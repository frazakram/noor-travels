"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { t, type Lang } from "@/lib/i18n";

type LibraryIndex = {
  version: number;
  total: number;
  categories: string[];
  items: LibraryItem[];
};

type LibraryItem = {
  id: string;
  question: string;
  category: string;
  tags: string[];
  verified?: boolean;
};

type LibraryAnswer = {
  answer: string;
  citations: string[];
  sources: { ref: string; type: string; snippet: string; score?: number }[];
  confidence: string;
  verified?: boolean;
};

const PAGE_SIZE = 40;

function categoryLabel(lang: string, cat: string): string {
  const labels = {
    en: {
      beginner: "Beginner",
      expert: "Expert",
      hadith: "Hadith",
      hadith_ext: "Hadith",
      other_faith: "Other faiths",
      surah: "Surah",
      travel: "Travel",
      tafsir: "Tafsir",
      tafsir_ext: "Tafsir",
      verse: "Verse",
      verse_ext: "Verse",
      dua: "Dua",
      dua_ext: "Dua",
      followup: "Follow-up",
      generated: "General",
      revert: "New Muslim",
      kids: "Kids",
      daily_life: "Daily life",
      salah: "Salah",
      faith: "Faith",
      faith_ext: "Faith",
      ramadan: "Ramadan",
      prophets: "Prophets",
      etiquette: "Etiquette",
    },
    ur: {
      beginner: "ابتدائی",
      expert: "ماہر",
      hadith: "حدیث",
      hadith_ext: "حدیث",
      other_faith: "دیگر مذاہب",
      surah: "سورت",
      travel: "سفر",
      tafsir: "تفسیر",
      tafsir_ext: "تفسیر",
      verse: "آیت",
      verse_ext: "آیت",
      dua: "دعا",
      dua_ext: "دعا",
      followup: "فالو اپ",
      generated: "عام",
      revert: "نیا مسلمان",
      kids: "بچے",
      daily_life: "روزمرہ",
      salah: "نماز",
      faith: "ایمان",
      faith_ext: "ایمان",
      ramadan: "رمضان",
      prophets: "انبیاء",
      etiquette: "آداب",
    },
    hi: {
      beginner: "शुरुआती",
      expert: "विशेषज्ञ",
      hadith: "हदीस",
      hadith_ext: "हदीस",
      other_faith: "अन्य धर्म",
      surah: "सूरह",
      travel: "सफ़र",
      tafsir: "तफ़सीर",
      tafsir_ext: "तफ़सीर",
      verse: "आयत",
      verse_ext: "आयत",
      dua: "दुआ",
      dua_ext: "दुआ",
      followup: "फ़ॉलो-अप",
      generated: "सामान्य",
      revert: "नए मुसलमान",
      kids: "बच्चे",
      daily_life: "रोज़मर्रा",
      salah: "नमाज़",
      faith: "ईमान",
      faith_ext: "ईमान",
      ramadan: "रमज़ान",
      prophets: "पैग़म्बर",
      etiquette: "आदाब",
    },
  } as const;
  const table = labels[lang as keyof typeof labels] || labels.en;
  return table[cat as keyof typeof table] || cat.replace(/_/g, " ");
}

