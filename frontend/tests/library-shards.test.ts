import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ANSWER_SHARD_COUNT, answerShardOf, answerShardPath } from "../lib/library-shards.ts";

const PUBLIC = new URL("../public", import.meta.url);
const index = JSON.parse(readFileSync(new URL("public/data/question-library-index.json", new URL("../", import.meta.url)), "utf-8"));

describe("answer shards", () => {
  it("has exactly one file per shard", () => {
    assert.equal(readdirSync(new URL("public/data/answers", new URL("../", import.meta.url))).length, ANSWER_SHARD_COUNT);
  });

  it("finds every library question's answer in the shard the frontend computes (matches the Python writer)", () => {
    const shards = new Map<number, Record<string, unknown>>();
    const missing: string[] = [];
    for (const item of index.items as { id: string }[]) {
      const n = answerShardOf(item.id);
      if (!shards.has(n)) {
        shards.set(n, JSON.parse(readFileSync(new URL(`${PUBLIC.pathname}${answerShardPath(item.id)}`, "file://"), "utf-8")));
      }
      if (!shards.get(n)![item.id]) missing.push(item.id);
    }
    assert.deepEqual(missing.slice(0, 5), [], `${missing.length} ids not found in their computed shard`);
  });

  it("is stable for a known id", () => {
    assert.equal(answerShardPath("q-0001"), `/data/answers/${answerShardOf("q-0001")}.json`);
    assert.ok(answerShardOf("q-0001") >= 0 && answerShardOf("q-0001") < ANSWER_SHARD_COUNT);
  });
});
