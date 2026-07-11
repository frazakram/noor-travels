"use client";

export type QuranLastRead = {
  surah: number;
  ayah: number;
  surahName?: string;
  updatedAt: number;
};

export type QuranBookmark = {
  surah: number;
  ayah: number;
  verseKey: string;
  surahName?: string;
  note?: string;
  createdAt: number;
};

const LAST_READ_KEY = "noor-quran-last-read";
const BOOKMARKS_KEY = "noor-quran-bookmarks";
const MAX_BOOKMARKS = 100;

export function loadLastRead(): QuranLastRead | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v?.surah || !v?.ayah) return null;
    return {
      surah: Number(v.surah),
      ayah: Number(v.ayah),
      surahName: typeof v.surahName === "string" ? v.surahName : undefined,
      updatedAt: Number(v.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveLastRead(entry: Omit<QuranLastRead, "updatedAt"> & { updatedAt?: number }): void {
  const next: QuranLastRead = {
    surah: entry.surah,
    ayah: entry.ayah,
    surahName: entry.surahName,
    updatedAt: entry.updatedAt ?? Date.now(),
  };
  localStorage.setItem(LAST_READ_KEY, JSON.stringify(next));
}

export function loadBookmarks(): QuranBookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((b) => b?.surah && b?.ayah && b?.verseKey)
      .map((b) => ({
        surah: Number(b.surah),
        ayah: Number(b.ayah),
        verseKey: String(b.verseKey),
        surahName: typeof b.surahName === "string" ? b.surahName : undefined,
        note: typeof b.note === "string" ? b.note : undefined,
        createdAt: Number(b.createdAt) || Date.now(),
      }))
      .slice(0, MAX_BOOKMARKS);
  } catch {
    return [];
  }
}

function saveBookmarks(list: QuranBookmark[]): void {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list.slice(0, MAX_BOOKMARKS)));
}

export function isBookmarked(verseKey: string): boolean {
  return loadBookmarks().some((b) => b.verseKey === verseKey);
}

export function toggleBookmark(entry: Omit<QuranBookmark, "createdAt"> & { createdAt?: number }): QuranBookmark[] {
  const list = loadBookmarks();
  const idx = list.findIndex((b) => b.verseKey === entry.verseKey);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift({
      surah: entry.surah,
      ayah: entry.ayah,
      verseKey: entry.verseKey,
      surahName: entry.surahName,
      note: entry.note,
      createdAt: entry.createdAt ?? Date.now(),
    });
  }
  saveBookmarks(list);
  return list;
}
