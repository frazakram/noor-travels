import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AYAH_CHUNK, MAX_WINDOW, extendDown, extendUp, includeIndex, initialWindow } from "../lib/ayah-window.ts";

const size = (w: { start: number; end: number }) => w.end - w.start;

describe("ayah window", () => {
  it("starts at the top, or just above a deep-linked ayah", () => {
    assert.deepEqual(initialWindow(0, 286), { start: 0, end: AYAH_CHUNK });
    assert.deepEqual(initialWindow(10, 286), { start: 0, end: AYAH_CHUNK });
    assert.deepEqual(initialWindow(200, 286), { start: 197, end: 215 });
    assert.deepEqual(initialWindow(285, 286), { start: 282, end: 286 });
    assert.deepEqual(initialWindow(0, 4), { start: 0, end: 4 });
  });

  it("never mounts more than MAX_WINDOW ayahs while scrolling down a long surah", () => {
    let w = initialWindow(0, 286);
    for (let i = 0; i < 40; i++) {
      w = extendDown(w, 286);
      assert.ok(size(w) <= MAX_WINDOW, JSON.stringify(w));
    }
    assert.equal(w.end, 286);
    assert.equal(w.start, 286 - MAX_WINDOW);
  });

  it("brings earlier ayahs back when scrolling up, again within budget", () => {
    let w = { start: 200, end: 254 };
    w = extendUp(w, 286);
    assert.equal(w.start, 182);
    assert.ok(size(w) <= MAX_WINDOW);
    for (let i = 0; i < 20; i++) w = extendUp(w, 286);
    assert.equal(w.start, 0);
    assert.ok(size(w) <= MAX_WINDOW);
  });

  it("keeps the same window when the ayah is already mounted", () => {
    const w = { start: 0, end: 18 };
    assert.equal(includeIndex(w, 5, 286), w);
  });

  it("grows toward a nearby ayah (playback moving on) and trims the far side", () => {
    const w = includeIndex({ start: 0, end: 54 }, 52, 286);
    assert.deepEqual(w, { start: 4, end: 58 });
  });

  it("re-centers on a jump instead of mounting everything before it", () => {
    assert.deepEqual(includeIndex({ start: 0, end: 18 }, 200, 286), initialWindow(200, 286));
    assert.deepEqual(includeIndex({ start: 200, end: 254 }, 2, 286), initialWindow(2, 286));
  });

  it("extends upward for a nearby earlier ayah", () => {
    const w = includeIndex({ start: 100, end: 154 }, 95, 286);
    assert.equal(w.start, 92);
    assert.ok(w.end <= 154 && size(w) <= MAX_WINDOW);
  });
});
