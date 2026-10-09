"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLang } from "@/components/LangProvider";
import { nativeSupportsOfflineAudio } from "@/lib/native-bridge";
import {
  cancelSurahDownload,
  downloadKey,
  getDownloadStatesSnapshot,
  getServerDownloadStates,
  subscribeDownloadStates,
  removeSurahDownload,
  startSurahDownload,
  trLangFor,
  type AudioDownloadState,
} from "@/lib/offline-audio";
import { t } from "@/lib/i18n";


const noopSubscribe = () => () => {};

/** Download state for one surah + reciter + spoken language, polled from the native side. */
export function useSurahAudioDownload(surahNumber: number, reciter: string, translation: string) {
  const [supported, setSupported] = useState(false);
  const [startError, setStartError] = useState(false);

  // Translation audio is part of the download; Hindi has no recording, so it is left out.
  const tr = trLangFor(true, translation);
  const key = downloadKey(surahNumber, reciter, tr);

  useEffect(() => {
    setSupported(nativeSupportsOfflineAudio());
  }, []);

  const states = useSyncExternalStore(
    supported ? subscribeDownloadStates : noopSubscribe,
    getDownloadStatesSnapshot,
    getServerDownloadStates,
  );
  const state: AudioDownloadState | undefined = supported ? states[key] : undefined;

  useEffect(() => setStartError(false), [key]);

  async function save() {
    setStartError(false);
    try {
      if (!(await startSurahDownload(surahNumber, reciter, tr))) setStartError(true);
    } catch {
      setStartError(true);
    }
  }

  return {
    supported,
    state,
    failed: startError || state?.state === "failed",
    save,
    cancel: () => cancelSurahDownload(key),
    remove: () => removeSurahDownload(key),
  };
}

const ICON_DOWNLOAD = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
  </svg>
);

/**
 * Compact control beside the surah name so the feature is discoverable without opening the
 * audio options: tap to save, shows progress while saving, and opens the options (where Remove
 * lives) once saved. Renders nothing outside APK 1.8+.
 */
export function SurahAudioDownloadButton({
  surahNumber,
  reciter,
  translation,
  onOpenOptions,
}: {
  surahNumber: number;
  reciter: string;
  translation: string;
  onOpenOptions: () => void;
}) {
  const { lang } = useLang();
  const dl = useSurahAudioDownload(surahNumber, reciter, translation);
  if (!dl.supported) return null;

  const base =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap";
  const idle = "border-noor-200 text-noor-700 hover:bg-noor-50 dark:border-noor-600 dark:text-noor-200 dark:hover:bg-noor-800";

  if (dl.state?.state === "downloading") {
    const pct = Math.round((dl.state.done / Math.max(1, dl.state.total)) * 100);
    return (
      <button type="button" onClick={dl.cancel} className={`${base} ${idle}`} aria-live="polite" title={t(lang, "feedbackCancel")}>
        <span className="tabular-nums">{pct}%</span>
        <span className="text-faint">· {t(lang, "feedbackCancel")}</span>
      </button>
    );
  }
  if (dl.state?.state === "saved") {
    return (
      <button type="button" onClick={onOpenOptions} className={`${base} border-noor-700 bg-noor-700 text-white dark:border-noor-500 dark:bg-noor-600`}>
        ✓ {t(lang, "audioOfflineSavedShort")}
      </button>
    );
  }
  return (
    <button type="button" onClick={() => void dl.save()} className={`${base} ${idle}`} title={t(lang, "audioOfflineSave")}>
      {ICON_DOWNLOAD}
      {dl.failed ? t(lang, "tryAgain") : t(lang, "audioOfflineShort")}
    </button>
  );
}

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
  const dl = useSurahAudioDownload(surahNumber, reciter, translation);
  if (!dl.supported) return null;
  const { state, failed } = dl;

  const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1);

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
            <button type="button" onClick={dl.cancel} className="font-medium text-accent">
              {t(lang, "feedbackCancel")}
            </button>
          </div>
        </div>
      ) : state?.state === "saved" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-body">
            ✓ {t(lang, "audioOfflineSaved").replace("{mb}", mb(state.bytes))}
          </span>
          <button type="button" onClick={() => void dl.remove()} className="font-medium text-muted underline">
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
          <button type="button" onClick={() => void dl.save()} className="rounded-md border border-noor-200 px-3 py-1 text-xs font-medium text-body dark:border-noor-600">
            {failed ? t(lang, "tryAgain") : t(lang, "audioOfflineSave")}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Per-row control in the surah list. Tap to save; shows progress while saving (tap to cancel);
 * a filled check once saved (tap, then confirm, to remove). Renders nothing outside APK 1.8+.
 */
export function SurahListDownload({
  surahNumber,
  reciter,
  translation,
}: {
  surahNumber: number;
  reciter: string;
  translation: string;
}) {
  const { lang } = useLang();
  const dl = useSurahAudioDownload(surahNumber, reciter, translation);
  if (!dl.supported) return null;

  const base =
    "flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full border px-2 text-xs font-semibold tabular-nums";
  const idle = "border-noor-200 text-noor-700 hover:bg-noor-50 dark:border-noor-600 dark:text-noor-200 dark:hover:bg-noor-800";

  let label = t(lang, "audioOfflineSave");
  let onClick: () => void = () => void dl.save();
  let className = `${base} ${idle}`;
  let content: React.ReactNode = ICON_DOWNLOAD;

  if (dl.state?.state === "downloading") {
    const pct = Math.round((dl.state.done / Math.max(1, dl.state.total)) * 100);
    label = t(lang, "feedbackCancel");
    onClick = dl.cancel;
    content = `${pct}%`;
  } else if (dl.state?.state === "saved") {
    label = t(lang, "offlineRemove");
    onClick = () => {
      if (window.confirm(t(lang, "audioOfflineRemoveAsk"))) void dl.remove();
    };
    className = `${base} border-noor-700 bg-noor-700 text-white dark:border-noor-500 dark:bg-noor-600`;
    content = "✓";
  } else if (dl.failed) {
    label = t(lang, "tryAgain");
    className = `${base} border-red-300 text-red-700 dark:border-red-500 dark:text-red-300`;
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label} title={label}>
      {content}
    </button>
  );
}

/** One line above the list explaining the per-row buttons. Renders nothing outside APK 1.8+. */
export function SurahListOfflineHint() {
  const { lang } = useLang();
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(nativeSupportsOfflineAudio()), []);
  if (!supported) return null;
  return <p className="text-xs text-muted">{t(lang, "audioOfflineListHint")}</p>;
}