function AnswerPanel({
  lang,
  question,
  answer,
  loading,
}: {
  lang: Lang;
  question: string;
  answer: LibraryAnswer | null;
  loading: boolean;
}) {
  if (loading && !answer) {
    return (
      <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-800 dark:bg-teal-950/20">
        <p className="text-sm text-faint">{t(lang, "libraryLoadingAnswer")}</p>
      </div>
    );
  }

  if (!answer) return null;

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-800 dark:bg-teal-950/20">
      <h2 className="text-sm font-semibold text-heading">{t(lang, "libraryAnswerTitle")}</h2>
      <p className="mt-1 text-sm text-muted">{question}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-body">{answer.answer}</p>
      {answer.citations.length > 0 && (
        <p className="mt-3 text-xs text-accent">
          {t(lang, "citations")}: {answer.citations.join(" · ")}
        </p>
      )}
      {answer.sources.length > 0 && (
        <details className="group mt-2">
          <summary className="cursor-pointer text-xs font-medium text-accent">
            {t(lang, "showSources")} ({answer.sources.length})
          </summary>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {answer.sources.map((s, i) => (
              <li key={i} className="rounded-lg border border-subtle bg-surface-muted/50 p-2 text-[11px]">
                <p className="font-medium text-heading">{s.ref}</p>
                <p className="mt-1 text-muted">{s.snippet}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-3 text-[10px] text-faint">{t(lang, "libraryPreloadedNote")}</p>
    </div>
  );
}

export default function QuestionLibraryPage() {
  const { lang } = useLang();
  const [index, setIndex] = useState<LibraryIndex | null>(null);
  const [answers, setAnswers] = useState<Record<string, LibraryAnswer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/data/question-library-index.json")
      .then((r) => {
        if (!r.ok) throw new Error("Library not found");
        return r.json();
      })
      .then((data: LibraryIndex) => setIndex(data))
      .catch(() => setError("libraryLoadError"))
      .finally(() => setLoading(false));
  }, []);

  const loadAnswers = useCallback(async () => {
    if (answers) return answers;
    setAnswersLoading(true);
    try {
      const r = await fetch("/data/question-library-answers.json");
      if (!r.ok) throw new Error("Answers not found");
      const data = (await r.json()) as Record<string, LibraryAnswer>;
      setAnswers(data);
      return data;
    } catch {
      setError("libraryLoadError");
      return null;
    } finally {
      setAnswersLoading(false);
    }
  }, [answers]);

  const filtered = useMemo(() => {
    if (!index) return [];
    const q = search.trim().toLowerCase();
    return index.items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!q) return true;
      const hay = `${item.question} ${item.category} ${(item.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [index, search, category]);

  useEffect(() => {
    setPage(0);
    setSelectedId(null);
  }, [search, category]);

  useEffect(() => {
    setSelectedId(null);
  }, [page]);

  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  async function onSelect(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    await loadAnswers();
  }

  const selected = selectedId && answers ? answers[selectedId] : null;
  const selectedQuestion = selectedId ? index?.items.find((i) => i.id === selectedId) : null;

  if (loading) {
    return <p className="text-center text-muted py-12">{t(lang, "loading")}</p>;
  }

  if (error || !index) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <p className="text-muted">{t(lang, "libraryLoadError")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-heading">{t(lang, "questionLibrary")}</h1>
        <p className="text-sm text-muted">{t(lang, "questionLibraryHint")}</p>
        <p className="text-xs text-faint">
          {index.total.toLocaleString()} {t(lang, "libraryQuestionsCount")} · {t(lang, "libraryPreloaded")}
        </p>
      </header>

      <div className="card space-y-3">
        <input
          type="search"
          className="input w-full"
          placeholder={t(lang, "librarySearchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              category === "all" ? "bg-teal-700 text-white dark:bg-teal-600" : "border border-subtle text-muted"
            }`}
          >
            {t(lang, "libraryAllCategories")}
          </button>
          {index.categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                category === cat ? "bg-teal-700 text-white dark:bg-teal-600" : "border border-subtle text-muted"
              }`}
            >
              {categoryLabel(lang, cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,38%)] lg:items-start lg:gap-5">
        <div className="space-y-2">
          <p className="text-xs text-faint">
            {filtered.length.toLocaleString()} {t(lang, "libraryMatches")}
            {search ? ` · “${search}”` : ""}
          </p>
          <ul className="space-y-2">
            {pageItems.map((item) => {
              const isOpen = selectedId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void onSelect(item.id)}
                    aria-expanded={isOpen}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      isOpen
                        ? "border-teal-500 bg-teal-50/80 dark:bg-teal-950/30"
                        : "border-subtle bg-surface-muted/40 hover:border-teal-300 dark:hover:border-teal-700"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 shrink-0 text-xs transition-transform ${isOpen ? "rotate-90 text-teal-600" : "text-faint"}`}
                        aria-hidden
                      >
                        ▶
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-heading">{item.question}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-faint">
                          {categoryLabel(lang, item.category)}
                        </p>
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-2 lg:hidden">
                      <AnswerPanel
                        lang={lang}
                        question={item.question}
                        answer={answers?.[item.id] ?? null}
                        loading={answersLoading}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">{t(lang, "libraryNoResults")}</p>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-subtle px-3 py-1.5 text-xs font-medium text-muted disabled:opacity-40"
              >
                {t(lang, "prevPage")}
              </button>
              <span className="text-xs text-faint">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="rounded-lg border border-subtle px-3 py-1.5 text-xs font-medium text-muted disabled:opacity-40"
              >
                {t(lang, "nextPage")}
              </button>
            </div>
          )}
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-4">
          {selectedId && selectedQuestion ? (
            <AnswerPanel
              lang={lang}
              question={selectedQuestion.question}
              answer={selected}
              loading={answersLoading}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-subtle bg-surface-muted/30 p-6 text-center">
              <p className="text-sm text-muted">{t(lang, "librarySelectQuestion")}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
