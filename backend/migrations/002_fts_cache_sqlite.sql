CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  source_ref,
  content,
  source_type UNINDEXED,
  chunk_id UNINDEXED,
  tokenize='unicode61 remove_diacritics 0'
);

-- Populate FTS from document_chunks (idempotent: clear + rebuild)
DELETE FROM chunks_fts;

INSERT INTO chunks_fts(rowid, source_ref, content, source_type, chunk_id)
SELECT id, source_ref, content, source_type, id FROM document_chunks;

CREATE TABLE IF NOT EXISTS rag_cache (
  cache_key TEXT PRIMARY KEY,
  response_json TEXT NOT NULL,
  created_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_cache_created ON rag_cache(created_at);
