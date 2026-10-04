import type { SalahSettings, SalahTimesResponse } from "@/lib/salah";

/** Last prayer times shown, so the next open can show them instantly while refreshing. */
export type CachedTimes = { times: SalahTimesResponse; settingsKey: string };

/** Moving less than this doesn't change prayer times meaningfully (~seconds per km). */
export const MOVED_KM = 5;

export function settingsKey(s: SalahSettings): string {
  const o = s.offsets;
  return [s.method, s.school, s.latitudeAdjustment ?? 0, o.fajr, o.dhuhr, o.asr, o.maghrib, o.isha].join("|");
}

/** "DD-MM-YYYY" for today in a timezone, the format the times API returns. */
export function todayInTz(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" })
    .format(now)
    .replace(/\//g, "-");
}

/**
 * Saved times may be shown only if they are for today (in their own timezone, where the
 * prayers happen) and were computed with the same method, school and offsets.
 */
export function usableCachedTimes(entry: unknown, settings: SalahSettings, now: Date = new Date()): SalahTimesResponse | null {
  if (!entry || typeof entry !== "object") return null;
  const { times, settingsKey: key } = entry as Partial<CachedTimes>;
  if (!times || typeof times.date !== "string" || typeof times.timezone !== "string" || !Array.isArray(times.prayers)) return null;
  if (key !== settingsKey(settings)) return null;
  try {
    return times.date === todayInTz(times.timezone, now) ? times : null;
  } catch {
    return null; // unknown timezone name
  }
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
