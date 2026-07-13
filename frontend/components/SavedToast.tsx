"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  label: string;
  onDone?: () => void;
  /** How long the toast stays visible */
  durationMs?: number;
};

/**
 * Compact Apple-style confirmation HUD, themed for Noor (teal/gold).
 * Centered, auto-dismisses; no interaction required.
 */
export function SavedToast({ open, label, onDone, durationMs = 1400 }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), durationMs);
    const done = window.setTimeout(() => onDoneRef.current?.(), durationMs + 220);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(done);
    };
  }, [open, durationMs]);

  if (!mounted || (!open && !visible)) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center px-6"
      aria-live="polite"
      role="status"
    >
      <div
        className={`flex min-w-[7.5rem] flex-col items-center gap-2 rounded-[1.35rem] border border-white/20 bg-noor-900/92 px-7 py-5 text-white shadow-2xl shadow-noor-950/40 backdrop-blur-xl transition-all duration-200 dark:border-white/10 dark:bg-black/80 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-noor-600 shadow-inner shadow-white/10">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className="text-sm font-semibold tracking-wide text-white/95">{label}</span>
      </div>
    </div>,
    document.body,
  );
}
