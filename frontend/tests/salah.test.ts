import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countdownParts,
  getNextPrayer,
  getTimePhase,
  minutesInTz,
  msUntilTime,
  qiblaBearing,
  shiftTime,
  type PrayerSlot,
} from "../lib/salah.ts";

const IST = "Asia/Kolkata";

// Bengaluru-like day; Isha's window crosses midnight like the real API returns.
const PRAYERS: PrayerSlot[] = [
  { id: "fajr", start: "04:58", end: "06:09" },
  { id: "dhuhr", start: "12:10", end: "15:32" },
  { id: "asr", start: "15:32", end: "18:11" },
  { id: "maghrib", start: "18:11", end: "19:23" },
  { id: "isha", start: "19:23", end: "00:10" },
];

/** A Date that reads as `hh:mm:ss` wall-clock time in IST (UTC+05:30, no DST). */
function ist(hh: number, mm: number, ss = 0): Date {
  return new Date(Date.UTC(2026, 8, 26, hh - 5, mm - 30, ss));
}

describe("minutesInTz", () => {
  it("reads wall-clock minutes in the given zone", () => {
    assert.equal(minutesInTz(ist(13, 45), IST), 13 * 60 + 45);
  });

  it("reports midnight as 0, not 24:00", () => {
    assert.equal(minutesInTz(ist(0, 5), IST), 5);
  });

  it("differs across zones for the same instant", () => {
    const instant = new Date(Date.UTC(2026, 8, 26, 12, 0));
    assert.equal(minutesInTz(instant, "UTC"), 12 * 60);
    assert.equal(minutesInTz(instant, "America/New_York"), 8 * 60);
  });
});

describe("shiftTime", () => {
  it("applies masjid offsets and wraps over midnight both ways", () => {
    assert.equal(shiftTime("04:58", 2), "05:00");
    assert.equal(shiftTime("23:59", 3), "00:02");
    assert.equal(shiftTime("00:01", -5), "23:56");
  });

  it("leaves the time alone for a zero or invalid offset", () => {
    assert.equal(shiftTime("12:10", 0), "12:10");
    assert.equal(shiftTime("12:10", Number.NaN), "12:10");
  });
});

describe("msUntilTime", () => {
  it("counts to later today", () => {
    assert.equal(msUntilTime("12:10", IST, ist(12, 0)), 10 * 60_000);
  });

  it("rolls over to tomorrow once the time has passed", () => {
    assert.equal(msUntilTime("04:58", IST, ist(20, 0)), (8 * 60 + 58) * 60_000);
  });
});

describe("getNextPrayer", () => {
  it("finds the current window and the next prayer mid-day", () => {
    const info = getNextPrayer(PRAYERS, IST, ist(13, 0));
    assert.equal(info.current, "dhuhr");
    assert.equal(info.next, "asr");
    assert.equal(info.countdownMs, (15 * 60 + 32 - 13 * 60) * 60_000);
  });

  it("keeps Isha current after midnight until its window ends", () => {
    const info = getNextPrayer(PRAYERS, IST, ist(0, 5));
    assert.equal(info.current, "isha");
    assert.equal(info.next, "fajr");
  });

  it("has no current prayer between Isha's end and Fajr", () => {
    const info = getNextPrayer(PRAYERS, IST, ist(2, 0));
    assert.equal(info.current, null);
    assert.equal(info.next, "fajr");
    assert.equal(info.countdownMs, (2 * 60 + 58) * 60_000);
  });

  it("counts down to tomorrow's Fajr late in the evening", () => {
    const info = getNextPrayer(PRAYERS, IST, ist(21, 0));
    assert.equal(info.next, "fajr");
    assert.equal(info.countdownMs, (7 * 60 + 58) * 60_000);
  });

  it("counts down with second precision so the timer visibly ticks", () => {
    const info = getNextPrayer(PRAYERS, IST, ist(12, 9, 20));
    assert.equal(info.next, "dhuhr");
    assert.equal(info.countdownMs, 40_000);
  });

  it("reports progress through a window that crosses midnight", () => {
    const info = getNextPrayer(PRAYERS, IST, ist(21, 46, 30));
    assert.equal(info.current, "isha");
    assert.ok(info.progress > 0.49 && info.progress < 0.51, `progress ${info.progress}`);
  });
});

describe("getTimePhase", () => {
  it("follows the active prayer window", () => {
    assert.equal(getTimePhase(PRAYERS, IST, ist(16, 0)), "asr");
    assert.equal(getTimePhase(PRAYERS, IST, ist(18, 30)), "maghrib");
  });

  it("is morning between Fajr's end and Dhuhr, night after Isha ends", () => {
    assert.equal(getTimePhase(PRAYERS, IST, ist(9, 0)), "morning");
    assert.equal(getTimePhase(PRAYERS, IST, ist(2, 0)), "night");
  });
});

describe("countdownParts", () => {
  it("splits and zero-pads, hiding hours under one hour", () => {
    assert.deepEqual(countdownParts(3 * 3_600_000 + 5 * 60_000 + 9_000), { h: 3, m: "05", s: "09" });
    assert.deepEqual(countdownParts(59_000), { h: null, m: "00", s: "59" });
    assert.deepEqual(countdownParts(-1), { h: null, m: "00", s: "00" });
  });
});

describe("qiblaBearing", () => {
  const close = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1, `expected ~${expected}°, got ${actual}°`);

  it("matches published Qibla directions", () => {
    close(qiblaBearing(12.9716, 77.5946), 288.8); // Bengaluru
    close(qiblaBearing(51.5074, -0.1278), 118.99); // London
    close(qiblaBearing(40.7128, -74.006), 58.48); // New York
  });
});
