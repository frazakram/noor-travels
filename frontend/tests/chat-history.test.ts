import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupConversations, newConversationId, parseServerTime, restoreAnswer } from "../lib/chat-history-model.ts";

describe("parseServerTime", () => {
  it("reads SQLite and Postgres UTC timestamps as the same instant", () => {
    const want = Date.UTC(2026, 9, 5, 10, 30, 0);
    assert.equal(parseServerTime("2026-10-05 10:30:00").getTime(), want);
    assert.equal(parseServerTime("2026-10-05 10:30:00+00:00").getTime(), want);
    assert.equal(parseServerTime("2026-10-05 16:00:00+05:30").getTime(), want);
    assert.equal(parseServerTime("2026-10-05 10:30:00.123456+00:00").getTime(), want + 123);
  });
});

describe("groupConversations", () => {
  const now = new Date(2026, 9, 5, 15, 0); // local time
  const at = (d: Date) => d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  const item = (id: string, d: Date, starred = false) => ({ id, title: id, starred, updated_at: at(d) });

  it("puts starred chats first, then today / yesterday / this week / older by local day", () => {
    const groups = groupConversations(
      [
        item("old", new Date(2026, 8, 1)),
        item("today-early", new Date(2026, 9, 5, 0, 5)),
        item("starred-old", new Date(2026, 0, 1), true),
        item("yesterday", new Date(2026, 9, 4, 23, 59)),
        item("today-late", new Date(2026, 9, 5, 14, 0)),
        item("week", new Date(2026, 9, 1)),
      ],
      now,
    );
    assert.deepEqual(
      groups.map((g) => [g.group, g.items.map((i) => i.id)]),
      [
        ["starred", ["starred-old"]],
        ["today", ["today-late", "today-early"]],
        ["yesterday", ["yesterday"]],
        ["week", ["week"]],
        ["older", ["old"]],
      ],
    );
  });

  it("leaves out empty groups", () => {
    assert.deepEqual(groupConversations([], now), []);
  });
});

describe("restoreAnswer", () => {
  it("maps saved meta back to what the chat panel renders and ignores junk", () => {
    const r = restoreAnswer({ citations: ["Quran 2:153", 5], response_lang: "ur", llm_model: "m", confidence: "high", sources: [{ ref: "Quran 2:153", type: "quran", snippet: "s" }] });
    assert.deepEqual(r.citations, ["Quran 2:153"]);
    assert.equal(r.responseLang, "ur");
    assert.equal(r.llmModel, "m");
    assert.equal(r.sources?.length, 1);
    assert.equal(restoreAnswer({ response_lang: "fr" }).responseLang, undefined);
    assert.equal(restoreAnswer({}).llmModel, null);
  });
});

describe("newConversationId", () => {
  it("makes RFC 4122 v4 ids the backend accepts", () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const ids = new Set(Array.from({ length: 50 }, newConversationId));
    assert.equal(ids.size, 50);
    for (const id of ids) assert.match(id, re);
  });
});
