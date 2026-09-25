import type { translations } from "@/lib/i18n";

export type NavIconName = "today" | "quran" | "hadith" | "ask" | "you";

export type NavTab = {
  href: string;
  key: keyof (typeof translations)["en"];
  icon: NavIconName;
  /** Route prefixes that belong to this tab, so sub-features keep it highlighted. */
  sections: string[];
};

export const NAV_TABS: NavTab[] = [
  { href: "/", key: "navToday", icon: "today", sections: ["/khutba"] },
  { href: "/quran", key: "quran", icon: "quran", sections: ["/quran", "/learn-quran", "/recite"] },
  {
    href: "/hadith",
    key: "navHadithDuas",
    icon: "hadith",
    sections: ["/hadith", "/hadith-of-day", "/adhkar", "/dhikr", "/duas", "/travel-duas"],
  },
  { href: "/library", key: "ask", icon: "ask", sections: ["/library", "/ask"] },
  { href: "/settings", key: "navYou", icon: "you", sections: ["/settings", "/account", "/about", "/support", "/privacy"] },
];

export function isTabActive(pathname: string, tab: NavTab): boolean {
  if (tab.href === "/" && pathname === "/") return true;
  return tab.sections.some((s) => pathname === s || pathname.startsWith(`${s}/`));
}
