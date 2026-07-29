"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { HADITH_TOPICS } from "@/lib/hadith-topics";
import {
  isHadithFavorite,
  loadHotdArchive,
  rememberHotd,
  toggleHadithFavorite,
  type HotdArchiveEntry,
} from "@/lib/hadith-library";
import { t } from "@/lib/i18n";
import { todayDateString } from "@/lib/hadith-of-day";

type DailyHadith = {
  id: number;
  collection: string;
  chapter_en?: string;
  hadith_number: number;
  arabic: string;
  english: string;
  reference: string;
};

const TOPIC_KEY = "noor-hotd-topic";

const TOPIC_LABEL: Record<
  string,
  | "hadithTopicPrayer"
  | "hadithTopicFasting"
  | "hadithTopicZakat"
  | "hadithTopicHajj"
  | "hadithTopicFamily"
  | "hadithTopicCharacter"
  | "hadithTopicTrade"
  | "hadithTopicDaily"
  | "hadithTopicFaith"
  | "hadithTopicDuas"
  | "hadithTopicProphets"
  | "hadithTopicStriving"
> = {
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
};

export default function HadithOfDayPage() {
  const { lang } = useLang();
  const [hadith, setHadith] = useState<DailyHadith | null>(null);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [archive, setArchive] = useState<HotdArchiveEntry[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [topic, setTopic] = useState("all");

  useEffect(() => {
    setArchive(loadHotdArchive());
    const savedTopic = localStorage.getItem(TOPIC_KEY);
    if (savedTopic) setTopic(savedTopic);
  }, []);

  useEffect(() => {
    setError(false);
    setHadith(null);
    const q = topic && topic !== "all" ? `?topic=${encodeURIComponent(topic)}` : "";
    api<DailyHadith>(`/api/hadith/daily${q}`)
      .then((row) => {
        setHadith(row);
        setSaved(isHadithFavorite(row.id));
        setArchive(
          rememberHotd({
            id: row.id,
            reference: row.reference,
            chapter_en: row.chapter_en,
            arabic: row.arabic,
            english: row.english,
          })
        );
      })
      .catch(() => setError(true));
  }, [topic]);

  function handleSave() {
    if (!hadith) return;
    const next = toggleHadithFavorite({
      id: hadith.id,
      reference: hadith.reference,
      chapter_en: hadith.chapter_en,
      arabic: hadith.arabic,
      english: hadith.english,
    });
    setSaved(next.some((h) => h.id === hadith.id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            {t(lang, "hadithOfTheDay")}
          </p>
          {hadith?.chapter_en && (
            <h1 className="mt-1 text-xl font-bold text-heading">{hadith.chapter_en}</h1>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input max-w-[160px] py-1 text-[11px]"
            value={topic}
            aria-label={t(lang, "hotdTopic")}
            onChange={(e) => {
              const next = e.target.value;
              setTopic(next);
              localStorage.setItem(TOPIC_KEY, next);
            }}
          >
            <option value="all">{t(lang, "hotdAllTopics")}</option>
            {HADITH_TOPICS.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {t(lang, TOPIC_LABEL[tp.id])}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="rounded-full border border-subtle px-3 py-1.5 text-xs font-medium text-muted"
          >
            {t(lang, "viewArchive")}
            {archive.length ? ` (${archive.length})` : ""}
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-muted">{t(lang, "hadithDailyError")}</p>}
      {!hadith && !error && <p className="text-sm text-muted">{t(lang, "loadingHadith")}</p>}

      {hadith && (
        <article className="card space-y-4 border-gold-200/70 dark:border-gold-500/25">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                saved
                  ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                  : "border border-subtle text-muted"
              }`}
            >
              {saved ? t(lang, "savedHadith") : t(lang, "saveHadith")}
            </button>
          </div>
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

      {showArchive && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-heading">{t(lang, "hadithArchive")}</h2>
          {archive.length === 0 ? (
            <p className="text-sm text-faint">{t(lang, "noArchiveYet")}</p>
          ) : (
            archive.map((entry) => (
              <article key={`${entry.date}-${entry.id}`} className="card space-y-2">
                <Link href={`/hadith-of-day/${entry.date}`} className="text-xs text-accent hover:underline">
                  {entry.date} · {entry.reference}
                </Link>
                <p className="text-sm leading-relaxed text-body">
                  {entry.english.replace(/\s+/g, " ").trim().slice(0, 280)}
                  {entry.english.length > 280 ? "…" : ""}
                </p>
              </article>
            ))
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={`/hadith-of-day/${todayDateString()}`} className="text-accent hover:underline">
          {t(lang, "hotdPermalink")} →
        </Link>
        <Link href="/hadith" className="text-accent hover:underline">
          {t(lang, "browseAllHadith")} →
        </Link>
        <Link href="/hadith" className="text-accent hover:underline">
          {t(lang, "hadithFavorites")} →
        </Link>
      </div>
    </div>
  );
}
