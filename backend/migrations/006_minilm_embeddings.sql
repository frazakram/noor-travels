-- Migrate document_chunks.embedding from vector(1536) to vector(384) for
-- Xenova/all-MiniLM-L6-v2. Drops the old index, alters the column, and
-- recreates an HNSW index suited to 384-dim cosine search.
--
-- Run AFTER re-indexing all corpus chunks with the new model.
-- Existing rows with 1536-dim embeddings will be NULL'd out; they must be
-- re-embedded before semantic search will return results.

BEGIN;

-- Drop dependent index first
DROP INDEX IF EXISTS idx_chunks_embedding;

-- Wipe old embeddings so the column type change succeeds cleanly
UPDATE document_chunks SET embedding = NULL;

-- Change dimension
ALTER TABLE document_chunks
  ALTER COLUMN embedding TYPE vector(384)
  USING NULL::vector(384);

-- HNSW index is better than ivfflat for Vercel (no training phase, works with
-- any number of rows including zero at index-creation time)
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMIT;
