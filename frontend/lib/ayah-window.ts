/**
 * Which ayahs the reader keeps mounted: a window [start, end) of at most MAX_WINDOW ayahs.
 *
 * The reader used to mount ayahs 0..n and only ever grow, so a long surah ended up with every
 * card in the DOM (Al-Baqarah: 286 cards, ~30k nodes, ~420 MB on a budget phone while playing),
 * and a deep link or playback at ayah 200 first rendered the 199 before it. Scrolling down now
 * drops ayahs far above, scrolling up brings them back, and jumps re-center the window.
 * Chromium's scroll anchoring keeps the viewport still when cards above it come and go.
 */
export const AYAH_CHUNK = 18;
export const MAX_WINDOW = AYAH_CHUNK * 3;

export type AyahWindow = { start: number; end: number };

const clampWindow = (start: number, end: number, total: number): AyahWindow => {
  const s = Math.max(0, Math.min(start, Math.max(0, total - 1)));
  const e = Math.min(total, Math.max(end, s + 1));
  return { start: s, end: e };
};

/** First render: start a little above the ayah opened (deep link / resume), or at the top. */
export function initialWindow(index: number, total: number): AyahWindow {
  if (total <= 0) return { start: 0, end: AYAH_CHUNK };
  const i = Math.min(Math.max(0, index), total - 1);
  const start = i <= AYAH_CHUNK ? 0 : i - 3;
  return clampWindow(start, Math.max(start + AYAH_CHUNK, i + 6), total);
}

/** Bottom sentinel reached: mount the next chunk, dropping the oldest above if over budget. */
export function extendDown(w: AyahWindow, total: number): AyahWindow {
  const end = Math.min(total, w.end + AYAH_CHUNK);
  return clampWindow(Math.max(w.start, end - MAX_WINDOW), end, total);
}

/** Top sentinel reached: mount the previous chunk, dropping the farthest below if over budget. */
export function extendUp(w: AyahWindow, total: number): AyahWindow {
  const start = Math.max(0, w.start - AYAH_CHUNK);
  return clampWindow(start, Math.min(w.end, start + MAX_WINDOW), total);
}

/**
 * Make sure ayah `index` (and a little context around it) is mounted. Nearby targets grow the
 * window and trim the far side; a jump re-centers it. Returns the same object when nothing
 * changes, so callers can bail out of a state update.
 */
export function includeIndex(w: AyahWindow, index: number, total: number, after = 6): AyahWindow {
  if (total <= 0) return w;
  const i = Math.min(Math.max(0, index), total - 1);
  const wantEnd = Math.min(total, i + after);
  if (i >= w.start && wantEnd <= w.end) return w;
  const isJump = i < w.start - AYAH_CHUNK || i >= w.end + AYAH_CHUNK;
  if (isJump) return initialWindow(i, total);
  if (i < w.start) {
    const start = Math.max(0, i - 3);
    return clampWindow(start, Math.min(w.end, start + MAX_WINDOW), total);
  }
  return clampWindow(Math.max(w.start, wantEnd - MAX_WINDOW), wantEnd, total);
}
