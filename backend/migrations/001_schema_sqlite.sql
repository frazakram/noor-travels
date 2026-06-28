-- SQLite schema for local development fallback
DROP TABLE IF EXISTS document_chunks;
DROP TABLE IF EXISTS ayahs;
DROP TABLE IF EXISTS surahs;
DROP TABLE IF EXISTS hadiths;
DROP TABLE IF EXISTS duas;

CREATE TABLE surahs (
  number INTEGER PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_en_translation TEXT,
  revelation_type TEXT,
  ayah_count INTEGER NOT NULL
);

CREATE TABLE ayahs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surah_number INTEGER NOT NULL REFERENCES surahs(number),
  ayah_number INTEGER NOT NULL,
  verse_key TEXT NOT NULL UNIQUE,
  arabic TEXT NOT NULL,
  transliteration TEXT,
  translation_en TEXT,
  translation_ur TEXT,
  juz INTEGER,
  page INTEGER,
  UNIQUE (surah_number, ayah_number)
);

CREATE INDEX idx_ayahs_surah ON ayahs(surah_number);

CREATE TABLE hadiths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection TEXT NOT NULL DEFAULT 'bukhari',
  chapter_id INTEGER,
  chapter_en TEXT,
  hadith_number INTEGER,
  arabic TEXT,
  english TEXT,
  reference TEXT
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  embedding TEXT NOT NULL
);
