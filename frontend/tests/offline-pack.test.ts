import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assetsIn, packUrls } from "../lib/offline-pack.ts";

describe("offline pack", () => {
  it("saves every surah page and only the translation the reader needs", () => {
    const en = packUrls("en");
    for (let n = 1; n <= 114; n++) assert.ok(en.includes(`/quran/${n}`), `surah ${n}`);
    assert.ok(en.some((u) => u.endsWith("/api/duas/")) && en.some((u) => u.endsWith("/api/adhkar/")));
    assert.equal(en.filter((u) => u.includes("translation=")).length, 0); // pages carry English
    assert.equal(packUrls("ur").filter((u) => u.includes("translation=ur")).length, 114);
  });

  it("finds a page's build assets, once each, and nothing else", () => {
    const html = `<script src="/_next/static/chunks/a.js"></script><link href="/_next/static/css/b.css" rel="stylesheet"><script src="/_next/static/chunks/a.js"></script><img src="/logo.png"><a href="https://x.com/_next/static/c.js">`;
    assert.deepEqual(assetsIn(html), ["/_next/static/chunks/a.js", "/_next/static/css/b.css"]);
  });
});
