-- Personal progress synced across a signed-in user's devices (Quran bookmarks, last read,
-- hadith favorites, adhkar bookmarks, prayer streak, hifz). One JSON document per user and
-- namespace: {"items": {id: {"v": value, "t": ms, "d": 1?}}}. The server merges per item (newer
-- t wins; deletions are kept as tombstones so they spread), see app/api/sync.py.
CREATE TABLE IF NOT EXISTS user_sync_docs (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  doc TEXT NOT NULL DEFAULT '{"items": {}}',
  rev INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, namespace)
);
