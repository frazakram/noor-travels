-- RAG response cache for production (Postgres)
CREATE TABLE IF NOT EXISTS rag_cache (
  cache_key TEXT PRIMARY KEY,
  response_json TEXT NOT NULL,
  created_at DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_cache_created ON rag_cache(created_at);
