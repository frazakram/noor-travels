"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AppLogo } from "@/components/AppLogo";
import { useLang } from "@/components/LangProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { t, type Lang } from "@/lib/i18n";

const links = [
  { href: "/", key: "home" as const },
  { href: "/quran", key: "quran" as const },
  { href: "/hadith", key: "hadith" as const },
  { href: "/duas", key: "duas" as const },
  { href: "/khutba", key: "khutba" as const },
];

export function Nav() {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const linkClass = (href: string) =>
    `rounded-full px-3 py-1.5 text-sm transition ${
      pathname === href
        ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
        : "text-body hover:bg-white/70 dark:hover:bg-slate-800/80"
    }`;

  const mobileMenu =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[200] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/55"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 top-safe-header overflow-y-auto border-t border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
              <nav className="grid gap-2">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
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
                    onClick={() => setLang(l)}
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
        )
      : null;

  return (
    <>
      <header
        dir="ltr"
        className={`sticky top-0 z-50 border-b border-white/20 bg-white/95 pt-safe backdrop-blur-md transition-shadow duration-300 dark:bg-slate-900/95 ${
          scrolled ? "shadow-md shadow-noor-950/10" : "shadow-none"
        }`}
      >
        <div className="mx-auto flex min-h-14 max-w-5xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
          <Link
            href="/"
            className="flex min-h-11 shrink-0 items-center gap-2 font-semibold text-heading"
            aria-label={t(lang, "appName")}
          >
            <AppLogo />
            <span className="max-w-[7rem] truncate text-sm leading-tight sm:max-w-none sm:text-base">{t(lang, "appName")}</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                <span className="inline-flex items-center gap-1.5">
                  {t(lang, l.key)}
                  {l.key === "khutba" && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                  )}
                </span>
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2" dir="ltr">
            <ThemeToggle variant="inline" />
            <div className="hidden rounded-full bg-slate-100 p-1 shadow-inner sm:flex dark:bg-slate-800">
              {(["en", "ur", "hi"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`min-w-8 rounded-full px-2 py-1 text-xs font-semibold uppercase transition ${
                    lang === l
                      ? "bg-teal-700 text-white shadow-sm dark:bg-teal-500"
                      : "text-slate-500 dark:text-slate-300"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm active:scale-95 md:hidden"
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={open}
            >
              <span className="sr-only">Menu</span>
              <span className="relative h-3.5 w-4">
                <span
                  className={`absolute left-0 top-0 h-0.5 w-4 rounded-full bg-current transition ${open ? "translate-y-1.5 rotate-45" : ""}`}
                />
                <span
                  className={`absolute left-0 top-1.5 h-0.5 w-4 rounded-full bg-current transition ${open ? "opacity-0" : ""}`}
                />
                <span
                  className={`absolute bottom-0 left-0 h-0.5 w-4 rounded-full bg-current transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>
      {mobileMenu}
    </>
  );
}
