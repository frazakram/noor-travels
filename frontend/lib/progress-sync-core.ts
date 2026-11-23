/**
 * The pure half of progress sync (lib/progress-sync.ts does the I/O). Keep `mergeItems` in step
 * with backend/app/api/sync.py `merge`: both sides must agree on who wins.
 *
 * Model: each synced store (Quran bookmarks, prayer log, …) is seen as a map of items, each with
 * the time it last changed. A removed item stays as a tombstone (`d: 1`) so the removal reaches
 * the other devices instead of them bringing the item back. Per item, the newest change wins, so
 * edits to different items on two devices both survive.
 */

export type SyncItem = { v?: unknown; t: number; d?: 1 };
export type SyncItems = Record<string, SyncItem>;
/** What a store holds right now, as items. `t0` is the item's own creation time if the store
 *  keeps one; it is used only the first time a device syncs, so old local items don't count as
 *  brand-new changes and override newer edits made elsewhere. */
export type LocalItems = Record<string, { v: unknown; t0?: number }>;

export const NAMESPACES = [
  "quran-bookmarks",
  "quran-last-read",
  "hadith-favorites",
  "dhikr-bookmarks",
  "dhikr-progress",
  "salah-streak",
  "hifz",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

const DAY_MS = 86_400_000;
export const TOMBSTONE_MS = 180 * DAY_MS;
export const MAX_ITEMS = 5000;

/** JSON with sorted keys and no undefined fields, so equal values compare equal. */
export function canon(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canon(v))).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(obj[k])}`).join(",")}}`;
}

/** Newest `t` wins per item; a deletion wins a tie; old tombstones and items past MAX_ITEMS go. */
export function mergeItems(docs: SyncItems[], nowMs: number): SyncItems {
  const out: SyncItems = {};
  for (const doc of docs) {
    for (const [key, item] of Object.entries(doc ?? {})) {
      const cur = out[key];
      if (!cur || item.t > cur.t || (item.t === cur.t && item.d && !cur.d)) out[key] = item;
    }
  }
  const cutoff = nowMs - TOMBSTONE_MS;
  let entries = Object.entries(out).filter(([, item]) => !(item.d && item.t < cutoff));
  if (entries.length > MAX_ITEMS) entries = entries.sort((a, b) => b[1].t - a[1].t).slice(0, MAX_ITEMS);
  return Object.fromEntries(entries);
}

/**
 * Compares what the store holds now with the last synced state and stamps every difference with
 * `nowMs`: new or edited items get the new value, items gone from the store become tombstones.
 * With no previous state (first sync on this device) everything is taken as-is, dated `t0`.
 */
export function commitLocal(
  prev: SyncItems | null,
  current: LocalItems,
  nowMs: number,
): { items: SyncItems; changed: string[] } {
  const changed: string[] = [];
  if (!prev) {
    const items: SyncItems = {};
    for (const [id, { v, t0 }] of Object.entries(current)) {
      items[id] = { v, t: t0 ?? 0 };
      changed.push(id);
    }
    return { items, changed };
  }
  const items: SyncItems = { ...prev };
  for (const [id, { v }] of Object.entries(current)) {
    const before = prev[id];
    if (!before || before.d || canon(before.v) !== canon(v)) {
      items[id] = { v, t: nowMs };
      changed.push(id);
    }
  }
  for (const [id, before] of Object.entries(prev)) {
    if (!before.d && !(id in current)) {
      items[id] = { t: nowMs, d: 1 };
      changed.push(id);
    }
  }
  return { items, changed };
}

/** Keeps only the items `inScope` accepts (stores that only sync recent data). */
export function scoped(items: SyncItems, inScope?: (id: string) => boolean): SyncItems {
  if (!inScope) return items;
  return Object.fromEntries(Object.entries(items).filter(([id]) => inScope(id)));
}

/** The live (not deleted) items, newest first. */
export function live(items: SyncItems): [string, SyncItem][] {
  return Object.entries(items)
    .filter(([, item]) => !item.d)
    .sort((a, b) => b[1].t - a[1].t);
}

// ---------------------------------------------------------------- store <-> items

type Bookmark = { verseKey: string; createdAt: number };
type Favorite = { id: number; savedAt: number };
type LastRead = { updatedAt: number };
type DhikrProgress = { date: string; counts: Record<string, number> };
type DayLog = Partial<Record<string, boolean>>;
type HifzState = { version: 1; settings: object; items: { id: string; added: string }[] };

