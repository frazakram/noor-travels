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
  verse_keys TEXT
);

CREATE INDEX IF NOT EXISTS idx_adhkar_category ON adhkar(category, order_index);
