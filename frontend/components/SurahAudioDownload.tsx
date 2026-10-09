"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { nativeSupportsOfflineAudio } from "@/lib/native-bridge";
import {
  cancelSurahDownload,
  downloadKey,
  readDownloadStates,
  removeSurahDownload,
  startSurahDownload,
  trLangFor,
  type AudioDownloadState,
} from "@/lib/offline-audio";
import { t } from "@/lib/i18n";

const POLL_MS = 700;

/**
 * Reader audio options: save this surah's recitation (and translation audio) on the phone.
 * Android APK 1.8+ only — the browser can't read the audio CDNs, and older APKs lack the
 * bridge — so it renders nothing elsewhere.
 */
export function SurahAudioDownload({
  surahNumber,
  reciter,
  translation,
}: {
  surahNumber: number;
  reciter: string;
  translation: string;
}) {
  const { lang } = useLang();
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<AudioDownloadState | undefined>();
  const [startError, setStartError] = useState(false);

  // Translation audio is part of the download; Hindi has no recording, so it is left out.
  const tr = trLangFor(true, translation);
  const key = downloadKey(surahNumber, reciter, tr);

  useEffect(() => {
    setSupported(nativeSupportsOfflineAudio());
  }, []);

  useEffect(() => {
    if (!supported) return;
    setStartError(false);
    const read = () => setState(readDownloadStates()[key]);
    read();
    const id = window.setInterval(read, POLL_MS);
    return () => window.clearInterval(id);
  }, [supported, key]);

  if (!supported) return null;

  async function save() {
    setStartError(false);
    try {
      if (!(await startSurahDownload(surahNumber, reciter, tr))) setStartError(true);
    } catch {
      setStartError(true);
    }
  }

  const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1);
  const failed = startError || state?.state === "failed";

  return (
    <div className="space-y-1.5 border-t border-subtle pt-2" role="group" aria-label={t(lang, "audioOfflineTitle")}>
      <p className="text-xs font-medium text-heading">{t(lang, "audioOfflineTitle")}</p>

      {state?.state === "downloading" ? (
        <div className="space-y-1.5" role="status" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-noor-100 dark:bg-noor-800">
            <div
              className="h-full rounded-full bg-noor-600 transition-[width] duration-300 dark:bg-noor-400"
              style={{ width: `${Math.round((state.done / Math.max(1, state.total)) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              {t(lang, "audioOfflineSaving").replace("{done}", String(state.done)).replace("{total}", String(state.total))}
              {" · "}
              {mb(state.bytes)} MB
            </span>
            <button type="button" onClick={() => cancelSurahDownload(key)} className="font-medium text-accent">
              {t(lang, "feedbackCancel")}
            </button>
          </div>
        </div>
      ) : state?.state === "saved" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-body">
            ✓ {t(lang, "audioOfflineSaved").replace("{mb}", mb(state.bytes))}
          </span>
          <button type="button" onClick={() => void removeSurahDownload(key)} className="font-medium text-muted underline">
            {t(lang, "offlineRemove")}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted">{t(lang, "audioOfflineIntro")}</p>
          {translation === "hi" && <p className="text-[11px] text-muted">{t(lang, "audioOfflineHindiNote")}</p>}
          {failed && (
            <p className="text-[11px] text-red-600 dark:text-red-400">
              {t(lang, state?.error === "space" ? "audioOfflineNoSpace" : "audioOfflineFailed")}
            </p>
          )}
          <button type="button" onClick={() => void save()} className="rounded-md border border-noor-200 px-3 py-1 text-xs font-medium text-body dark:border-noor-600">
            {failed ? t(lang, "tryAgain") : t(lang, "audioOfflineSave")}
          </button>
        </div>
      )}
    </div>
  );
}
