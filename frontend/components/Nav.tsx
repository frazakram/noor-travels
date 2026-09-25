"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppLogo } from "@/components/AppLogo";
import { useLang } from "@/components/LangProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AUTH_CHANGED_EVENT, getUser } from "@/lib/auth";
import { t, type Lang } from "@/lib/i18n";
import { NAV_TABS, isTabActive } from "@/lib/nav";

function AccountButton() {
  const { lang } = useLang();
  const [initial, setInitial] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const refresh = () => {
      const u = getUser();
      setInitial(u ? (u.name || u.email)[0]?.toUpperCase() ?? null : null);
    };
    refresh();
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
  }, []);

  // Avoid flash of login CTA before auth hydrates
  if (initial === undefined) {
    return <span className="inline-block h-8 w-20 shrink-0" aria-hidden />;
  }

  if (initial) {
    return (
      <Link
        href="/account"
        prefetch={false}
        aria-label={t(lang, "account")}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:scale-105"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-noor-700 text-sm font-semibold text-white dark:bg-noor-600">
          {initial}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/account"
      prefetch={false}
      aria-label={t(lang, "authLoginSignup")}
      className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-subtle px-3 py-1.5 text-[11px] font-medium text-heading transition hover:border-noor-300 sm:px-3.5 sm:text-xs"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 opacity-90 transition group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l5-5-5-5M15 12H3" />
      </svg>
      <span className="whitespace-nowrap">{t(lang, "authLoginSignup")}</span>
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const pickLang = useCallback(
    (next: Lang) => {
      if (next !== lang) setLang(next);
    },
    [lang, setLang],
  );

  const linkClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm transition-colors ${
      active
        ? "bg-noor-50 font-medium text-noor-800 dark:bg-noor-800 dark:text-gold-200"
        : "text-muted hover:text-heading"
    }`;

  return (
    <>
      <header
        dir="ltr"
        className={`sticky top-0 z-50 border-b border-subtle bg-white/95 pt-safe md:backdrop-blur-md transition-shadow duration-300 dark:bg-noor-950/95 ${
          scrolled ? "shadow-sm" : "shadow-none"
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
          <nav className="hidden gap-1 md:flex" aria-label={t(lang, "mainNavigation")}>
            {NAV_TABS.map((tab) => {
              const active = isTabActive(pathname, tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={linkClass(active)}
                >
                  {t(lang, tab.key)}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2" dir="ltr">
            <AccountButton />
            <ThemeToggle variant="inline" />
            <div className="hidden rounded-full bg-slate-100 p-0.5 sm:flex dark:bg-slate-800">
              {(["en", "ur", "hi"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => pickLang(l)}
                  className={`min-w-8 rounded-full px-2 py-1 text-xs font-semibold uppercase transition ${
                    lang === l
                      ? "bg-white text-heading shadow-sm dark:bg-noor-700"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
