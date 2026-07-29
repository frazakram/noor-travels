/**
 * Library-item tag slug for each surah (index 0 = surah 1), matching the
 * tags baked into public/data/question-library-index.json (e.g. "al-fatiha",
 * "yasin" — not a plain slugify of the transliterated name, a few names
 * diverge: "Ya-Sin" → "yasin", "Aal Imran" → "al-imran").
 */
export const SURAH_LIBRARY_TAG: string[] = [
  "al-fatiha", "al-baqarah", "al-imran", "an-nisa", "al-maidah", "al-anam", "al-araf", "al-anfal", "at-tawbah", "yunus",
  "hud", "yusuf", "ar-rad", "ibrahim", "al-hijr", "an-nahl", "al-isra", "al-kahf", "maryam", "ta-ha",
  "al-anbiya", "al-hajj", "al-muminun", "an-nur", "al-furqan", "ash-shuara", "an-naml", "al-qasas", "al-ankabut", "ar-rum",
  "luqman", "as-sajdah", "al-ahzab", "saba", "fatir", "yasin", "as-saffat", "sad", "az-zumar", "ghafir",
  "fussilat", "ash-shura", "az-zukhruf", "ad-dukhan", "al-jathiyah", "al-ahqaf", "muhammad", "al-fath", "al-hujurat", "qaf",
  "adh-dhariyat", "at-tur", "an-najm", "al-qamar", "ar-rahman", "al-waqiah", "al-hadid", "al-mujadila", "al-hashr", "al-mumtahanah",
  "as-saff", "al-jumuah", "al-munafiqun", "at-taghabun", "at-talaq", "at-tahrim", "al-mulk", "al-qalam", "al-haqqah", "al-maarij",
  "nuh", "al-jinn", "al-muzzammil", "al-muddaththir", "al-qiyamah", "al-insan", "al-mursalat", "an-naba", "an-naziat", "abasa",
  "at-takwir", "al-infitar", "al-mutaffifin", "al-inshiqaq", "al-buruj", "at-tariq", "al-ala", "al-ghashiyah", "al-fajr", "al-balad",
  "ash-shams", "al-layl", "ad-duha", "ash-sharh", "at-tin", "al-alaq", "al-qadr", "al-bayyinah", "az-zalzalah", "al-adiyat",
  "al-qariah", "at-takathur", "al-asr", "al-humazah", "al-fil", "quraysh", "al-maun", "al-kawthar", "al-kafirun", "an-nasr",
  "al-masad", "al-ikhlas", "al-falaq", "an-nas",
];

export function libraryTagForSurah(surahNumber: number): string | undefined {
  return SURAH_LIBRARY_TAG[surahNumber - 1];
}
