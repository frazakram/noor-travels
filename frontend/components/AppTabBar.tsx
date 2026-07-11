"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useChat } from "@/components/ChatProvider";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

type IconName =
  | "home"
  | "quran"
  | "learn"
  | "hadith"
  | "library"
  | "duas"
  | "khutba"
  | "settings"
  | "account";

const primary = [
  { href: "/", key: "home" as const, icon: "home" as const },
  { href: "/quran", key: "quran" as const, icon: "quran" as const },
  { href: "/learn-quran", key: "learnQuran" as const, icon: "learn" as const },
  { href: "/hadith", key: "hadith" as const, icon: "hadith" as const },
];

const moreLinks = [
  { href: "/library", key: "questionLibrary" as const, icon: "library" as const },
  { href: "/duas", key: "duas" as const, icon: "duas" as const },
  { href: "/khutba", key: "khutba" as const, icon: "khutba" as const },
  { href: "/settings", key: "settings" as const, icon: "settings" as const },
  { href: "/account", key: "account" as const, icon: "account" as const },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function moveGlassReflection(event: ReactPointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  event.currentTarget.style.setProperty("--glass-x", `${Math.max(0, Math.min(100, x))}%`);
  event.currentTarget.style.setProperty("--glass-y", `${Math.max(0, Math.min(100, y))}%`);
  event.currentTarget.style.setProperty("--glass-intensity", "1");
}

function resetGlassReflection(event: ReactPointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--glass-x", "50%");
  event.currentTarget.style.setProperty("--glass-y", "20%");
  event.currentTarget.style.setProperty("--glass-intensity", "0");
}

function NavIcon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "home":
      return <svg {...common}><path d="m3 11 9-8 9 8" /><path d="M5.5 9.5V21h13V9.5M9 21v-6h6v6" /></svg>;
    case "quran":
      return <svg {...common}><path d="M12 5.5C9.8 3.8 7.2 3.2 4 4v14c3.2-.8 5.8-.2 8 1.5" /><path d="M12 5.5c2.2-1.7 4.8-2.3 8-1.5v14c-3.2-.8-5.8-.2-8 1.5V5.5Z" /></svg>;
    case "learn":
      return <svg {...common}><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M6 9.2V15c3 2.2 9 2.2 12 0V9.2M21 8v6" /></svg>;
    case "hadith":
      return <svg {...common}><path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V3Z" /><path d="M7 17h12M9 7h6M9 11h6" /></svg>;
    case "library":
      return <svg {...common}><path d="M4 5.5h5V20H4zM10 3h5v17h-5zM16 7h4v13h-4z" /></svg>;
    case "duas":
      return <svg {...common}><path d="M8.5 12.5c-2-2-2.2-4.4-.7-5.7 1.1-1 2.5-.4 3.2.8M15.5 12.5c2-2 2.2-4.4.7-5.7-1.1-1-2.5-.4-3.2.8" /><path d="M7 12c1.5 3 3 5 5 7 2-2 3.5-4 5-7M12 7v6" /></svg>;
    case "khutba":
      return <svg {...common}><path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M9 21h6" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>;
    case "account":
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.4 3.8-5.2 7-5.2s5.8 1.8 7 5.2" /></svg>;
  }
}

