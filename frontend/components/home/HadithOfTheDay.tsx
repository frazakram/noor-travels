"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";

type DailyHadith = {
  collection: string;
  chapter_en?: string;
  hadith_number: number;
  arabic: string;
  english: string;
  reference: string;
};

export function HadithOfTheDay({ lang }: { lang: Lang }) {
  const [hadith, setHadith] = useState<DailyHadith | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<DailyHadith>("/api/hadith/daily")
      .then(setHadith)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  const preview = hadith
    ? hadith.english.replace(/\s+/g, " ").trim().slice(0, 220) +
      (hadith.english.length > 220 ? "…" : "")
    : "";

  return (
    <section>
      <article className="rounded-2xl border border-gold-200/70 bg-gradient-to-br from-amber-50 to-yellow-50/60 p-4 dark:border-gold-500/25 dark:from-amber-950/20 dark:to-yellow-950/10 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          {t(lang, "hadithOfTheDay")}
        </p>
        {hadith ? (
          <>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{preview}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{hadith.reference}</p>
              <Link
                href="/hadith-of-day"
                className="text-xs font-medium text-accent hover:underline"
              >
                {t(lang, "readFullHadith")}
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{t(lang, "loadingHadith")}</p>
        )}
      </article>
    </section>
  );
}
