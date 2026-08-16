"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { ShareButton } from "@/components/ShareButton";
import { api, apiStatic } from "@/lib/api";
import { HADITH_TOPICS, type HadithTopic } from "@/lib/hadith-topics";
import {
  isHadithFavorite,
  loadHadithFavorites,
  toggleHadithFavorite,
  type FavoriteHadith,
} from "@/lib/hadith-library";
import { t, type Lang } from "@/lib/i18n";

type Hadith = {
  id: number;
  chapter_en: string;
  hadith_number: number;
  arabic: string;
  english: string;
  reference: string;
};

type BrowseResponse = {
  results: Hadith[];
  total: number;
  chapter: string;
};

type Dua = {
  id: string;
  title_en: string;
  title_ur: string;
  title_hi: string;
  arabic: string;
  transliteration: string;
  translation_en: string;
  translation_ur: string;
  translation_hi: string;
  source: string;
  category: string;
};

type TKey = Parameters<typeof t>[1];

// Labels only for categories with real UI text; anything else in the data
// still renders, just title-cased from its raw category string.
const DUA_CATEGORY_KEYS: Record<string, TKey> = {
  travel: "duaCategoryTravel",
  morning: "duaCategoryMorning",
  evening: "duaCategoryEvening",
  sleep: "duaCategorySleep",
  anxiety: "duaCategoryAnxiety",
  forgiveness: "duaCategoryForgiveness",
  protection: "duaCategoryProtection",
  health: "duaCategoryHealth",
  guidance: "duaCategoryGuidance",
  knowledge: "duaCategoryKnowledge",
  patience: "duaCategoryPatience",
  marriage: "duaCategoryMarriage",
  newborn: "duaCategoryNewborn",
  rizq: "duaCategoryRizq",
  home: "duaCategoryHome",
  rain: "duaCategoryRain",
  death: "duaCategoryDeath",
  exam: "duaCategoryExam",
  study: "duaCategoryStudy",
  general: "duaCategoryGeneral",
};

