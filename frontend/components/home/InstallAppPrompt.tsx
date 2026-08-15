"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { APK_URL, isAndroidBrowser, isInsideApp } from "@/lib/apk";
import { t } from "@/lib/i18n";

const DISMISS_KEY = "noor-install-prompt-dismissed";
/** Anchor on the home page holding the full download card (QR + steps). */
export const GET_APP_ANCHOR = "get-the-app";

/**
 * Floating install prompt.
 *
 * Alignment is the whole trick here. Pinning a floating card with a fixed left
 * offset is what makes these overflow the right edge on narrow screens; instead
 * this spans `inset-x-0`, pads inward, and centres a `max-w-md` box — a
 * combination that cannot exceed the viewport at any width. Every text node
 * sits in a `min-w-0` flex child so a long translation wraps instead of
 * pushing the buttons off-screen.
 */
export function InstallAppPrompt() {
  const { lang } = useLang();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [onAndroid, setOnAndroid] = useState(false);

  useEffect(() => {
    // Home page only, per product decision — the full download card with the
    // QR code and install steps already lives there.
    if (pathname !== "/") return;
    if (isInsideApp()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* private mode — show it anyway */
    }
    setOnAndroid(isAndroidBrowser());
    // Let the page settle before sliding in, so it does not fight first paint.
    const timer = window.setTimeout(() => setShow(true), 1200);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      // ChatWidget's round FAB sits fixed at bottom-right (bottom-24, end-5,
      // z-50), so this stops short of the right edge rather than spanning full
      // width — a full-width bar here would sit under the FAB and clip its own
      // dismiss button behind it. Left-aligned, capped narrower than the FAB's
      // reserved corner at every breakpoint.
      className="fixed inset-x-3 z-40 flex justify-start pb-[env(safe-area-inset-bottom,0px)] md:pb-3"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex w-full max-w-[15.5rem] items-center gap-3 rounded-2xl border border-teal-200/70 bg-white/97 p-3 shadow-xl shadow-noor-950/20 backdrop-blur animate-fade-in-up sm:max-w-sm dark:border-teal-700/60 dark:bg-noor-900/97">
        <Image
          src="/logo-sm.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-heading">{t(lang, "installApp")}</p>
          <p className="text-xs leading-snug text-muted">{t(lang, "installAppHint")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1">
          {onAndroid ? (
            <a
              href={APK_URL}
              rel="noopener"
              onClick={dismiss}
              className="btn-primary whitespace-nowrap px-3 py-1.5 text-xs font-semibold"
            >
              {t(lang, "installAppCta")}
            </a>
          ) : (
            <a
              href={`#${GET_APP_ANCHOR}`}
              onClick={dismiss}
              className="btn-primary whitespace-nowrap px-3 py-1.5 text-xs font-semibold"
            >
              {t(lang, "installAppCta")}
            </a>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="whitespace-nowrap px-3 py-1 text-[11px] font-medium text-muted hover:text-heading"
          >
            {t(lang, "installNotNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
