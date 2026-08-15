"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { ShareButton } from "@/components/ShareButton";
import { apiStatic } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";

type TKey = Parameters<typeof t>[1];

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

// Labels only for categories with real UI text; anything else in the data
// still renders, just title-cased from its raw category string.
const CATEGORY_KEYS: Record<string, TKey> = {
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

function categoryLabel(lang: Lang, category: string): string {
  const key = CATEGORY_KEYS[category];
  if (key) return t(lang, key);
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function DuasPage() {
  const { lang } = useLang();
  const [duas, setDuas] = useState<Dua[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const load = () => {
    setStatus("loading");
    // All duas, not just travel — this page previously called /api/duas/travel
    // exclusively, so the other 18 categories were never reachable here.
    apiStatic<{ duas: Dua[] }>("/api/duas/")
      .then((d) => {
        setDuas(d.duas);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(load, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of duas) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => categoryLabel(lang, a[0]).localeCompare(categoryLabel(lang, b[0])));
  }, [duas, lang]);

  const visible = activeCategory ? duas.filter((d) => d.category === activeCategory) : duas;

  function title(d: Dua) {
    if (lang === "ur") return d.title_ur;
    if (lang === "hi") return d.title_hi;
    return d.title_en;
  }

  function translation(d: Dua) {
    if (lang === "ur") return d.translation_ur;
    if (lang === "hi") return d.translation_hi;
    return d.translation_en;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "duas")}</h1>
        <p className="mt-1 text-sm text-muted">{t(lang, "duasSubtitle")}</p>
        <Link href="/library?category=dua" className="text-xs text-accent hover:underline">
          {t(lang, "duaLibraryCrossLink")} →
        </Link>
      </div>

      {status === "loading" && (
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

      {status === "error" && (
        <div className="card text-center">
          <p className="text-sm text-muted">{t(lang, "learnQuranLoadError")}</p>
          <button type="button" onClick={load} className="btn-primary mt-3 text-sm">
            {t(lang, "learnQuranRetry")}
          </button>
        </div>
      )}

      {status === "done" && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              activeCategory === null
                ? "border-noor-600 bg-noor-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-noor-950"
                : "border-subtle bg-white text-body hover:border-noor-300 dark:bg-noor-900 dark:hover:border-noor-500"
            }`}
          >
            {t(lang, "duaCategoryAll")} ({duas.length})
          </button>
          {categories.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                activeCategory === cat
                  ? "border-noor-600 bg-noor-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-noor-950"
                  : "border-subtle bg-white text-body hover:border-noor-300 dark:bg-noor-900 dark:hover:border-noor-500"
              }`}
            >
              {categoryLabel(lang, cat)} ({count})
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {visible.map((d) => (
          <article key={d.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-accent">{categoryLabel(lang, d.category)}</p>
                <h2 className="font-semibold text-heading" dir={lang === "ur" ? "rtl" : "ltr"}>
                  {title(d)}
                </h2>
              </div>
              <ShareButton
                lang={lang}
                getPayload={() => ({
                  title: title(d),
                  text: `${title(d)}\n\n${d.arabic}\n\n${translation(d)}\n\n— ${d.source}\n${typeof window !== "undefined" ? window.location.origin + "/duas" : ""}`,
                })}
                tipSide="top"
                className="shrink-0"
              />
            </div>
            <p className="font-arabic mt-3 text-right text-xl" dir="rtl">{d.arabic}</p>
            <p className="mt-2 text-sm italic text-faint">{d.transliteration}</p>
            <p className="mt-3 text-sm leading-relaxed text-body" dir={lang === "ur" ? "rtl" : "ltr"}>
              {translation(d)}
            </p>
            <p className="mt-2 text-xs text-accent">{d.source}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
