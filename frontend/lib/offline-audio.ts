/**
 * Offline surah audio (Android APK only). Recitation and translation clips are saved by the
 * native side (QuranAudioStore.kt), which plays the saved copy of any queue URL on its own.
 * This module decides what a download contains and keeps the surah's audio manifest (the
 * backend's /api/quran/audio/surahs response) in IndexedDB, because without the network the
 * reader can't ask the backend which clips belong to the surah.
 */
import { api } from "@/lib/api";
import {
  audioUrlsOf,
  downloadKey,
  lookupKeys,
  type AudioDownloadState,
  type AudioManifest,
  type TrLang,
} from "@/lib/offline-audio-keys";
import {
  nativeCancelQuranAudio,
  nativeDeleteQuranAudio,
  nativeDownloadQuranAudio,
  nativeQuranAudioStatus,
} from "@/lib/native-bridge";

// --- manifest storage ---

const DB_NAME = "noor-offline-audio";
const STORE = "manifests";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadSavedManifest(surah: number, reciter: string, tr: TrLang): Promise<AudioManifest | null> {
  try {
    const status = nativeQuranAudioStatus();
    for (const key of lookupKeys(surah, reciter, tr)) {
      // Only trust a manifest whose files finished downloading.
      if (status?.[key]?.state !== "saved") continue;
      const m = await withStore<AudioManifest | undefined>("readonly", (s) => s.get(key));
      if (m?.ayahs?.length) return m;
    }
  } catch {
    /* IndexedDB unavailable — behave as not saved */
  }
  return null;
}

// --- download control ---

/** Fetches the surah's manifest, stores it, and hands its clips to the native downloader. */
export async function startSurahDownload(surah: number, reciter: string, tr: TrLang): Promise<boolean> {
  const trParam = tr === "none" ? "" : `&translation_lang=${tr}`;
  const manifest = await api<AudioManifest>(
    `/api/quran/audio/surahs/${surah}?reciter=${encodeURIComponent(reciter)}${trParam}`,
  );
  const urls = audioUrlsOf(manifest);
  if (!urls.length) return false;
  const key = downloadKey(surah, reciter, tr);
  await withStore("readwrite", (s) => s.put(manifest, key));
  return nativeDownloadQuranAudio(key, urls);
}

export async function removeSurahDownload(key: string): Promise<void> {
  nativeDeleteQuranAudio(key);
  try {
    await withStore("readwrite", (s) => s.delete(key));
  } catch {
    /* nothing to remove */
  }
}

export function cancelSurahDownload(key: string): void {
  nativeCancelQuranAudio(key);
}

export function readDownloadStates(): Record<string, AudioDownloadState> {
  return nativeQuranAudioStatus() ?? {};
}

export { downloadKey, trLangFor } from "@/lib/offline-audio-keys";
export type { AudioDownloadState, AudioManifest, TrLang } from "@/lib/offline-audio-keys";
