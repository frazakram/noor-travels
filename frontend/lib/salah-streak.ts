import type { Lang } from "@/lib/i18n";
import type { PrayerId } from "@/lib/salah";

const STORAGE_KEY = "noor-salah-streak";

export type DayLog = Partial<Record<PrayerId, boolean>>;

export type StreakStore = {
  currentStreak: number;
  longestStreak: number;
  logs: Record<string, DayLog>;
};

function emptyStore(): StreakStore {
  return { currentStreak: 0, longestStreak: 0, logs: {} };
}

export function loadStreak(): StreakStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

export function saveStreak(store: StreakStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function todayKey(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export function yesterdayKey(tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

const ALL_PRAYERS: PrayerId[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export function isDayComplete(log: DayLog | undefined): boolean {
  if (!log) return false;
  return ALL_PRAYERS.every((p) => log[p]);
}

export function countToday(log: DayLog | undefined): number {
  if (!log) return 0;
  return ALL_PRAYERS.filter((p) => log[p]).length;
}

function recomputeStreak(store: StreakStore, tz: string): StreakStore {
  let streak = 0;
  const check = new Date();
  const today = todayKey(tz);
  if (!isDayComplete(store.logs[today])) {
    check.setDate(check.getDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(check);
    if (isDayComplete(store.logs[key])) {
      streak += 1;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return {
    ...store,
    currentStreak: streak,
    longestStreak: Math.max(store.longestStreak, streak),
  };
}

export function togglePrayer(prayer: PrayerId, tz: string): StreakStore {
  const store = loadStreak();
  const key = todayKey(tz);
  const day = { ...(store.logs[key] ?? {}) };
  day[prayer] = !day[prayer];
  store.logs[key] = day;
  const updated = recomputeStreak(store, tz);
  saveStreak(updated);
  return updated;
}

export function getTodayLog(tz: string): DayLog {
  return loadStreak().logs[todayKey(tz)] ?? {};
}

export function getWeekLogs(
  tz: string,
  lang: Lang = "en",
): Array<{ key: string; label: string; log: DayLog; prayed: number; missed: number }> {
  const store = loadStreak();
  const locale = lang === "ur" ? "ur-PK" : lang === "hi" ? "hi-IN" : "en-US";
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
    const label = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "short" }).format(d);
    const log = store.logs[key] ?? {};
    const prayed = countToday(log);
    days.push({ key, label, log, prayed, missed: 5 - prayed });
  }
  return days;
}

export function getMissedToday(tz: string): number {
  return Math.max(0, 5 - countToday(getTodayLog(tz)));
}

export type PeriodStats = {
  daysTracked: number;
  daysComplete: number;
  prayersPrayed: number;
  prayersPossible: number;
  completionPct: number;
  qadaRemaining: number;
};

function dateKeysInRange(tz: string, daysBack: number): string[] {
  const keys: string[] = [];
  const d = new Date();
  for (let i = 0; i < daysBack; i++) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
    keys.push(key);
    d.setDate(d.getDate() - 1);
  }
  return keys;
}

export function getPeriodStats(tz: string, daysBack: number): PeriodStats {
  const store = loadStreak();
  const keys = dateKeysInRange(tz, daysBack);
  let daysTracked = 0;
  let daysComplete = 0;
  let prayersPrayed = 0;

  for (const key of keys) {
    const log = store.logs[key];
    if (!log) continue;
    const prayed = countToday(log);
    if (prayed === 0) continue;
    daysTracked += 1;
    prayersPrayed += prayed;
    if (isDayComplete(log)) daysComplete += 1;
  }

  const prayersPossible = daysTracked * 5;
  const qadaRemaining = Math.max(0, prayersPossible - prayersPrayed);
  const completionPct =
    prayersPossible > 0 ? Math.round((prayersPrayed / prayersPossible) * 100) : 0;

  return {
    daysTracked,
    daysComplete,
    prayersPrayed,
    prayersPossible,
    completionPct,
    qadaRemaining,
  };
}

export function getMonthStats(tz: string): PeriodStats {
  return getPeriodStats(tz, 30);
}

export function getYearStats(tz: string): PeriodStats {
  return getPeriodStats(tz, 365);
}
