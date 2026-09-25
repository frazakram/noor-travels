"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChat } from "@/components/ChatProvider";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";
import { NAV_TABS, isTabActive, type NavIconName } from "@/lib/nav";

export function NavIcon({ name, className = "h-5 w-5" }: { name: NavIconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "today":
      return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>;
    case "quran":
      return <svg {...common}><path d="M12 5.5C9.8 3.8 7.2 3.2 4 4v14c3.2-.8 5.8-.2 8 1.5" /><path d="M12 5.5c2.2-1.7 4.8-2.3 8-1.5v14c-3.2-.8-5.8-.2-8 1.5V5.5Z" /></svg>;
    case "hadith":
      return <svg {...common}><path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V3Z" /><path d="M7 17h12M9 7h6M9 11h6" /></svg>;
    case "ask":
      return <svg {...common}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 16.3h.01" /></svg>;
    case "you":
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.4 3.8-5.2 7-5.2s5.8 1.8 7 5.2" /></svg>;
  }
}

export function AppTabBar() {
  const pathname = usePathname();
  const { lang } = useLang();
  const { isOpen: chatOpen } = useChat();

  if (chatOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-subtle bg-white/95 pb-[env(safe-area-inset-bottom,0px)] md:hidden dark:bg-noor-950/95">
      <nav aria-label={t(lang, "mainNavigation")} className="mx-auto grid max-w-md grid-cols-5">
        {NAV_TABS.map((tab) => {
          const active = isTabActive(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-1 pb-2 pt-2.5 transition-colors ${
                active ? "text-noor-700 dark:text-gold-300" : "text-slate-500 hover:text-noor-700 dark:text-slate-400 dark:hover:text-noor-100"
              }`}
            >
              <NavIcon name={tab.icon} className={`h-[22px] w-[22px] ${active ? "stroke-[2.1]" : ""}`} />
              <span className={`max-w-full truncate text-[10px] leading-none tracking-tight ${active ? "font-semibold" : "font-medium"}`}>
                {t(lang, tab.key)}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
