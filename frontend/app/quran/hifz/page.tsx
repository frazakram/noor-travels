"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import {
  addRange,
  applyReview,
  buildSegments,
  dayKey,
  loadState,
  previewInterval,
  removeItem,
  saveState,
  stats,
  STRONG_DAYS,
  todayQueue,
  type Grade,
  type HifzItem,
  type HifzState,
} from "@/lib/hifz";
import { t, type Lang } from "@/lib/i18n";
import { ayahArabic, displaySurahName } from "@/lib/quran-display";
import type { Ayah } from "@/lib/quran-types";

type SurahSummary = { number: number; name_en: string; ayah_count: number };

const GRADES: { grade: Grade; key: "hifzAgain" | "hifzHard" | "hifzGood" | "hifzEasy"; tone: string }[] = [
  { grade: 0, key: "hifzAgain", tone: "border-red-200 text-red-700 dark:border-red-500/40 dark:text-red-300" },
  { grade: 1, key: "hifzHard", tone: "border-gold-300 text-gold-700 dark:border-gold-500/40 dark:text-gold-300" },
  { grade: 2, key: "hifzGood", tone: "border-noor-300 text-noor-700 dark:border-noor-500 dark:text-noor-200" },
  { grade: 3, key: "hifzEasy", tone: "border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300" },
];

function intervalLabel(lang: Lang, days: number): string {
  return days === 1 ? t(lang, "hifzTomorrow") : t(lang, "hifzInDays").replace("{n}", String(days));
}

