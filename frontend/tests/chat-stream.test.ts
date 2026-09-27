import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEvents } from "../lib/chat-stream.ts";

describe("parseEvents", () => {
  it("returns complete lines and keeps the unfinished tail", () => {
    const { events, rest } = parseEvents('{"type":"stage","stage":"understanding"}\n{"type":"stage","sta');
    assert.deepEqual(events, [{ type: "stage", stage: "understanding" }]);
    assert.equal(rest, '{"type":"stage","sta');
  });

  it("reassembles an event split across network chunks", () => {
    const first = parseEvents('{"type":"stage","stage":"searching","keywords":["pati');
    const second = parseEvents(first.rest + 'ence"]}\n');
    assert.deepEqual(second.events, [{ type: "stage", stage: "searching", keywords: ["patience"] }]);
    assert.equal(second.rest, "");
  });

  it("skips blank keep-alive lines and non-JSON noise", () => {
    const { events } = parseEvents('\n: ping\n{"type":"result","result":{"answer":"ok"}}\n');
    assert.deepEqual(events, [{ type: "result", result: { answer: "ok" } }]);
  });

  it("keeps Urdu and Hindi text intact", () => {
    const { events } = parseEvents('{"type":"stage","stage":"searching","keywords":["صبر","सब्र"]}\n');
    assert.deepEqual(events[0], { type: "stage", stage: "searching", keywords: ["صبر", "सब्र"] });
  });
});
