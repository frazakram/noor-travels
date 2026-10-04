import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computePrayerTimes } from "../lib/salah-offline.ts";

// AlAdhan's answers for 15 March 2026 (a Ramadan day), fetched 2026-10-05 via /api/salah/times.
// The offline calculation must stay within a minute of them for these setups, including the
// India default (Karachi, Hanafi) and Umm al-Qura's Ramadan Isha rule.
const CASES = [
  { city: "Delhi", lat: 28.6139, lng: 77.209, tz: "Asia/Kolkata", method: 1, school: 1, expected: { fajr: "05:13", sunrise: "06:31", dhuhr: "12:30", asr: "16:48", maghrib: "18:29", isha: "19:48", midnight: "00:30" } },
  { city: "Mumbai", lat: 19.076, lng: 72.8777, tz: "Asia/Kolkata", method: 1, school: 0, expected: { fajr: "05:34", sunrise: "06:47", dhuhr: "12:47", asr: "16:10", maghrib: "18:48", isha: "20:01", midnight: "00:48" } },
  { city: "Hyderabad", lat: 17.385, lng: 78.4867, tz: "Asia/Kolkata", method: 3, school: 1, expected: { fajr: "05:12", sunrise: "06:24", dhuhr: "12:25", asr: "16:45", maghrib: "18:26", isha: "19:34", midnight: "00:25" } },
  { city: "Makkah", lat: 21.4225, lng: 39.8262, tz: "Asia/Riyadh", method: 4, school: 0, expected: { fajr: "05:14", sunrise: "06:30", dhuhr: "12:30", asr: "15:53", maghrib: "18:30", isha: "20:30", midnight: "00:30" } },
  // At London's latitude the two libraries' sun-position formulas differ by up to 2 minutes.
  { city: "London", tolerance: 2, lat: 51.5074, lng: -0.1278, tz: "Europe/London", method: 3, school: 1, expected: { fajr: "04:23", sunrise: "06:15", dhuhr: "12:09", asr: "16:08", maghrib: "18:05", isha: "19:51", midnight: "00:10" } },
] as const;

const NOON_UTC_15_MARCH = new Date(Date.UTC(2026, 2, 15, 9, 0));
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const gap = (a: string, b: string) => {
  const d = Math.abs(minutes(a) - minutes(b));
  return Math.min(d, 1440 - d);
};
const noOffsets = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

describe("computePrayerTimes (offline) vs AlAdhan", () => {
  for (const c of CASES) {
    const tolerance = "tolerance" in c ? c.tolerance : 1;
    it(`${c.city}, method ${c.method}, ${c.school ? "Hanafi" : "Shafi"}: every time within ${tolerance} min`, () => {
      const r = computePrayerTimes(c.lat, c.lng, { method: c.method, school: c.school, latitudeAdjustment: 0, offsets: noOffsets }, c.tz, NOON_UTC_15_MARCH);
      assert.equal(r.date, "15-03-2026");
      for (const [prayer, expected] of Object.entries(c.expected)) {
        assert.ok(gap(r.timings[prayer], expected) <= tolerance, `${prayer}: offline ${r.timings[prayer]} vs AlAdhan ${expected}`);
      }
    });
  }

  it("applies per-prayer offsets and chains each prayer's end to the next start", () => {
    const r = computePrayerTimes(28.6139, 77.209, { method: 1, school: 1, latitudeAdjustment: 0, offsets: { ...noOffsets, isha: 15 } }, "Asia/Kolkata", NOON_UTC_15_MARCH);
    assert.ok(gap(r.timings.isha, "20:03") <= 1);
    const byId = Object.fromEntries(r.prayers.map((p) => [p.id, p]));
    assert.equal(byId.fajr.end, r.timings.sunrise);
    assert.equal(byId.maghrib.end, r.timings.isha);
    assert.equal(byId.isha.end, r.timings.midnight);
    assert.equal(r.computedOffline, true);
  });

  it("knows it is Ramadan from the device calendar", () => {
    const r = computePrayerTimes(21.4225, 39.8262, { method: 4, school: 0, latitudeAdjustment: 0, offsets: noOffsets }, "Asia/Riyadh", NOON_UTC_15_MARCH);
    assert.equal(r.hijri?.month?.number, 9);
  });
});
