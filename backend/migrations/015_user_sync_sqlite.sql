-- See 015_user_sync.sql.
CREATE TABLE IF NOT EXISTS user_sync_docs (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  doc TEXT NOT NULL DEFAULT '{"items": {}}',
  rev INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, namespace)
);