export function AppTabBar() {
  const pathname = usePathname();
  const { lang } = useLang();
  const { isOpen: chatOpen } = useChat();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** Ignore backdrop dismiss for a beat after opening (mobile ghost-tap). */
  const ignoreBackdropUntil = useRef(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  if (chatOpen) return null;

  const fixedLinks = [primary[0], primary[1], primary[2], primary[3]];
  const moreActive = moreLinks.some((item) => isActive(pathname, item.href));

  function toggleMore(event: React.MouseEvent | React.PointerEvent) {
    event.stopPropagation();
    event.preventDefault();
    setMoreOpen((open) => {
      if (!open) ignoreBackdropUntil.current = Date.now() + 400;
      return !open;
    });
  }

  function dismissMore() {
    if (Date.now() < ignoreBackdropUntil.current) return;
    setMoreOpen(false);
  }

  const moreSheet =
    mounted &&
    createPortal(
      <div className="md:hidden">
        <div
          className={`fixed inset-0 z-[200] bg-noor-950/55 backdrop-blur-[3px] transition-opacity duration-200 ${
            moreOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!moreOpen}
          onClick={dismissMore}
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-label={t(lang, "more")}
          className={`fixed inset-x-3 z-[210] mx-auto max-w-sm rounded-3xl border border-white/70 bg-white p-3 shadow-2xl shadow-noor-950/35 transition-all duration-200 dark:border-noor-600/80 dark:bg-noor-900 ${
            moreOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-6 scale-95 opacity-0"
          }`}
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-extrabold text-heading">{t(lang, "more")}</p>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-noor-50 text-lg font-bold text-muted transition hover:rotate-90 dark:bg-noor-800"
              aria-label={t(lang, "close")}
            >
              ×
            </button>
          </div>
          <nav className="grid grid-cols-3 gap-2">
            {moreLinks.map((item, index) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`app-more-item relative flex min-h-20 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border px-2 py-3 text-center transition active:scale-95 ${
                    active
                      ? "border-gold-300 bg-gold-50 text-noor-800 shadow-sm dark:border-gold-500/60 dark:bg-gold-500/15 dark:text-gold-200"
                      : "border-noor-100 bg-noor-50 text-noor-800 hover:-translate-y-0.5 hover:bg-white dark:border-noor-700 dark:bg-noor-800 dark:text-noor-100 dark:hover:bg-noor-700"
                  }`}
                  style={{ animationDelay: `${index * 35}ms` }}
                >
                  <NavIcon name={item.icon} className="h-6 w-6" />
                  <span className="max-w-full text-[11px] font-extrabold leading-tight">
                    {t(lang, item.key)}
                  </span>
                  {item.key === "khutba" && (
                    <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,.8)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </section>
      </div>,
      document.body,
    );

  return (
    <>
      {moreSheet}

      <div className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] md:hidden">
        <nav
          aria-label={t(lang, "mainNavigation")}
          className="app-tabbar mx-auto grid max-w-md grid-cols-5 items-end gap-1"
        >
          {fixedLinks.slice(0, 2).map((item) => (
            <TabLink key={item.href} item={item} pathname={pathname} lang={lang} />
          ))}

          <div className="relative z-[100] flex flex-col items-center justify-end">
            <button
              type="button"
              onClick={toggleMore}
              aria-label={t(lang, "more")}
              aria-expanded={moreOpen}
              className={`relative app-plus-button -mt-7 mb-1 flex h-14 w-14 touch-manipulation items-center justify-center overflow-hidden rounded-full border-[3px] border-sand-50 bg-gradient-to-br from-teal-600 via-noor-600 to-noor-800 text-white shadow-[0_8px_20px_rgba(24,83,70,.4)] transition-all duration-300 dark:border-noor-950 ${
                moreOpen ? "rotate-45 scale-105 ring-4 ring-gold-400/25" : "hover:-translate-y-1"
              } ${moreActive ? "ring-4 ring-gold-400/25" : ""}`}
              onPointerMove={moveGlassReflection}
              onPointerLeave={resetGlassReflection}
            >
              <svg viewBox="0 0 24 24" className="pointer-events-none h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <span
              className={`text-[11px] font-extrabold tracking-wide ${
                moreActive || moreOpen
                  ? "text-teal-700 dark:text-gold-300"
                  : "text-noor-900 dark:text-white"
              }`}
            >
              {t(lang, "more")}
            </span>
          </div>

          {fixedLinks.slice(2).map((item) => (
            <TabLink key={item.href} item={item} pathname={pathname} lang={lang} />
          ))}
        </nav>
      </div>
    </>
  );
}

function TabLink({
  item,
  pathname,
  lang,
}: {
  item: (typeof primary)[number];
  pathname: string;
  lang: "en" | "ur" | "hi";
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`app-tab-link group flex min-w-0 flex-col items-center justify-end gap-0.5 px-1 py-1 transition-all active:scale-90 ${
        active
          ? "text-teal-700 dark:text-gold-300"
          : "text-noor-900 hover:text-teal-700 dark:text-white dark:hover:text-gold-200"
      }`}
    >
      <NavIcon
        name={item.icon}
        className={`transition-all ${active ? "app-tab-icon-active h-6 w-6 stroke-[2.2]" : "h-5 w-5 opacity-95 group-hover:opacity-100"}`}
      />
      <span className="max-w-full truncate text-[11px] font-extrabold leading-tight tracking-wide dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
        {t(lang, item.key)}
      </span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-gold-500 dark:bg-gold-400" />}
    </Link>
  );
}
