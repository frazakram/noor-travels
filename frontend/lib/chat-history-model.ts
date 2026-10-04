/**
 * Saved chats (signed-in users): pure helpers, kept apart from the API calls so they test
 * without the app's module aliases. Server timestamps are UTC: "YYYY-MM-DD HH:MM:SS" from
 * SQLite, "YYYY-MM-DD HH:MM:SS(.ffffff)+00:00" from Postgres.
 */

export type ConversationSummary = { id: string; title: string; starred: boolean; updated_at: string };

export type SavedMessage = { role: "user" | "assistant"; content: string; meta: Record<string, unknown> };

export type HistoryGroup = "starred" | "today" | "yesterday" | "week" | "older";

export const HISTORY_GROUPS: HistoryGroup[] = ["starred", "today", "yesterday", "week", "older"];

export function parseServerTime(value: string): Date {
  const iso = value.trim().replace(" ", "T");
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Starred chats first (their own section), then the rest by how recently they were active,
 *  in the user's local days. Empty groups are left out; order within a group is newest first. */
export function groupConversations(items: ConversationSummary[], now: Date = new Date()): { group: HistoryGroup; items: ConversationSummary[] }[] {
  const today = startOfDay(now);
  const day = 86_400_000;
  const byGroup = new Map<HistoryGroup, ConversationSummary[]>(HISTORY_GROUPS.map((g) => [g, []]));
  const sorted = [...items].sort((a, b) => parseServerTime(b.updated_at).getTime() - parseServerTime(a.updated_at).getTime());
  for (const item of sorted) {
    let group: HistoryGroup;
    if (item.starred) group = "starred";
    else {
      const t = parseServerTime(item.updated_at).getTime();
      group = t >= today ? "today" : t >= today - day ? "yesterday" : t >= today - 7 * day ? "week" : "older";
    }
    byGroup.get(group)!.push(item);
  }
  return HISTORY_GROUPS.map((group) => ({ group, items: byGroup.get(group)! })).filter((g) => g.items.length > 0);
}

/** Fields of a reopened assistant message, in the shape the chat panel renders. */
export type RestoredAnswer = {
  transliteration?: string;
  citations?: string[];
  sources?: { ref: string; type: string; snippet: string; score?: number }[];
  notice?: string;
  confidence?: string;
  mode?: string;
  llmModel?: string | null;
  responseLang?: "en" | "ur" | "hi";
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export function restoreAnswer(meta: Record<string, unknown>): RestoredAnswer {
  const lang = meta.response_lang;
  return {
    transliteration: str(meta.transliteration),
    citations: Array.isArray(meta.citations) ? meta.citations.filter((c): c is string => typeof c === "string") : undefined,
    sources: Array.isArray(meta.sources) ? (meta.sources as RestoredAnswer["sources"]) : undefined,
    notice: str(meta.notice),
    confidence: str(meta.confidence),
    mode: str(meta.mode),
    llmModel: str(meta.llm_model) ?? null,
    responseLang: lang === "ur" || lang === "hi" || lang === "en" ? lang : undefined,
  };
}

export function newConversationId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Older WebViews: RFC 4122 v4 from getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
