"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { api } from "@/lib/api";
import { HADITH_TOPICS } from "@/lib/hadith-topics";
import { t, type Lang } from "@/lib/i18n";

type DailyHadith = {
  id?: number;
  collection: string;
  chapter_en?: string;
  hadith_number: number;
  arabic: string;
  english: string;
  reference: string;
};

const TOPIC_KEY = "noor-hotd-topic";

const TOPIC_LABEL: Record<string, "hadithTopicPrayer" | "hadithTopicFasting" | "hadithTopicZakat" | "hadithTopicHajj" | "hadithTopicFamily" | "hadithTopicCharacter" | "hadithTopicTrade" | "hadithTopicDaily" | "hadithTopicFaith" | "hadithTopicDuas" | "hadithTopicProphets" | "hadithTopicStriving"> = {
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

export function HadithOfTheDay({ lang }: { lang: Lang }) {
  const [hadith, setHadith] = useState<DailyHadith | null>(null);
  const [failed, setFailed] = useState(false);
  const [topic, setTopic] = useState("all");

  useEffect(() => {
    const saved = localStorage.getItem(TOPIC_KEY);
    if (saved) setTopic(saved);
  }, []);

  useEffect(() => {
    setFailed(false);
    setHadith(null);
    const q = topic && topic !== "all" ? `?topic=${encodeURIComponent(topic)}` : "";
    api<DailyHadith & { id: number }>(`/api/hadith/daily${q}`)
      .then((row) => {
        setHadith(row);
        if (row?.id) {
          import("@/lib/hadith-library").then(({ rememberHotd }) => {
            rememberHotd({
              id: row.id,
              reference: row.reference,
              chapter_en: row.chapter_en,
              arabic: row.arabic,
              english: row.english,
            });
          });
        }
      })
      .catch(() => setFailed(true));
  }, [topic]);

  if (failed) return <p className="text-sm text-muted">{t(lang, "hadithDailyError")}</p>;

  const preview = hadith
    ? hadith.english.replace(/\s+/g, " ").trim().slice(0, 220) +
      (hadith.english.length > 220 ? "…" : "")
    : "";

  return (
    <div>
      <select
        className="input mb-3 w-auto max-w-[180px] py-1 text-[11px]"
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
      {hadith ? (
        <>
          <p className="text-sm leading-relaxed text-body">{preview}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted">{hadith.reference}</p>
            <div className="flex items-center gap-3">
              <Link href="/hadith-of-day" prefetch={false} className="text-xs font-medium text-accent hover:underline">
                {t(lang, "readFullHadith")}
              </Link>
              <ShareButton
                lang={lang}
                getPayload={() => ({
                  title: hadith.reference,
                  text: `${hadith.english}\n\n— ${hadith.reference}\n${typeof window !== "undefined" ? window.location.origin + "/hadith-of-day" : ""}`,
                })}
                tipSide="top"
              />
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">{t(lang, "loadingHadith")}</p>
      )}
    </div>
  );
}
