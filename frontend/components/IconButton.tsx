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
  variant?: "default" | "gold" | "primary";
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
  repeat: "🔁",
  tafsir: "📜",
  book: "📖",
  ayah: "①",
  search: "🔍",
} as const;
