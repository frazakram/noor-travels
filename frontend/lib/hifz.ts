/**
 * Hifz (memorisation) planner: spaced repetition over short segments of ayahs.
 *
 * A segment is a few consecutive ayahs (default 3, what Recite scores in one attempt). Each
 * review gets a grade, from the user or from a Recite score, and the next review is scheduled
 * with an SM-2 style rule: well-recited segments come back after growing intervals, a lapse
 * brings one back tomorrow. Pure functions over a plain JSON state kept on the device.
 */

export type Grade = 0 | 1 | 2 | 3; // again, hard, good, easy

export type HifzItem = {
  id: string; // "36:1-3"
  surah: number;
  from: number;
  to: number;
  added: string; // yyyy-mm-dd
  reps: number; // successful reviews in a row
  lapses: number;
  ease: number;
  interval: number; // days
  due: string | null; // null = new, not yet learned
  lastScore?: number; // last Recite score (0-10)
  history: { date: string; grade: Grade; score?: number }[];
};

export type HifzSettings = { newPerDay: number; segmentSize: number };
export type HifzState = { version: 1; settings: HifzSettings; items: HifzItem[] };

export const DEFAULT_SETTINGS: HifzSettings = { newPerDay: 1, segmentSize: 3 };
export const STRONG_DAYS = 21; // an interval this long counts as memorised
const START_EASE = 2.5;
const MIN_EASE = 1.3;

export function emptyState(): HifzState {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, items: [] };
}

/** Local calendar date as yyyy-mm-dd (reviews are due by day, in the user's own day). */
export function dayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

export function segmentId(surah: number, from: number, to: number): string {
  return from === to ? `${surah}:${from}` : `${surah}:${from}-${to}`;
}

/** Splits an ayah range into segments; a last segment of 1 joins the previous one. */
export function buildSegments(surah: number, from: number, to: number, size: number): { surah: number; from: number; to: number }[] {
  const segments: { surah: number; from: number; to: number }[] = [];
  const step = Math.max(1, Math.floor(size));
  for (let start = from; start <= to; start += step) {
    segments.push({ surah, from: start, to: Math.min(to, start + step - 1) });
  }
  const last = segments[segments.length - 1];
  if (segments.length > 1 && step > 1 && last.from === last.to) {
    segments.pop();
    segments[segments.length - 1].to = last.to;
  }
  return segments;
}

/** Adds a range to the plan as new segments, skipping any already planned. */
export function addRange(state: HifzState, surah: number, from: number, to: number, today: string): HifzState {
  const have = new Set(state.items.map((i) => i.id));
  const added = buildSegments(surah, Math.min(from, to), Math.max(from, to), state.settings.segmentSize)
    .map((s) => ({ ...s, id: segmentId(s.surah, s.from, s.to) }))
    .filter((s) => !have.has(s.id))
    .map<HifzItem>((s) => ({ ...s, added: today, reps: 0, lapses: 0, ease: START_EASE, interval: 0, due: null, history: [] }));
  return { ...state, items: [...state.items, ...added] };
}

/** Recite scores 0-10. A score tells how well the segment is known; mapped onto the grades. */
export function gradeFromScore(score: number): Grade {
  if (score >= 9) return 3;
  if (score >= 7.5) return 2;
  if (score >= 5) return 1;
  return 0;
}

/** The interval (days) a grade would schedule, without changing anything: shown on buttons. */
export function previewInterval(item: HifzItem, grade: Grade): number {
  return schedule(item, grade, "2000-01-01").interval;
}

/** SM-2 style update. Again resets the streak and brings the segment back tomorrow. */
export function schedule(item: HifzItem, grade: Grade, today: string, score?: number): HifzItem {
  let { reps, lapses, ease, interval } = item;
  if (grade === 0) {
    reps = 0;
    lapses += 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
    interval = 1;
  } else {
    reps += 1;
    if (grade === 1) ease = Math.max(MIN_EASE, ease - 0.15);
    if (grade === 3) ease += 0.15;
    if (reps === 1) interval = grade === 3 ? 3 : 1;
    else if (reps === 2) interval = grade === 1 ? 2 : grade === 3 ? 7 : 4;
    else interval = Math.round(interval * (grade === 1 ? 1.2 : grade === 3 ? ease * 1.3 : ease));
    interval = Math.max(1, Math.min(interval, 365));
  }
  return {
    ...item,
    reps,
    lapses,
    ease: Math.round(ease * 100) / 100,
    interval,
    due: addDays(today, interval),
    lastScore: score ?? item.lastScore,
    history: [...item.history, { date: today, grade, ...(score != null ? { score } : {}) }].slice(-30),
  };
}

export function applyReview(state: HifzState, id: string, grade: Grade, today: string, score?: number): HifzState {
  return { ...state, items: state.items.map((i) => (i.id === id ? schedule(i, grade, today, score) : i)) };
}

export function removeItem(state: HifzState, id: string): HifzState {
  return { ...state, items: state.items.filter((i) => i.id !== id) };
}

/**
 * Today's session: every review due today or earlier (oldest first), then new segments in
 * plan order, limited to newPerDay minus new ones already started today.
 */
export function todayQueue(state: HifzState, today: string): HifzItem[] {
  const due = state.items.filter((i) => i.due !== null && i.due <= today).sort((a, b) => (a.due! < b.due! ? -1 : 1));
  const startedToday = state.items.filter((i) => i.history[0]?.date === today).length;
  const fresh = state.items.filter((i) => i.due === null).slice(0, Math.max(0, state.settings.newPerDay - startedToday));
  return [...due, ...fresh];
}

export function stats(state: HifzState) {
  const ayahs = (i: HifzItem) => i.to - i.from + 1;
  const sum = (items: HifzItem[]) => items.reduce((n, i) => n + ayahs(i), 0);
  return {
    planned: sum(state.items),
    learning: sum(state.items.filter((i) => i.due !== null && i.interval < STRONG_DAYS)),
    strong: sum(state.items.filter((i) => i.interval >= STRONG_DAYS)),
    fresh: sum(state.items.filter((i) => i.due === null)),
  };
}

const STORAGE_KEY = "noor-hifz-v1";

export function loadState(): HifzState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (raw?.version === 1 && Array.isArray(raw.items)) return { ...emptyState(), ...raw, settings: { ...DEFAULT_SETTINGS, ...raw.settings } };
  } catch {
    /* corrupt or blocked storage: start empty rather than crash */
  }
  return emptyState();
}

export function saveState(state: HifzState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the session still works, it just won't persist */
  }
}
