"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { ShareButton } from "@/components/ShareButton";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

export type HadithRecord = {
  id: number;
  collection: string;
  chapter_en: string;
  hadith_number: number;
  arabic: string;
  english: string;
  reference: string;
};

/** One hadith in full, the target of citation links in chat answers. */
export function HadithDetail({ collection, number, initial }: { collection: string; number: number; initial: HadithRecord | null }) {
  const { lang } = useLang();
  const [hadith, setHadith] = useState<HadithRecord | null>(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (initial) return;
    // The server couldn't reach the API: load in the browser instead of showing an error.
    api<HadithRecord>(`/api/hadith/${collection}/${number}`)
      .then(setHadith)
      .catch(() => setFailed(true));
  }, [collection, number, initial]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link href="/hadith" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
        <svg className="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t(lang, "hadithAll")}
      </Link>

      {!hadith && !failed && <div className="card h-48 animate-pulse" aria-busy="true" />}
      {failed && <p className="card text-sm text-muted">{t(lang, "hadithLoadError")}</p>}

      {hadith && (
        <article className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-heading">{hadith.reference}</h1>
              {hadith.chapter_en && <p className="mt-0.5 text-xs text-accent">{hadith.chapter_en}</p>}
            </div>
            <ShareButton
              lang={lang}
              getPayload={() => ({
                title: hadith.reference,
                text: `${hadith.english}\n\n— ${hadith.reference}\n${window.location.href}`,
                url: window.location.href,
                card: { kind: "hadith", reference: hadith.reference, translation: hadith.english },
              })}
              className="shrink-0"
            />
          </div>
          <p className="font-arabic mt-4 text-right text-xl leading-loose" dir="rtl" lang="ar">
            {hadith.arabic}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-body" dir="ltr" lang="en">
            {hadith.english}
          </p>
          <p className="mt-4 border-t border-subtle pt-3 text-[11px] text-faint">{t(lang, "hadithNumberingNote")}</p>
        </article>
      )}
    </div>
  );
}
