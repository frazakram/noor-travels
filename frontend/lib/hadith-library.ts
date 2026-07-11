"use client";

export type FavoriteHadith = {
  id: number;
  reference: string;
  chapter_en?: string;
  arabic: string;
  english: string;
  savedAt: number;
};

export type HotdArchiveEntry = {
  date: string; // YYYY-MM-DD UTC
  id: number;
  reference: string;
  chapter_en?: string;
  arabic: string;
  english: string;
};

const FAVORITES_KEY = "noor-hadith-favorites";
const ARCHIVE_KEY = "noor-hadith-daily-archive";
const MAX_FAVORITES = 200;
const MAX_ARCHIVE = 90;

export function loadHadithFavorites(): FavoriteHadith[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((h) => h?.id && h?.english).slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

function saveFavorites(list: FavoriteHadith[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list.slice(0, MAX_FAVORITES)));
}

export function isHadithFavorite(id: number): boolean {
  return loadHadithFavorites().some((h) => h.id === id);
}

export function toggleHadithFavorite(entry: Omit<FavoriteHadith, "savedAt"> & { savedAt?: number }): FavoriteHadith[] {
  const list = loadHadithFavorites();
  const idx = list.findIndex((h) => h.id === entry.id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift({ ...entry, savedAt: entry.savedAt ?? Date.now() });
  }
  saveFavorites(list);
  return list;
}

export function loadHotdArchive(): HotdArchiveEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((h) => h?.date && h?.english).slice(0, MAX_ARCHIVE);
  } catch {
    return [];
  }
}

export function rememberHotd(entry: Omit<HotdArchiveEntry, "date"> & { date?: string }): HotdArchiveEntry[] {
  const date =
    entry.date ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  const list = loadHotdArchive().filter((h) => h.date !== date);
  list.unshift({
    date,
    id: entry.id,
    reference: entry.reference,
    chapter_en: entry.chapter_en,
    arabic: entry.arabic,
    english: entry.english,
  });
  const next = list.slice(0, MAX_ARCHIVE);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  return next;
}
