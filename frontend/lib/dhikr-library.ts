"use client";

export type DhikrProgress = {
  date: string; // YYYY-MM-DD, local time — resets when the day rolls over
  counts: Record<string, number>;
};

const PROGRESS_KEY = "noor-dhikr-progress";
const BOOKMARKS_KEY = "noor-dhikr-bookmarks";
const MAX_BOOKMARKS = 100;

function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function loadDhikrProgress(): DhikrProgress {
  const empty: DhikrProgress = { date: today(), counts: {} };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<DhikrProgress>;
    if (parsed.date !== empty.date || typeof parsed.counts !== "object" || !parsed.counts) {
      return empty; // new day — counters reset
    }
    return { date: parsed.date, counts: parsed.counts };
  } catch {
    return empty;
  }
}

function saveDhikrProgress(progress: DhikrProgress): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

/** Increments an item's count, clamped to `target`. Returns the updated progress. */
export function incrementDhikrCount(id: string, target: number): DhikrProgress {
  const progress = loadDhikrProgress();
  const next = Math.min((progress.counts[id] ?? 0) + 1, Math.max(target, 1));
  const updated = { date: progress.date, counts: { ...progress.counts, [id]: next } };
  saveDhikrProgress(updated);
  return updated;
}

export function resetDhikrCount(id: string): DhikrProgress {
  const progress = loadDhikrProgress();
  const updated = { date: progress.date, counts: { ...progress.counts, [id]: 0 } };
  saveDhikrProgress(updated);
  return updated;
}

export function loadDhikrBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((id) => typeof id === "string").slice(0, MAX_BOOKMARKS) : [];
  } catch {
    return [];
  }
}

export function isDhikrBookmarked(id: string): boolean {
  return loadDhikrBookmarks().includes(id);
}

export function toggleDhikrBookmark(id: string): string[] {
  const list = loadDhikrBookmarks();
  const idx = list.indexOf(id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift(id);
  }
  const next = list.slice(0, MAX_BOOKMARKS);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  return next;
}
