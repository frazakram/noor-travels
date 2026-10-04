import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addDays, addRange, applyReview, buildSegments, emptyState, gradeFromScore, schedule, stats, todayQueue, type HifzItem } from "../lib/hifz.ts";

const DAY = "2026-10-05";

describe("buildSegments", () => {
  it("splits a range into passages and folds a lone last ayah into the previous one", () => {
    assert.deepEqual(buildSegments(1, 1, 7, 3).map((s) => [s.from, s.to]), [[1, 3], [4, 7]]);
    assert.deepEqual(buildSegments(112, 1, 4, 2).map((s) => [s.from, s.to]), [[1, 2], [3, 4]]);
    assert.deepEqual(buildSegments(2, 255, 255, 3).map((s) => [s.from, s.to]), [[255, 255]]);
  });
});

describe("scheduling", () => {
  const fresh = (): HifzItem => addRange(emptyState(), 36, 1, 3, DAY).items[0];

  it("brings a lapse back tomorrow and grows intervals with good reviews", () => {
    let item = schedule(fresh(), 2, DAY);
    assert.equal(item.interval, 1);
    item = schedule(item, 2, item.due!);
    assert.equal(item.interval, 4);
    item = schedule(item, 2, item.due!);
    assert.ok(item.interval >= 9, `third good review: ${item.interval} days`);
    const lapsed = schedule(item, 0, item.due!);
    assert.equal(lapsed.interval, 1);
    assert.equal(lapsed.reps, 0);
    assert.equal(lapsed.lapses, 1);
    assert.equal(lapsed.due, addDays(item.due!, 1));
  });

  it("maps Recite scores onto grades", () => {
    assert.deepEqual([9.4, 8, 6, 3].map(gradeFromScore), [3, 2, 1, 0]);
  });
});

describe("todayQueue", () => {
  it("puts due reviews first and limits new passages per day", () => {
    let state = addRange(emptyState(), 1, 1, 7, DAY); // 2 passages
    state = addRange(state, 112, 1, 4, DAY); // 2 more, all new
    assert.equal(todayQueue(state, DAY).length, 1); // newPerDay = 1
    state = applyReview(state, state.items[0].id, 2, DAY); // learned today, due tomorrow
    assert.equal(todayQueue(state, DAY).length, 0); // today's new quota used
    const tomorrow = todayQueue(state, addDays(DAY, 1));
    assert.equal(tomorrow[0].id, state.items[0].id); // the review comes first
    assert.equal(tomorrow.length, 2);
  });

  it("counts ayahs, not passages, in stats, and doesn't add duplicates", () => {
    let state = addRange(emptyState(), 1, 1, 7, DAY);
    state = addRange(state, 1, 1, 7, DAY);
    assert.equal(state.items.length, 2);
    assert.equal(stats(state).planned, 7);
  });
});
