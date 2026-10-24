import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { IBADAH_SLUGS, refHref, walkthroughSteps, type IbadahGuide } from "../lib/ibadah.ts";

const DIR = path.join(import.meta.dirname, "..", "content", "ibadah");
const guides: IbadahGuide[] = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")));

describe("Ibadah Guide", () => {
  it("lists every guide for the offline pack, and nothing else", () => {
    assert.deepEqual([...IBADAH_SLUGS].sort(), guides.map((g) => g.slug).sort());
  });

  it("gives every guide a unique order and some content", () => {
    const orders = guides.map((g) => g.order);
    assert.equal(new Set(orders).size, orders.length);
    for (const g of guides) assert.ok(g.sections.some((s) => s.items.length > 0), g.slug);
  });

  it("only walks through ordered steps (reference-only guides like nikah have none)", () => {
    const nikah = guides.find((g) => g.slug === "nikah")!;
    assert.equal(walkthroughSteps(nikah).length, 0);
    const salah = guides.find((g) => g.slug === "salah")!;
    assert.ok(walkthroughSteps(salah).every(({ section }) => section.kind === "steps"));
  });

  it("links Quran and hadith references into the app's readers", () => {
    assert.equal(refHref({ kind: "quran", key: "5:6", quote: "x" }), "/quran/5?ayah=6");
    assert.equal(refHref({ kind: "hadith", collection: "bukhari", number: 159, quote: "x" }), "/hadith/bukhari/159");
    assert.equal(refHref({ kind: "fiqh", text: { en: "a", ur: "b", hi: "c" } }), null);
  });
});
