"use client";

import Link from "next/link";
import { Tooltip } from "@/components/Tooltip";

type Props = {
  icon: string;
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

export const Icons = {
  play: "▶",
  pause: "⏸",
  prevAyah: "⏮",
  nextAyah: "⏭",
  prevSurah: "◀◀",
  nextSurah: "▶▶",
  repeat: "🔁",
  tafsir: "📜",
  book: "📖",
  ayah: "①",
  back: "←",
  search: "🔍",
} as const;
