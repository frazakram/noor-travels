-- Errors reported by the app (web page, WebView, Android native). One row per distinct problem:
-- the server fingerprints each report (kind + message with numbers stripped + first stack frame)
-- and repeats only bump `occurrences`, so the table stays small however often an error fires.
-- No user id, IP or query string is stored.
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
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_errors_last_seen ON client_errors(last_seen);
