"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { t, type Lang } from "@/lib/i18n";

type DhikrKey = "subhanAllah" | "alhamdulillah" | "allahuAkbar";

type Counts = Record<DhikrKey, number>;

const STORAGE_KEY = "noor-tasbeeh-counts";
const MILESTONE = 100;

const DHIKR_ROWS: { key: DhikrKey; labelKey: "tasbeehSubhanAllah" | "tasbeehAlhamdulillah" | "tasbeehAllahuAkbar" }[] = [
  { key: "subhanAllah", labelKey: "tasbeehSubhanAllah" },
  { key: "alhamdulillah", labelKey: "tasbeehAlhamdulillah" },
  { key: "allahuAkbar", labelKey: "tasbeehAllahuAkbar" },
];

const EMPTY: Counts = { subhanAllah: 0, alhamdulillah: 0, allahuAkbar: 0 };

function loadCounts(): Counts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Counts>;
      return {
        subhanAllah: clampCount(parsed.subhanAllah),
        alhamdulillah: clampCount(parsed.alhamdulillah),
        allahuAkbar: clampCount(parsed.allahuAkbar),
      };
    }
    // Migrate legacy single counter into SubhanAllah
    const legacy = Number(localStorage.getItem("noor-tasbeeh-count"));
    if (Number.isFinite(legacy) && legacy > 0) {
      return { ...EMPTY, subhanAllah: Math.floor(legacy) };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { ...EMPTY };
}

function clampCount(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(Math.floor(v), 9999);
}

function FireIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 23c-4.2 0-7-2.9-7-7.1 0-2.6 1.3-4.7 2.6-6.3.4-.5 1.1-.3 1.2.3.3 1.5.8 2.5 1.4 3.1.3-.9.7-2 1.1-2.9C12.4 7 14.2 4.2 16.5 2.6c.5-.3 1.1.2.9.8-.5 1.8-.3 3.4.2 4.7 1.1-1.1 2-2.7 2.1-4.7 0-.5.6-.8 1-.4C22.5 5.3 24 8.1 24 11.2 24 17.1 19.5 23 12 23z" />
    </svg>
  );
}

function DhikrRow({
  lang,
  label,
  count,
  bursting,
  onIncrement,
  onReset,
}: {
  lang: Lang;
  label: string;
  count: number;
  bursting: boolean;
  onIncrement: () => void;
  onReset: () => void;
}) {
  const celebrated = count >= MILESTONE;

  return (
    <div className="relative flex items-center gap-2 sm:gap-3">
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200 sm:text-base">
        {label}
      </p>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {celebrated && (
          <span
            className={`inline-flex text-orange-500 dark:text-orange-400 ${bursting ? "animate-bounce" : ""}`}
            title={t(lang, "tasbeehMilestone")}
            aria-label={t(lang, "tasbeehMilestone")}
          >
            <FireIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
        )}

        <span
          className={`min-w-[2.25rem] text-right font-mono text-xl font-bold tabular-nums sm:min-w-[2.75rem] sm:text-2xl ${
            celebrated ? "text-orange-600 dark:text-orange-400" : "text-teal-700 dark:text-teal-400"
          }`}
        >
          {count}
        </span>

        <button
          type="button"
          onClick={onIncrement}
          aria-label={`${label} +1`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-lg text-white shadow-md transition-transform active:scale-95 sm:h-11 sm:w-11 sm:text-xl"
        >
          +
        </button>

        {count > 0 ? (
          <button
            type="button"
            onClick={onReset}
            aria-label={t(lang, "tasbeehReset")}
            title={t(lang, "tasbeehReset")}
            className="touch-target flex h-10 w-10 items-center justify-center rounded-full text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 sm:h-11 sm:w-11"
          >
            ↺
          </button>
        ) : (
          <span className="h-10 w-10 sm:h-11 sm:w-11" aria-hidden />
        )}
      </div>

      {bursting && (
        <div className="pointer-events-none absolute right-14 top-0 flex gap-1 sm:right-16">
          {[...Array(9)].map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-confetti rounded-full bg-orange-400"
              style={{ animationDelay: `${i * 35}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TasbeehWidget() {
  const { lang } = useLang();
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [burstKey, setBurstKey] = useState<DhikrKey | null>(null);

  useEffect(() => {
    setCounts(loadCounts());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  }, [counts]);

  function increment(key: DhikrKey) {
    const prevCount = counts[key];
    const next = clampCount(prevCount + 1);
    setCounts((prev) => ({ ...prev, [key]: next }));
    if (prevCount < MILESTONE && next >= MILESTONE) {
      setBurstKey(key);
      window.setTimeout(() => setBurstKey(null), 900);
    }
  }

  function reset(key: DhikrKey) {
    setCounts((prev) => ({ ...prev, [key]: 0 }));
    if (burstKey === key) setBurstKey(null);
  }

  return (
    <section>
      <div className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {t(lang, "tasbeehCounter")}
        </p>

        <div className="flex flex-col gap-3 sm:gap-3.5">
          {DHIKR_ROWS.map(({ key, labelKey }, index) => (
            <div key={key}>
              {index > 0 && <div className="mb-3 border-t border-slate-100 dark:border-slate-700 sm:mb-3.5" />}
              <DhikrRow
                lang={lang}
                label={t(lang, labelKey)}
                count={counts[key]}
                bursting={burstKey === key}
                onIncrement={() => increment(key)}
                onReset={() => reset(key)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
