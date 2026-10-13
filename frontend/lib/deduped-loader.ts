/**
 * Loads a value per key with a single request however many callers ask at once, remembering the
 * most recent `max` results. A failed load is forgotten so the next caller retries.
 *
 * Exists because a per-component fetch of per-page data (every ayah asking for its whole surah's
 * words) once sent ~80 identical requests in a burst and tripped Vercel's DDoS challenge.
 */
export function createDedupedLoader<K, V>(load: (key: K) => Promise<V>, max = 6): (key: K) => Promise<V> {
  const entries = new Map<K, Promise<V>>();
  return (key) => {
    const hit = entries.get(key);
    if (hit) {
      // Refresh recency: Map iterates in insertion order, so re-insert.
      entries.delete(key);
      entries.set(key, hit);
      return hit;
    }
    const pending = load(key);
    entries.set(key, pending);
    pending.catch(() => {
      if (entries.get(key) === pending) entries.delete(key);
    });
    while (entries.size > max) {
      const oldest = entries.keys().next().value as K;
      entries.delete(oldest);
    }
    return pending;
  };
}
