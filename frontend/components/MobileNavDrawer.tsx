"use client";

import Link from "next/link";
import { memo, useCallback } from "react";
import { createPortal } from "react-dom";
import { t, type Lang } from "@/lib/i18n";

const links = [
  { href: "/", key: "home" as const },
  { href: "/quran", key: "quran" as const },
  { href: "/learn-quran", key: "learnQuran" as const },
  { href: "/hadith", key: "hadith" as const },
  { href: "/library", key: "questionLibrary" as const },
  { href: "/duas", key: "duas" as const },
  { href: "/khutba", key: "khutba" as const },
  { href: "/recite", key: "recite" as const },
  { href: "/settings", key: "settings" as const },
];

type Props = {
  open: boolean;
  mounted: boolean;
  pathname: string;
  lang: Lang;
  setLang: (l: Lang) => void;
  onClose: () => void;
};

function MobileNavDrawerInner({ open, mounted, pathname, lang, setLang, onClose }: Props) {
  const pickLang = useCallback(
    (next: Lang) => {
      if (next !== lang) setLang(next);
    },
    [lang, setLang],
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] md:hidden transition-opacity duration-150 ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label="Navigation menu"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/92 backdrop-blur-[2px]"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 top-safe-header overflow-y-auto border-t border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <nav className="grid gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={onClose}
              className={`relative z-[1] block min-h-12 rounded-2xl px-4 py-3.5 text-base font-semibold transition active:scale-[0.98] ${
                pathname === l.href
                  ? "bg-teal-700 text-white dark:bg-teal-600"
                  : "bg-slate-100 text-body dark:bg-slate-900"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {t(lang, l.key)}
                {l.key === "khutba" && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
              </span>
            </Link>
          ))}
        </nav>
        <div className="relative z-[1] mt-5 flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {(["en", "ur", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                pickLang(l);
              }}
              className={`min-h-11 flex-1 rounded-full py-2 text-xs font-semibold uppercase transition ${
                lang === l ? "bg-teal-700 text-white" : "text-slate-500 dark:text-slate-300"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const MobileNavDrawer = memo(MobileNavDrawerInner);
