"use client";

export type JournalEntry = {
  text: string;
  updatedAt: number;
  /** fajr | isha | other */
  anchor?: "fajr" | "isha" | "other";
};

export type JournalStore = {
  entries: Record<string, JournalEntry>;
  streak: number;
};

const KEY = "noor-gratitude-journal";

function empty(): JournalStore {
  return { entries: {}, streak: 0 };
}

export function loadJournal(): JournalStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const v = JSON.parse(raw);
    return { entries: v.entries ?? {}, streak: Number(v.streak) || 0 };
  } catch {
    return empty();
  }
}

function saveJournal(store: JournalStore): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function todayKey(tz = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function recomputeStreak(store: JournalStore, tz: string): number {
  let streak = 0;
  const d = new Date();
  const today = todayKey(tz);
  if (!store.entries[today]?.text?.trim()) {
    d.setDate(d.getDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
    if (store.entries[key]?.text?.trim()) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

export function saveTodayEntry(
  text: string,
  tz: string,
  anchor: JournalEntry["anchor"] = "other"
): JournalStore {
  const store = loadJournal();
  const key = todayKey(tz);
  const trimmed = text.trim();
  if (!trimmed) {
    delete store.entries[key];
  } else {
    store.entries[key] = { text: trimmed.slice(0, 800), updatedAt: Date.now(), anchor };
  }
  store.streak = recomputeStreak(store, tz);
  saveJournal(store);
  return store;
}

export function getTodayEntry(tz: string): JournalEntry | null {
  return loadJournal().entries[todayKey(tz)] ?? null;
}
