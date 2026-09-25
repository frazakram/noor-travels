/** Must match backend/ingestion/library_shards.py — tests/library-shards.test.ts checks every id. */
export const ANSWER_SHARD_COUNT = 128;

export function answerShardOf(id: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(id)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % ANSWER_SHARD_COUNT;
}

export function answerShardPath(id: string): string {
  return `/data/answers/${answerShardOf(id)}.json`;
}
