-- Noor Safar schema
CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS ayahs CASCADE;
DROP TABLE IF EXISTS surahs CASCADE;
DROP TABLE IF EXISTS hadiths CASCADE;
DROP TABLE IF EXISTS duas CASCADE;

CREATE TABLE surahs (
  number INT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_en_translation TEXT,
  revelation_type TEXT,
  ayah_count INT NOT NULL
);

CREATE TABLE ayahs (
  id SERIAL PRIMARY KEY,
  surah_number INT NOT NULL REFERENCES surahs(number),
  ayah_number INT NOT NULL,
  verse_key TEXT NOT NULL UNIQUE,
  arabic TEXT NOT NULL,
  transliteration TEXT,
  translation_en TEXT,
  translation_ur TEXT,
  juz INT,
  page INT,
  UNIQUE (surah_number, ayah_number)
);

CREATE INDEX idx_ayahs_surah ON ayahs(surah_number);
CREATE INDEX idx_ayahs_search ON ayahs USING gin (
  to_tsvector('simple', coalesce(translation_en,'') || ' ' || coalesce(translation_ur,'') || ' ' || coalesce(transliteration,''))
);

CREATE TABLE hadiths (
  id SERIAL PRIMARY KEY,
  collection TEXT NOT NULL DEFAULT 'bukhari',
  chapter_id INT,
  chapter_en TEXT,
  hadith_number INT,
  arabic TEXT,
  english TEXT,
  reference TEXT
);

CREATE INDEX idx_hadiths_search ON hadiths USING gin (
  to_tsvector('simple', coalesce(english,'') || ' ' || coalesce(chapter_en,''))
);

CREATE TABLE duas (
  id TEXT PRIMARY KEY,
  title_en TEXT,
  title_ur TEXT,
  title_hi TEXT,
  arabic TEXT NOT NULL,
  transliteration TEXT,
  translation_en TEXT,
  translation_ur TEXT,
  translation_hi TEXT,
  source TEXT,
  category TEXT DEFAULT 'travel'
);

CREATE TABLE document_chunks (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536)
);

CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
