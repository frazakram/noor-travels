"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deleteChat, listChats, updateChat } from "@/lib/chat-history";
import { groupConversations, type ConversationSummary, type HistoryGroup } from "@/lib/chat-history-model";
import { t, type Lang } from "@/lib/i18n";

const GROUP_KEY: Record<HistoryGroup, Parameters<typeof t>[1]> = {
  starred: "chatGroupStarred",
  today: "chatGroupToday",
  yesterday: "chatGroupYesterday",
  week: "chatGroupWeek",
  older: "chatGroupOlder",
};

export function StarIcon({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
    </svg>
  );
}

type Props = {
  lang: Lang;
  signedIn: boolean;
  activeId: string | null;
  /** Bumped by the chat whenever a turn is saved, so the list is fresh when shown. */
  version: number;
  openingId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onStarChange: (id: string, starred: boolean) => void;
  onDeleted: (id: string) => void;
  onLeave: () => void;
};

/** The signed-in user's saved conversations: search, starred first, then by day. */
export function ChatHistoryPanel({ lang, signedIn, activeId, version, openingId, onOpen, onNew, onStarChange, onDeleted, onLeave }: Props) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    // Typing searches after a short pause instead of on every key.
    const timer = window.setTimeout(
      () =>
        listChats(query)
          .then((list) => {
            if (!live) return;
            setItems(list);
            setFailed(false);
          })
          .catch(() => live && setFailed(true)),
      query ? 250 : 0,
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [signedIn, query, version]);

  const groups = useMemo(() => (items ? groupConversations(items) : []), [items]);

  async function toggleStar(item: ConversationSummary) {
    const starred = !item.starred;
    setItems((list) => list?.map((c) => (c.id === item.id ? { ...c, starred } : c)) ?? null);
    onStarChange(item.id, starred);
    try {
      await updateChat(item.id, { starred });
    } catch {
      setItems((list) => list?.map((c) => (c.id === item.id ? { ...c, starred: !starred } : c)) ?? null);
      onStarChange(item.id, !starred);
    }
  }

  async function remove(item: ConversationSummary) {
    if (confirmId !== item.id) {
      setConfirmId(item.id);
      return;
    }
    setConfirmId(null);
    const before = items;
    setItems((list) => list?.filter((c) => c.id !== item.id) ?? null);
    try {
      await deleteChat(item.id);
      onDeleted(item.id);
    } catch {
      setItems(before);
    }
  }

  if (!signedIn) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-noor-50 text-accent dark:bg-noor-800">
          <StarIcon filled={false} className="h-6 w-6" />
        </span>
        <p className="text-sm text-body">{t(lang, "chatHistorySignIn")}</p>
        <Link href="/account" onClick={onLeave} className="btn-primary px-5 text-sm">
          {t(lang, "chatHistorySignInCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-subtle px-3 py-2">
        <label className="relative flex-1">
          <span className="sr-only">{t(lang, "chatHistorySearch")}</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, "chatHistorySearch")}
            className="input w-full py-1.5 ps-8 text-sm"
            dir="auto"
          />
        </label>
        <button type="button" onClick={onNew} className="shrink-0 rounded-lg border border-noor-200 px-2.5 py-1.5 text-xs font-medium text-accent hover:border-noor-400 dark:border-noor-600">
          + {t(lang, "chatHistoryNew")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2" onClick={() => setConfirmId(null)}>
        {failed && !items && <p className="px-3 py-6 text-center text-xs text-muted">{t(lang, "chatHistoryError")}</p>}
        {!failed && !items && (
          <div className="space-y-2 px-2 py-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-muted" />
            ))}
          </div>
        )}
        {items && items.length === 0 && (
          <p className="px-6 py-10 text-center text-xs leading-relaxed text-muted">{t(lang, query ? "chatHistoryNoMatch" : "chatHistoryEmpty")}</p>
        )}
        {groups.map(({ group, items: rows }) => (
          <section key={group} className="mb-3">
            <h3 className="flex items-center gap-1 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-faint">
              {group === "starred" && <StarIcon filled className="h-3 w-3 text-gold-500" />}
              {t(lang, GROUP_KEY[group])}
            </h3>
            <ul>
              {rows.map((item) => (
                <li
                  key={item.id}
                  className={`group flex items-center gap-1 rounded-lg pe-1 ${item.id === activeId ? "bg-noor-50 dark:bg-noor-800" : "hover:bg-surface-muted"}`}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(item.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-start text-sm text-body"
                    dir="auto"
                  >
                    {openingId === item.id && <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-noor-300 border-t-noor-700" aria-hidden />}
                    <span className="truncate">{item.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleStar(item);
                    }}
                    aria-pressed={item.starred}
                    aria-label={t(lang, item.starred ? "chatUnstar" : "chatStar")}
                    title={t(lang, item.starred ? "chatUnstar" : "chatStar")}
                    className={`rounded-md p-1.5 ${item.starred ? "text-gold-500" : "text-faint hover:text-gold-500"}`}
                  >
                    <StarIcon filled={item.starred} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove(item);
                    }}
                    aria-label={t(lang, "chatDelete")}
                    title={t(lang, "chatDelete")}
                    className={`rounded-md p-1.5 text-xs ${confirmId === item.id ? "bg-red-50 px-2 font-medium text-red-600 dark:bg-red-900/30 dark:text-red-300" : "text-faint hover:text-red-500"}`}
                  >
                    {confirmId === item.id ? (
                      t(lang, "chatDeleteConfirm")
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
