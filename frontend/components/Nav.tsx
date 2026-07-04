"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppLogo } from "@/components/AppLogo";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { useLang } from "@/components/LangProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AUTH_CHANGED_EVENT, getUser } from "@/lib/auth";
import { t, type Lang } from "@/lib/i18n";

const links = [
  { href: "/", key: "home" as const },
  { href: "/quran", key: "quran" as const },
  { href: "/learn-quran", key: "learnQuran" as const },
  { href: "/hadith", key: "hadith" as const },
  { href: "/library", key: "questionLibrary" as const },
  { href: "/duas", key: "duas" as const },
  { href: "/khutba", key: "khutba" as const },
];

function AccountButton() {
  const { lang } = useLang();
  const [initial, setInitial] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const u = getUser();
      setInitial(u ? (u.name || u.email)[0]?.toUpperCase() ?? null : null);
    };
    refresh();
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
  }, []);

  return (
    <Link
      href="/account"
      aria-label={t(lang, "account")}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:scale-105"
    >
      {initial ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white shadow-sm">
          {initial}
        </span>
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-subtle bg-white/70 text-slate-500 dark:bg-slate-800/70 dark:text-slate-300">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="8.2" r="3.4" />
            <path d="M5 19.4c1.3-3 4-4.6 7-4.6s5.7 1.6 7 4.6" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </Link>
  );
}

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
    const root = document.documentElement;
    if (open) {
      root.classList.add("noor-nav-open");
      document.body.style.overflow = "hidden";
    } else {
      root.classList.remove("noor-nav-open");
      document.body.style.overflow = "";
    }
    return () => {
      root.classList.remove("noor-nav-open");
      document.body.style.overflow = "";
    };
  }, [open]);

  const pickLang = useCallback(
    (next: Lang) => {
      if (next !== lang) setLang(next);
    },
    [lang, setLang],
  );

  const linkClass = (href: string) =>
    `rounded-full px-3 py-1.5 text-sm transition ${
      pathname === href
        ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
        : "text-body hover:bg-white/70 dark:hover:bg-slate-800/80"
    }`;

  return (
    <>
      <header
        dir="ltr"
        className={`sticky top-0 z-50 border-b border-white/20 bg-white/95 pt-safe backdrop-blur-md transition-shadow duration-300 dark:bg-slate-900/95 ${
          scrolled ? "shadow-md shadow-noor-950/10" : "shadow-none"
        }`}
      >
        <div className="mx-auto flex min-h-12 max-w-5xl items-center justify-between gap-2 px-3 py-1 sm:gap-4 sm:px-4 sm:py-2">
          <Link
            href="/"
            className="flex min-h-10 shrink-0 items-center gap-2 font-semibold text-heading"
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
            <AccountButton />
            <ThemeToggle variant="inline" />
            <div className="hidden rounded-full bg-slate-100 p-1 shadow-inner sm:flex dark:bg-slate-800">
              {(["en", "ur", "hi"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => pickLang(l)}
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
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm active:scale-95 md:hidden"
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
      <MobileNavDrawer
        open={open}
        mounted={mounted}
        pathname={pathname}
        lang={lang}
        setLang={setLang}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
