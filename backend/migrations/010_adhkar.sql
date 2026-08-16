CREATE TABLE IF NOT EXISTS adhkar (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  title_hi TEXT NOT NULL,
  arabic TEXT NOT NULL,
  transliteration TEXT NOT NULL,
  translation_en TEXT NOT NULL,
  translation_ur TEXT NOT NULL,
  translation_hi TEXT NOT NULL,
  source TEXT NOT NULL,
  repeat_count INTEGER NOT NULL DEFAULT 1,
  -- Set only for items that are exact Quran verses, so the frontend can
  -- fetch real Qari recitation audio via the existing quran_audio endpoint
  -- instead of a mismatched TTS engine (TTS here only supports en/ur/hi).
  -- A multi-verse item (e.g. the closing two ayat of Al-Baqarah) stores a
  -- comma-separated list: "2:285,2:286".
  verse_keys TEXT
);

CREATE INDEX IF NOT EXISTS idx_adhkar_category ON adhkar(category, order_index);
