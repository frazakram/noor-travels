"use client";

import { useEffect, useMemo, useState } from "react";
import { CitationLink } from "@/components/CitationLink";
import { useLang } from "@/components/LangProvider";
import { citationHref, citationLabel } from "@/lib/citation-links";
import { t } from "@/lib/i18n";
import {
  cycleMark,
  formatCountdown,
  isLastTen,
  isOddNight,
  loadFastLog,
  nextFastEvent,
  ramadanPhase,
  saveFastLog,
  type FastLog,
  type RamadanPhase,
} from "@/lib/ramadan";
import { formatPrayerClock, type SalahTimesResponse } from "@/lib/salah";

/** Home card shown automatically during Ramadan (and as a countdown in the last days of Sha'ban). */
export function RamadanCard({ times }: { times: SalahTimesResponse | null }) {
  const { lang } = useLang();
  const [preview, setPreview] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [log, setLog] = useState<FastLog>({});

  useEffect(() => {
    // ?ramadan=preview shows the card outside Ramadan (day 23, so the last ten are visible).
    setPreview(new URLSearchParams(window.location.search).get("ramadan") === "preview");
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const phase: RamadanPhase | null = useMemo(() => {
    if (preview) return { kind: "ramadan", day: 23, daysInMonth: 30, year: "preview" };
    return ramadanPhase(times?.hijri);
  }, [preview, times?.hijri]);

  useEffect(() => {
    if (phase) setLog(loadFastLog(phase.year));
  }, [phase?.year]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!phase || !times || !now) return null;

  if (phase.kind === "soon") {
    return (
      <section className="card flex items-center gap-3 border-gold-300/60 bg-gradient-to-br from-noor-800 to-noor-950 text-white dark:border-gold-500/30">
        <Crescent />
        <div>
          <p className="text-sm font-semibold">{t(lang, "ramadanSoon").replace("{n}", String(phase.daysLeft))}</p>
          <p className="text-xs text-white/70">{t(lang, "ramadanSoonNote")}</p>
        </div>
      </section>
    );
  }

  const event = nextFastEvent(times, now);
  const eventLabel = event.kind === "iftar" ? t(lang, "ramadanIftarIn") : t(lang, "ramadanSehriEndsIn");
  const fasted = Object.values(log).filter((v) => v === "fasted").length;
  const missed = Object.values(log).filter((v) => v === "missed").length;
  const hadith = isLastTen(phase.day) ? "Sahih al-Bukhari 1944" : "Sahih al-Bukhari 1941";

  function tap(day: number) {
    const next = cycleMark(log, day);
    setLog(next);
    saveFastLog(phase!.year, next);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-gold-300/50 bg-gradient-to-br from-noor-800 via-noor-900 to-noor-950 p-4 text-white shadow-lg dark:border-gold-500/30">
      <div className="flex items-center gap-3">
        <Crescent />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t(lang, "ramadanMubarak")}</p>
          <p className="text-xs text-gold-200">{t(lang, "ramadanDay").replace("{d}", String(phase.day)).replace("{n}", String(phase.daysInMonth))}</p>
        </div>
      </div>

      <div className="mt-4 text-center" aria-live="off">
        <p className="text-xs uppercase tracking-widest text-white/70">{eventLabel}</p>
        <p className="mt-1 font-mono text-4xl font-semibold tabular-nums text-gold-200" dir="ltr">
          {formatCountdown(event.secondsLeft)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl bg-white/10 py-2">
          <p className="text-white/70">{t(lang, "ramadanSehriEnds")}</p>
          <p className="text-base font-semibold" dir="ltr">{formatPrayerClock(times.timings.fajr)}</p>
        </div>
        <div className="rounded-xl bg-white/10 py-2">
          <p className="text-white/70">{t(lang, "ramadanIftar")}</p>
          <p className="text-base font-semibold" dir="ltr">{formatPrayerClock(times.timings.maghrib)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <p className="font-medium">{t(lang, "ramadanTracker")}</p>
          <p className="text-white/70">
            {t(lang, "ramadanFasted")} {fasted}
            {missed > 0 && ` · ${t(lang, "ramadanToMakeUp")} ${missed}`}
          </p>
        </div>
        <div className="grid grid-cols-10 gap-1.5" dir="ltr">
          {Array.from({ length: phase.daysInMonth }, (_, i) => i + 1).map((day) => {
            const mark = log[day];
            const future = day > phase.day;
            return (
              <button
                key={day}
                type="button"
                disabled={future}
                onClick={() => tap(day)}
                aria-label={`${t(lang, "ramadanDayShort")} ${day}: ${mark ? t(lang, mark === "fasted" ? "ramadanFasted" : "ramadanToMakeUp") : "—"}`}
                className={`relative flex aspect-square items-center justify-center rounded-full text-[10px] font-medium transition-colors ${
                  mark === "fasted"
                    ? "bg-gold-400 text-noor-950"
                    : mark === "missed"
                      ? "border border-red-300/70 text-red-200 line-through"
                      : isLastTen(day)
                        ? "border border-gold-300/50 text-gold-100"
                        : "border border-white/20 text-white/80"
                } ${day === phase.day ? "ring-2 ring-white" : ""} ${future ? "opacity-40" : ""}`}
              >
                {day}
                {isOddNight(day) && <span className="absolute -top-1 right-0 text-[8px] text-gold-300" aria-hidden>★</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-white/60">{t(lang, "ramadanTrackerHint")}</p>
      </div>

      <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/85">
        <p>{t(lang, isLastTen(phase.day) ? "ramadanLastTenNote" : "ramadanFaithNote")}</p>
        <CitationLink href={citationHref(hadith)!} label={citationLabel(citationHref(hadith)!)} className="mt-1 inline-block font-medium text-gold-200 underline decoration-dotted underline-offset-2">
          {hadith}
        </CitationLink>
      </div>
    </section>
  );
}

function Crescent() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-gold-300" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M14.5 3.2a8.8 8.8 0 1 0 6.3 14.7A7.2 7.2 0 0 1 14.5 3.2Z" />
      </svg>
    </span>
  );
}
