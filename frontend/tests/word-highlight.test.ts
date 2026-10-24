import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getWordHighlight, setWordHighlight, subscribeWordHighlight } from "../lib/word-highlight.ts";

describe("word highlight store", () => {
  it("notifies only when the index actually changes", () => {
    setWordHighlight(-1);
    let calls = 0;
    const off = subscribeWordHighlight(() => calls++);
    setWordHighlight(3);
    setWordHighlight(3);
    setWordHighlight(3);
    setWordHighlight(4);
    assert.equal(calls, 2);
    assert.equal(getWordHighlight(), 4);
    off();
    setWordHighlight(5);
    assert.equal(calls, 2);
  });
});
