export type PrayerId = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export type PrayerSlot = {
  id: PrayerId;
  start: string;
  end: string;
};

export type SalahTimesResponse = {
  date: string;
  hijri?: {
    date?: string;
    day?: string;
    month?: { number?: number; en?: string; ar?: string };
    year?: string;
    holidays?: string[];
  };
  timezone: string;
  latitude: number;
  longitude: number;
  method: number;
  school: number;
  timings: Record<string, string>;
  prayers: PrayerSlot[];
};

export type LocationResponse = {
  label: string;
  locality: string;
  region: string;
  country: string;
  display_name: string;
  latitude: number;
  longitude: number;
};

export type LocationSearchResult = {
  label: string;
  display_name: string;
  latitude: number;
  longitude: number;
};

export type PrayerOffsets = Record<PrayerId, number>;

export type SalahSettings = {
  method: number;
  school: 0 | 1;
  /** Per-prayer minute adjustments to match the local masjid timetable. */
  offsets: PrayerOffsets;
  /**
   * Aladhan latitudeAdjustmentMethod for high latitudes:
   * 1 Middle of Night, 2 One Seventh, 3 Angle Based (default for polar).
   * 0 / undefined = none (standard).
   */
  latitudeAdjustment?: 0 | 1 | 2 | 3;
};

export const DEFAULT_PRAYER_OFFSETS: PrayerOffsets = {
  fajr: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
};

export const DEFAULT_SALAH_SETTINGS: SalahSettings = {
  method: 1,
  school: 1,
  offsets: DEFAULT_PRAYER_OFFSETS,
  latitudeAdjustment: 0,
};

export const HIGH_LATITUDE_METHODS = [
  { id: 0 as const, labelKey: "highLatNone" as const },
  { id: 1 as const, labelKey: "highLatMiddleNight" as const },
  { id: 2 as const, labelKey: "highLatOneSeventh" as const },
  { id: 3 as const, labelKey: "highLatAngleBased" as const },
];

export const PRAYER_METHODS = [
  { id: 1, label: "Karachi" },
  { id: 2, label: "ISNA" },
  { id: 3, label: "Muslim World League" },
  { id: 4, label: "Umm al-Qura" },
  { id: 5, label: "Egyptian Authority" },
  { id: 7, label: "Tehran" },
  { id: 8, label: "Gulf Region" },
  { id: 12, label: "France" },
  { id: 13, label: "Turkey" },
  { id: 14, label: "Russia" },
  { id: 15, label: "Moonsighting Committee" },
] as const;

export type TimePhase = "fajr" | "morning" | "dhuhr" | "asr" | "maghrib" | "isha" | "night";