function duaCategoryLabel(lang: Lang, category: string): string {
  const key = DUA_CATEGORY_KEYS[category];
  if (key) return t(lang, key);
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function DuaCard({ d }: { d: Dua }) {
  const { lang } = useLang();
  const title = lang === "ur" ? d.title_ur : lang === "hi" ? d.title_hi : d.title_en;
  const translation = lang === "ur" ? d.translation_ur : lang === "hi" ? d.translation_hi : d.translation_en;
  return (
    <article className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-accent">{duaCategoryLabel(lang, d.category)}</p>
          <h3 className="font-semibold text-heading" dir={lang === "ur" ? "rtl" : "ltr"}>
            {title}
          </h3>
        </div>
        <ShareButton
          lang={lang}
          getPayload={() => ({
            title,
            text: `${title}\n\n${d.arabic}\n\n${translation}\n\n— ${d.source}\n${typeof window !== "undefined" ? window.location.origin + "/hadith?section=duas" : ""}`,
          })}
          tipSide="top"
          className="shrink-0"
        />
      </div>
      <p className="font-arabic mt-3 text-right text-xl" dir="rtl">{d.arabic}</p>
      <p className="mt-2 text-sm italic text-faint">{d.transliteration}</p>
      <p className="mt-3 text-sm leading-relaxed text-body" dir={lang === "ur" ? "rtl" : "ltr"}>
        {translation}
      </p>
      <p className="mt-2 text-xs text-accent">{d.source}</p>
    </article>
  );
}

const PAGE_SIZE = 40;

const TOPIC_KEYS = {
  prayer: "hadithTopicPrayer",
  fasting: "hadithTopicFasting",
  zakat: "hadithTopicZakat",
  hajj: "hadithTopicHajj",
  family: "hadithTopicFamily",
  character: "hadithTopicCharacter",
  trade: "hadithTopicTrade",
  daily: "hadithTopicDaily",
  faith: "hadithTopicFaith",
  duas: "hadithTopicDuas",
  prophets: "hadithTopicProphets",
  striving: "hadithTopicStriving",
} as const;

function topicLabel(lang: Lang, topicId: string): string {
  const key = TOPIC_KEYS[topicId as keyof typeof TOPIC_KEYS];
  return key ? t(lang, key) : topicId;
}

function HadithCard({
  h,
  saved,
  onToggleSave,
}: {
  h: Hadith | FavoriteHadith;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const { lang } = useLang();
  return (
    <article className="card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-accent">
          {h.reference}
          {"chapter_en" in h && h.chapter_en ? ` · ${h.chapter_en}` : ""}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSave}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              saved
                ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                : "border border-subtle text-muted"
            }`}
          >
            {saved ? t(lang, "savedHadith") : t(lang, "saveHadith")}
          </button>
          <ShareButton lang={lang} getPayload={() => hadithSharePayload(h)} tipSide="top" />
        </div>
      </div>
      <p className="font-arabic mt-2 text-right" dir="rtl">
        {h.arabic}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-body">{h.english}</p>
    </article>
  );
}

function hadithSharePayload(h: Hadith | FavoriteHadith) {
  const text = `${h.english}\n\n— ${h.reference}\n${typeof window !== "undefined" ? window.location.origin + "/hadith" : ""}`;
  return { title: h.reference, text };
}

export default function HadithPage() {
  const { lang } = useLang();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Hadith[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [activeTopic, setActiveTopic] = useState<HadithTopic | null>(null);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [browseResults, setBrowseResults] = useState<Hadith[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteHadith[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const [showDuas, setShowDuas] = useState(false);
  const [duas, setDuas] = useState<Dua[]>([]);
  const [duasStatus, setDuasStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [activeDuaCategory, setActiveDuaCategory] = useState<string | null>(null);

  const openDuas = useCallback((category: string | null = null) => {
    setShowFavorites(false);
    setSearched(false);
    setShowDuas(true);
    setActiveDuaCategory(category);
    setDuasStatus((prev) => {
      if (prev !== "idle" && prev !== "error") return prev;
      apiStatic<{ duas: Dua[] }>("/api/duas/")
        .then((d) => {
          setDuas(d.duas);
          setDuasStatus("done");
        })
        .catch(() => setDuasStatus("error"));
      return "loading";
    });
  }, []);

  useEffect(() => {
    setFavorites(loadHadithFavorites());
    // window.location.search rather than useSearchParams: the latter forces a
    // Suspense boundary around the whole page for a param only needed once at
    // mount — same avoidance already used by app/khutba/page.tsx.
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") === "duas" || params.get("section") === "travel") {
      openDuas(params.get("category") ?? (params.get("section") === "travel" ? "travel" : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const duaCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of duas) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => duaCategoryLabel(lang, a[0]).localeCompare(duaCategoryLabel(lang, b[0])));
  }, [duas, lang]);

  const visibleDuas = activeDuaCategory ? duas.filter((d) => d.category === activeDuaCategory) : duas;

  const loadChapter = useCallback(async (chapter: string, offset = 0) => {
    setBrowseLoading(true);
    setActiveChapter(chapter);
    try {
      const d = await api<BrowseResponse>(
        `/api/hadith/browse?chapter=${encodeURIComponent(chapter)}&limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setBrowseResults((prev) => (offset === 0 ? d.results : [...prev, ...d.results]));
      setBrowseTotal(d.total);
    } catch {
      if (offset === 0) {
        setBrowseResults([]);
        setBrowseTotal(0);
      }
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  function selectTopic(topic: HadithTopic) {
    setActiveTopic(topic);
    setSearched(false);
    setSearchResults([]);
    setQuery("");
    setShowFavorites(false);
    setShowDuas(false);
    void loadChapter(topic.chapters[0], 0);
  }

  function clearBrowse() {
    setActiveTopic(null);
    setActiveChapter(null);
    setBrowseResults([]);
    setBrowseTotal(0);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.length < 2) return;
    setSearching(true);
    setSearched(true);
    clearBrowse();
    setShowFavorites(false);
    setShowDuas(false);
    try {
      const d = await api<{ results: Hadith[] }>(`/api/hadith/search?q=${encodeURIComponent(query)}`);
      setSearchResults(d.results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.length === 0) {
      setSearched(false);
      setSearchResults([]);
    }
  }

  function handleToggleSave(h: Hadith | FavoriteHadith) {
    const next = toggleHadithFavorite({
      id: h.id,
      reference: h.reference,
      chapter_en: "chapter_en" in h ? h.chapter_en : undefined,
      arabic: h.arabic,
      english: h.english,
    });
    setFavorites(next);
  }

  const showBrowse = !searched && !showFavorites && !showDuas;
  const canLoadMore = browseResults.length < browseTotal;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-heading">{t(lang, "hadith")}</h1>
          <p className="text-sm text-muted">{t(lang, "hadithSubtitle")}</p>
          <Link href="/library?category=hadith" className="text-xs text-accent hover:underline">
            {t(lang, "hadithLibraryCrossLink")} →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setShowFavorites(true);
              setShowDuas(false);
              setSearched(false);
              clearBrowse();
              setFavorites(loadHadithFavorites());
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              showFavorites
                ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                : "border border-subtle text-muted"
            }`}
          >
            {t(lang, "hadithFavorites")}
            {favorites.length ? ` (${favorites.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => openDuas()}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              showDuas
                ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                : "border border-subtle text-muted"
            }`}
          >
            {t(lang, "duas")}
          </button>
          <Link
            href="/adhkar"
            className="rounded-full border border-subtle px-3 py-1.5 text-xs font-medium text-muted hover:border-noor-300"
          >
            {t(lang, "dhikr")}
          </Link>
          <Link
            href="/hadith-of-day"
            className="rounded-full border border-subtle px-3 py-1.5 text-xs font-medium text-muted hover:border-noor-300"
          >
            {t(lang, "hadithOfTheDay")}
          </Link>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input min-w-0"
          placeholder={t(lang, "search")}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
        <button type="submit" className="btn-primary min-h-11 shrink-0 sm:min-h-0" disabled={searching}>
          {searching ? "…" : t(lang, "search")}
        </button>
      </form>

      {showFavorites && (
        <section className="space-y-4">
          <button type="button" onClick={() => setShowFavorites(false)} className="text-sm text-accent hover:underline">
            ← {t(lang, "hadithBrowseTopics")}
          </button>
          {favorites.length === 0 ? (
            <p className="text-sm text-faint">{t(lang, "noSavedHadiths")}</p>
          ) : (
            favorites.map((h) => (
              <HadithCard
                key={h.id}
                h={h}
                saved
                onToggleSave={() => handleToggleSave(h)}
              />
            ))
          )}
        </section>
      )}

      {showDuas && (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setShowDuas(false);
              setActiveDuaCategory(null);
            }}
            className="text-sm text-accent hover:underline"
          >
            ← {t(lang, "hadithBrowseTopics")}
          </button>

          {duasStatus === "loading" && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card animate-pulse space-y-3">
                  <div className="h-4 w-1/3 rounded bg-surface-muted" />
                  <div className="h-6 w-full rounded bg-surface-muted" />
                  <div className="h-4 w-2/3 rounded bg-surface-muted" />
                </div>
              ))}
            </div>
          )}

          {duasStatus === "error" && (
            <div className="card text-center">
              <p className="text-sm text-muted">{t(lang, "learnQuranLoadError")}</p>
              <button type="button" onClick={() => openDuas(activeDuaCategory)} className="btn-primary mt-3 text-sm">
                {t(lang, "learnQuranRetry")}
              </button>
            </div>
          )}

          {duasStatus === "done" && (
            <>
              {duaCategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveDuaCategory(null)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      activeDuaCategory === null
                        ? "border-noor-600 bg-noor-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-noor-950"
                        : "border-subtle bg-white text-body hover:border-noor-300 dark:bg-noor-900 dark:hover:border-noor-500"
                    }`}
                  >
                    {t(lang, "duaCategoryAll")} ({duas.length})
                  </button>
                  {duaCategories.map(([cat, count]) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveDuaCategory(cat)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        activeDuaCategory === cat
                          ? "border-noor-600 bg-noor-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-noor-950"
                          : "border-subtle bg-white text-body hover:border-noor-300 dark:bg-noor-900 dark:hover:border-noor-500"
                      }`}
                    >
                      {duaCategoryLabel(lang, cat)} ({count})
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-4">
                {visibleDuas.map((d) => (
                  <DuaCard key={d.id} d={d} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {searched && searchResults.length === 0 && !searching && (
        <p className="text-faint">{t(lang, "noResults")}</p>
      )}

      {searched && searchResults.length > 0 && (
        <div className="space-y-4">
          {searchResults.map((h) => (
            <HadithCard
              key={h.id}
              h={h}
              saved={isHadithFavorite(h.id)}
              onToggleSave={() => handleToggleSave(h)}
            />
          ))}
        </div>
      )}

      {showBrowse && !activeTopic && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-heading">{t(lang, "hadithBrowseTopics")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HADITH_TOPICS.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => selectTopic(topic)}
                className="card text-left transition hover:border-noor-300 hover:shadow-md dark:hover:border-noor-500"
              >
                <span className="text-2xl" aria-hidden>
                  {topic.icon}
                </span>
                <h3 className="mt-2 font-semibold text-heading">{topicLabel(lang, topic.id)}</h3>
                <p className="mt-1 text-xs text-muted">
                  {topic.chapters.length} {topic.chapters.length === 1 ? "chapter" : "chapters"}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {showBrowse && activeTopic && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearBrowse}
              className="text-sm text-accent hover:underline"
            >
              ← {t(lang, "hadithBrowseTopics")}
            </button>
            <span className="text-faint">·</span>
            <span className="text-sm font-medium text-heading">
              {topicLabel(lang, activeTopic.id)}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted">{t(lang, "hadithPickChapter")}</p>
            <div className="flex flex-wrap gap-2">
              {activeTopic.chapters.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => void loadChapter(ch, 0)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    activeChapter === ch
                      ? "border-noor-600 bg-noor-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-noor-950"
                      : "border-subtle bg-white text-body hover:border-noor-300 dark:bg-noor-900 dark:hover:border-noor-500"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {browseLoading && browseResults.length === 0 && (
            <p className="text-sm text-muted">…</p>
          )}

          {activeChapter && browseResults.length > 0 && (
            <p className="text-xs text-muted">
              {browseResults.length} / {browseTotal} · {activeChapter}
            </p>
          )}

          <div className="space-y-4">
            {browseResults.map((h) => (
              <HadithCard
                key={h.id}
                h={h}
                saved={isHadithFavorite(h.id)}
                onToggleSave={() => handleToggleSave(h)}
              />
            ))}
          </div>

          {canLoadMore && (
            <button
              type="button"
              onClick={() => void loadChapter(activeChapter!, browseResults.length)}
              disabled={browseLoading}
              className="btn-primary w-full sm:w-auto"
            >
              {browseLoading ? "…" : t(lang, "hadithLoadMore")}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
