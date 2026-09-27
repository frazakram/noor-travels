-- Trigram indexes so keyword retrieval's `ILIKE '%term%'` uses an index instead of scanning
-- every row (Ibn Kathir alone is 36 MB). Each expression must match the text expression in
-- app/services/keyword_search.py character for character, or Postgres won't use the index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_ayahs_search_trgm ON ayahs USING gin (
  (COALESCE(translation_en, '') || ' ' || COALESCE(transliteration, '') || ' ' || COALESCE(translation_ur, ''))
  gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS idx_hadiths_search_trgm ON hadiths USING gin (
  (COALESCE(chapter_en, '') || ' ' || COALESCE(english, '')) gin_trgm_ops
);

-- Retrieval scores and shows only the first 2,000 characters of a tafsir entry.
CREATE INDEX IF NOT EXISTS idx_tafsir_head_trgm ON tafsir USING gin (SUBSTR(text, 1, 2000) gin_trgm_ops);
