-- See 014_client_errors.sql.
CREATE TABLE IF NOT EXISTS client_errors (
  fingerprint TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  path TEXT,
  platform TEXT,
  app_version TEXT,
  build TEXT,
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_errors_last_seen ON client_errors(last_seen);
