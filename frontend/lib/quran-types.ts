export type TranslationLang = "en" | "ur" | "hi";

export type Ayah = {
  ayah_number: number;
  verse_key: string;
  arabic: string;
  transliteration: string;
  transliteration_hi?: string;
  translation_en: string;
  translation_ur: string;
  translation_hi?: string;
  translation?: string;
};
