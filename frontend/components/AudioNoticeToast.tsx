"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

/**
 * Non-blocking "this clip was skipped" notice — bottom-of-screen so it never
 * interrupts reading, auto-dismisses on its own. Used when a reciter or
 * translation audio clip fails to load: the user asked to be told explicitly
 * rather than have it silently replaced with synthesized speech.
 */
export function AudioNoticeToast({ message, onDismiss, durationMs = 4000 }: Props) {
  const { lang } = useLang();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), durationMs);
    const done = window.setTimeout(() => onDismissRef.current(), durationMs + 220);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(done);
    };
  }, [message, durationMs]);

  if (!mounted || !message) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[250] flex justify-center px-4"
      aria-live="polite"
      role="status"
    >
      <div
        className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-2xl border border-gold-300 bg-white px-4 py-3 shadow-lg transition-all duration-200 dark:border-gold-600 dark:bg-noor-900 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <span className="mt-0.5 shrink-0 text-gold-600 dark:text-gold-400" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 004 21h16a2 2 0 001.89-2.96L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </span>
        <p className="text-sm text-body">{message}</p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label={t(lang, "dismiss")}
          className="ml-auto shrink-0 text-faint hover:text-heading"
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
