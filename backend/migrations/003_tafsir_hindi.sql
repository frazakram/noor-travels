ALTER TABLE ayahs ADD COLUMN IF NOT EXISTS translation_hi TEXT;
ALTER TABLE ayahs ADD COLUMN IF NOT EXISTS transliteration_hi TEXT;

CREATE TABLE IF NOT EXISTS tafsir (
  id SERIAL PRIMARY KEY,
  verse_key TEXT NOT NULL,
  source TEXT NOT NULL,
  text TEXT NOT NULL,
  UNIQUE (verse_key, source)
);

CREATE INDEX IF NOT EXISTS idx_tafsir_verse ON tafsir(verse_key);
