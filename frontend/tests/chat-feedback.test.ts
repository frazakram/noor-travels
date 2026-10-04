import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { newFeedbackId } from "../lib/chat-feedback.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("newFeedbackId", () => {
  it("matches the id format the backend accepts", () => {
    for (let i = 0; i < 50; i++) assert.match(newFeedbackId(), UUID);
  });

  it("still produces valid, unique ids without crypto.randomUUID (old WebViews)", () => {
    const original = crypto.randomUUID;
    try {
      // @ts-expect-error simulate a runtime without randomUUID
      crypto.randomUUID = undefined;
      const ids = new Set(Array.from({ length: 200 }, () => newFeedbackId()));
      assert.equal(ids.size, 200);
      for (const id of ids) assert.match(id, UUID);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
