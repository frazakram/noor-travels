"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import { Icons } from "@/components/IconButton";
import { emitPageLoading } from "@/components/NavigationProgress";
import { api, apiStatic } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cleanQuranText, displaySurahName } from "@/lib/quran-display";
import { loadBookmarks, loadLastRead, type QuranBookmark, type QuranLastRead } from "@/lib/quran-bookmarks";
import { formatSurahDuration, getPreferredReciter, getSurahDurations } from "@/lib/quran-durations";

type Surah = {
  number: number;
  name_ar: string;
  name_en: string;
  name_en_translation: string;
  revelation_type: string;
  ayah_count: number;
};

type SearchResult = {
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  arabic: string;
  translation_en: string;
  translation_ur: string;
  translation_hi?: string;
};

export default function QuranPage() {
  const { lang } = useLang();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeSurah, setActiveSurah] = useState<number | null>(null);
  const [lastRead, setLastRead] = useState<QuranLastRead | null>(null);
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});

  useEffect(() => {
    setLastRead(loadLastRead());
    setBookmarks(loadBookmarks());
    getSurahDurations(getPreferredReciter()).then(setDurations);
    apiStatic<{ surahs: Surah[] }>("/api/quran/surahs")
      .then((d) => {
        setSurahs(d.surahs);
        setLoadError("");
      })
      .catch((e: Error) => {
        setLoadError(e.message || "Could not load Quran. The server may need database setup.");
        setSurahs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    emitPageLoading(loading);
    return () => emitPageLoading(false);
  }, [loading]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.length < 2) return;
    setSearching(true);
    setSearched(true);
    try {
      const d = await api<{ results: SearchResult[] }>(`/api/quran/search?q=${encodeURIComponent(query)}`);
      setResults(d.results);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  if (loading) return <p className="text-muted">{t(lang, "loading")}</p>;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSurahs =
    normalizedQuery.length === 0
      ? surahs
      : surahs.filter((s) =>
          [
            String(s.number),
            displaySurahName(s.number, s.name_en),
            s.name_en,
            s.name_en_translation,
            s.name_ar,
            s.revelation_type,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        );

  const bookmarkedSurahs = new Set(bookmarks.map((b) => b.surah));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "quran")}</h1>
        <p className="mt-1 text-sm text-muted">{t(lang, "audiobookDesc")}</p>
      </div>

      {lastRead && (
        <Link
          href={`/quran/${lastRead.surah}?ayah=${lastRead.ayah}`}
          className="card flex items-center justify-between gap-3 border-noor-300 bg-noor-50/80 hover:border-noor-400 dark:border-noor-600 dark:bg-noor-900/40"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {t(lang, "continueReading")}
            </p>
            <p className="mt-1 font-medium text-heading">
              {lastRead.surahName
                ? `${lastRead.surah}. ${lastRead.surahName}`
                : `${t(lang, "quran")} ${lastRead.surah}`}
              <span className="text-muted">
                {" "}
                · {t(lang, "ayah")} {lastRead.ayah}
              </span>
            </p>
          </div>
          <span className="text-sm font-medium text-accent">{t(lang, "resume")} →</span>
        </Link>
      )}

      {bookmarks.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-heading">{t(lang, "bookmarks")}</p>
          <div className="flex flex-wrap gap-2">
            {bookmarks.slice(0, 12).map((b) => (
              <Link
                key={b.verseKey}
                href={`/quran/${b.surah}?ayah=${b.ayah}`}
                className="rounded-full border border-gold-300 bg-gold-50 px-3 py-1 text-xs font-medium text-noor-900 dark:border-gold-600 dark:bg-noor-900 dark:text-gold-300"
              >
                ★ {b.verseKey}
              </Link>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input min-w-0"
          placeholder={t(lang, "search")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearched(false);
            setResults([]);
          }}
        />
        <button type="submit" className="btn-primary min-h-11 shrink-0 sm:min-h-0">
          {t(lang, "search")}
        </button>
      </form>

      <Link
        href="/quran/find"
        className="card flex items-center gap-3 hover:border-noor-300 dark:hover:border-noor-500"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-300 bg-gold-50 text-noor-800 dark:border-gold-600 dark:bg-noor-800 dark:text-gold-400"
          aria-hidden
        >
          {Icons.camera}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-heading">{t(lang, "findFromScreenshot")}</p>
          <p className="text-xs text-faint">{t(lang, "findFromScreenshotDesc")}</p>
        </div>
      </Link>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href="/recite"
          className="card flex items-center gap-3 hover:border-noor-300 dark:hover:border-noor-500"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-300 bg-gold-50 text-noor-800 dark:border-gold-600 dark:bg-noor-800 dark:text-gold-400"
            aria-hidden
          >
            {Icons.mic}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-heading">{t(lang, "recite")}</p>
            <p className="text-xs text-faint">{t(lang, "reciteCardDesc")}</p>
          </div>
        </Link>
        <Link
          href="/learn-quran"
          className="card flex items-center gap-3 hover:border-noor-300 dark:hover:border-noor-500"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-300 bg-gold-50 text-noor-800 dark:border-gold-600 dark:bg-noor-800 dark:text-gold-400"
            aria-hidden
          >
            {Icons.book}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-heading">{t(lang, "learnQuran")}</p>
            <p className="text-xs text-faint">{t(lang, "learnQuranDesc")}</p>
          </div>
        </Link>
      </div>

      {loadError && (
        <NoticeCard
          tone="warning"
          title={t(lang, "quranLoadErrorTitle")}
          message={loadError}
          actionLabel={t(lang, "tryAgain")}
          onAction={() => {
            setLoading(true);
            setLoadError("");
            apiStatic<{ surahs: Surah[] }>("/api/quran/surahs")
              .then((d) => setSurahs(d.surahs))
              .catch((e: Error) => setLoadError(e.message))
              .finally(() => setLoading(false));
          }}
        />
      )}

      {searching && <p className="text-sm text-muted">{t(lang, "loading")}</p>}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <Link
              key={r.verse_key}
              href={`/quran/${r.surah_number}?ayah=${r.ayah_number}`}
              className="card block hover:border-noor-300 dark:hover:border-noor-500"
            >
              <p className="text-xs text-accent">{r.verse_key}</p>
              <p className="font-arabic mt-1 text-right" dir="rtl">
                {r.arabic}
              </p>
              <p className="mt-2 text-sm text-body">
                {cleanQuranText(
                  lang === "ur"
                    ? r.translation_ur
                    : lang === "hi"
                      ? r.translation_hi || r.translation_en
                      : r.translation_en
                )}
              </p>
            </Link>
          ))}
        </div>
      )}

      {searched && !searching && results.length === 0 && normalizedQuery.length >= 2 && (
        <p className="text-sm text-faint">{t(lang, "noResults")}</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSurahs.map((s) => (
          <Link
            key={s.number}
            href={`/quran/${s.number}`}
            onClick={() => setActiveSurah(s.number)}
            className={`card flex items-center justify-between transition hover:border-noor-300 dark:hover:border-noor-500 ${
              activeSurah === s.number
                ? "border-noor-400 bg-noor-50 dark:border-noor-500 dark:bg-noor-800/60"
                : ""
            }`}
          >
            <div className="min-w-0">
              <p className="font-medium text-heading">
                {s.number}. {displaySurahName(s.number, s.name_en)}
                {bookmarkedSurahs.has(s.number) ? " ★" : ""}
                {lastRead?.surah === s.number ? " · ▶" : ""}
              </p>
              <p className="text-xs text-faint">
                {s.name_en_translation} · {s.ayah_count} {t(lang, "ayahs")}
                {durations[String(s.number)] ? ` · ${formatSurahDuration(durations[String(s.number)], lang)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activeSurah === s.number ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-noor-200 border-t-noor-600 dark:border-noor-700 dark:border-t-noor-300" />
              ) : (
                <p className="font-arabic text-body" dir="rtl">
                  {s.name_ar}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
