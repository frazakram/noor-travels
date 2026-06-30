CREATE TABLE IF NOT EXISTS preloaded_khutbahs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  english_text TEXT NOT NULL,
  match_text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_khutbahs_title ON preloaded_khutbahs(title);
