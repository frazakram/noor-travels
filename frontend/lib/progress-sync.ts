"use client";

/**
 * Keeps a signed-in user's progress the same on all their devices: Quran bookmarks and last read,
 * hadith favorites, adhkar bookmarks and today's counts, the prayer log, and hifz.
 *
 * The stores stay exactly as they were (localStorage, instant, offline). This runs beside them:
 * - a save only fires an event (lib/sync-signal.ts); a few seconds later the changed items are
 *   found by comparing the store with the last synced state, and only those items are sent;
 * - a pull asks only for namespaces whose revision changed, and runs after the page is idle,
 *   when the app comes back to the foreground, or when the device comes back online;
 * - when the page is hidden, pending changes go out at once (keepalive), so closing the app
 *   right after bookmarking doesn't lose the change;
 * - failures are silent and retried later; nothing here ever blocks the UI.
 * Merge rules: lib/progress-sync-core.ts, same as backend/app/api/sync.py.
 */

import { AUTH_CHANGED_EVENT, getToken, getUser } from "@/lib/auth";
import { loadDhikrBookmarks, loadDhikrProgress } from "@/lib/dhikr-library";
import { loadHadithFavorites } from "@/lib/hadith-library";
import { loadState as loadHifz } from "@/lib/hifz";
import {
  NAMESPACES,
  bookmarksCodec,
  canon,
  commitLocal,
  dhikrBookmarksCodec,
  dhikrProgressCodec,
  favoritesCodec,
  hifzCodec,
  lastReadCodec,
  mergeItems,
  salahCodec,
  scoped,
  type LocalItems,
  type Namespace,
  type SyncItems,
} from "@/lib/progress-sync-core";
import { loadBookmarks, loadLastRead } from "@/lib/quran-bookmarks";
import { loadStreak, recomputeStreak } from "@/lib/salah-streak";
import { PROGRESS_CHANGED_EVENT, PROGRESS_SYNCED_EVENT } from "@/lib/sync-signal";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const PUSH_DELAY_MS = 2500;
const START_DELAY_MS = 2500;
const MIN_PULL_GAP_MS = 60_000;

type Store = {
  key: string;
  read(today: string): LocalItems;
  write(items: SyncItems, today: string): string;
  inScope?(id: string, today: string): boolean;
};

const STORES: Record<Namespace, Store> = {
  "quran-bookmarks": {
    key: "noor-quran-bookmarks",
    read: () => bookmarksCodec.toItems(loadBookmarks()),
    write: (items) => JSON.stringify(bookmarksCodec.fromItems(items)),
  },
  "quran-last-read": {
    key: "noor-quran-last-read",
    read: () => lastReadCodec.toItems(loadLastRead()),
    write: (items) => JSON.stringify(lastReadCodec.fromItems(items) ?? loadLastRead()),
  },
  "hadith-favorites": {
    key: "noor-hadith-favorites",
    read: () => favoritesCodec.toItems(loadHadithFavorites()),
    write: (items) => JSON.stringify(favoritesCodec.fromItems(items)),
  },
  "dhikr-bookmarks": {
    key: "noor-dhikr-bookmarks",
    read: () => dhikrBookmarksCodec.toItems(loadDhikrBookmarks()),
    write: (items) => JSON.stringify(dhikrBookmarksCodec.fromItems(items, loadDhikrBookmarks())),
  },
  "dhikr-progress": {
    key: "noor-dhikr-progress",
    read: () => dhikrProgressCodec.toItems(loadDhikrProgress()),
    write: (items) => JSON.stringify(dhikrProgressCodec.fromItems(items, loadDhikrProgress())),
  },
  "salah-streak": {
    key: "noor-salah-streak",
    read: (today) => salahCodec.toItems(loadStreak().logs, today),
    write: (items, today) => {
      const store = loadStreak();
      const logs = salahCodec.fromItems(items, store.logs, today);
      return JSON.stringify(recomputeStreak({ ...store, logs }, Intl.DateTimeFormat().resolvedOptions().timeZone));
    },
    inScope: (id, today) => salahCodec.inScope(id, today),
  },
  hifz: {
    key: "noor-hifz-v1",
    read: () => hifzCodec.toItems(loadHifz()),
    write: (items) => JSON.stringify(hifzCodec.fromItems(items, loadHifz())),
  },
};

// ---------------------------------------------------------------- local sync state

/** Per user and namespace: the last synced items, ids changed here but not yet sent, and the
 *  server revision those items match. Per user, so switching accounts never mixes them. */
type Doc = { items: SyncItems; dirty: string[]; rev: number };

const docKey = (uid: number, ns: Namespace) => `noor-sync-v1:${uid}:${ns}`;
const localDay = () => new Date().toLocaleDateString("en-CA");

function readDoc(uid: number, ns: Namespace): Doc | null {
  try {
    const raw = JSON.parse(localStorage.getItem(docKey(uid, ns)) ?? "null");
    return raw && typeof raw.items === "object" ? { items: raw.items, dirty: raw.dirty ?? [], rev: raw.rev ?? 0 } : null;
  } catch {
    return null;
  }
}

function writeDoc(uid: number, ns: Namespace, doc: Doc): void {
  try {
    localStorage.setItem(docKey(uid, ns), JSON.stringify(doc));
  } catch {
    /* storage full: the next sync redoes the comparison */
  }
}

