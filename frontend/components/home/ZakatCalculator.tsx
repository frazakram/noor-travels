"use client";

import { useEffect, useMemo, useState } from "react";
import { CitationLink } from "@/components/CitationLink";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";
import {
  computeZakat,
  NISAB_GOLD_GRAMS,
  NISAB_SILVER_GRAMS,
  type NisabBasis,
  type ZakatInput,
  type ZakatPrices,
} from "@/lib/zakat";

// Figures stay on this device only: they are personal financial details.
const STORAGE_KEY = "noor-zakat-v1";

type Saved = { input: ZakatInput; prices: ZakatPrices; basis: NisabBasis };

const EMPTY: Saved = {
  input: { cash: 0, goldGrams: 0, goldKarat: 22, silverGrams: 0, investments: 0, businessStock: 0, receivables: 0, debts: 0 },
  prices: { gold24kPerGram: 0, silverPerGram: 0 },
  basis: "silver",
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-body">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value || ""}
          placeholder="0"
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="input w-32 py-1.5 text-right"
          dir="ltr"
        />
        {suffix && <span className="w-6 text-xs text-faint">{suffix}</span>}
      </span>
    </label>
  );
}

/** Zakat on wealth: 2.5% of net zakatable wealth at or above the nisab (lib/zakat). */
export function ZakatCalculator() {
  const { lang } = useLang();
  const [saved, setSaved] = useState<Saved>(EMPTY);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (raw?.input && raw?.prices) setSaved({ ...EMPTY, ...raw, input: { ...EMPTY.input, ...raw.input } });
    } catch {
      /* start empty */
    }
  }, []);

  function update(next: Saved) {
    setSaved(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* still works, just isn't remembered */
    }
  }
  const setInput = (patch: Partial<ZakatInput>) => update({ ...saved, input: { ...saved.input, ...patch } });
  const setPrices = (patch: Partial<ZakatPrices>) => update({ ...saved, prices: { ...saved.prices, ...patch } });

  const result = useMemo(() => computeZakat(saved.input, saved.prices, saved.basis), [saved]);
  const basisPrice = saved.basis === "silver" ? saved.prices.silverPerGram : saved.prices.gold24kPerGram;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{t(lang, "zakatIntro")}</p>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-accent">{t(lang, "zakatPrices")}</h3>
        <NumberField label={t(lang, "zakatGoldPrice")} value={saved.prices.gold24kPerGram} onChange={(n) => setPrices({ gold24kPerGram: n })} suffix="₹/g" />
        <NumberField label={t(lang, "zakatSilverPrice")} value={saved.prices.silverPerGram} onChange={(n) => setPrices({ silverPerGram: n })} suffix="₹/g" />
        <p className="text-[11px] text-faint">{t(lang, "zakatPriceHint")}</p>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-accent">{t(lang, "zakatAssets")}</h3>
        <NumberField label={t(lang, "zakatCash")} value={saved.input.cash} onChange={(n) => setInput({ cash: n })} suffix="₹" />
        <NumberField label={t(lang, "zakatGold")} value={saved.input.goldGrams} onChange={(n) => setInput({ goldGrams: n })} suffix="g" />
        <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
          <span className="text-body">{t(lang, "zakatGoldPurity")}</span>
          <select className="input w-32 py-1.5" value={saved.input.goldKarat} onChange={(e) => setInput({ goldKarat: Number(e.target.value) })}>
            {[24, 22, 21, 18, 14].map((k) => (
              <option key={k} value={k}>
                {k}k
              </option>
            ))}
          </select>
        </label>
        <NumberField label={t(lang, "zakatSilver")} value={saved.input.silverGrams} onChange={(n) => setInput({ silverGrams: n })} suffix="g" />
        <NumberField label={t(lang, "zakatInvestments")} value={saved.input.investments} onChange={(n) => setInput({ investments: n })} suffix="₹" />
        <NumberField label={t(lang, "zakatBusiness")} value={saved.input.businessStock} onChange={(n) => setInput({ businessStock: n })} suffix="₹" />
        <NumberField label={t(lang, "zakatReceivables")} value={saved.input.receivables} onChange={(n) => setInput({ receivables: n })} suffix="₹" />
        <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-accent">{t(lang, "zakatLiabilities")}</h3>
        <NumberField label={t(lang, "zakatDebts")} value={saved.input.debts} onChange={(n) => setInput({ debts: n })} suffix="₹" />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-accent">{t(lang, "zakatNisabBasis")}</h3>
        <div className="grid grid-cols-2 gap-2">
          {(["silver", "gold"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => update({ ...saved, basis: b })}
              aria-pressed={saved.basis === b}
              className={`rounded-xl border px-3 py-2 text-left text-xs ${
                saved.basis === b ? "border-noor-600 bg-noor-50 text-noor-800 dark:border-noor-400 dark:bg-noor-800 dark:text-noor-100" : "border-subtle text-muted"
              }`}
            >
              <span className="block font-semibold">{t(lang, b === "silver" ? "zakatBasisSilver" : "zakatBasisGold")}</span>
              {b === "silver" ? `${NISAB_SILVER_GRAMS} g` : `${NISAB_GOLD_GRAMS} g`}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-faint">{t(lang, "zakatBasisNote")}</p>
      </section>

      <section className="rounded-2xl bg-gradient-to-br from-noor-800 to-noor-950 p-4 text-white" aria-live="polite">
        <div className="flex justify-between text-xs text-white/75">
          <span>{t(lang, "zakatNetWealth")}</span>
          <span dir="ltr">{inr.format(result.netWealth)}</span>
        </div>
        <div className="mt-1 flex justify-between text-xs text-white/75">
          <span>{t(lang, "zakatNisab")}</span>
          <span dir="ltr">{basisPrice > 0 ? inr.format(result.nisab) : "—"}</span>
        </div>
        <div className="mt-3 border-t border-white/15 pt-3">
          {basisPrice <= 0 ? (
            <p className="text-sm text-gold-200">{t(lang, "zakatNeedPrice")}</p>
          ) : result.meetsNisab ? (
            <>
              <p className="text-xs uppercase tracking-widest text-white/70">{t(lang, "zakatDue")}</p>
              <p className="mt-1 text-3xl font-semibold text-gold-200" dir="ltr">
                {inr.format(result.zakat)}
              </p>
            </>
          ) : (
            <p className="text-sm text-white/85">{t(lang, "zakatBelowNisab")}</p>
          )}
        </div>
      </section>

      <div className="space-y-1 text-[11px] text-faint">
        <p>{t(lang, "zakatHawlNote")}</p>
        <p>{t(lang, "zakatScholarsNote")}</p>
        <p>
          {t(lang, "zakatRecipients")}{" "}
          <CitationLink href="/quran/9?ayah=60" label="Quran 9:60" className="font-medium text-accent underline decoration-dotted underline-offset-2">
            Quran 9:60
          </CitationLink>
        </p>
      </div>
    </div>
  );
}
