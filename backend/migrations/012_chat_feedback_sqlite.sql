-- See 012_chat_feedback.sql. JSON columns are TEXT here.
CREATE TABLE IF NOT EXISTS chat_feedback (
  id TEXT PRIMARY KEY,
  rating INTEGER NOT NULL CHECK (rating IN (-1, 1)),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations TEXT NOT NULL DEFAULT '[]',
  source_refs TEXT NOT NULL DEFAULT '[]',
  lang TEXT,
  mode TEXT,
  llm_model TEXT,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_feedback_rating_time ON chat_feedback(rating, created_at);
