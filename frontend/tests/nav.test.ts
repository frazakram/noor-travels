import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NAV_TABS, isTabActive } from "../lib/nav.ts";

const activeTab = (pathname: string) => NAV_TABS.filter((tab) => isTabActive(pathname, tab)).map((tab) => tab.key);

describe("isTabActive", () => {
  it("highlights exactly one tab for every real route", () => {
    const routes = [
      "/", "/khutba", "/quran", "/quran/2", "/quran/listen/36", "/quran/find", "/learn-quran", "/learn-quran/l1",
      "/recite", "/hadith", "/hadith-of-day", "/hadith-of-day/2026-09-26", "/adhkar", "/library", "/library/some-slug",
      "/settings", "/account", "/about", "/support", "/privacy",
    ];
    for (const route of routes) {
      assert.equal(activeTab(route).length, 1, `${route} -> ${activeTab(route).join(",") || "none"}`);
    }
  });

  it("groups sub-features under their tab", () => {
    assert.deepEqual(activeTab("/recite"), ["quran"]);
    assert.deepEqual(activeTab("/adhkar"), ["navHadithDuas"]);
    assert.deepEqual(activeTab("/library/x"), ["ask"]);
    assert.deepEqual(activeTab("/privacy"), ["navYou"]);
    assert.deepEqual(activeTab("/khutba"), ["navToday"]);
  });

  it("does not treat a shared prefix as a match", () => {
    assert.deepEqual(activeTab("/hadith-of-day"), ["navHadithDuas"]);
    assert.equal(isTabActive("/quranic", NAV_TABS[1]), false);
  });
});
