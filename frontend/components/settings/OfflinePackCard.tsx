"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";
import {
  downloadPack,
  estimatedMB,
  offlineSupported,
  readPackStatus,
  removePack,
  type PackProgress,
  type PackStatus,
  type PackTranslation,
} from "@/lib/offline-pack";

type State = { kind: "idle" } | { kind: "downloading"; progress: PackProgress } | { kind: "failed" };

/** Settings: save the Quran, duas and adhkar for use without a connection. */
export function OfflinePackCard() {
  const { lang } = useLang();
  const translation: PackTranslation = lang === "ur" || lang === "hi" ? lang : "en";
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setSupported(offlineSupported());
    setStatus(readPackStatus());
    return () => abort.current?.abort();
  }, []);

  async function start() {
    abort.current = new AbortController();
    setState({ kind: "downloading", progress: { done: 0, total: 1, bytes: 0 } });
    try {
      const saved = await downloadPack(translation, (progress) => setState({ kind: "downloading", progress }), abort.current.signal);
      setStatus(saved);
      setState({ kind: "idle" });
    } catch (err) {
      setState(err instanceof DOMException && err.name === "AbortError" ? { kind: "idle" } : { kind: "failed" });
    }
  }

  async function remove() {
    await removePack();
    setStatus(null);
  }

  const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1);
  const stale = status && status.translation !== translation;

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-heading">{t(lang, "offlineTitle")}</h2>
        <p className="mt-1 text-xs text-muted">{t(lang, "offlineIntro")}</p>
      </div>

      {!supported && <p className="text-xs text-muted">{t(lang, "offlineUnsupported")}</p>}

      {supported && state.kind === "downloading" && (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-noor-100 dark:bg-noor-800">
            <div
              className="h-full rounded-full bg-noor-600 transition-[width] duration-300 dark:bg-noor-400"
              style={{ width: `${Math.round((state.progress.done / Math.max(1, state.progress.total)) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {t(lang, "offlineDownloading")} · {mb(state.progress.bytes)} MB
            </span>
            <button type="button" onClick={() => abort.current?.abort()} className="font-medium text-accent">
              {t(lang, "feedbackCancel")}
            </button>
          </div>
        </div>
      )}

      {supported && state.kind !== "downloading" && (
        <>
          {status ? (
            <p className="text-xs text-body">
              ✓ {t(lang, "offlineReady")} · {mb(status.bytes)} MB · {new Date(status.savedAt).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-xs text-muted">{t(lang, "offlineSize").replace("{mb}", String(estimatedMB(translation)))}</p>
          )}
          {stale && <p className="text-xs text-muted">{t(lang, "offlineLanguageChanged")}</p>}
          {state.kind === "failed" && <p className="text-xs text-red-600 dark:text-red-400">{t(lang, "offlineFailed")}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void start()} className="btn-primary px-4 py-2 text-sm">
              {status ? t(lang, "offlineUpdate") : state.kind === "failed" ? t(lang, "tryAgain") : t(lang, "offlineDownload")}
            </button>
            {status && (
              <button type="button" onClick={() => void remove()} className="rounded-xl border border-subtle px-4 py-2 text-sm text-muted">
                {t(lang, "offlineRemove")}
              </button>
            )}
          </div>
          <p className="text-[11px] text-faint">{t(lang, "offlinePrayerNote")}</p>
        </>
      )}
    </section>
  );
}
