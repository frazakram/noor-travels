"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

export function TasbeehWidget() {
  const { lang } = useLang();
  const [count, setCount] = useState(0);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem("noor-tasbeeh-count"));
    if (Number.isFinite(saved) && saved >= 0 && saved <= 99) setCount(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("noor-tasbeeh-count", String(count));
  }, [count]);

  function increment() {
    const next = count >= 99 ? 0 : count + 1;
    setCount(next);
    if (next === 33 || next === 99 || next === 0) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 700);
    }
  }

  function reset() {
    setCount(0);
  }

  return (
    <section>
      <div className="relative flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:p-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t(lang, "tasbeehCounter")}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 sm:text-sm">{t(lang, "tasbeehHint")}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {count > 0 && (
            <button
              type="button"
              onClick={reset}
              aria-label={t(lang, "tasbeehReset")}
              title={t(lang, "tasbeehReset")}
              className="touch-target flex items-center justify-center rounded-full text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            >
              ↺
            </button>
          )}
          <span className="font-mono text-3xl font-bold text-teal-700 dark:text-teal-400 sm:text-4xl">{count}</span>
          <button
            type="button"
            onClick={increment}
            className="h-12 w-12 rounded-full bg-teal-600 text-xl text-white shadow-lg transition-transform active:scale-95 sm:h-14 sm:w-14 sm:text-2xl"
          >
            +
          </button>
        </div>
        {burst && (
          <div className="pointer-events-none absolute right-5 top-3 flex gap-1">
            {[...Array(9)].map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-confetti rounded-full bg-amber-400"
                style={{ animationDelay: `${i * 35}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
