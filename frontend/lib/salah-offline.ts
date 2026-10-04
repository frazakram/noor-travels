/**
 * Prayer times computed on the device (adhan-js), used when the times API can't be reached:
 * offline, or the server is down. Produces the same SalahTimesResponse shape as
 * /api/salah/times and follows the same rules: AlAdhan's method parameters, school, the
 * high-latitude rule, per-prayer minute offsets, each prayer ending when the next begins,
 * Fajr ending at sunrise and Isha at midnight (midpoint of sunset and sunrise).
 *
 * Checked against AlAdhan for several cities and methods (tests/salah-offline.test.ts).
 */
import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from "adhan";
import type { PrayerId, SalahSettings, SalahTimesResponse } from "@/lib/salah";

/** AlAdhan method id -> parameters for the same organisation's method. */
function methodParams(method: number): CalculationParameters {
  switch (method) {
    case 1:
      return CalculationMethod.Karachi();
    case 2:
      return CalculationMethod.NorthAmerica();
    case 3:
      return CalculationMethod.MuslimWorldLeague();
    case 4:
      return CalculationMethod.UmmAlQura();
    case 5:
      return CalculationMethod.Egyptian();
    case 7:
      return CalculationMethod.Tehran();
    case 8: {
      const p = CalculationMethod.Other();
      p.fajrAngle = 19.5;
      p.ishaInterval = 90;
      return p;
    }
    case 12: {
      const p = CalculationMethod.Other();
      p.fajrAngle = 12;
      p.ishaAngle = 12;
      return p;
    }
    case 13:
      return CalculationMethod.Turkey();
    case 14: {
      const p = CalculationMethod.Other();
      p.fajrAngle = 16;
      p.ishaAngle = 15;
      return p;
    }
    case 15: {
      // adhan-js's preset adds +5 min Dhuhr / +3 min Maghrib that AlAdhan's version doesn't;
      // its seasonal Fajr/Isha matches AlAdhan at mid/high latitudes, not near the tropics.
      const p = CalculationMethod.MoonsightingCommittee();
      p.methodAdjustments = { ...p.methodAdjustments, dhuhr: 0, maghrib: 0 };
      return p;
    }
    default:
      return CalculationMethod.Karachi();
  }
}

/** AlAdhan's default (no latitudeAdjustmentMethod sent) is angle-based, not adhan-js's default. */
function highLatitudeRule(adjustment: number | undefined): CalculationParameters["highLatitudeRule"] {
  if (adjustment === 1) return HighLatitudeRule.MiddleOfTheNight;
  if (adjustment === 2) return HighLatitudeRule.SeventhOfTheNight;
  return HighLatitudeRule.TwilightAngle;
}

function hhmm(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function ddmmyyyy(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(date).replace(/\//g, "-");
}

/** The calendar date "today" in a timezone, as a Date at local noon for adhan-js. */
function calendarDay(now: Date, tz: string): Date {
  const [d, m, y] = ddmmyyyy(now, tz).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

/** Hijri date from the platform calendar (Umm al-Qura); may differ by a day from local sighting. */
function hijriOf(date: Date, tz: string): SalahTimesResponse["hijri"] {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: tz, day: "numeric", month: "numeric", year: "numeric" }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const monthNumber = Number(get("month"));
    const monthName = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: tz, month: "long" }).format(date);
    return {
      day: get("day"),
      month: { number: monthNumber, en: monthName },
      year: get("year").replace(/\D/g, ""),
      date: `${get("day").padStart(2, "0")}-${String(monthNumber).padStart(2, "0")}-${get("year").replace(/\D/g, "")}`,
    };
  } catch {
    return undefined;
  }
}

export function computePrayerTimes(
  lat: number,
  lng: number,
  settings: SalahSettings,
  timezone: string,
  now: Date = new Date(),
): SalahTimesResponse {
  const coords = new Coordinates(lat, lng);
  const params = methodParams(settings.method);
  const hijri = hijriOf(now, timezone);
  // Umm al-Qura sets Isha 120 min after Maghrib in Ramadan (90 otherwise). AlAdhan applies
  // it; adhan-js leaves it to the caller, which made offline Isha 30 min early in Ramadan.
  if (settings.method === 4 && hijri?.month?.number === 9) params.ishaInterval = 120;
  params.madhab = settings.school === 1 ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = highLatitudeRule(settings.latitudeAdjustment);
  const day = calendarDay(now, timezone);
  const today = new PrayerTimes(coords, day, params);
  // Standard midnight: halfway between the astronomical sunset and next sunrise. Built from
  // parameters without the method's minute adjustments (Turkey shifts sunrise/sunset by
  // several minutes for its own rules; AlAdhan's midnight ignores that).
  const plain = methodParams(settings.method);
  plain.methodAdjustments = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
  plain.highLatitudeRule = params.highLatitudeRule;
  const sun = new PrayerTimes(coords, day, plain);
  const nextSun = new PrayerTimes(coords, new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 12), plain);
  const midnight = new Date((sun.sunset.getTime() + nextSun.sunrise.getTime()) / 2);

  const o = settings.offsets;
  const start: Record<PrayerId, string> = {
    fajr: hhmm(addMinutes(today.fajr, o.fajr), timezone),
    dhuhr: hhmm(addMinutes(today.dhuhr, o.dhuhr), timezone),
    asr: hhmm(addMinutes(today.asr, o.asr), timezone),
    maghrib: hhmm(addMinutes(today.maghrib, o.maghrib), timezone),
    isha: hhmm(addMinutes(today.isha, o.isha), timezone),
  };
  const sunrise = hhmm(today.sunrise, timezone);
  const midnightStr = hhmm(midnight, timezone);
  return {
    date: ddmmyyyy(now, timezone),
    hijri,
    timezone,
    latitude: lat,
    longitude: lng,
    method: settings.method,
    school: settings.school,
    computedOffline: true,
    timings: { ...start, sunrise, midnight: midnightStr },
    prayers: [
      { id: "fajr", start: start.fajr, end: sunrise },
      { id: "dhuhr", start: start.dhuhr, end: start.asr },
      { id: "asr", start: start.asr, end: start.maghrib },
      { id: "maghrib", start: start.maghrib, end: start.isha },
      { id: "isha", start: start.isha, end: midnightStr },
    ],
  };
}