/** Records what changed in the store since the last sync. */
function commit(uid: number, ns: Namespace): Doc {
  const store = STORES[ns];
  const today = localDay();
  const inScope = store.inScope ? (id: string) => store.inScope!(id, today) : undefined;
  const prev = readDoc(uid, ns);
  const { items, changed } = commitLocal(prev ? scoped(prev.items, inScope) : null, store.read(today), Date.now());
  const doc: Doc = { items, dirty: Array.from(new Set([...(prev?.dirty ?? []), ...changed])), rev: prev?.rev ?? 0 };
  if (!prev || changed.length) writeDoc(uid, ns, doc);
  return doc;
}

// ---------------------------------------------------------------- network

function session(): { uid: number; token: string } | null {
  const token = getToken();
  const uid = getUser()?.id;
  return token && typeof uid === "number" ? { uid, token } : null;
}

let authFailed = false;

async function call<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) authFailed = true;
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return (await res.json()) as T;
}

async function push(uid: number, token: string, ns: Namespace, keepalive = false): Promise<void> {
  const doc = commit(uid, ns);
  if (!doc.dirty.length) return;
  const sent: SyncItems = {};
  for (const id of doc.dirty) if (doc.items[id]) sent[id] = doc.items[id];
  const res = await call<{ base: number; rev: number }>(`/api/sync/${ns}`, token, {
    method: "PUT",
    body: JSON.stringify({ items: sent }),
    keepalive,
  });
  // Re-read: the user may have changed more while the request was out.
  const now = readDoc(uid, ns) ?? doc;
  now.dirty = now.dirty.filter((id) => !sent[id] || now.items[id]?.t !== sent[id].t);
  // If nobody else wrote in between, the server now holds exactly our items: no need to pull them.
  if (res.base === now.rev) now.rev = res.rev;
  writeDoc(uid, ns, now);
}

async function pull(uid: number, token: string): Promise<Namespace[]> {
  const revs = NAMESPACES.map((ns) => `${ns}:${readDoc(uid, ns)?.rev ?? 0}`).join(",");
  const data = await call<{ namespaces: Partial<Record<Namespace, { rev: number; items: SyncItems }>> }>(
    `/api/sync?revs=${encodeURIComponent(revs)}`,
    token,
  );
  const updated: Namespace[] = [];
  const today = localDay();
  for (const ns of NAMESPACES) {
    const remote = data.namespaces?.[ns];
    if (!remote) continue;
    const store = STORES[ns];
    const doc = commit(uid, ns);
    const merged = scoped(
      mergeItems([remote.items ?? {}, doc.items], Date.now()),
      store.inScope ? (id) => store.inScope!(id, today) : undefined,
    );
    if (canon(merged) !== canon(doc.items)) {
      try {
        localStorage.setItem(store.key, store.write(merged, today));
        updated.push(ns);
      } catch {
        continue; // couldn't write: keep the old state, try again next time
      }
    }
    // Ids where the server's version won need no push any more.
    const dirty = doc.dirty.filter((id) => merged[id] && merged[id] === doc.items[id]);
    writeDoc(uid, ns, { items: merged, dirty, rev: remote.rev });
  }
  return updated;
}

// ---------------------------------------------------------------- scheduling

let running: Promise<void> = Promise.resolve();
let lastPull = 0;
const pending = new Set<Namespace>();
let pushTimer: ReturnType<typeof setTimeout> | undefined;

/** Runs sync steps one at a time, so two never interleave on the same documents. */
function serial(step: () => Promise<void>): Promise<void> {
  running = running.then(step).catch(() => undefined);
  return running;
}

export function syncProgressNow(): Promise<void> {
  return serial(async () => {
    const s = session();
    if (!s || authFailed) return;
    lastPull = Date.now();
    const updated = await pull(s.uid, s.token);
    for (const ns of NAMESPACES) await push(s.uid, s.token, ns);
    pending.clear();
    if (updated.length) window.dispatchEvent(new CustomEvent(PROGRESS_SYNCED_EVENT, { detail: updated }));
  });
}

function flushPending(keepalive = false): void {
  if (pushTimer !== undefined) clearTimeout(pushTimer);
  pushTimer = undefined;
  if (!pending.size) return;
  const namespaces = Array.from(pending);
  pending.clear();
  void serial(async () => {
    const s = session();
    if (!s || authFailed) return;
    for (const ns of namespaces) await push(s.uid, s.token, ns, keepalive);
  });
}

/** Wires sync into the page; returns the cleanup. Call once, from the root layout. */
export function wireProgressSync(): () => void {
  const onChange = (e: Event) => {
    const ns = (e as CustomEvent<string>).detail as Namespace;
    if (!session() || !(ns in STORES)) return;
    pending.add(ns);
    if (pushTimer === undefined) pushTimer = setTimeout(() => flushPending(), PUSH_DELAY_MS);
  };
  const onAuth = () => {
    authFailed = false;
    if (session()) void syncProgressNow();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flushPending(true);
    else if (Date.now() - lastPull > MIN_PULL_GAP_MS) void syncProgressNow();
  };
  const onOnline = () => void syncProgressNow();
  const onPageHide = () => flushPending(true);

  window.addEventListener(PROGRESS_CHANGED_EVENT, onChange);
  window.addEventListener(AUTH_CHANGED_EVENT, onAuth);
  window.addEventListener("online", onOnline);
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);
  const start = setTimeout(() => {
    if (session()) void syncProgressNow();
  }, START_DELAY_MS);
  return () => {
    clearTimeout(start);
    window.removeEventListener(PROGRESS_CHANGED_EVENT, onChange);
    window.removeEventListener(AUTH_CHANGED_EVENT, onAuth);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