export const bookmarksCodec = {
  toItems: (list: Bookmark[]): LocalItems => Object.fromEntries(list.map((b) => [b.verseKey, { v: b, t0: b.createdAt }])),
  fromItems: <B extends Bookmark>(items: SyncItems): B[] =>
    live(items)
      .map(([, item]) => item.v as B)
      .sort((a, b) => b.createdAt - a.createdAt),
};

export const lastReadCodec = {
  toItems: (last: LastRead | null): LocalItems => (last ? { last: { v: last, t0: last.updatedAt } } : {}),
  fromItems: <L extends LastRead>(items: SyncItems): L | null => {
    const item = items.last;
    return item && !item.d ? (item.v as L) : null;
  },
};

export const favoritesCodec = {
  toItems: (list: Favorite[]): LocalItems => Object.fromEntries(list.map((h) => [String(h.id), { v: h, t0: h.savedAt }])),
  fromItems: <F extends Favorite>(items: SyncItems): F[] =>
    live(items)
      .map(([, item]) => item.v as F)
      .sort((a, b) => b.savedAt - a.savedAt),
};

export const dhikrBookmarksCodec = {
  toItems: (ids: string[]): LocalItems => Object.fromEntries(ids.map((id) => [id, { v: 1 }])),
  /** Newest bookmark first; ties (first sync) keep this device's order. */
  fromItems: (items: SyncItems, current: string[]): string[] => {
    const order = new Map(current.map((id, i) => [id, i]));
    return live(items)
      .sort((a, b) => b[1].t - a[1].t || (order.get(a[0]) ?? 1e9) - (order.get(b[0]) ?? 1e9))
      .map(([id]) => id);
  },
};

/** Today's adhkar counters are one item: they reset daily, so only today's matter. */
export const dhikrProgressCodec = {
  toItems: (p: DhikrProgress): LocalItems => ({ today: { v: p } }),
  fromItems: (items: SyncItems, current: DhikrProgress): DhikrProgress => {
    const item = items.today;
    const v = item && !item.d ? (item.v as DhikrProgress) : null;
    return v && v.date === current.date && v.counts && typeof v.counts === "object" ? v : current;
  },
};

/** One item per prayer marked as prayed ("2026-11-24|fajr"), so marking Fajr on the phone and
 *  Dhuhr on the web the same day keeps both. Only the last SALAH_DAYS sync. */
export const SALAH_DAYS = 400;
export const salahCodec = {
  inScope: (id: string, today: string): boolean => id.slice(0, 10) >= shiftDay(today, -SALAH_DAYS),
  toItems: (logs: Record<string, DayLog>, today: string): LocalItems => {
    const out: LocalItems = {};
    const from = shiftDay(today, -SALAH_DAYS);
    for (const [date, log] of Object.entries(logs)) {
      if (date < from) continue;
      for (const [prayer, done] of Object.entries(log ?? {})) if (done) out[`${date}|${prayer}`] = { v: 1 };
    }
    return out;
  },
  /** Days older than the synced window are kept from this device as they are. */
  fromItems: (items: SyncItems, current: Record<string, DayLog>, today: string): Record<string, DayLog> => {
    const from = shiftDay(today, -SALAH_DAYS);
    const logs: Record<string, DayLog> = Object.fromEntries(Object.entries(current).filter(([date]) => date < from));
    for (const [id] of live(items)) {
      const [date, prayer] = id.split("|");
      if (!date || !prayer || date < from) continue;
      (logs[date] ??= {})[prayer] = true;
    }
    return logs;
  },
};

export const hifzCodec = {
  toItems: (state: HifzState): LocalItems => {
    const out: LocalItems = { settings: { v: state.settings } };
    for (const item of state.items) out[`item:${item.id}`] = { v: item };
    return out;
  },
  fromItems: <S extends HifzState>(items: SyncItems, current: S): S => {
    const settings = items.settings && !items.settings.d ? (items.settings.v as object) : current.settings;
    const list = live(items)
      .filter(([id]) => id.startsWith("item:"))
      .map(([, item]) => item.v as S["items"][number])
      .sort((a, b) => (a.added < b.added ? -1 : a.added > b.added ? 1 : a.id < b.id ? -1 : 1));
    return { ...current, settings, items: list };
  },
};

/** "YYYY-MM-DD" shifted by whole days (calendar arithmetic in UTC, so no DST surprises). */
export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
