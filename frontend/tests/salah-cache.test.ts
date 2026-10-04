import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { distanceKm, settingsKey, todayInTz, usableCachedTimes } from "../lib/salah-cache.ts";

const settings = { method: 1, school: 1 as const, latitudeAdjustment: 0 as const, offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } };
const times = (date: string, timezone = "Asia/Kolkata") => ({ date, timezone, prayers: [{ id: "fajr", start: "04:58", end: "06:16" }] });
// 2026-10-05 20:00 UTC is 06-10-2026 01:30 in Kolkata, still 05-10-2026 in New York.
const now = new Date(Date.UTC(2026, 9, 5, 20, 0));

describe("usableCachedTimes", () => {
  it("uses today's times computed with the same settings", () => {
    const entry = { times: times("06-10-2026"), settingsKey: settingsKey(settings) };
    assert.ok(usableCachedTimes(entry, settings, now));
  });

  it("judges 'today' in the prayer location's timezone, not the phone's", () => {
    assert.equal(usableCachedTimes({ times: times("05-10-2026"), settingsKey: settingsKey(settings) }, settings, now), null);
    assert.ok(usableCachedTimes({ times: times("05-10-2026", "America/New_York"), settingsKey: settingsKey(settings) }, settings, now));
  });

  it("rejects yesterday's times, changed settings, and malformed or missing data", () => {
    const key = settingsKey(settings);
    assert.equal(usableCachedTimes({ times: times("05-10-2026"), settingsKey: key }, settings, now), null);
    assert.equal(usableCachedTimes({ times: times("06-10-2026"), settingsKey: settingsKey({ ...settings, school: 0 }) }, settings, now), null);
    assert.equal(
      usableCachedTimes({ times: times("06-10-2026"), settingsKey: settingsKey({ ...settings, offsets: { ...settings.offsets, isha: 2 } }) }, settings, now),
      null,
    );
    for (const bad of [null, undefined, "x", {}, { times: {}, settingsKey: key }, { times: times("06-10-2026", "Not/AZone"), settingsKey: key }]) {
      assert.equal(usableCachedTimes(bad, settings, now), null);
    }
  });
});

describe("distanceKm", () => {
  it("measures real distances", () => {
    assert.ok(Math.abs(distanceKm({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 }) - 1150) < 15); // Delhi-Mumbai
    assert.ok(distanceKm({ lat: 28.61, lng: 77.21 }, { lat: 28.62, lng: 77.22 }) < 2);
  });
});

describe("todayInTz", () => {
  it("formats as the API's DD-MM-YYYY", () => {
    assert.equal(todayInTz("Asia/Kolkata", now), "06-10-2026");
  });
});
