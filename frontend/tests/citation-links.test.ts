import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { citationHref, linkifyCitations } from "../lib/citation-links.ts";

describe("citationHref", () => {
  it("links each source kind to its in-app page", () => {
    assert.equal(citationHref("Quran 2:153"), "/quran/2?ayah=153");
    assert.equal(citationHref("[Quran 112:4]"), "/quran/112?ayah=4");
    assert.equal(citationHref("Tafsir 16:110 (ibn_kathir_en)"), "/quran/16?ayah=110");
    assert.equal(citationHref("Tafsir 2:188"), "/quran/2?ayah=188");
    assert.equal(citationHref("Sahih al-Bukhari 583"), "/hadith/bukhari/583");
    assert.equal(citationHref("Dua anxiety-1"), "/hadith?section=duas&dua=anxiety-1");
    assert.equal(citationHref("Dua study-2"), "/hadith?section=duas&dua=study-2");
  });

  it("refuses references that don't exist rather than linking somewhere wrong", () => {
    for (const bad of ["Quran 2:287", "Quran 115:1", "Quran 0:1", "Quran 1:0", "Sahih al-Bukhari 0", "Sahih Muslim 12",
      "Sunan Abu Dawud 4", "Quran 2", "Bukhari 583", "random text"]) {
      assert.equal(citationHref(bad), null, bad);
    }
  });
});

describe("linkifyCitations", () => {
  const links = (text: string) => linkifyCitations(text).filter((s) => s.href).map((s) => [s.text, s.href]);
  const joined = (text: string) => linkifyCitations(text).map((s) => s.text).join("");

  it("keeps the visible text exactly as written", () => {
    for (const text of [
      "Patience [Quran 2:153] and prayer.",
      "See [Sahih al-Bukhari 1075, 1078, 1079] and [Tafsir 16:110 (ibn_kathir_en)].",
      "No citations here (2:153).",
      "Broken [Quran 2:999] stays text.",
    ]) {
      assert.equal(joined(text), text);
    }
  });

  it("links every item of a bracketed list, continuing the list's kind", () => {
    assert.deepEqual(links("[Sahih al-Bukhari 1075, 1078]"), [
      ["Sahih al-Bukhari 1075", "/hadith/bukhari/1075"],
      ["1078", "/hadith/bukhari/1078"],
    ]);
    assert.deepEqual(links("[Quran 2:153, 3:200]"), [
      ["Quran 2:153", "/quran/2?ayah=153"],
      ["3:200", "/quran/3?ayah=200"],
    ]);
    assert.deepEqual(links("[Quran 2:255, Sahih al-Bukhari 583]"), [
      ["Quran 2:255", "/quran/2?ayah=255"],
      ["Sahih al-Bukhari 583", "/hadith/bukhari/583"],
    ]);
  });

  it("leaves unbracketed numbers and unknown references unlinked", () => {
    assert.deepEqual(links("Quran 2:153 and (3:200)"), []);
    assert.deepEqual(links("[Sahih Muslim 12]"), []);
    assert.deepEqual(links("[Quran 2:999]"), []);
  });
});

describe("citationLabel", () => {
  it("names the source a link opens, including list items", async () => {
    const { citationLabel } = await import("../lib/citation-links.ts");
    assert.equal(citationLabel("/hadith/bukhari/1078"), "Sahih al-Bukhari 1078");
    assert.equal(citationLabel("/quran/10?ayah=3"), "Quran 10:3");
    assert.equal(citationLabel("/hadith?section=duas&dua=study-2"), "Dua study-2");
    for (const ref of ["Quran 2:153", "Sahih al-Bukhari 583", "Dua anxiety-1"]) {
      assert.equal(citationLabel(citationHref(ref)!), ref);
    }
  });
});
