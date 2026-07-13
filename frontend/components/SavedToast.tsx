"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  label: string;
  onDone?: () => void;
  durationMs?: number;
};

/**
 * Apple-style confirmation HUD — always a solid dark frosted card with white
 * label so it stays readable in both light and dark app themes.
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
        className={`flex min-w-[8rem] flex-col items-center gap-2.5 rounded-[1.35rem] border border-white/25 bg-[#0d221f] px-8 py-5 text-white shadow-[0_20px_50px_rgba(13,34,31,0.45)] backdrop-blur-xl transition-all duration-200 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-white shadow-inner">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className="text-[15px] font-bold tracking-wide text-white">{label}</span>
      </div>
    </div>,
    document.body,
  );
}
