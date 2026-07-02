"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

const APK_URL =
  "https://github.com/frazakram/noor-safar-releases/releases/latest/download/app-release.apk";
const DISMISS_KEY = "noor-install-banner-dismissed";

/** Invites Android browser visitors to install the APK. Never shows inside the app itself. */
export function InstallAppBanner() {
  const { lang } = useLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const isAndroid = /Android/i.test(ua);
      const inApp =
        /NoorSafarAndroid/i.test(ua) ||
        document.documentElement.classList.contains("app-shell");
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (isAndroid && !inApp && !dismissed) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

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
    <div className="fixed inset-x-3 bottom-3 z-40 animate-fade-in-up">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-teal-200/60 bg-white/95 p-3 shadow-xl shadow-noor-950/20 backdrop-blur dark:border-teal-700/60 dark:bg-noor-900/95">
        <Image src="/logo-sm.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-heading">{t(lang, "installApp")}</p>
          <p className="truncate text-xs text-muted">{t(lang, "installAppHint")}</p>
        </div>
        <a
          href={APK_URL}
          onClick={dismiss}
          className="btn-primary shrink-0 px-3 py-2 text-xs font-semibold"
        >
          {t(lang, "installAppCta")}
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t(lang, "close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