export default function HifzPage() {
  const { lang } = useLang();
  const [state, setState] = useState<HifzState | null>(null);
  const [surahs, setSurahs] = useState<SurahSummary[]>([]);
  const [texts, setTexts] = useState<Record<number, Ayah[]>>({});
  const [showText, setShowText] = useState(false);
  const [today] = useState(dayKey);

  useEffect(() => {
    setState(loadState());
    api<{ surahs: SurahSummary[] }>("/api/quran/surahs")
      .then((d) => setSurahs(d.surahs ?? []))
      .catch(() => setSurahs([]));
  }, []);

  function update(next: HifzState) {
    setState(next);
    saveState(next);
  }

  const queue = useMemo(() => (state ? todayQueue(state, today) : []), [state, today]);
  const current = queue[0];

  // Text for the segment in front of the user (and the next one, so it appears instantly).
  useEffect(() => {
    for (const item of queue.slice(0, 2)) {
      if (texts[item.surah]) continue;
      api<{ ayahs: Ayah[] }>(`/api/quran/surahs/${item.surah}?translation=${lang}`)
        .then((d) => setTexts((prev) => ({ ...prev, [item.surah]: d.ayahs ?? [] })))
        .catch(() => undefined);
    }
  }, [queue, lang, texts]);

  // A new segment is for learning: show its text. A review is a test: start with it hidden.
  useEffect(() => {
    setShowText(current ? current.due === null : false);
  }, [current?.id, current?.due]);

  const name = (n: number) => displaySurahName(n, surahs.find((s) => s.number === n)?.name_en ?? `Surah ${n}`);
  const ref = (i: HifzItem) => `${name(i.surah)} ${i.surah}:${i.from}${i.to > i.from ? `–${i.to}` : ""}`;

  if (!state) return <div className="card h-40 animate-pulse" aria-busy="true" />;
  const s = stats(state);
  const nextDue = state.items.filter((i) => i.due && i.due > today).map((i) => i.due!).sort()[0];

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link href="/quran" className="text-sm text-accent hover:underline">
          ← {t(lang, "quran")}
        </Link>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "hifzTitle")}</h1>
        <p className="text-sm text-muted">{t(lang, "hifzIntro")}</p>
        {state.items.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {t(lang, "hifzStrong")} {s.strong}
            </span>
            <span className="rounded-full bg-noor-50 px-2.5 py-1 font-medium text-noor-700 dark:bg-noor-800 dark:text-noor-200">
              {t(lang, "hifzLearning")} {s.learning}
            </span>
            <span className="rounded-full border border-subtle px-2.5 py-1 text-muted">
              {t(lang, "hifzNew")} {s.fresh}
            </span>
            <span className="self-center text-faint">{t(lang, "hifzAyahsUnit")}</span>
          </div>
        )}
      </header>

      {/* Today's session */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-heading">
          {t(lang, "hifzToday")} {queue.length > 0 && <span className="font-normal text-muted">· {queue.length}</span>}
        </h2>
        {current ? (
          <SessionCard
            item={current}
            title={ref(current)}
            ayahs={(texts[current.surah] ?? []).filter((a) => a.ayah_number >= current.from && a.ayah_number <= current.to)}
            showText={showText}
            onToggleText={() => setShowText((v) => !v)}
            onGrade={(grade) => update(applyReview(state, current.id, grade, today))}
          />
        ) : (
          <div className="card text-sm text-muted">
            {state.items.length === 0
              ? t(lang, "hifzEmpty")
              : `✓ ${t(lang, "hifzDone")}${nextDue ? ` · ${t(lang, "hifzNextReview")} ${new Date(nextDue).toLocaleDateString()}` : ""}`}
          </div>
        )}
      </section>

      <AddRange surahs={surahs} segmentSize={state.settings.segmentSize} onAdd={(surah, from, to) => update(addRange(state, surah, from, to, today))} />

      {/* Plan */}
      {state.items.length > 0 && (
        <section className="card space-y-2">
          <h2 className="text-sm font-semibold text-heading">{t(lang, "hifzPlan")}</h2>
          <ul className="divide-y divide-noor-100 dark:divide-noor-800">
            {state.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 truncate text-body">{ref(i)}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  <span className={i.interval >= STRONG_DAYS ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}>
                    {i.due === null
                      ? t(lang, "hifzNew")
                      : i.interval >= STRONG_DAYS
                        ? `✓ ${t(lang, "hifzStrong")}`
                        : i.due <= today
                          ? t(lang, "hifzDueNow")
                          : new Date(i.due).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    aria-label={`${t(lang, "hifzRemove")} ${ref(i)}`}
                    onClick={() => update(removeItem(state, i.id))}
                    className="rounded-md px-1.5 text-faint hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <Settings state={state} onChange={update} />
        </section>
      )}
    </div>
  );
}

function SessionCard({
  item,
  title,
  ayahs,
  showText,
  onToggleText,
  onGrade,
}: {
  item: HifzItem;
  title: string;
  ayahs: Ayah[];
  showText: boolean;
  onToggleText: () => void;
  onGrade: (grade: Grade) => void;
}) {
  const { lang } = useLang();
  const isNew = item.due === null;
  const reciteHref = `/recite?surah=${item.surah}&from=${item.from}&to=${item.to}&hifz=${encodeURIComponent(item.id)}`;
  return (
    <article className="card space-y-4 animate-fade-in-up" key={item.id}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent">{isNew ? t(lang, "hifzLearnNew") : t(lang, "hifzReview")}</p>
          <h3 className="text-lg font-semibold text-heading">{title}</h3>
        </div>
        <button type="button" onClick={onToggleText} className="rounded-lg border border-subtle px-2.5 py-1 text-xs text-muted">
          {showText ? t(lang, "hifzHideText") : t(lang, "hifzShowText")}
        </button>
      </div>

      {showText ? (
        <div className="space-y-3">
          {ayahs.length === 0 && <div className="h-20 animate-pulse rounded-xl bg-noor-50 dark:bg-noor-800" />}
          {ayahs.map((a) => (
            <div key={a.verse_key} className="space-y-1">
              <p className="font-arabic text-right text-2xl leading-loose text-heading" dir="rtl" lang="ar">
                {ayahArabic(a.verse_key, a.arabic)} <span className="text-sm text-accent">﴿{a.ayah_number}﴾</span>
              </p>
              <p className="text-xs text-muted" dir={lang === "ur" ? "rtl" : "ltr"}>
                {a.translation ?? a.translation_en}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-subtle p-4 text-center text-sm text-muted">{t(lang, "hifzReciteFromMemory")}</p>
      )}

      <Link href={reciteHref} className="btn-primary flex min-h-11 items-center justify-center gap-2 text-sm">
        🎙 {t(lang, "hifzReciteCheck")}
      </Link>

      <div>
        <p className="mb-2 text-xs text-faint">{t(lang, "hifzOrRate")}</p>
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map(({ grade, key, tone }) => (
            <button
              key={grade}
              type="button"
              onClick={() => onGrade(grade)}
              className={`rounded-xl border bg-white px-1 py-2 text-xs font-medium dark:bg-noor-900 ${tone}`}
            >
              {t(lang, key)}
              <span className="block text-[10px] font-normal opacity-75">{intervalLabel(lang, previewInterval(item, grade))}</span>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function AddRange({ surahs, segmentSize, onAdd }: { surahs: SurahSummary[]; segmentSize: number; onAdd: (surah: number, from: number, to: number) => void }) {
  const { lang } = useLang();
  const [surah, setSurah] = useState(1);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(7);
  const count = surahs.find((x) => x.number === surah)?.ayah_count ?? 7;
  const lo = Math.max(1, Math.min(from, count));
  const hi = Math.max(lo, Math.min(to, count));
  const segments = buildSegments(surah, lo, hi, segmentSize).length;

  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-semibold text-heading">{t(lang, "hifzAdd")}</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          aria-label={t(lang, "reciteSelectSurah")}
          className="input max-w-[220px] py-1.5"
          value={surah}
          onChange={(e) => {
            const n = Number(e.target.value);
            setSurah(n);
            setFrom(1);
            setTo(surahs.find((x) => x.number === n)?.ayah_count ?? 1);
          }}
        >
          {surahs.map((x) => (
            <option key={x.number} value={x.number}>
              {x.number}. {displaySurahName(x.number, x.name_en)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-muted">
          {t(lang, "hifzFrom")}
          <input type="number" min={1} max={count} value={from} onChange={(e) => setFrom(Number(e.target.value))} className="input w-20 py-1.5" />
        </label>
        <label className="flex items-center gap-1 text-muted">
          {t(lang, "hifzTo")}
          <input type="number" min={1} max={count} value={to} onChange={(e) => setTo(Number(e.target.value))} className="input w-20 py-1.5" />
        </label>
      </div>
      <button type="button" onClick={() => onAdd(surah, lo, hi)} disabled={!surahs.length} className="btn-primary px-4 py-2 text-sm">
        {t(lang, "hifzAddButton").replace("{n}", String(segments))}
      </button>
    </section>
  );
}

function Settings({ state, onChange }: { state: HifzState; onChange: (s: HifzState) => void }) {
  const { lang } = useLang();
  const set = (patch: Partial<HifzState["settings"]>) => onChange({ ...state, settings: { ...state.settings, ...patch } });
  return (
    <div className="flex flex-wrap gap-4 border-t border-subtle pt-3 text-xs text-muted">
      <label className="flex items-center gap-2">
        {t(lang, "hifzNewPerDay")}
        <select className="input w-16 py-1" value={state.settings.newPerDay} onChange={(e) => set({ newPerDay: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        {t(lang, "hifzSegmentSize")}
        <select className="input w-16 py-1" value={state.settings.segmentSize} onChange={(e) => set({ segmentSize: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
