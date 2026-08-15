"use client";

import Link from "next/link";
import { Tooltip } from "@/components/Tooltip";

type Props = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "gold" | "primary" | "hero";
  className?: string;
  type?: "button" | "submit";
  tipSide?: "top" | "bottom";
};

const variants = {
  default:
    "border-noor-200 text-noor-700 hover:bg-noor-50 dark:border-noor-600 dark:text-noor-200 dark:hover:bg-noor-800",
  gold:
    "border-gold-300 bg-gold-50 text-noor-800 hover:bg-gold-100 dark:border-gold-600 dark:bg-noor-800 dark:text-gold-400 dark:hover:bg-noor-700",
  primary:
    "border-noor-700 bg-noor-700 text-white hover:bg-noor-800 dark:border-noor-500 dark:bg-noor-600 dark:hover:bg-noor-500",
  /** For placement on the always-dark Salah hero, regardless of site theme. */
  hero: "border-transparent bg-white/15 text-white hover:bg-white/25",
};

const baseClass =
  "inline-flex h-11 min-h-11 min-w-11 items-center justify-center rounded-lg border px-2.5 text-base leading-none transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 sm:h-9 sm:min-h-0 sm:min-w-9 sm:px-2";

export function IconButton({
  icon,
  label,
  onClick,
  href,
  disabled,
  active,
  variant = "default",
  className = "",
  type = "button",
  tipSide = "bottom",
}: Props) {
  const cls = `${baseClass} ${
    active
      ? "border-noor-700 bg-noor-700 text-white dark:border-noor-500 dark:bg-noor-600"
      : variants[variant]
  } ${className}`;

  const inner = <span aria-hidden>{icon}</span>;

  if (href) {
    return (
      <Tooltip label={label} side={tipSide}>
        <Link href={href} aria-label={label} className={cls}>
          {inner}
        </Link>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={label} side={tipSide}>
      <button
        type={type}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={cls}
      >
        {inner}
      </button>
    </Tooltip>
  );
}

function svgIcon(path: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[1.2em] w-[1.2em]" aria-hidden>
      {path}
    </svg>
  );
}

export const Icons = {
  play: svgIcon(
    <path d="M8.5 5.6v12.8c0 1.2 1.3 1.9 2.3 1.3l10-6.4a1.5 1.5 0 0 0 0-2.6l-10-6.4c-1-.6-2.3.1-2.3 1.3Z" />,
  ),
  pause: svgIcon(
    <>
      <rect x="6" y="4.5" width="4.4" height="15" rx="1.8" />
      <rect x="13.6" y="4.5" width="4.4" height="15" rx="1.8" />
    </>,
  ),
  prevAyah: svgIcon(
    <>
      <rect x="5" y="5" width="2.6" height="14" rx="1.3" />
      <path d="M19 6.7v10.6c0 1.2-1.3 1.9-2.3 1.3l-8.3-5.3a1.5 1.5 0 0 1 0-2.6l8.3-5.3c1-.6 2.3.1 2.3 1.3Z" />
    </>,
  ),
  nextAyah: svgIcon(
    <>
      <path d="M5 6.7v10.6c0 1.2 1.3 1.9 2.3 1.3l8.3-5.3a1.5 1.5 0 0 0 0-2.6L7.3 5.4C6.3 4.8 5 5.5 5 6.7Z" />
      <rect x="16.4" y="5" width="2.6" height="14" rx="1.3" />
    </>,
  ),
  prevSurah: svgIcon(
    <>
      <path d="M11.5 7.2v9.6c0 1.1-1.2 1.8-2.2 1.2l-7-4.8a1.4 1.4 0 0 1 0-2.4l7-4.8c1-.6 2.2.1 2.2 1.2Z" />
      <path d="M21.5 7.2v9.6c0 1.1-1.2 1.8-2.2 1.2l-7-4.8a1.4 1.4 0 0 1 0-2.4l7-4.8c1-.6 2.2.1 2.2 1.2Z" />
    </>,
  ),
  nextSurah: svgIcon(
    <>
      <path d="M2.5 7.2v9.6c0 1.1 1.2 1.8 2.2 1.2l7-4.8a1.4 1.4 0 0 0 0-2.4l-7-4.8c-1-.6-2.2.1-2.2 1.2Z" />
      <path d="M12.5 7.2v9.6c0 1.1 1.2 1.8 2.2 1.2l7-4.8a1.4 1.4 0 0 0 0-2.4l-7-4.8c-1-.6-2.2.1-2.2 1.2Z" />
    </>,
  ),
  back: svgIcon(
    <path d="M13.8 5.3a1.2 1.2 0 0 1 0 1.7L9.9 11H19a1.2 1.2 0 0 1 0 2.4H9.9l3.9 4a1.2 1.2 0 1 1-1.7 1.6l-6-6a1.2 1.2 0 0 1 0-1.7l6-6a1.2 1.2 0 0 1 1.7 0Z" />,
  ),
  repeat: svgIcon(
    <>
      <path d="M7.5 7.2h9.2a3.3 3.3 0 0 1 3.3 3.3v1.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 4.8 19.8 7.4 16.5 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 16.8H7.3a3.3 3.3 0 0 1-3.3-3.3v-1.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 19.2 4.2 16.6 7.5 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  ),
  audioOpts: svgIcon(
    <>
      <path d="M4 7.5h9.5M17.5 7.5H20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="15.2" cy="7.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 16.5h3.5M11 16.5H20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8.8" cy="16.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
    </>,
  ),
  tafsir: "📜",
  book: "📖",
  ayah: "①",
  search: "🔍",
  share: svgIcon(
    <path d="M18 16.08a2.92 2.92 0 0 0-1.96.77l-7.13-4.15a2.6 2.6 0 0 0 0-1.4l7.05-4.11a3 3 0 1 0-.91-2.11 3 3 0 0 0 .09.7L8.04 9.81A3 3 0 1 0 6 15a2.92 2.92 0 0 0 2.04-.81l7.12 4.16a2.6 2.6 0 0 0-.08.65 2.92 2.92 0 1 0 2.92-2.92Z" />,
  ),
  camera: svgIcon(
    <>
      <path d="M8.6 5.4 7.4 7H4.5A1.5 1.5 0 0 0 3 8.5v9A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 19.5 7h-2.9l-1.2-1.6a1.5 1.5 0 0 0-1.2-.6h-4.4a1.5 1.5 0 0 0-1.2.6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>,
  ),
  mic: svgIcon(
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11v1a6 6 0 0 0 12 0v-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 18v3M9 21h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>,
  ),
} as const;
