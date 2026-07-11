"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { loadLastRead, loadBookmarks, type QuranLastRead, type QuranBookmark } from "@/lib/quran-bookmarks";
import { t } from "@/lib/i18n";

export function ContinueReadingCard() {
  const { lang } = useLang();
  const [last, setLast] = useState<QuranLastRead | null>(null);
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);

  useEffect(() => {
    setLast(loadLastRead());
    setBookmarks(loadBookmarks().slice(0, 3));
  }, []);

  if (!last && bookmarks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-noor-200/80 bg-gradient-to-br from-noor-50 to-white p-4 dark:border-noor-600/40 dark:from-noor-900/40 dark:to-slate-900/40 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-noor-700 dark:text-noor-300">
        {t(lang, "continueReading")}
      </p>

      {last && (
        <Link
          href={`/quran/${last.surah}?ayah=${last.ayah}`}
          className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-3 transition hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900"
        >
          <div>
            <p className="font-semibold text-heading">
              {last.surahName ? `${last.surah}. ${last.surahName}` : `${t(lang, "quran")} ${last.surah}`}
            </p>
            <p className="text-xs text-muted">
              {t(lang, "ayah")} {last.ayah}
            </p>
          </div>
          <span className="text-sm font-medium text-accent">{t(lang, "resume")} →</span>
        </Link>
      )}

      {bookmarks.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-muted">{t(lang, "bookmarks")}</p>
          {bookmarks.map((b) => (
            <Link
              key={b.verseKey}
              href={`/quran/${b.surah}?ayah=${b.ayah}`}
              className="block rounded-lg px-2 py-1.5 text-sm text-heading hover:bg-white/70 dark:hover:bg-slate-900/50"
            >
              {b.verseKey}
              {b.surahName ? ` · ${b.surahName}` : ""}
            </Link>
          ))}
        </div>
      )}

      <Link href="/quran" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
        {t(lang, "openQuran")} →
      </Link>
    </section>
  );
}
