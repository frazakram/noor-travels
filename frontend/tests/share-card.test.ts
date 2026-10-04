import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { layoutCard, wrap, type Measure } from "../lib/share-card.ts";

// Roughly real proportions: an average glyph is about half the font size wide.
const measure: Measure = (text, font, size) => text.length * size * (font === "arabic" ? 0.42 : 0.5);
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i % 10}`).join(" ");

describe("wrap", () => {
  it("never splits a word and keeps every word, in order", () => {
    const text = "In the name of Allah, the Most Gracious, the Most Merciful";
    const lines = wrap(text, 200, (s) => s.length * 10);
    assert.equal(lines.join(" "), text);
    for (const line of lines) assert.ok(line.length * 10 <= 200 || !line.includes(" "));
  });
});

describe("layoutCard", () => {
  it("shows a short verse with its Arabic, at large sizes", () => {
    const l = layoutCard({ kind: "quran", reference: "Quran 112:1", arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ", translation: "Say, He is Allah, the One." }, measure);
    assert.ok(l.arabic);
    assert.equal(l.truncated, false);
    assert.ok(l.body.size >= 40);
  });

  it("drops the Arabic before ever shortening the translation", () => {
    const l = layoutCard({ kind: "hadith", reference: "Sahih al-Bukhari 1", arabic: words(120), translation: words(200) }, measure);
    assert.equal(l.arabic, null);
    assert.equal(l.truncated, false);
    assert.equal(l.body.lines.join(" "), words(200));
  });

  it("shortens only text too long to fit, at a sentence end, and marks it", () => {
    const long = Array.from({ length: 120 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const l = layoutCard({ kind: "hadith", reference: "Sahih al-Bukhari 2", translation: long }, measure);
    assert.equal(l.truncated, true);
    const text = l.body.lines.join(" ");
    assert.ok(text.endsWith(". …"), text.slice(-20));
    assert.ok(long.startsWith(text.slice(0, -2).trim()));
  });

  it("always fits the card's content area", () => {
    for (const n of [5, 40, 120, 300, 900]) {
      const l = layoutCard({ kind: "dua", reference: "Dua", arabic: words(Math.ceil(n / 3)), translation: words(n) }, measure);
      const used = (l.arabic ? l.arabic.lines.length * l.arabic.lineHeight + 88 : 0) + l.body.lines.length * l.body.lineHeight;
      assert.ok(used <= 1350 - 190 - 250, `n=${n} used=${used}`);
    }
  });
});

describe("card text clean-up", () => {
  it("joins the source's mid-sentence line breaks", () => {
    const l = layoutCard({ kind: "hadith", reference: "x", translation: "set out at the time of Al-Hudaibiya (treaty), and\nwhen they proceeded" }, measure);
    assert.equal(l.body.lines.join(" "), "set out at the time of Al-Hudaibiya (treaty), and when they proceeded");
  });

  it("shows an ayah's own Arabic: Bismillah removed from verse 1 except Al-Fatiha and At-Tawbah", async () => {
    const { ayahArabic } = await import("../lib/quran-display.ts");
    // Exact text from the ayahs table: Arabic that looks the same can differ in diacritic order.
    const db = {"112:1": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ قُلْ هُوَ ٱللَّهُ أَحَدٌ", "1:1": "﻿بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", "112:2": "ٱللَّهُ ٱلصَّمَدُ", "9:1": "بَرَآءَةٌۭ مِّنَ ٱللَّهِ وَرَسُولِهِۦٓ إِلَى ٱلَّذِينَ عَٰهَدتُّم مِّنَ ٱلْمُشْرِكِينَ"};
    assert.equal(ayahArabic("112:1", db["112:1"]), db["112:1"].split(" ").slice(4).join(" "));
    assert.ok(!ayahArabic("112:1", db["112:1"]).includes("بِسْمِ"));
    assert.equal(ayahArabic("1:1", db["1:1"]), db["1:1"].trim());
    assert.equal(ayahArabic("112:2", db["112:2"]), db["112:2"].trim());
    assert.equal(ayahArabic("9:1", db["9:1"]), db["9:1"].replace(/\s+/g, " ").trim());
  });
});
