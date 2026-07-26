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

  const month = useMemo(() => {
    const h = hijriFor(anchor);
    // Gregorian date carrying hijri day 1 of the anchor's month.
    let first = addDays(anchor, -(h.day - 1));
    for (let guard = 0; guard < 5; guard++) {
      const p = hijriFor(first);
      if (p.day === 1) break;
      first = addDays(first, 1 - p.day);
    }
    // Normalize to noon so 24h steps never straddle a DST change.
    first = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 12);
    const days: { greg: Date; hijriDay: number }[] = [];
    for (let i = 0; i < 31; i++) {
      const greg = addDays(first, i);
      const p = hijriFor(greg);
      if (p.month !== h.month || p.year !== h.year) break;
      days.push({ greg, hijriDay: p.day });
    }
    return { hijriMonth: h.month, hijriYear: h.year, first, days };
  }, [anchor, hijriFor]);

  const locale = displayLocale(lang);

  const monthTitle = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
        month: "long",
        year: "numeric",
      }).format(addDays(month.first, offsetDays));
    } catch {
      return `${month.hijriMonth}/${month.hijriYear}`;
    }
  }, [locale, month, offsetDays]);

  const gregorianRange = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    const last = month.days[month.days.length - 1]?.greg ?? month.first;
    return `${fmt.format(month.first)} – ${fmt.format(last)}`;
  }, [locale, month]);

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  }, [locale]);

  if (!mounted || !open) return null;

  const today = new Date();
  const monthEvents = HIJRI_EVENTS.filter((e) => e.month === month.hijriMonth);
  const leadingBlanks = month.first.getDay();

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
            onClick={() => setAnchor(addDays(month.first, -1))}
            aria-label="Previous month"
            className="touch-target rounded-xl border border-noor-200 px-3 text-heading hover:bg-noor-50 dark:border-noor-600 dark:hover:bg-noor-800"
          >
            ‹
          </button>
          <div className="min-w-0 text-center">
            <h2 className="truncate text-lg font-bold text-heading">{monthTitle}</h2>
            <p className="text-xs text-muted">{gregorianRange}</p>
          </div>
          <button
            type="button"
            onClick={() => setAnchor(addDays(month.first, month.days.length))}
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
          {month.days.map(({ greg, hijriDay }) => {
            const isToday = sameGregorianDay(greg, today);
            const isFriday = greg.getDay() === 5;
            const event = monthEvents.find((e) => e.day === hijriDay);
            return (
              <div
                key={hijriDay}
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
                  {hijriDay}
                </span>
                <span className={`text-[10px] ${isToday ? "text-white/80" : "text-faint"}`}>
                  {greg.getDate()}
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
