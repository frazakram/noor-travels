import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cycleMark, formatCountdown, isOddNight, nextFastEvent, ramadanPhase } from "../lib/ramadan.ts";

const times = (fajr: string, maghrib: string) => ({ timezone: "Asia/Kolkata", timings: { fajr, maghrib } }) as never;
// 2026-10-05 00:30 UTC is 06:00 in Kolkata.
const at = (hh: number, mm: number) => new Date(Date.UTC(2026, 9, 5, hh, mm) - 330 * 60_000);

describe("ramadanPhase", () => {
  it("detects Ramadan and the last days of Sha'ban from the Hijri date", () => {
    assert.deepEqual(ramadanPhase({ day: "12", month: { number: 9, days: 30 }, year: "1447" }), { kind: "ramadan", day: 12, daysInMonth: 30, year: "1447" });
    assert.deepEqual(ramadanPhase({ day: "25", month: { number: 8, days: 30 }, year: "1447" }), { kind: "soon", daysLeft: 6, year: "1447" });
    assert.equal(ramadanPhase({ day: "5", month: { number: 8 }, year: "1447" }), null);
    assert.equal(ramadanPhase({ day: "5", month: { number: 10 }, year: "1447" }), null);
    assert.equal(ramadanPhase(undefined), null);
  });
});

describe("nextFastEvent", () => {
  it("counts down to sehri's end, then iftar, then tomorrow's sehri", () => {
    const t = times("05:00", "18:30");
    assert.deepEqual(nextFastEvent(t, at(4, 0)), { kind: "sehri", at: "05:00", secondsLeft: 3600 });
    assert.deepEqual(nextFastEvent(t, at(18, 0)), { kind: "iftar", at: "18:30", secondsLeft: 1800 });
    assert.deepEqual(nextFastEvent(t, at(23, 0)), { kind: "sehri-tomorrow", at: "05:00", secondsLeft: 6 * 3600 });
  });

  it("formats the countdown as h:mm:ss", () => {
    assert.equal(formatCountdown(3661), "1:01:01");
    assert.equal(formatCountdown(-5), "0:00:00");
  });
});

describe("tracker", () => {
  it("marks only odd nights of the last ten and cycles a day's mark", () => {
    assert.deepEqual([20, 21, 22, 27, 29, 30].map(isOddNight), [false, true, false, true, true, false]);
    let log = cycleMark({}, 3);
    assert.equal(log[3], "fasted");
    log = cycleMark(log, 3);
    assert.equal(log[3], "missed");
    log = cycleMark(log, 3);
    assert.equal(3 in log, false);
  });
});
