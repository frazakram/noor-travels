import { apiStatic } from "@/lib/api";
import { createDedupedLoader } from "@/lib/deduped-loader";

export type SurahWords = { ayahs: { verse_key: string; words: { ar: string; tr: string; en: string }[] }[] };

/**
 * Word-by-word data for a whole surah. Every part of the reader that needs it (ayah text, the
 * audio hook's word counts) shares one request per surah, and apiStatic lets the browser/CDN
 * cache it for the day the server allows instead of refetching it on each visit.
 */
export const fetchSurahWords = createDedupedLoader<number, SurahWords>((surah) =>
  apiStatic<SurahWords>(`/api/quran/surahs/${surah}/words`),
);
