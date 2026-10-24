import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { newSessionId, reattachDecision, type NativePlaybackSession } from "../lib/playback-session.ts";

const base: NativePlaybackSession = { sessionId: "s", surah: 9, ayahIndex: 70, playing: true, active: true, updatedAt: 1 };

describe("reattachDecision", () => {
  it("attaches to the surah that is playing, at its ayah", () => {
    assert.deepEqual(reattachDecision(base, 9, 129), { attach: true, index: 70, playing: true, sessionId: "s" });
  });
  it("keeps a paused session attached but not playing", () => {
    assert.deepEqual(reattachDecision({ ...base, playing: false }, 9, 129), { attach: true, index: 70, playing: false, sessionId: "s" });
  });
  it("ignores another surah, an ended session, no session, or no ayahs yet", () => {
    assert.deepEqual(reattachDecision(base, 10, 109), { attach: false });
    assert.deepEqual(reattachDecision({ ...base, active: false }, 9, 129), { attach: false });
    assert.deepEqual(reattachDecision(null, 9, 129), { attach: false });
    assert.deepEqual(reattachDecision(base, 9, 0), { attach: false });
  });
  it("clamps an out-of-range ayah index", () => {
    assert.deepEqual(reattachDecision({ ...base, ayahIndex: 500 }, 9, 129), { attach: true, index: 128, playing: true, sessionId: "s" });
    assert.deepEqual(reattachDecision({ ...base, ayahIndex: -3 }, 9, 129), { attach: true, index: 0, playing: true, sessionId: "s" });
  });
});

describe("newSessionId", () => {
  it("is unique per call", () => {
    assert.notEqual(newSessionId(9), newSessionId(9));
  });
});

import { canResumeNative, isOwnSessionEvent, queueKey, type QueueSettings } from "../lib/playback-session.ts";

describe("isOwnSessionEvent", () => {
  it("applies our own events and drops another session's", () => {
    assert.equal(isOwnSessionEvent("a", "a"), true);
    assert.equal(isOwnSessionEvent("b", "a"), false);
  });
  it("applies id-less events (older APKs) and events before our id is known", () => {
    assert.equal(isOwnSessionEvent(undefined, "a"), true);
    assert.equal(isOwnSessionEvent("", "a"), true);
    assert.equal(isOwnSessionEvent("a", null), true);
  });
});

const settings: QueueSettings = {
  surah: 9, reciter: "ar.alafasy", translation: "en", includeTranslation: true, includeTafsir: false,
  repeatScope: "ayah", repeatCount: 1,
};

describe("queueKey", () => {
  it("changes when anything that shapes the queue changes", () => {
    const k = queueKey(settings);
    assert.equal(queueKey({ ...settings }), k);
    for (const change of [{ reciter: "ar.husary" }, { translation: "ur" }, { includeTranslation: false }, { includeTafsir: true }, { repeatCount: 3 }, { surah: 10 }]) {
      assert.notEqual(queueKey({ ...settings, ...change }), k, JSON.stringify(change));
    }
  });
  it("ignores the range unless repeating a range", () => {
    assert.equal(queueKey({ ...settings, rangeStart: 2 }), queueKey(settings));
    const r = { ...settings, repeatScope: "range" };
    assert.notEqual(queueKey({ ...r, rangeStart: 2 }), queueKey({ ...r, rangeStart: 3 }));
  });
});

describe("canResumeNative", () => {
  const base = { attached: true, playing: false, requestedIndex: 5, pausedIndex: 5, queueKeyAtStart: "k", currentQueueKey: "k" };
  it("resumes the same ayah with unchanged settings", () => assert.equal(canResumeNative(base), true));
  it("starts a new queue otherwise", () => {
    assert.equal(canResumeNative({ ...base, attached: false }), false);
    assert.equal(canResumeNative({ ...base, playing: true }), false);
    assert.equal(canResumeNative({ ...base, requestedIndex: 6 }), false);
    assert.equal(canResumeNative({ ...base, currentQueueKey: "other" }), false);
    assert.equal(canResumeNative({ ...base, queueKeyAtStart: null }), false);
  });
});

import { reconcileDecision } from "../lib/playback-session.ts";

describe("reconcileDecision", () => {
  const live: NativePlaybackSession = { sessionId: "s", surah: 9, ayahIndex: 40, playing: true, active: true, updatedAt: 1 };
  const page = { attached: true, sessionId: "s", surah: 9, ayahCount: 129, now: 1000 };
  it("syncs the ayah and play state of our live session", () => {
    assert.deepEqual(reconcileDecision(live, page), { action: "sync", index: 40, playing: true });
    assert.deepEqual(reconcileDecision({ ...live, playing: false }, page), { action: "sync", index: 40, playing: false });
  });
  it("treats a recently played-out session as finished (auto-play may continue)", () => {
    assert.deepEqual(reconcileDecision({ ...live, active: false, endReason: "finished" }, page), { action: "finished" });
  });
  it("does not auto-play when the app is reopened long after the finish", () => {
    const later = { ...page, now: 1 + 3 * 60 * 1000 };
    assert.deepEqual(reconcileDecision({ ...live, active: false, endReason: "finished" }, later), { action: "reset" });
  });
  it("resets on a stopped, missing or foreign session", () => {
    assert.deepEqual(reconcileDecision({ ...live, active: false, endReason: "stopped" }, page), { action: "reset" });
    assert.deepEqual(reconcileDecision({ ...live, active: false }, page), { action: "reset" });
    assert.deepEqual(reconcileDecision(null, page), { action: "reset" });
    assert.deepEqual(reconcileDecision({ ...live, sessionId: "other" }, page), { action: "reset" });
  });
  it("attaches a page that is not attached yet, or does nothing", () => {
    assert.deepEqual(reconcileDecision(live, { ...page, attached: false, sessionId: null }), { action: "attach", index: 40, playing: true, sessionId: "s" });
    assert.deepEqual(reconcileDecision(live, { ...page, attached: false, sessionId: null, surah: 10 }), { action: "none" });
  });
});
