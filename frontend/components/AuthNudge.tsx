"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { isLoggedIn } from "@/lib/auth";
import { t } from "@/lib/i18n";

const NUDGE_KEY = "noor-auth-nudge-shown";
const NUDGE_DELAY_MS = 30_000;

/** Shown once ever: after 30s on a page, a small card suggests signing in.
 *  Login is optional — this only explains what an account adds. */
export function AuthNudge() {
  const { lang } = useLang();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname === "/account") return;
    try {
      if (isLoggedIn() || localStorage.getItem(NUDGE_KEY)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      try {
        if (isLoggedIn() || localStorage.getItem(NUDGE_KEY)) return;
        localStorage.setItem(NUDGE_KEY, new Date().toISOString());
        setVisible(true);
      } catch {
        /* private mode — skip the nudge */
      }
    }, NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-sm animate-[nudge-in_.4s_cubic-bezier(.34,1.56,.64,1)] sm:bottom-6">
      <style>{`@keyframes nudge-in { from { opacity: 0; transform: translateY(16px) scale(.95); } to { opacity: 1; transform: none; } }`}</style>
      <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl dark:border-emerald-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="text-2xl">☁️</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-heading">{t(lang, "authNudgeTitle")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{t(lang, "authNudgeBody")}</p>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-faint hover:bg-surface-muted hover:text-body"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href="/account"
            onClick={() => setVisible(false)}
            className="btn-primary flex-1 py-2 text-center text-xs"
          >
            {t(lang, "authSignup")}
          </Link>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="flex-1 rounded-full border border-subtle px-3 py-2 text-xs text-muted hover:bg-surface-muted"
          >
            {t(lang, "authNudgeLater")}
          </button>
        </div>
      </div>
    </div>
  );
}
