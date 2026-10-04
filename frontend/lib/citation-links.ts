/**
 * Turns source references in chat answers into in-app links to the full text:
 *   Quran 2:153                    -> /quran/2?ayah=153
 *   Tafsir 2:153 (ibn_kathir_en)   -> /quran/2?ayah=153   (the reader shows tafsir per verse)
 *   Sahih al-Bukhari 583           -> /hadith/bukhari/583
 *   Dua anxiety-1                  -> /hadith?section=duas&dua=anxiety-1
 * A reference that doesn't match a known shape gets no link: a wrong link is worse than none.
 */

/** Collections whose numbering in our data is known; the slug is the API's collection value. */
const HADITH_COLLECTIONS: Record<string, string> = {
  "Sahih al-Bukhari": "bukhari",
};

const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77,
  227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36,
  25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

function verseHref(surah: number, ayah: number): string | null {
  const count = SURAH_AYAH_COUNTS[surah - 1];
  if (!count || ayah < 1 || ayah > count) return null;
  return `/quran/${surah}?ayah=${ayah}`;
}

/** In-app link for one reference, or null when it can't be linked with certainty. */
export function citationHref(ref: string): string | null {
  const r = ref.trim().replace(/^\[|\]$/g, "").trim();
  let m = /^(?:Quran|Tafsir) (\d{1,3}):(\d{1,3})(?: \([a-z_]+\))?$/i.exec(r);
  if (m) return verseHref(Number(m[1]), Number(m[2]));
  m = /^Dua ([a-z]+(?:-[a-z0-9]+)+)$/i.exec(r);
  if (m) return `/hadith?section=duas&dua=${encodeURIComponent(m[1])}`;
  for (const [name, slug] of Object.entries(HADITH_COLLECTIONS)) {
    m = new RegExp(`^${name.replace(/[-]/g, "\\-")} (\\d{1,5})$`).exec(r);
    if (m && Number(m[1]) >= 1) return `/hadith/${slug}/${Number(m[1])}`;
  }
  return null;
}

export type Segment = { text: string; href?: string };

const KIND = String.raw`(?:Quran|Tafsir|Dua|Sahih al-Bukhari)`;
/** A bracketed citation, possibly listing several: [Quran 2:153], [Sahih al-Bukhari 1075, 1078]. */
const BRACKET = new RegExp(String.raw`\[(${KIND}[^\]\n]{1,120})\]`, "g");

/**
 * Splits answer text into plain and linked pieces. Inside a bracket, a list continues the
 * previous kind: "[Quran 2:153, 3:200]" links both verses, "[Sahih al-Bukhari 1075, 1078]" both
 * hadith. The visible text is unchanged; only references that resolve become links.
 */
export function linkifyCitations(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(BRACKET)) {
    const start = match.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: "[" });
    const parts = match[1].split(/(,\s*)/);
    let prefix = "";
    for (const part of parts) {
      if (/^,\s*$/.test(part)) {
        out.push({ text: part });
        continue;
      }
      const own = new RegExp(`^(${KIND})\\b`).exec(part);
      if (own) prefix = own[1];
      const ref = own ? part : `${prefix} ${part}`;
      const href = citationHref(ref);
      out.push(href ? { text: part, href } : { text: part });
    }
    out.push({ text: "]" });
    last = start + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
