import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ITEMS,
  TOMBSTONE_MS,
  bookmarksCodec,
  canon,
  commitLocal,
  dhikrBookmarksCodec,
  dhikrProgressCodec,
  hifzCodec,
  mergeItems,
  salahCodec,
  scoped,
  shiftDay,
  type SyncItems,
} from "../lib/progress-sync-core.ts";

const NOW = Date.UTC(2026, 10, 24, 12);

describe("canon", () => {
  it("ignores key order and undefined fields", () => {
    assert.equal(canon({ b: 1, a: { y: [1, 2], x: undefined } }), canon({ a: { y: [1, 2] }, b: 1 }));
    assert.notEqual(canon({ a: 1 }), canon({ a: "1" }));
  });
});

describe("mergeItems (same rules as backend sync.merge)", () => {
  it("keeps the newest change per item and lets a deletion win a tie", () => {
    const merged = mergeItems(
      [
        { x: { v: 1, t: NOW - 10 }, y: { v: "a", t: NOW - 1 } },
        { x: { v: 2, t: NOW - 5 }, y: { t: NOW - 1, d: 1 } },
      ],
      NOW,
    );
    assert.deepEqual(merged, { x: { v: 2, t: NOW - 5 }, y: { t: NOW - 1, d: 1 } });
  });
  it("drops old tombstones and bounds the size", () => {
    assert.deepEqual(Object.keys(mergeItems([{ old: { t: NOW - TOMBSTONE_MS - 1, d: 1 }, keep: { v: 1, t: 0 } }], NOW)), ["keep"]);
    const many: SyncItems = {};
    for (let i = 0; i < MAX_ITEMS + 3; i++) many[String(i)] = { v: 1, t: i };
    const kept = mergeItems([many], NOW);
    assert.equal(Object.keys(kept).length, MAX_ITEMS);
    assert.ok(!("0" in kept) && String(MAX_ITEMS + 2) in kept);
  });
});

describe("commitLocal", () => {
  it("first sync takes the store as it is, dated by the items' own timestamps", () => {
    const r = commitLocal(null, { a: { v: 1, t0: 50 }, b: { v: 2 } }, NOW);
    assert.deepEqual(r.items, { a: { v: 1, t: 50 }, b: { v: 2, t: 0 } });
    assert.deepEqual(r.changed.sort(), ["a", "b"]);
  });
  it("stamps additions, edits and removals with now, and nothing else", () => {
    const prev: SyncItems = { same: { v: { n: 1 }, t: 1 }, edited: { v: 1, t: 1 }, removed: { v: 1, t: 1 }, gone: { t: 1, d: 1 } };
    const r = commitLocal(prev, { same: { v: { n: 1 } }, edited: { v: 2 }, added: { v: 3 } }, NOW);
    assert.deepEqual(r.changed.sort(), ["added", "edited", "removed"]);
    assert.deepEqual(r.items.same, { v: { n: 1 }, t: 1 });
    assert.deepEqual(r.items.removed, { t: NOW, d: 1 });
    assert.deepEqual(r.items.gone, { t: 1, d: 1 });
    assert.deepEqual(commitLocal(r.items, { same: { v: { n: 1 } }, edited: { v: 2 }, added: { v: 3 } }, NOW + 1).changed, []);
  });
});

/** A device: its store's items, its last synced state, and a sync against a shared server doc. */
function device() {
  let synced: SyncItems | null = null;
  return {
    sync(store: Record<string, { v: unknown; t0?: number }>, server: { items: SyncItems }, now: number): SyncItems {
      const { items } = commitLocal(synced, store, now);
      server.items = mergeItems([server.items, items], now);
      synced = server.items;
      return synced;
    },
  };
}

