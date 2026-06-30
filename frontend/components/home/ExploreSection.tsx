"use client";

import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

const items = [
  {
    href: "/quran",
    key: "quran" as const,
    desc: "Arabic + translations + tafsir audio",
    stat: "114 Surahs · 6,236 Ayahs",
    icon: "📖",
    accent: "border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20",
  },
  {
    href: "/hadith",
    key: "hadith" as const,
    desc: "Browse Bukhari by topic",
    stat: "7,277 Hadiths · 10 Topics",
    icon: "📜",
    accent: "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20",
  },
  {
    href: "/duas",
    key: "duas" as const,
    desc: "Authentic duas for journeys",
    stat: "12 Duas for travel",
    icon: "🤲",
    accent: "border-l-sky-500 bg-sky-50/60 dark:bg-sky-950/20",
  },
  {
    href: "/khutba",
    key: "khutba" as const,
    desc: "Live translation and khutbah library",
    stat: "300+ Khutbahs",
    icon: "🕌",
    accent: "border-l-violet-500 bg-violet-50/60 dark:bg-violet-950/20",
  },
];

export function ExploreSection() {
  const { lang } = useLang();

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-heading sm:text-lg">{t(lang, "salahExplore")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`group rounded-2xl border border-slate-100 border-l-4 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 sm:p-5 ${item.accent}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm dark:bg-slate-900 sm:h-11 sm:w-11 sm:text-xl">
                  {item.icon}
                </span>
                <div>
                  <h3 className="font-semibold text-heading">{t(lang, item.key)}</h3>
                  <p className="mt-0.5 text-xs text-muted sm:text-sm">{item.desc}</p>
                  <p className="mt-2 text-xs font-medium text-accent">{item.stat}</p>
                </div>
              </div>
              <span className="translate-x-2 text-xl text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
