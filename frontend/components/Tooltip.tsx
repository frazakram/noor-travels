"use client";

import type { ReactNode } from "react";

type TipSide = "top" | "bottom";

type Props = {
  label: string;
  side?: TipSide;
  children: ReactNode;
  className?: string;
};

const sideClass: Record<TipSide, string> = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
};

/** Instant tooltip — no native `title` delay. */
export function Tooltip({ label, side = "top", children, className = "" }: Props) {
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[60] whitespace-nowrap rounded-md bg-noor-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity duration-75 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 dark:bg-noor-700 ${sideClass[side]}`}
      >
        {label}
      </span>
    </span>
  );
}
