"use client";

import { useEffect, useState } from "react";
import type { ChatStage, ChatStageName } from "@/lib/chat-stream";
import { t, type Lang } from "@/lib/i18n";

const ORDER: ChatStageName[] = ["understanding", "searching", "found", "writing"];

const LABEL_KEY = {
  understanding: "chatStageUnderstanding",
  searching: "chatStageSearching",
  found: "chatStageFound",
  writing: "chatStageWriting",
} as const;

/** "Sahih al-Bukhari 5862" → "Bukhari 5862", "Tafsir 49:12 (ibn_kathir_en)" → "Tafsir 49:12". */
function shortRef(ref: string): string {
  return ref.replace(/^Sahih al-/, "").replace(/\s*\(.*\)$/, "");
}

function RubElHizb() {
  return (
    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-noor-400/25 animate-search-halo dark:bg-noor-400/20" />
      <svg viewBox="0 0 24 24" className="relative h-6 w-6 text-accent animate-search-star">
        <rect x="5" y="5" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect
          x="5"
          y="5"
          width="14"
          height="14"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          transform="rotate(45 12 12)"
        />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      </svg>
    </span>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "keyword" | "source" }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1" dir="ltr">
      {items.map((item, i) => (
        <span
          key={item}
          style={{ animationDelay: `${i * 90}ms` }}
          className={`animate-chip-in rounded-full px-2 py-0.5 text-[10px] font-medium ${
            tone === "keyword"
              ? "bg-noor-100 text-noor-800 dark:bg-noor-800 dark:text-noor-100"
              : "border border-subtle bg-white text-body dark:bg-noor-800"
          }`}
        >
          {tone === "source" ? shortRef(item) : item}
        </span>
      ))}
    </div>
  );
}

function StepIcon({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <span className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-noor-600 text-white animate-check-pop dark:bg-noor-500">
        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-noor-500 bg-white dark:bg-noor-900">
        <span className="h-1.5 w-1.5 rounded-full bg-noor-500 animate-search-dot" />
      </span>
    );
  }
  return <span className="relative z-10 h-4 w-4 shrink-0 rounded-full border-2 border-noor-200 bg-white dark:border-noor-700 dark:bg-noor-900" />;
}

/** The four steps as a connected timeline; `current` = index of the running step (4 = all done). */
function StepList({ stages, current, lang }: { stages: ChatStage[]; current: number; lang: Lang }) {
  const byName = new Map(stages.map((s) => [s.stage, s]));
  return (
    <ol className="space-y-0">
      {ORDER.map((name, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        const data = byName.get(name);
        const last = i === ORDER.length - 1;
        return (
          <li key={name} className="relative flex gap-2.5 pb-2.5 last:pb-0">
            {!last && (
              // Connector to the next step; fills as that step is reached.
              <span className="absolute start-[7px] top-4 bottom-0 w-0.5 overflow-hidden rounded-full bg-noor-100 dark:bg-noor-800" aria-hidden>
                <span
                  className={`block w-full bg-noor-500 transition-[height] duration-500 ease-out ${i < current ? "h-full" : "h-0"}`}
                />
              </span>
            )}
            <StepIcon state={state} />
            <div className={`min-w-0 flex-1 text-[11px] leading-4 transition-colors duration-300 ${
              state === "pending" ? "text-faint" : state === "active" ? "font-semibold text-heading" : "text-body"
            }`}>
              {t(lang, LABEL_KEY[name])}
              {name === "searching" && data?.keywords && data.keywords.length > 0 && (
                <Chips items={data.keywords} tone="keyword" />
              )}
              {name === "found" && data?.sources && data.sources.length > 0 && (
                <Chips items={data.sources} tone="source" />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function useElapsed(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);
  return Math.max(0, now - startedAt);
}

/** Live view of the answer pipeline, driven by /api/rag/chat/stream stage events. */
export function ChatSearchProgress({ stages, lang, startedAt }: { stages: ChatStage[]; lang: Lang; startedAt: number }) {
  const latest = stages[stages.length - 1]?.stage ?? "understanding";
  const current = ORDER.indexOf(latest);
  const elapsed = useElapsed(startedAt);

  return (
    <div
      className="w-[min(92%,20rem)] rounded-2xl border border-subtle bg-surface-muted px-3 py-2.5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        <RubElHizb />
        <p className="animate-text-shimmer min-w-0 flex-1 truncate text-xs font-semibold">{t(lang, LABEL_KEY[latest])}…</p>
        <span className="shrink-0 tabular-nums text-[10px] text-faint" dir="ltr">{(elapsed / 1000).toFixed(1)}s</span>
      </div>
      {/* Overall progress: one quarter per completed step, the running step half-filled. */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-noor-100 dark:bg-noor-800" aria-hidden>
        <div
          className="h-full rounded-full bg-gradient-to-r from-noor-400 to-noor-600 transition-[width] duration-700 ease-out"
          style={{ width: `${((current + 0.5) / ORDER.length) * 100}%` }}
        />
      </div>
      <div className="mt-2.5">
        <StepList stages={stages} current={current} lang={lang} />
      </div>
    </div>
  );
}

export type SearchTrailData = { stages: ChatStage[]; ms: number };

/**
 * Kept on the answer after the live card closes, so the steps stay visible even when they
 * flashed by in a second (or arrived together): a summary line that expands to the timeline.
 */
export function SearchTrail({ trail, lang }: { trail: SearchTrailData; lang: Lang }) {
  const byName = new Map(trail.stages.map((s) => [s.stage, s]));
  const keywords = byName.get("searching")?.keywords?.length ?? 0;
  const sources = byName.get("found")?.sources?.length ?? 0;
  const summary = t(lang, "chatTrailSummary")
    .replace("{k}", String(keywords))
    .replace("{s}", String(sources))
    .replace("{t}", (trail.ms / 1000).toFixed(1));

  return (
    <details className="group mb-2 border-b border-subtle pb-2" dir="ltr">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-medium text-muted marker:content-none">
        <span className="flex items-center gap-0.5" aria-hidden>
          {ORDER.map((name, i) => (
            <span
              key={name}
              style={{ animationDelay: `${i * 120}ms` }}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-noor-600 text-white animate-check-pop dark:bg-noor-500"
            >
              <svg className="h-2 w-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <svg className="h-3 w-3 shrink-0 transition group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </summary>
      <div className="mt-2.5">
        <StepList stages={trail.stages} current={ORDER.length} lang={lang} />
      </div>
    </details>
  );
}
