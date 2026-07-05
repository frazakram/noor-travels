"use client";

import { useCallback, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { HADITH_TOPICS, type HadithTopic } from "@/lib/hadith-topics";
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

function HadithCard({ h }: { h: Hadith }) {
  return (
    <article className="card">
      <p className="text-xs text-accent">
        {h.reference} · {h.chapter_en}
      </p>
      <p className="font-arabic mt-2 text-right" dir="rtl">
        {h.arabic}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-body">{h.english}</p>
    </article>
  );
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

  const showBrowse = !searched;
  const canLoadMore = browseResults.length < browseTotal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "hadith")}</h1>
        <p className="text-sm text-muted">{t(lang, "hadithSubtitle")}</p>
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

      {searched && searchResults.length === 0 && !searching && (
        <p className="text-faint">{t(lang, "noResults")}</p>
      )}

      {searched && searchResults.length > 0 && (
        <div className="space-y-4">
          {searchResults.map((h) => (
            <HadithCard key={h.id} h={h} />
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
              <HadithCard key={h.id} h={h} />
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
