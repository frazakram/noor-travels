"use client";

import { PageLoading } from "@/components/PageLoading";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import { LoadingGlass } from "@/components/LoadingGlass";
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

const QURAN_TOOLS = [
  { href: "/quran/listen", key: "audiobook" as const, icon: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></> },
  { href: "/learn-quran", key: "learnQuran" as const, icon: <><path d="m3 8 9-4 9 4-9 4-9-4Z" /><path d="M7 10v5c2.8 2 7.2 2 10 0v-5" /></> },
  { href: "/recite", key: "recite" as const, icon: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></> },
  { href: "/quran/find", key: "findFromScreenshot" as const, icon: <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3" /></> },
];

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
        setLoadError(e.message || t(lang, "quranLoadErrorBody"));
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

  if (loading) return <PageLoading />;

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
        <p className="mt-1 text-sm text-muted">{t(lang, "quranPageDesc")}</p>
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
          aria-label={t(lang, "search")}
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

      <nav className="grid grid-cols-4 gap-2">
        {QURAN_TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            prefetch={false}
            className="flex flex-col items-center gap-2 rounded-2xl border border-subtle bg-white px-1 py-3 text-center transition-colors hover:border-noor-300 dark:bg-noor-900 dark:hover:border-noor-500"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-noor-700 dark:text-gold-300" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {tool.icon}
            </svg>
            <span className="text-[11px] font-medium leading-tight text-heading sm:text-xs">{t(lang, tool.key)}</span>
          </Link>
        ))}
      </nav>

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
              prefetch={false}
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
            prefetch={false}
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
                <LoadingGlass size="sm" />
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
