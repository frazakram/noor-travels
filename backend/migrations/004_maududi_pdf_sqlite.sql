CREATE TABLE IF NOT EXISTS tafsir_pdf_pages (
  pdf_page INTEGER PRIMARY KEY,
  mushaf_page INTEGER,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tafsir_pdf_mushaf ON tafsir_pdf_pages(mushaf_page);
