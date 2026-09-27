"use client";

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

/** Live view of the answer pipeline, driven by /api/rag/chat/stream stage events. */
export function ChatSearchProgress({ stages, lang }: { stages: ChatStage[]; lang: Lang }) {
  const latest = stages[stages.length - 1]?.stage ?? "understanding";
  const current = ORDER.indexOf(latest);
  const byName = new Map(stages.map((s) => [s.stage, s]));

  return (
    <div
      className="w-[min(92%,20rem)] rounded-2xl border border-subtle bg-surface-muted px-3 py-2.5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        <RubElHizb />
        <p className="animate-text-shimmer text-xs font-semibold">{t(lang, LABEL_KEY[latest])}…</p>
      </div>
      <ol className="mt-2 space-y-1.5 border-t border-subtle pt-2">
        {ORDER.map((name, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          const data = byName.get(name);
          return (
            <li key={name} className={`text-[11px] ${state === "pending" ? "text-faint opacity-60" : "text-body"}`}>
              <span className="flex items-center gap-2">
                {state === "done" ? (
                  <svg className="h-3.5 w-3.5 shrink-0 text-accent animate-check-pop" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : state === "active" ? (
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-noor-500 animate-search-dot" />
                  </span>
                ) : (
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                  </span>
                )}
                {t(lang, LABEL_KEY[name])}
              </span>
              {name === "searching" && data?.keywords && data.keywords.length > 0 && (
                <div className="ps-[1.375rem]">
                  <Chips items={data.keywords} tone="keyword" />
                </div>
              )}
              {name === "found" && data?.sources && data.sources.length > 0 && (
                <div className="ps-[1.375rem]">
                  <Chips items={data.sources} tone="source" />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
