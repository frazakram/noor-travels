"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";
import { HIJRI_EVENTS, type SalahTimesResponse } from "@/lib/salah";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Today's hijri date from the Aladhan API — used to calibrate the grid so it
   *  matches the date shown everywhere else in the app. */
  hijri?: SalahTimesResponse["hijri"];
};

type HijriParts = { day: number; month: number; year: number };

const DAY_MS = 86_400_000;

const hijriFmt = () =>
  new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

let cachedFmt: Intl.DateTimeFormat | null = null;

function hijriPartsOf(date: Date): HijriParts {
  cachedFmt ??= hijriFmt();
  const parts = cachedFmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { day: get("day"), month: get("month"), year: get("year") };
}

// Month-name-only lookup, via formatToParts rather than .format(). ICU's
// islamic-umalqura calendar appends an era string ("AH") to any pattern that
// includes a year even when era was never requested, and for dates pushed
// outside the calendar's supported table range that era/year label can come
// back garbled (this is the mechanism behind a stray "BC" showing up) —
// reading only the "month" part sidesteps that failure mode entirely, since
// the numeric hijri year shown elsewhere always comes from hijriPartsOf()
// above, never from a formatted string.
const monthNameCache = new Map<string, Intl.DateTimeFormat>();

function hijriMonthName(date: Date, locale: string): string {
  const key = `${locale}-u-ca-islamic-umalqura`;
  let fmt = monthNameCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(key, { month: "long" });
    monthNameCache.set(key, fmt);
  }
  const part = fmt.formatToParts(date).find((p) => p.type === "month");
  return part?.value ?? "";
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function sameGregorianDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function displayLocale(lang: string): string {
  return lang === "ur" ? "ur-PK" : lang === "hi" ? "hi-IN" : "en-IN";
}

