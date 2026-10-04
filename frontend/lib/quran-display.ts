export function cleanQuranText(text?: string | null): string {
  return (text ?? "")
    .replace(/\s+[-–—]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Al Quran Cloud uthmani often prepends Bismillah to ayah 1; strip when shown separately. */
const LEADING_BISMILLAH =
  /^[\uFEFF\s]*بِسْمِ[\s\u00A0]*ٱللَّهِ[\s\u00A0]*ٱلرَّحْمَٰنِ[\s\u00A0]*ٱلرَّحِيمِ[\s\u00A0]*/u;

export function stripLeadingBismillah(text?: string | null): string {
  return cleanQuranText((text ?? "").replace(LEADING_BISMILLAH, ""));
}

/**
 * An ayah's own Arabic text: verse 1 of every surah except Al-Fatiha (where the Bismillah IS
 * verse 1) and At-Tawbah (which has none) comes with the Bismillah prepended in the source.
 */
export function ayahArabic(verseKey: string, arabic?: string | null): string {
  const [surah, ayah] = verseKey.split(":").map(Number);
  return ayah === 1 && surah !== 1 && surah !== 9 ? stripLeadingBismillah(arabic) : cleanQuranText(arabic);
}

export function displaySurahName(number: number, name: string): string {
  if (number === 10 && name.toLowerCase() === "jonas") return "Jonah";
  return name;
}