const PRAYER_ORDER: PrayerId[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

/** Minutes since midnight in IANA timezone. */
export function minutesInTz(date: Date, tz: string): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Seconds since midnight in the zone; IANA offsets are whole minutes, so seconds are zone-independent. */
function secondsInTz(date: Date, tz: string): number {
  return minutesInTz(date, tz) * 60 + date.getUTCSeconds();
}

export function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Shift HH:mm by ±minutes, wrapping over midnight. */
export function shiftTime(time: string, minutes: number): string {
  if (!time || !Number.isFinite(minutes) || minutes === 0) return time;
  const total = ((parseMinutes(time) + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format HH:mm for display (keeps 24h; UI can wrap with locale later). */
export function formatPrayerClock(time: string): string {
  if (!time || !time.includes(":")) return time;
  return time.slice(0, 5);
}

/** Ms until target HH:mm today or tomorrow in timezone. */
export function msUntilTime(time: string, tz: string, now = new Date()): number {
  let diffSec = parseMinutes(time) * 60 - secondsInTz(now, tz);
  if (diffSec <= 0) diffSec += 24 * 60 * 60;
  return diffSec * 1000;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00m 00s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export type CountdownParts = { h: number | null; m: string; s: string };

/** Same breakdown as formatCountdown, split so a UI can animate each segment independently. */
export function countdownParts(ms: number): CountdownParts {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h: h > 0 ? h : null, m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0") };
}

export type NextPrayerInfo = {
  current: PrayerId | null;
  next: PrayerId;
  countdownMs: number;
  progress: number;
};

function isInPrayerWindow(startMin: number, endMin: number, nowMin: number): boolean {
  if (endMin > startMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // Window crosses midnight (e.g. Isha 20:08 → 00:23)
  return nowMin >= startMin || nowMin < endMin;
}

export function getNextPrayer(prayers: PrayerSlot[], tz: string, now = new Date()): NextPrayerInfo {
  const nowMin = minutesInTz(now, tz);

  const slots = PRAYER_ORDER.map((id) => {
    const p = prayers.find((x) => x.id === id)!;
    return { id, startMin: parseMinutes(p.start), endMin: parseMinutes(p.end) };
  });

  let current: PrayerId | null = null;
  for (const s of slots) {
    if (isInPrayerWindow(s.startMin, s.endMin, nowMin)) {
      current = s.id;
      break;
    }
  }

  let next: PrayerId = "fajr";
  let countdownMs = msUntilTime(prayers.find((p) => p.id === "fajr")!.start, tz, now);

  for (const s of slots) {
    if (nowMin < s.startMin) {
      next = s.id;
      countdownMs = (s.startMin * 60 - secondsInTz(now, tz)) * 1000;
      break;
    }
  }

  const currentSlot = current ? slots.find((s) => s.id === current)! : null;
  let progress = 0;
  if (currentSlot) {
    const windowStart = currentSlot.startMin;
    let windowEnd = currentSlot.endMin;
    let n = nowMin;
    if (windowEnd <= windowStart) {
      windowEnd += 24 * 60;
      if (n < windowStart) n += 24 * 60;
    }
    const total = Math.max(1, windowEnd - windowStart);
    progress = Math.min(1, Math.max(0, (n - windowStart) / total));
  }

  return { current, next, countdownMs, progress };
}

export function getTimePhase(prayers: PrayerSlot[] | null, tz: string, now = new Date()): TimePhase {
  if (prayers) {
    const info = getNextPrayer(prayers, tz, now);
    if (info.current) return info.current;
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hour12: false }).format(now),
    );
    if (hour >= 21 || hour < 4) return "night";
    return info.next === "fajr" ? "night" : "morning";
  }
  const hour = now.getHours();
  if (hour >= 5 && hour < 7) return "fajr";
  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 15) return "dhuhr";
  if (hour >= 15 && hour < 18) return "asr";
  if (hour >= 18 && hour < 20) return "maghrib";
  if (hour >= 20 && hour < 22) return "isha";
  return "night";
}

export function qiblaBearing(lat: number, lng: number): number {
  const kaabaLat = (21.422487 * Math.PI) / 180;
  const kaabaLng = (39.826206 * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const y = Math.sin(kaabaLng - lambda);
  const x = Math.cos(phi) * Math.tan(kaabaLat) - Math.sin(phi) * Math.cos(kaabaLng - lambda);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export const HIJRI_EVENTS = [
  { month: 1, day: 10, name: "Ashura" },
  { month: 8, day: 15, name: "15th Sha'ban" },
  { month: 9, day: 1, name: "Ramadan begins" },
  { month: 9, day: 27, name: "Laylatul Qadr (commonly observed)" },
  { month: 10, day: 1, name: "Eid al-Fitr" },
  { month: 12, day: 9, name: "Day of Arafah" },
  { month: 12, day: 10, name: "Eid al-Adha" },
] as const;

export function upcomingHijriEvent(hijri?: SalahTimesResponse["hijri"]): string {
  const month = hijri?.month?.number;
  const day = Number(hijri?.day);
  if (!month || !day) return "Islamic date loaded";
  const events = HIJRI_EVENTS;
  const current = month * 40 + day;
  const next = events.find((e) => e.month * 40 + e.day >= current) ?? events[0];
  const days = next.month >= month ? (next.month - month) * 30 + (next.day - day) : (12 - month + next.month) * 30 + (next.day - day);
  if (days <= 0) return next.name;
  return `${days} day${days === 1 ? "" : "s"} until ${next.name}`;
}
