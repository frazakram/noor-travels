"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

type DailyHadith = {
  collection: string;
  chapter_en?: string;
  hadith_number: number;
  arabic: string;
  english: string;
  reference: string;
};

export default function HadithOfDayPage() {
  const { lang } = useLang();
  const [hadith, setHadith] = useState<DailyHadith | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<DailyHadith>("/api/hadith/daily")
      .then(setHadith)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          {t(lang, "hadithOfTheDay")}
        </p>
        {hadith?.chapter_en && (
          <h1 className="mt-1 text-xl font-bold text-heading">{hadith.chapter_en}</h1>
        )}
      </header>

      {error && <p className="text-sm text-muted">{t(lang, "hadithDailyError")}</p>}
      {!hadith && !error && <p className="text-sm text-muted">{t(lang, "loadingHadith")}</p>}

      {hadith && (
        <article className="card space-y-4 border-gold-200/70 dark:border-gold-500/25">
          <p
            className="font-arabic text-right text-lg leading-loose text-slate-800 dark:text-white sm:text-xl"
            dir="rtl"
          >
            {hadith.arabic}
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-body">{hadith.english}</p>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{hadith.reference}</p>
        </article>
      )}

      <Link href="/hadith" className="inline-block text-sm text-accent hover:underline">
        {t(lang, "browseAllHadith")} →
      </Link>
    </div>
  );
}
