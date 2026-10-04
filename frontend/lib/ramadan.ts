/**
 * Ramadan mode: derived entirely from data the app already has. The Hijri date comes with the
 * prayer times (AlAdhan, or the device's Umm al-Qura calendar offline), sehri ends at Fajr and
 * iftar is at Maghrib. Pure functions; the UI is components/home/RamadanCard.
 */
import { parseMinutes, secondsInTz, type SalahTimesResponse } from "@/lib/salah";

export type RamadanPhase =
  | { kind: "ramadan"; day: number; daysInMonth: number; year: string }
  | { kind: "soon"; daysLeft: number; year: string };

const RAMADAN = 9;
const SHABAN = 8;
/** How early the "Ramadan begins in N days" teaser appears. */
const TEASER_DAYS = 10;

export function ramadanPhase(hijri: SalahTimesResponse["hijri"]): RamadanPhase | null {
  const month = hijri?.month?.number;
  const day = Number(hijri?.day);
  const year = String(hijri?.year ?? "");
  if (!month || !day) return null;
  if (month === RAMADAN) return { kind: "ramadan", day, daysInMonth: hijri?.month?.days ?? 30, year };
  if (month === SHABAN) {
    const daysLeft = (hijri?.month?.days ?? 30) - day + 1;
    if (daysLeft <= TEASER_DAYS) return { kind: "soon", daysLeft, year: year };
  }
  return null;
}

export type FastEvent = { kind: "sehri" | "iftar" | "sehri-tomorrow"; at: string; secondsLeft: number };

/** The next fasting milestone from now, in the prayer location's timezone. */
export function nextFastEvent(times: SalahTimesResponse, now: Date = new Date()): FastEvent {
  const nowS = secondsInTz(now, times.timezone);
  const fajr = times.timings.fajr;
  const maghrib = times.timings.maghrib;
  const fajrS = parseMinutes(fajr) * 60;
  const maghribS = parseMinutes(maghrib) * 60;
  if (nowS < fajrS) return { kind: "sehri", at: fajr, secondsLeft: fajrS - nowS };
  if (nowS < maghribS) return { kind: "iftar", at: maghrib, secondsLeft: maghribS - nowS };
  // Tomorrow's Fajr is within a minute of today's; good enough for a countdown that refreshes.
  return { kind: "sehri-tomorrow", at: fajr, secondsLeft: 86400 - nowS + fajrS };
}

/** The last ten nights; the odd ones are when the Night of Qadr is sought (Bukhari 1944). */
export function isLastTen(day: number): boolean {
  return day >= 21;
}

export function isOddNight(day: number): boolean {
  return day >= 21 && day % 2 === 1;
}

export type FastMark = "fasted" | "missed";
export type FastLog = Record<number, FastMark>;

const logKey = (year: string) => `noor-ramadan-${year || "current"}`;

export function loadFastLog(year: string): FastLog {
  try {
    const raw = JSON.parse(localStorage.getItem(logKey(year)) ?? "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function saveFastLog(year: string, log: FastLog): void {
  try {
    localStorage.setItem(logKey(year), JSON.stringify(log));
  } catch {
    /* tracking is a convenience; the card still works */
  }
}

/** Tap cycle for a day: unmarked -> fasted -> missed (to make up) -> unmarked. */
export function cycleMark(log: FastLog, day: number): FastLog {
  const next: FastLog = { ...log };
  if (!next[day]) next[day] = "fasted";
  else if (next[day] === "fasted") next[day] = "missed";
  else delete next[day];
  return next;
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
