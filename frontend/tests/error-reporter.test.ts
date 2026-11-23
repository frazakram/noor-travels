import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_PER_PAGE, createQueue, describe as describeError, isNoise } from "../lib/error-reporter.ts";

const report = (message: string, kind: "error" | "react" = "error") => ({ kind, message, platform: "web" as const });

describe("error reporter", () => {
  it("drops noise that is not the app's bug", () => {
    assert.equal(isNoise("Script error."), true);
    assert.equal(isNoise("ResizeObserver loop completed with undelivered notifications."), true);
    assert.equal(isNoise("The user aborted a request."), true);
    assert.equal(isNoise("x is undefined", "at f (chrome-extension://abc/x.js:1:1)"), true);
    assert.equal(isNoise("Cannot read properties of undefined (reading 'verse_key')"), false);
  });

  it("sends each distinct error once and stops at the per-page cap", () => {
    const q = createQueue();
    assert.equal(q.add(report("boom")), true);
    assert.equal(q.add(report("boom")), false);
    assert.equal(q.add(report("boom", "react")), true);
    for (let i = 0; i < 20; i++) q.add(report(`e${i}`));
    assert.equal(q.take().length, MAX_PER_PAGE);
    assert.deepEqual(q.take(), []);
    assert.equal(q.add(report("later")), false);
  });

  it("clips oversized messages and stacks", () => {
    const q = createQueue();
    q.add({ ...report("m".repeat(5000)), stack: "s".repeat(20000) });
    const [r] = q.take();
    assert.equal(r.message.length, 2000);
    assert.equal(r.stack!.length, 8000);
  });

  it("describes anything that can be thrown", () => {
    assert.equal(describeError(new TypeError("bad")).message, "bad");
    assert.equal(describeError("plain").message, "plain");
    assert.equal(describeError({ code: 7 }).message, '{"code":7}');
  });
});
