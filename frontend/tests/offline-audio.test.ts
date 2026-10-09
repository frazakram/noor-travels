import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { audioUrlsOf, downloadKey, lookupKeys, trLangFor } from "../lib/offline-audio-keys.ts";

describe("trLangFor", () => {
  it("keeps English and Urdu, which have recorded translation audio", () => {
    assert.equal(trLangFor(true, "en"), "en");
    assert.equal(trLangFor(true, "ur"), "ur");
  });
  it("is none for Hindi (synthesized online) or when translation audio is off", () => {
    assert.equal(trLangFor(true, "hi"), "none");
    assert.equal(trLangFor(false, "en"), "none");
  });
});

describe("audioUrlsOf", () => {
  it("lists each clip once, Bismillah first, skipping empty entries", () => {
    const urls = audioUrlsOf({
      bismillah_audio: "b.mp3",
      ayahs: [
        { audio: "1.mp3", translation_audio: "t1.mp3" },
        { audio: "1.mp3", translation_audio: null }, // full-surah reciters repeat one file
        { audio: null },
        { audio: "2.mp3", translation_audio: "t2.mp3" },
      ],
    });
    assert.deepEqual(urls, ["b.mp3", "1.mp3", "t1.mp3", "2.mp3", "t2.mp3"]);
  });
  it("handles a manifest with no ayahs", () => {
    assert.deepEqual(audioUrlsOf({ ayahs: [] }), []);
  });
});

describe("lookupKeys", () => {
  it("needs the exact language when translation audio is wanted", () => {
    assert.deepEqual(lookupKeys(2, "ar.alafasy", "ur"), [downloadKey(2, "ar.alafasy", "ur")]);
  });
  it("lets any saved manifest serve a request without translation audio", () => {
    assert.deepEqual(lookupKeys(2, "ar.alafasy", "none"), ["2:ar.alafasy:none", "2:ar.alafasy:en", "2:ar.alafasy:ur"]);
  });
});
