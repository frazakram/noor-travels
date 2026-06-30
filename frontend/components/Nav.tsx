"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

  const linkClass = (href: string) =>
    `rounded-full px-3 py-1.5 text-sm transition ${
      pathname === href
        ? "bg-teal-700 text-white shadow-sm dark:bg-teal-600"
        : "text-body hover:bg-white/70 dark:hover:bg-slate-800/80"
    }`;

  return (
    <header
      className={`sticky top-0 z-50 border-b border-white/20 bg-white/80 backdrop-blur-md transition-shadow duration-300 dark:bg-slate-900/80 ${
        scrolled ? "shadow-md shadow-noor-950/10" : "shadow-none"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold text-heading">
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg object-contain"
            priority
          />
          <span className="hidden sm:inline">{t(lang, "appName")}</span>
        </Link>
        <nav className="hidden gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={linkClass(l.href)}
            >
              <span className="inline-flex items-center gap-1.5">
                {t(lang, l.key)}
                {l.key === "khutba" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
                )}
              </span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle variant="inline" />
          <div className="relative hidden rounded-full bg-slate-100 p-1 shadow-inner sm:flex dark:bg-slate-800">
            <span
              className="absolute bottom-1 top-1 rounded-full bg-teal-700 shadow-sm transition-transform duration-200 dark:bg-teal-500"
              style={{
                width: "2rem",
                transform: `translateX(${(["en", "ur", "hi"] as Lang[]).indexOf(lang) * 2}rem)`,
              }}
            />
            {(["en", "ur", "hi"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`relative z-10 w-8 rounded-full py-1 text-xs font-semibold uppercase transition ${
                  lang === l ? "text-white" : "text-slate-500 dark:text-slate-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm md:hidden"
            aria-label="Open navigation menu"
            aria-expanded={open}
          >
            <span className="sr-only">Menu</span>
            <span className="relative h-3.5 w-4">
              <span className={`absolute left-0 top-0 h-0.5 w-4 rounded-full bg-current transition ${open ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`absolute left-0 top-1.5 h-0.5 w-4 rounded-full bg-current transition ${open ? "opacity-0" : ""}`} />
              <span className={`absolute bottom-0 left-0 h-0.5 w-4 rounded-full bg-current transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-x-0 top-[65px] z-50 h-[calc(100vh-65px)] border-t border-white/20 bg-white/95 p-4 shadow-xl backdrop-blur-md md:hidden dark:bg-slate-950/95">
          <nav className="grid gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-2xl px-4 py-4 text-base font-semibold transition ${
                  pathname === l.href
                    ? "bg-teal-700 text-white dark:bg-teal-600"
                    : "bg-slate-50 text-body hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {t(lang, l.key)}
                  {l.key === "khutba" && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                </span>
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            {(["en", "ur", "hi"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 rounded-full py-2 text-xs font-semibold uppercase transition ${
                  lang === l ? "bg-teal-700 text-white" : "text-slate-500 dark:text-slate-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