describe("two devices", () => {
  it("bookmarks added on each survive, and a removal on one removes it on the other", () => {
    const server = { items: {} as SyncItems };
    const phone = device();
    const web = device();
    const bm = (verseKey: string, createdAt: number) => ({ surah: 1, ayah: 1, verseKey, createdAt });

    phone.sync(bookmarksCodec.toItems([bm("2:255", NOW - 100), bm("1:1", NOW - 90)]), server, NOW);
    let webList = bookmarksCodec.fromItems(web.sync(bookmarksCodec.toItems([bm("36:1", NOW - 50)]), server, NOW + 1));
    assert.deepEqual(webList.map((b) => b.verseKey), ["36:1", "1:1", "2:255"]);

    // The web removes 1:1; the phone (which still has it) must not bring it back.
    webList = webList.filter((b) => b.verseKey !== "1:1");
    web.sync(bookmarksCodec.toItems(webList), server, NOW + 2);
    const phoneList = bookmarksCodec.fromItems(
      phone.sync(bookmarksCodec.toItems([bm("2:255", NOW - 100), bm("1:1", NOW - 90)]), server, NOW + 3),
    );
    assert.deepEqual(phoneList.map((b) => b.verseKey), ["36:1", "2:255"]);
  });

  it("a device syncing for the first time can't resurrect what was deleted after it saved it", () => {
    const server = { items: { "1:1": { t: NOW - 10, d: 1 as const } } as SyncItems };
    const old = device();
    const list = bookmarksCodec.fromItems(old.sync(bookmarksCodec.toItems([{ verseKey: "1:1", createdAt: NOW - 1000 }]), server, NOW));
    assert.deepEqual(list, []);
  });

  it("prayers marked on different devices on the same day are all kept", () => {
    const today = "2026-11-24";
    const server = { items: {} as SyncItems };
    const phone = device();
    const web = device();
    phone.sync(salahCodec.toItems({ [today]: { fajr: true } }, today), server, NOW);
    const merged = web.sync(salahCodec.toItems({ [today]: { dhuhr: true } }, today), server, NOW + 1);
    assert.deepEqual(salahCodec.fromItems(merged, {}, today), { [today]: { fajr: true, dhuhr: true } });
  });
});

describe("codecs", () => {
  it("salah: only the recent window syncs; older days stay as they are on this device", () => {
    const today = "2026-11-24";
    const old = shiftDay(today, -500);
    const items = salahCodec.toItems({ [old]: { fajr: true }, [today]: { asr: true, isha: false } }, today);
    assert.deepEqual(Object.keys(items), [`${today}|asr`]);
    const logs = salahCodec.fromItems({ [`${today}|asr`]: { v: 1, t: 1 }, [`${old}|isha`]: { v: 1, t: 1 } }, { [old]: { fajr: true } }, today);
    assert.deepEqual(logs, { [old]: { fajr: true }, [today]: { asr: true } });
    assert.equal(salahCodec.inScope(`${old}|fajr`, today), false);
    assert.deepEqual(Object.keys(scoped({ [`${old}|fajr`]: { v: 1, t: 1 }, [`${today}|asr`]: { v: 1, t: 1 } }, (id) => salahCodec.inScope(id, today))), [`${today}|asr`]);
  });

  it("adhkar counts: another day's counts never replace today's", () => {
    const current = { date: "2026-11-24", counts: { a: 3 } };
    assert.deepEqual(dhikrProgressCodec.fromItems({ today: { v: { date: "2026-11-23", counts: { a: 33 } }, t: 9 } }, current), current);
    assert.deepEqual(dhikrProgressCodec.fromItems({ today: { v: { date: "2026-11-24", counts: { a: 7 } }, t: 9 } }, current).counts, { a: 7 });
  });

  it("adhkar bookmarks: newest first, ties keep this device's order", () => {
    const items = { a: { v: 1, t: 0 }, b: { v: 1, t: 0 }, c: { v: 1, t: 5 }, d: { t: 6, d: 1 as const } };
    assert.deepEqual(dhikrBookmarksCodec.fromItems(items, ["b", "a"]), ["c", "b", "a"]);
  });

  it("hifz: settings and items round-trip; removed items go", () => {
    const state = {
      version: 1 as const,
      settings: { newPerDay: 2, segmentSize: 3 },
      items: [
        { id: "36:1-3", added: "2026-11-01" },
        { id: "1:1-3", added: "2026-10-01" },
      ],
    };
    const items: SyncItems = Object.fromEntries(Object.entries(hifzCodec.toItems(state)).map(([k, { v }]) => [k, { v, t: 1 }]));
    const back = hifzCodec.fromItems(items, { ...state, items: [] });
    assert.deepEqual(back.items.map((i) => i.id), ["1:1-3", "36:1-3"]);
    assert.deepEqual(back.settings, state.settings);
    items["item:1:1-3"] = { t: 2, d: 1 };
    assert.deepEqual(hifzCodec.fromItems(items, state).items.map((i) => i.id), ["36:1-3"]);
  });
});
