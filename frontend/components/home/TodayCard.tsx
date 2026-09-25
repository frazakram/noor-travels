"use client";

import { useEffect, useState } from "react";
import { DailyReflection } from "@/components/home/DailyReflection";
import { HadithOfTheDay } from "@/components/home/HadithOfTheDay";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

type Tab = "verse" | "hadith";

const TAB_KEY = "noor-today-tab";

export function TodayCard() {
  const { lang } = useLang();
  const [tab, setTab] = useState<Tab>("verse");

  useEffect(() => {
    try {
      if (localStorage.getItem(TAB_KEY) === "hadith") setTab("hadith");
    } catch {
      /* storage unavailable — default tab is fine */
    }
  }, []);

  function pick(next: Tab) {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      active ? "bg-white text-heading shadow-sm dark:bg-noor-700" : "text-muted hover:text-heading"
    }`;

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-heading">{t(lang, "navToday")}</h2>
        <div role="tablist" className="flex rounded-full bg-noor-50 p-0.5 dark:bg-noor-800">
          <button type="button" role="tab" aria-selected={tab === "verse"} className={tabClass(tab === "verse")} onClick={() => pick("verse")}>
            {t(lang, "todayVerse")}
          </button>
          <button type="button" role="tab" aria-selected={tab === "hadith"} className={tabClass(tab === "hadith")} onClick={() => pick("hadith")}>
            {t(lang, "hadith")}
          </button>
        </div>
      </div>
      {tab === "verse" ? <DailyReflection lang={lang} /> : <HadithOfTheDay lang={lang} />}
    </section>
  );
}
