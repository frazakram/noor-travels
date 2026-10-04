/**
 * Offline pack: the Quran (all 114 surah pages, plus the reader's translation when it isn't
 * English), duas and adhkar, saved for use without a connection. The service worker
 * (public/sw.js) serves these when the network fails; prayer times need no pack, they are
 * calculated on the device (lib/salah-offline.ts).
 *
 * Measured on a production build: 144 files, 28 MB in English (each surah page carries its
 * text twice, as HTML and as the page's own data); a second translation adds ~10 MB.
 * Word-by-word data (4.7 MB) is left out: it only drives audio highlighting, and audio
 * streams online.
 */

export const OFFLINE_CACHE = "noor-offline-v1"; // must match OFFLINE in public/sw.js
/** Same base the app's API calls use (lib/api.ts); empty in production = same origin. */
const API = process.env.NEXT_PUBLIC_API_URL || "";
const STATUS_KEY = "noor-offline-pack";
const SURAHS = 114;
const CONCURRENCY = 4;

export type PackTranslation = "en" | "ur" | "hi";
export type PackStatus = { savedAt: string; bytes: number; translation: PackTranslation; files: number };
export type PackProgress = { done: number; total: number; bytes: number };

/** Rough size before downloading, from measured averages. */
export function estimatedMB(translation: PackTranslation): number {
  return translation === "en" ? 28 : 38;
}

/** Every URL the pack saves (pages first; their build assets are found while saving them). */
export function packUrls(translation: PackTranslation): string[] {
  const pages = ["/quran", "/hadith", "/adhkar", ...Array.from({ length: SURAHS }, (_, i) => `/quran/${i + 1}`)];
  const data = ["/api/quran/surahs", "/api/duas/", "/api/adhkar/"];
  if (translation !== "en") {
    for (let n = 1; n <= SURAHS; n++) data.push(`/api/quran/surahs/${n}?translation=${translation}`);
  }
  return [...pages, ...data.map((path) => `${API}${path}`)];
}

/** Build assets a saved page needs to run: its scripts, styles and fonts. */
export function assetsIn(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?#]+)"/g)) found.add(m[1]);
  return [...found];
}

export function readPackStatus(): PackStatus | null {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as PackStatus) : null;
  } catch {
    return null;
  }
}

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window && "serviceWorker" in navigator;
}

/**
 * Downloads the pack into Cache Storage. A failed file aborts the whole download (a pack with
 * holes would fail later, offline, where it can't be fixed); files already saved stay and are
 * simply overwritten by the next attempt.
 */
export async function downloadPack(
  translation: PackTranslation,
  onProgress: (p: PackProgress) => void,
  signal?: AbortSignal,
): Promise<PackStatus> {
  const cache = await caches.open(OFFLINE_CACHE);
  const queue = packUrls(translation);
  const seenAssets = new Set<string>();
  let done = 0;
  let bytes = 0;
  let total = queue.length;

  async function save(url: string) {
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const body = await res.clone().arrayBuffer();
    bytes += body.byteLength;
    await cache.put(url, res);
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("text/html")) {
      for (const asset of assetsIn(new TextDecoder().decode(body))) {
        if (!seenAssets.has(asset)) {
          seenAssets.add(asset);
          queue.push(asset);
          total += 1;
        }
      }
    }
    done += 1;
    onProgress({ done, total, bytes });
  }

  let next = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (next < queue.length) {
      if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
      await save(queue[next++]);
    }
  });
  await Promise.all(workers);

  const status: PackStatus = { savedAt: new Date().toISOString(), bytes, translation, files: done };
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify(status));
  } catch {
    /* status is a convenience; the files themselves are saved */
  }
  return status;
}

export async function removePack(): Promise<void> {
  await caches.delete(OFFLINE_CACHE);
  try {
    localStorage.removeItem(STATUS_KEY);
  } catch {
    /* ignore */
  }
}
