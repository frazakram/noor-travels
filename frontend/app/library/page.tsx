"use client";

import { NoticeCard } from "@/components/NoticeCard";
import { PageLoading } from "@/components/PageLoading";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useChat } from "@/components/ChatProvider";
import { useLang } from "@/components/LangProvider";
import { emitPageLoading } from "@/components/NavigationProgress";
import { t, type Lang } from "@/lib/i18n";
import { categoryLabel } from "@/lib/library-categories";
import { answerShardPath } from "@/lib/library-shards";
import { librarySlug } from "@/lib/library-slug";

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

function AnswerPanel({
  lang,
  question,
  answer,
  loading,
  failed,
}: {
  lang: Lang;
  question: string;
  answer: LibraryAnswer | null;
  loading: boolean;
  failed: boolean;
}) {
  if (failed && !answer) {
    return <p className="text-sm text-muted">{t(lang, "genericErrorTitle")}</p>;
  }
  if (loading && !answer) {
    return (
      <div className="rounded-xl border border-noor-200 bg-noor-50/50 p-4 dark:border-noor-800 dark:bg-noor-950/20">
        <p className="text-sm text-faint">{t(lang, "libraryLoadingAnswer")}</p>
      </div>
    );
  }

  if (!answer) return null;

  return (
    <div className="rounded-xl border border-noor-200 bg-noor-50/50 p-4 dark:border-noor-800 dark:bg-noor-950/20">
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
  return (
    <Suspense fallback={null}>
      <QuestionLibraryPageInner />
    </Suspense>
  );
}

function QuestionLibraryPageInner() {
  const { lang } = useLang();
  const { openChat } = useChat();
  const [index, setIndex] = useState<LibraryIndex | null>(null);
  const [answers, setAnswers] = useState<Record<string, LibraryAnswer>>({});
  const [answerFailed, setAnswerFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(() => searchParams.get("category") || "all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    emitPageLoading(true);
    fetch("/data/question-library-index.json")
      .then((r) => {
        if (!r.ok) throw new Error("Library not found");
        return r.json();
      })
      .then((data: LibraryIndex) => setIndex(data))
      .catch(() => setError("libraryLoadError"))
      .finally(() => {
        setLoading(false);
        emitPageLoading(false);
      });
  }, []);

  const loadAnswer = useCallback(
    async (id: string) => {
      if (answers[id]) return;
      setAnswersLoading(true);
      setAnswerFailed(false);
      emitPageLoading(true);
      try {
        const r = await fetch(answerShardPath(id));
        if (!r.ok) throw new Error(`Answer shard ${r.status}`);
        const shard = (await r.json()) as Record<string, LibraryAnswer>;
        setAnswers((prev) => ({ ...prev, ...shard }));
      } catch {
        setAnswerFailed(true);
      } finally {
        setAnswersLoading(false);
        emitPageLoading(false);
      }
    },
    [answers],
  );

  const filtered = useMemo(() => {
    if (!index) return [];
    const q = search.trim().toLowerCase();
    return index.items.filter((item) => {
      // Some source categories (e.g. "dua" / "dua_ext") share one display label — filter by label.
      if (category !== "all" && categoryLabel(lang, item.category) !== categoryLabel(lang, category)) return false;
      if (!q) return true;
      const hay = `${item.question} ${item.category} ${(item.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [index, search, category, lang]);

  const categoryChips = useMemo(() => {
    if (!index) return [];
    const seen = new Map<string, string>();
    for (const cat of index.categories) {
      const label = categoryLabel(lang, cat);
      if (!seen.has(label)) seen.set(label, cat);
    }
    return [...seen].map(([label, cat]) => ({ label, cat }));
  }, [index, lang]);

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
    await loadAnswer(id);
    // The answer expands under the tapped question — nudge it into view
    // if the fold cuts it off, without yanking the page around.
    requestAnimationFrame(() => {
      document.getElementById(`lib-answer-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function goToPage(next: number) {
    setPage(next);
    // Landing mid-list after a page flip reads as "nothing happened".
    document.getElementById("library-list-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return <PageLoading />;
  }

  if (error || !index) {
    return (
      <div className="mx-auto max-w-lg">
        <NoticeCard
          tone="error"
          title={t(lang, "genericErrorTitle")}
          message={t(lang, "genericErrorBody")}
          actionLabel={t(lang, "tryAgain")}
          onAction={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-8">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-heading">{t(lang, "ask")}</h1>
          <p className="mt-1 text-sm text-muted">{t(lang, "chatSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={openChat}
          className="flex w-full items-center gap-3 rounded-2xl border border-subtle bg-white px-4 py-3.5 text-start text-sm text-muted transition-colors hover:border-noor-300 dark:bg-noor-900"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-noor-700 dark:text-gold-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />
          </svg>
          <span className="min-w-0 flex-1 truncate">{t(lang, "askInputCta")}</span>
        </button>
      </header>

      <div className="pt-2">
        <h2 className="text-sm font-semibold text-heading">{t(lang, "askBrowseTitle")}</h2>
        <p className="mt-0.5 text-xs text-faint">
          {index.total.toLocaleString()} {t(lang, "libraryQuestionsCount")} · {t(lang, "libraryPreloaded")}
        </p>
      </div>

      <div className="card space-y-3">
        <input
          type="search"
          className="input w-full"
          placeholder={t(lang, "librarySearchPlaceholder")}
          aria-label={t(lang, "librarySearchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              category === "all" ? "bg-noor-700 text-white dark:bg-noor-600" : "border border-subtle text-muted"
            }`}
          >
            {t(lang, "libraryAllCategories")}
          </button>
          {categoryChips.map(({ label, cat }) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                category !== "all" && categoryLabel(lang, category) === label ? "bg-noor-700 text-white dark:bg-noor-600" : "border border-subtle text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mx-auto max-w-3xl space-y-2">
          <p id="library-list-top" className="scroll-mt-20 text-xs text-faint">
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
                        ? "border-noor-500 bg-noor-50/80 dark:bg-noor-950/30"
                        : "border-subtle bg-surface-muted/40 hover:border-noor-300 dark:hover:border-noor-700"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 shrink-0 text-xs transition-transform ${isOpen ? "rotate-90 text-noor-600" : "text-faint"}`}
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
                    <div className="mt-2" id={`lib-answer-${item.id}`}>
                      <AnswerPanel
                        lang={lang}
                        question={item.question}
                        answer={answers[item.id] ?? null}
                        loading={answersLoading}
                        failed={answerFailed}
                      />
                      <Link
                        href={`/library/${librarySlug(item)}`}
                        className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
                      >
                        {t(lang, "libraryPermalink")} →
                      </Link>
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
                onClick={() => goToPage(Math.max(0, page - 1))}
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
                onClick={() => goToPage(Math.min(totalPages - 1, page + 1))}
                className="rounded-lg border border-subtle px-3 py-1.5 text-xs font-medium text-muted disabled:opacity-40"
              >
                {t(lang, "nextPage")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
