/**
 * Ibadah Guide: step-by-step guides to acts of worship (wudu, salah, ghusl, janazah…).
 *
 * Content is data, not code: one JSON file per guide in content/ibadah/, rendered statically.
 * Rules the content follows (checked by backend/tests/test_ibadah_refs.py):
 * - Hanafi fiqh is the default; other views appear only as labelled notes.
 * - Every Quran/hadith reference carries a short `quote` that must appear in that verse's or
 *   hadith's text in this app's own corpus. Hadith numbers are this dataset's numbers, found by
 *   text, never copied from outside (they differ from the common numbering).
 * - A practice with no basis in the corpus is cited as `fiqh` (the school's ruling plus where
 *   it comes from), so a reviewer can see exactly what still needs checking.
 * - Guides are drafted from these sources and shown with a "not yet reviewed" notice until a
 *   scholar has checked them (`status: "reviewed"` plus `reviewedBy`).
 */
import type { Lang } from "@/lib/i18n";

export type Localized = { en: string; ur: string; hi: string };

export type IbadahRef =
  | { kind: "quran"; key: string; quote: string }
  | { kind: "hadith"; collection: "bukhari"; number: number; quote: string }
  | { kind: "fiqh"; text: Localized };

/** Hanafi ruling of a step. */
export type Ruling = "fard" | "wajib" | "sunnah" | "mustahab";

export type IbadahStep = {
  id: string;
  text: Localized;
  ruling?: Ruling;
  /** Arabic to recite at this step (a dua or a phrase). */
  arabic?: string;
  /** Latin-letter pronunciation of `arabic` (shown to everyone; Urdu/Hindi readers use it too). */
  transliteration?: string;
  /** Meaning of `arabic`. */
  meaning?: Localized;
  note?: Localized;
  refs: IbadahRef[];
};

export type IbadahSection = {
  id: string;
  title: Localized;
  /** "steps" are done in order (step-by-step mode walks them); "list" is reference material. */
  kind: "steps" | "list";
  items: IbadahStep[];
};

/** How the guide list is grouped (labels in lib/i18n.ts, order below). */
export const IBADAH_GROUPS = ["purification", "prayer", "ramadan", "hajj", "life"] as const;
export type IbadahGroup = (typeof IBADAH_GROUPS)[number];

export type IbadahGuide = {
  slug: string;
  order: number;
  group: IbadahGroup;
  title: Localized;
  summary: Localized;
  madhhab: "hanafi";
  status: "draft" | "reviewed";
  reviewedBy?: string;
  reviewedOn?: string;
  sections: IbadahSection[];
};

/** Every guide's slug, for the offline pack (tests/ibadah.test.ts keeps it in step with content/ibadah). */
export const IBADAH_SLUGS = [
  "wudu", "salah", "ghusl", "tayammum", "janazah",
  "jumuah", "eid", "witr", "taraweeh", "sajda-sahw", "istikhara", "qasr",
  "umrah", "hajj", "fasting", "zakat-al-fitr", "qurbani", "aqiqah", "nikah", "visiting-graves",
] as const;

export function loc(value: Localized | undefined, lang: Lang): string {
  if (!value) return "";
  return value[lang] || value.en;
}

/** Where a reference opens inside the app (the existing hadith and Quran readers). */
export function refHref(ref: IbadahRef): string | null {
  if (ref.kind === "hadith") return `/hadith/${ref.collection}/${ref.number}`;
  if (ref.kind === "quran") {
    const [surah, ayah] = ref.key.split(":");
    return `/quran/${surah}?ayah=${ayah}`;
  }
  return null;
}

export function refLabel(ref: IbadahRef, lang: Lang): string {
  if (ref.kind === "hadith") return `Sahih al-Bukhari ${ref.number}`;
  if (ref.kind === "quran") return lang === "ur" ? `قرآن ${ref.key}` : lang === "hi" ? `क़ुरआन ${ref.key}` : `Quran ${ref.key}`;
  return loc(ref.text, lang);
}

/** Steps a "do it now" walkthrough visits, in order: every item of every "steps" section. */
export function walkthroughSteps(guide: IbadahGuide): { section: IbadahSection; step: IbadahStep }[] {
  return guide.sections
    .filter((s) => s.kind === "steps")
    .flatMap((section) => section.items.map((step) => ({ section, step })));
}
