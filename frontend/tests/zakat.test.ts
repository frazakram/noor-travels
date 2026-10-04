import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeZakat, NISAB_GOLD_GRAMS, NISAB_SILVER_GRAMS } from "../lib/zakat.ts";

const none = { cash: 0, goldGrams: 0, goldKarat: 24, silverGrams: 0, investments: 0, businessStock: 0, receivables: 0, debts: 0 };
const prices = { gold24kPerGram: 7000, silverPerGram: 90 };

describe("computeZakat", () => {
  it("charges 2.5% of net wealth at or above the silver nisab", () => {
    const r = computeZakat({ ...none, cash: 100_000 }, prices, "silver");
    assert.equal(r.nisab, NISAB_SILVER_GRAMS * 90);
    assert.equal(r.meetsNisab, true);
    assert.equal(r.zakat, 2500);
  });

  it("values gold by purity and subtracts debts", () => {
    const r = computeZakat({ ...none, goldGrams: 24, goldKarat: 22, debts: 4000 }, prices, "silver");
    assert.equal(r.goldValue, 22 * 7000); // 24 g of 22k holds 22 g of pure gold
    assert.equal(r.netWealth, 22 * 7000 - 4000);
  });

  it("uses the gold nisab when chosen, which can make the same wealth fall below it", () => {
    const wealth = { ...none, cash: 200_000 };
    assert.equal(computeZakat(wealth, prices, "silver").meetsNisab, true);
    const gold = computeZakat(wealth, prices, "gold");
    assert.equal(gold.nisab, NISAB_GOLD_GRAMS * 7000);
    assert.equal(gold.meetsNisab, false);
    assert.equal(gold.zakat, 0);
  });

  it("never says zakat is due when the nisab price is missing", () => {
    const r = computeZakat({ ...none, cash: 10_000_000 }, { gold24kPerGram: 0, silverPerGram: 0 }, "silver");
    assert.equal(r.nisab, 0);
    assert.equal(r.meetsNisab, false);
    assert.equal(r.zakat, 0);
  });

  it("ignores negative or non-numeric entries and never goes below zero", () => {
    const r = computeZakat({ ...none, cash: -5, investments: Number.NaN, debts: 1_000_000 }, prices, "silver");
    assert.equal(r.totalAssets, 0);
    assert.equal(r.netWealth, 0);
  });
});