export function HijriCalendarModal({ open, onClose, hijri }: Props) {
  const { lang } = useLang();
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date());

  useEffect(() => setMounted(true), []);

  // Re-open always lands on the current month.
  useEffect(() => {
    if (open) setAnchor(new Date());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Intl's Umm al-Qura calendar can differ from the API (moon-sighting based)
  // by a day. Find the day shift that makes Intl agree with the API for today,
  // then apply it to every cell so the whole grid matches the app's hijri date.
  const offsetDays = useMemo(() => {
    const apiDay = Number(hijri?.day);
    const apiMonth = hijri?.month?.number;
    const apiYear = Number(hijri?.year);
    if (!apiDay || !apiMonth || !apiYear) return 0;
    const today = new Date();
    for (const delta of [0, 1, -1, 2, -2]) {
      const p = hijriPartsOf(addDays(today, delta));
      if (p.day === apiDay && p.month === apiMonth && p.year === apiYear) return delta;
    }
    return 0;
  }, [hijri]);

  const hijriFor = useCallback(
    (g: Date): HijriParts => hijriPartsOf(addDays(g, offsetDays)),
    [offsetDays],
  );

  // A plain, simple Gregorian month grid (every day of the calendar month the
  // user is on) — each cell carries its own hijri day/month/year alongside it.
  const month = useMemo(() => {
    const gYear = anchor.getFullYear();
    const gMonth = anchor.getMonth();
    const first = new Date(gYear, gMonth, 1, 12); // noon: 24h steps never straddle DST
    const daysInMonth = new Date(gYear, gMonth + 1, 0).getDate();
    const days: { greg: Date; hijri: HijriParts }[] = [];
    for (let i = 0; i < daysInMonth; i++) {
      const greg = addDays(first, i);
      days.push({ greg, hijri: hijriFor(greg) });
    }
    return { first, gYear, gMonth, days };
  }, [anchor, hijriFor]);

  const locale = displayLocale(lang);

  const gregorianTitle = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month.first),
    [locale, month.first],
  );

  // The hijri month almost always changes partway through a gregorian month,
  // so the subtitle shows whichever hijri month(s) actually fall within the
  // visible grid, e.g. "Safar–Rabi' I 1447 / 2026" — both calendars' years,
  // separated the way the islamic month/year are meant to sit alongside the
  // gregorian ones.
  const hijriSubtitle = useMemo(() => {
    const first = month.days[0]?.hijri;
    const last = month.days[month.days.length - 1]?.hijri;
    if (!first || !last) return "";
    const firstName = hijriMonthName(addDays(month.first, offsetDays), locale);
    const lastName = hijriMonthName(addDays(month.days[month.days.length - 1].greg, offsetDays), locale);
    const monthLabel =
      first.month === last.month && first.year === last.year
        ? firstName
        : first.year === last.year
          ? `${firstName}–${lastName}`
          : `${firstName} ${first.year} – ${lastName} ${last.year}`;
    const yearLabel = first.year === last.year ? `${first.year}` : `${first.year}–${last.year}`;
    return `${monthLabel} ${first.year === last.year ? yearLabel : ""} / ${month.gYear}`.replace(/\s+/g, " ").trim();
  }, [month, offsetDays, locale]);

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  }, [locale]);

  if (!mounted || !open) return null;

  const today = new Date();
  // A gregorian month can span two hijri months (or, at year-end, two hijri
  // years) — match events against every (month, year) pair actually visible.
  const visibleHijriMonths = new Set(month.days.map((d) => `${d.hijri.month}-${d.hijri.year}`));
  const monthEvents = HIJRI_EVENTS.filter((e) =>
    month.days.some((d) => visibleHijriMonths.has(`${d.hijri.month}-${d.hijri.year}`) && d.hijri.month === e.month),
  );
  const leadingBlanks = month.first.getDay();

  function goToMonth(offset: number) {
    setAnchor(new Date(month.gYear, month.gMonth + offset, 1, 12));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, "hijriCalendar")}
      onClick={onClose}
    >
      <div
        className="card max-h-[85vh] w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="touch-target rounded-xl border border-noor-200 px-3 text-heading hover:bg-noor-50 dark:border-noor-600 dark:hover:bg-noor-800"
          >
            ‹
          </button>
          <div className="min-w-0 text-center">
            <h2 className="truncate text-lg font-bold text-heading">{gregorianTitle}</h2>
            <p className="truncate text-xs text-muted">{hijriSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="touch-target rounded-xl border border-noor-200 px-3 text-heading hover:bg-noor-50 dark:border-noor-600 dark:hover:bg-noor-800"
          >
            ›
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {weekdayLabels.map((w, i) => (
            <span
              key={i}
              className={`text-[11px] font-semibold uppercase ${i === 5 ? "text-accent" : "text-faint"}`}
            >
              {w}
            </span>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {month.days.map(({ greg, hijri }) => {
            const isToday = sameGregorianDay(greg, today);
            const isFriday = greg.getDay() === 5;
            const event = monthEvents.find((e) => e.day === hijri.day && e.month === hijri.month);
            return (
              <div
                key={greg.getTime()}
                title={event?.name}
                className={`flex flex-col items-center rounded-lg py-1 ${
                  isToday
                    ? "bg-noor-700 text-white ring-2 ring-gold-400 dark:bg-noor-600"
                    : isFriday
                      ? "bg-gold-50 dark:bg-noor-800"
                      : ""
                }`}
              >
                <span className={`text-sm font-semibold ${isToday ? "text-white" : "text-heading"}`}>
                  {greg.getDate()}
                </span>
                <span
                  className={`whitespace-nowrap text-[9px] leading-tight ${isToday ? "text-white/80" : "text-faint"}`}
                >
                  {hijri.day}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${event ? "bg-gold-500 dark:bg-gold-400" : "bg-transparent"}`}
                />
              </div>
            );
          })}
        </div>

        {monthEvents.length > 0 && (
          <div className="mt-4 space-y-1 border-t border-subtle pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {t(lang, "hijriEventsThisMonth")}
            </p>
            {monthEvents.map((e) => (
              <p key={`${e.month}-${e.day}`} className="text-sm text-body">
                <span className="font-semibold text-heading">{e.day}</span> · {e.name}
              </p>
            ))}
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-faint">{t(lang, "hijriMoonNote")}</p>

        <button type="button" onClick={onClose} className="btn-primary mt-4 w-full">
          {t(lang, "close")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
