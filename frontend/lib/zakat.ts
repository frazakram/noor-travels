/**
 * Zakat on wealth: 2.5% of net zakatable wealth held for a lunar year, when it is at or above
 * the nisab. Pure functions; the UI is components/tools/ZakatCalculator.
 *
 * Nisab weights are the values most commonly used in South Asia (20 mithqal of gold, 200
 * dirham of silver). Scholars convert these slightly differently (gold 85-87.48 g, silver
 * 595-612.36 g), which the UI states; the silver basis is the common choice in India because
 * it is lower and so includes more people who can give.
 */

export const NISAB_GOLD_GRAMS = 87.48;
export const NISAB_SILVER_GRAMS = 612.36;
export const ZAKAT_RATE = 0.025;

export type NisabBasis = "silver" | "gold";

export type ZakatInput = {
  cash: number; // cash in hand and in bank accounts
  goldGrams: number;
  goldKarat: number; // 24, 22, 18...
  silverGrams: number;
  investments: number; // shares, mutual funds, crypto held for value
  businessStock: number; // trade goods at sale value
  receivables: number; // money owed to you that you expect to get back
  debts: number; // debts and bills due now
};

export type ZakatPrices = { gold24kPerGram: number; silverPerGram: number };

export type ZakatResult = {
  goldValue: number;
  silverValue: number;
  totalAssets: number;
  netWealth: number;
  nisab: number;
  meetsNisab: boolean;
  zakat: number;
};

const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function computeZakat(input: ZakatInput, prices: ZakatPrices, basis: NisabBasis): ZakatResult {
  const karat = Math.min(24, Math.max(0, input.goldKarat || 0));
  const goldValue = nonNegative(input.goldGrams) * (karat / 24) * nonNegative(prices.gold24kPerGram);
  const silverValue = nonNegative(input.silverGrams) * nonNegative(prices.silverPerGram);
  const totalAssets =
    nonNegative(input.cash) + goldValue + silverValue + nonNegative(input.investments) + nonNegative(input.businessStock) + nonNegative(input.receivables);
  const netWealth = Math.max(0, totalAssets - nonNegative(input.debts));
  const nisab =
    basis === "gold" ? NISAB_GOLD_GRAMS * nonNegative(prices.gold24kPerGram) : NISAB_SILVER_GRAMS * nonNegative(prices.silverPerGram);
  // Without a price the nisab is unknown (0): never tell someone they owe zakat on that basis.
  const meetsNisab = nisab > 0 && netWealth >= nisab;
  return {
    goldValue,
    silverValue,
    totalAssets,
    netWealth,
    nisab,
    meetsNisab,
    zakat: meetsNisab ? Math.round(netWealth * ZAKAT_RATE * 100) / 100 : 0,
  };
}
