"use client";

import { apiStatic } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";

const DEFAULT_RECITER = "ar.alafasy";
const STORAGE_KEY = "noor-reciter";

type DurationsResponse = {
  reciter: string;
  is_fallback: boolean;
  durations: Record<string, number>;
};

const cache = new Map<string, Record<string, number>>();
const inflight = new Map<string, Promise<Record<string, number>>>();

/** Reads the reciter the user last picked in the surah reader (shared across pages). */
export function getPreferredReciter(): string {
  if (typeof window === "undefined") return DEFAULT_RECITER;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_RECITER;
}

/** Per-surah recitation length (seconds), keyed by surah number as a string. Cached per reciter. */
export async function getSurahDurations(reciter: string): Promise<Record<string, number>> {
  if (cache.has(reciter)) return cache.get(reciter)!;
  const pending = inflight.get(reciter);
  if (pending) return pending;

  const req = apiStatic<DurationsResponse>(`/api/quran/durations?reciter=${encodeURIComponent(reciter)}`)
    .then((d) => {
      const map = d.durations || {};
      cache.set(reciter, map);
      return map;
    })
    .catch(() => ({}) as Record<string, number>)
    .finally(() => {
      inflight.delete(reciter);
    });

  inflight.set(reciter, req);
  return req;
}

/** "12 min" / "1 hr 5 min" — localized. */
export function formatSurahDuration(seconds: number, lang: Lang): string {
  if (!seconds || seconds <= 0) return "";
  const totalMin = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} ${t(lang, "durationMin")}`;
  if (m === 0) return `${h} ${t(lang, "durationHr")}`;
  return `${h} ${t(lang, "durationHr")} ${m} ${t(lang, "durationMin")}`;
}
