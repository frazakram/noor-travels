import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDedupedLoader } from "../lib/deduped-loader.ts";

describe("createDedupedLoader", () => {
  it("sends one request for any number of simultaneous callers", async () => {
    let calls = 0;
    const load = createDedupedLoader(async (k: number) => {
      calls++;
      return `v${k}`;
    });
    const results = await Promise.all(Array.from({ length: 129 }, () => load(9)));
    assert.equal(calls, 1);
    assert.ok(results.every((r) => r === "v9"));
  });

  it("serves later callers from memory", async () => {
    let calls = 0;
    const load = createDedupedLoader(async (k: number) => (calls++, k));
    await load(1);
    await load(1);
    assert.equal(calls, 1);
  });

  it("forgets a failed load so the next caller retries", async () => {
    let calls = 0;
    const load = createDedupedLoader(async (k: number) => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return k;
    });
    await assert.rejects(load(1));
    assert.equal(await load(1), 1);
    assert.equal(calls, 2);
  });

  it("keeps only the most recently used keys", async () => {
    let calls = 0;
    const load = createDedupedLoader(async (k: number) => (calls++, k), 2);
    await load(1);
    await load(2);
    await load(1); // 1 is now most recent
    await load(3); // evicts 2
    calls = 0;
    await load(1);
    assert.equal(calls, 0);
    await load(2);
    assert.equal(calls, 1);
  });
});
