"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import { ShareButton } from "@/components/ShareButton";
import { useCardSheen } from "@/hooks/useCardSheen";
import type { SharePayload } from "@/lib/share";
import {
  getMonthStats,
  getTodayLog,
  getYearStats,
  loadStreak,
  togglePrayer,
  type StreakStore,
} from "@/lib/salah-streak";
import {
  countdownParts,
  getNextPrayer,
  getTimePhase,
  minutesInTz,
  parseMinutes,
  pickMotivation,
  type PrayerId,
  type SalahTimesResponse,
} from "@/lib/salah";
import { t } from "@/lib/i18n";
import { isNativeApp } from "@/lib/native-bridge";
import {
  ensureNotificationPermission,
  scheduleAdhan,
} from "@/lib/notification-schedule";
import { loadNotificationPrefs, saveNotificationPrefs } from "@/lib/notification-prefs";

/** Circle r=19 in the countdown ring's 44×44 viewBox. */
const NEXT_PRAYER_RING_CIRCUMFERENCE = 2 * Math.PI * 19;
/** Countdown text glows gold in the last 5 minutes before adhan. */
const FINAL_STRETCH_MS = 5 * 60 * 1000;

const PRAYER_ICONS: Record<PrayerId, string> = {
  fajr: "🌅",
  dhuhr: "☀️",
  asr: "🌤️",
  maghrib: "🌇",
  isha: "🌙",
};

type DisplaySlot =
  | { kind: "prayer"; id: PrayerId; start: string; end: string }
  | { kind: "sunrise"; id: "sunrise"; start: string; end: string };

const PRAYER_LABEL_KEYS = {
  fajr: "salahFajr",
  dhuhr: "salahDhuhr",
  asr: "salahAsr",
  maghrib: "salahMaghrib",
  isha: "salahIsha",
} as const;

function formatPrayerClock(time: string, lang: "en" | "ur" | "hi"): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  const locale = lang === "ur" ? "ur-PK" : lang === "hi" ? "hi-IN" : "en-US";
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

/** Small gold confetti burst, anchored to whatever it's placed inside (e.g. a checkmark). */
function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden>
      {[...Array(8)].map((_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 animate-confetti rounded-full bg-amber-400"
          style={{ "--tw-translate-x": `${(i - 3.5) * 6}px`, animationDelay: `${i * 25}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** Flip-clock style countdown: each segment replays a flip animation when its value changes. */
function FlipCountdown({ ms, urgent }: { ms: number; urgent: boolean }) {
  const parts = countdownParts(ms);
  return (
    <p
      className={`flex items-baseline justify-end gap-0.5 font-mono text-2xl font-bold tabular-nums text-gold-300 sm:text-3xl ${
        urgent ? "animate-countdown-glow" : ""
      }`}
      style={{ perspective: "60px" }}
    >
      {parts.h != null && (
        <span key={`h-${parts.h}`} className="animate-digit-flip inline-block">
          {parts.h}h
        </span>
      )}
      <span key={`m-${parts.m}`} className="animate-digit-flip inline-block">
        {parts.m}m
      </span>
      <span key={`s-${parts.s}`} className="animate-digit-flip inline-block">
        {parts.s}s
      </span>
    </p>
  );
}

type Props = {
  times: SalahTimesResponse | null;
  locationLabel: string;
  loading: boolean;
  error: string;
  onRefresh: () => void;
};

export function SalahDashboard({ times, locationLabel, loading, error, onRefresh }: Props) {
  const { lang } = useLang();
  const [now, setNow] = useState<Date | null>(null);
  const [, setStreak] = useState<StreakStore>({ currentStreak: 0, longestStreak: 0, logs: {} });
  const [notifySet, setNotifySet] = useState<Record<string, boolean>>(() => loadNotificationPrefs().adhan);
  const [showStats, setShowStats] = useState(false);
  const [showAllPrayers, setShowAllPrayers] = useState(false);
  const tz = times?.timezone ?? "UTC";
  const sheen = useCardSheen();

  useEffect(() => {
    setNow(new Date());
    setStreak(loadStreak());
    setNotifySet(loadNotificationPrefs().adhan);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!now) return;
    setStreak(loadStreak());
  }, [now]);

  const phase = now ? getTimePhase(times?.prayers ?? null, tz, now) : "night";
  const motivation = now ? pickMotivation(lang, phase, now.getDate() + now.getHours()) : "";
  const nextInfo = times && now ? getNextPrayer(times.prayers, tz, now) : null;

  const prevNextRef = useRef<PrayerId | null>(null);
  const [justAdhan, setJustAdhan] = useState(false);
  useEffect(() => {
    if (!nextInfo) return;
    const prev = prevNextRef.current;
    prevNextRef.current = nextInfo.next;
    if (prev !== null && prev !== nextInfo.next) {
      setJustAdhan(true);
      const id = window.setTimeout(() => setJustAdhan(false), 1400);
      return () => window.clearTimeout(id);
    }
  }, [nextInfo?.next]);

  const todayLog = now ? getTodayLog(tz) : {};
  const monthStats = now ? getMonthStats(tz) : null;
  const yearStats = now ? getYearStats(tz) : null;

  const [justMarked, setJustMarked] = useState<PrayerId | null>(null);

  function handleToggle(prayer: PrayerId) {
    const wasDone = !!todayLog[prayer];
    setStreak(togglePrayer(prayer, tz));
    if (!wasDone) {
      setJustMarked(prayer);
      window.setTimeout(() => setJustMarked(null), 700);
    }
  }

  async function toggleNotification(prayer: PrayerId, start: string) {
    const enabled = !notifySet[prayer];
    if (!isNativeApp()) await ensureNotificationPermission();
    const prefs = loadNotificationPrefs();
    const nextAdhan = { ...prefs.adhan, [prayer]: enabled };
    saveNotificationPrefs({ ...prefs, adhan: nextAdhan });
    setNotifySet(nextAdhan);
    scheduleAdhan(prayer, start, enabled, times?.timezone);
  }

  const prayerLabel = (id: PrayerId) => t(lang, PRAYER_LABEL_KEYS[id]);
  const nowMinutes = now ? minutesInTz(now, tz) : 0;

  function hasStarted(prayer: PrayerId, start: string): boolean {
    if (!now) return false;
    const startMinutes = parseMinutes(start);
    if (prayer === "isha") return nowMinutes >= startMinutes || nowMinutes < parseMinutes(times?.timings.fajr ?? "00:00");
    return nowMinutes >= startMinutes;
  }

  function prayerTimesSharePayload(): SharePayload {
    const lines = [
      `Noor Safar prayer times${locationLabel ? ` for ${locationLabel}` : ""}`,
      `Date: ${times?.date ?? ""}`,
      `Fajr: ${times?.timings.fajr} - ${times?.timings.sunrise}`,
      `Sunrise: ${times?.timings.sunrise}`,
      `Dhuhr: ${times?.timings.dhuhr} - ${times?.timings.asr}`,
      `Asr: ${times?.timings.asr} - ${times?.timings.maghrib}`,
      `Maghrib: ${times?.timings.maghrib} - ${times?.timings.isha}`,
      `Isha: ${times?.timings.isha} - ${times?.timings.midnight || "Fajr"}`,
      typeof window !== "undefined" ? window.location.origin : "Noor Safar",
    ];
    return { title: "Noor Safar prayer times", text: lines.join("\n") };
  }

  const displaySlots: DisplaySlot[] = times
    ? [
        { kind: "prayer", ...times.prayers.find((p) => p.id === "fajr")! },
        { kind: "sunrise", id: "sunrise", start: times.timings.sunrise, end: times.timings.dhuhr },
        { kind: "prayer", ...times.prayers.find((p) => p.id === "dhuhr")! },
        { kind: "prayer", ...times.prayers.find((p) => p.id === "asr")! },
        { kind: "prayer", ...times.prayers.find((p) => p.id === "maghrib")! },
        { kind: "prayer", ...times.prayers.find((p) => p.id === "isha")! },
      ]
    : [];

  return (
    <div className="space-y-3">
      {/* Location row */}
      <div className="flex min-w-0 items-center gap-2 text-sm text-white/90">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm">📍</span>
        <div>
          <p
            className={`font-medium ${
              loading
                ? "animate-pulse rounded-md bg-gradient-to-r from-white/40 via-white/80 to-white/40 bg-[length:200%_100%] px-2 text-transparent"
                : ""
            }`}
          >
            {loading ? t(lang, "salahLocating") : locationLabel || t(lang, "salahYourArea")}
          </p>
          {times && (
            <p className="text-[10px] text-white/60 sm:text-xs">
              {times.latitude.toFixed(4)}°, {times.longitude.toFixed(4)}° · {times.timezone}
            </p>
          )}
        </div>
      </div>

      {/* Next salah countdown */}
      {nextInfo && times && now && (
        <div
          className={`card-touch relative overflow-hidden rounded-2xl bg-white/10 p-3 backdrop-blur-md transition-colors duration-500 sm:p-4 ${
            justAdhan ? "animate-adhan-flash" : ""
          }`}
          onPointerDown={sheen.trigger}
        >
          {sheen.active && <span key={sheen.pulseId} className="card-sheen-pulse-dark" aria-hidden />}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`relative h-12 w-12 shrink-0 sm:h-14 sm:w-14 ${justAdhan ? "animate-icon-breathe" : ""}`}>
                <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                  <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
                  <circle
                    cx="22"
                    cy="22"
                    r="19"
                    fill="none"
                    stroke="#e0bc6a"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={NEXT_PRAYER_RING_CIRCUMFERENCE}
                    strokeDashoffset={NEXT_PRAYER_RING_CIRCUMFERENCE * nextInfo.progress}
                    className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg sm:text-xl" aria-hidden>
                  {PRAYER_ICONS[nextInfo.next]}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 sm:text-xs">{t(lang, "salahNext")}</p>
                <p className="mt-0.5 text-xl font-bold capitalize text-white sm:text-2xl">
                  {prayerLabel(nextInfo.next)}
                </p>
                {nextInfo.current && (
                  <p className="mt-0.5 text-xs text-gold-300">
                    {t(lang, "salahNow")}: {prayerLabel(nextInfo.current)}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <FlipCountdown
                ms={nextInfo.countdownMs}
                urgent={nextInfo.countdownMs > 0 && nextInfo.countdownMs <= FINAL_STRETCH_MS}
              />
              <p className="text-[10px] text-white/60">{t(lang, "salahUntilAdhan")}</p>
              <p className="mt-0.5 text-[10px] text-white/70">
                {prayerLabel(nextInfo.next)} {t(lang, "adhanAt")} {formatPrayerClock(times.prayers.find((p) => p.id === nextInfo.next)?.start ?? times.timings[nextInfo.next], lang)}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end">
            <ShareButton
              lang={lang}
              getPayload={prayerTimesSharePayload}
              label={t(lang, "sharePrayerTimes")}
              variant="hero"
            />
          </div>
          <div
            className="mt-3 h-1 overflow-hidden rounded-full bg-white/20"
            title={`${Math.round(nextInfo.progress * 100)}% through ${nextInfo.current ? prayerLabel(nextInfo.current) : "current"} window`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-400 to-amber-300 transition-all duration-1000 ease-linear"
              style={{ width: `${nextInfo.progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Motivation */}
      {motivation && (
        <blockquote className="animate-fade-in border-l-2 border-amber-400 pl-3 text-xs italic leading-relaxed text-white/85 sm:text-sm">
          {motivation}
        </blockquote>
      )}

      {error && (
        <NoticeCard
          tone="warning"
          title={t(lang, "salahNeedsLocation")}
          message={
            error.startsWith("salahError")
              ? t(lang, error as "salahErrorLoad" | "salahErrorUnsupported" | "salahErrorPermission")
              : error
          }
          actionLabel={t(lang, "salahRetryLocation")}
          onAction={onRefresh}
        />
      )}

      {/* Prayers on mobile: only the active window by default, expandable to all */}
      {times && (
        <div className="space-y-1.5 sm:hidden">
          {(showAllPrayers
            ? displaySlots
            : displaySlots.filter(
                (s) => s.kind === "prayer" && s.id === (nextInfo?.current ?? nextInfo?.next),
              )
          ).map((p) => {
            const isSunrise = p.kind === "sunrise";
            const prayerId = p.kind === "prayer" ? p.id : null;
            const isCurrent = prayerId ? nextInfo?.current === prayerId : false;
            const isNext = prayerId ? nextInfo?.next === prayerId : false;
            const done = prayerId ? !!todayLog[prayerId] : false;
            const canMark = prayerId ? done || isCurrent || (!isNext && hasStarted(prayerId, p.start)) : false;
            const isPast = prayerId ? hasStarted(prayerId, p.start) && !isCurrent && !isNext : false;
            if (isSunrise) {
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-xl border border-amber-200/30 bg-amber-200/10 px-3 py-1.5"
                >
                  <span className="text-sm">🌄</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-white/70">
                    {t(lang, "sunrise")} · {t(lang, "fajrWindowEnds")}
                  </span>
                  <span className="font-mono text-xs text-gold-300">{p.start}</span>
                </div>
              );
            }
            return (
              <button
                key={p.id}
                type="button"
                aria-disabled={!canMark}
                title={!canMark ? t(lang, "prayerNotStarted") : undefined}
                onClick={() => {
                  if (canMark && prayerId) handleToggle(prayerId);
                }}
                className={`relative flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                  isCurrent
                    ? "border-gold-400/80 bg-gold-400/20 overflow-hidden animate-tile-bounce animate-tile-shimmer"
                    : isNext
                      ? "border-gold-300/40 bg-white/10"
                      : "border-white/15 bg-white/10"
                } ${canMark ? "" : "opacity-60"}`}
              >
                <span
                  className={`inline-block text-base ${isPast ? "opacity-60 grayscale-[30%]" : ""} ${isCurrent ? "animate-icon-breathe" : ""}`}
                >
                  {PRAYER_ICONS[prayerId!]}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-white">{prayerLabel(prayerId!)}</span>
                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-noor-950">
                      {t(lang, "salahActive")}
                    </span>
                  )}
                </span>
                <span className={`text-right ${isPast ? "opacity-60" : ""}`}>
                  <span className="block font-mono text-sm text-gold-300">{p.start}</span>
                  {p.end && (
                    <span className="block font-mono text-[10px] text-white/50">
                      {t(lang, "salahUntil")} {p.end}
                    </span>
                  )}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleNotification(prayerId!, p.start);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      void toggleNotification(prayerId!, p.start);
                    }
                  }}
                  className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] after:absolute after:-inset-2.5 after:content-[''] ${
                    notifySet[prayerId!] ? "bg-gold-400 text-noor-950" : "bg-white/10 text-white/60"
                  }`}
                  title={t(lang, "notifyAtAdhan")}
                >
                  🔔
                </span>
                <span
                  className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    done
                      ? "animate-check-pop border-gold-400 bg-gold-400 text-noor-950"
                      : "border-white/25 text-transparent"
                  }`}
                >
                  ✓
                  {justMarked === prayerId && <ConfettiBurst />}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowAllPrayers((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/10"
          >
            {t(lang, showAllPrayers ? "showLessPrayers" : "showAllPrayers")}
            <span aria-hidden>{showAllPrayers ? "▴" : "▾"}</span>
          </button>
        </div>
      )}

      {/* All 5 prayers — tile grid on larger screens */}
      {times && (
        <div className="hidden gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-6">
          {displaySlots.map((p) => {
            const isSunrise = p.kind === "sunrise";
            const prayerId = p.kind === "prayer" ? p.id : null;
            const isCurrent = prayerId ? nextInfo?.current === prayerId : false;
            const isNext = prayerId ? nextInfo?.next === prayerId : false;
            const done = prayerId ? !!todayLog[prayerId] : false;
            const canMark = prayerId ? done || isCurrent || (!isNext && hasStarted(prayerId, p.start)) : false;
            const isPast = prayerId ? hasStarted(prayerId, p.start) && !isCurrent && !isNext : false;
            return (
              <button
                key={p.id}
                type="button"
                aria-disabled={isSunrise || !canMark}
                title={isSunrise ? t(lang, "fajrEndsAtSunrise") : !canMark ? t(lang, "prayerNotStarted") : undefined}
                onClick={() => {
                  if (canMark && prayerId) handleToggle(prayerId);
                }}
                className={`group relative rounded-xl border p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 sm:p-3 ${
                  isCurrent ? "pt-7 overflow-hidden animate-tile-bounce animate-tile-shimmer" : ""
                } ${
                  isSunrise
                    ? "border-amber-200/40 bg-amber-200/10"
                    : isCurrent
                    ? "border-gold-400/70 bg-gold-400/15 shadow-md shadow-gold-500/20"
                    : isNext
                      ? "animate-pulse border-gold-300/50 bg-white/10"
                      : "border-white/15 bg-white/10 hover:bg-white/15"
                } ${isSunrise || canMark ? "" : "cursor-not-allowed opacity-55"}`}
              >
                {isCurrent && (
                  <span className="absolute left-2 top-2 rounded-full bg-amber-400/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-noor-950">
                    {t(lang, "salahActive")}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-block text-lg ${isPast ? "grayscale-[30%] opacity-60" : ""} ${isCurrent ? "animate-icon-breathe" : ""}`}
                  >
                    {isSunrise ? "🌄" : PRAYER_ICONS[prayerId!]}
                  </span>
                  <div className="flex items-center gap-1">
                    {prayerId && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleNotification(prayerId, p.start);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            void toggleNotification(prayerId, p.start);
                          }
                        }}
                        className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] after:absolute after:-inset-2 after:content-[''] ${notifySet[prayerId] ? "bg-gold-400 text-noor-950" : "bg-white/10 text-white/60"}`}
                        title={t(lang, "notifyAtAdhan")}
                      >
                        🔔
                      </span>
                    )}
                    {done && (
                      <span className="relative flex h-5 w-5 animate-check-pop items-center justify-center rounded-full border border-gold-400 bg-gold-400 text-[10px] text-noor-950">
                        ✓
                        {prayerId && justMarked === prayerId && <ConfettiBurst />}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 font-semibold text-white">{isSunrise ? t(lang, "sunrise") : prayerLabel(prayerId!)}</p>
                <p className={`mt-1 font-mono text-sm text-gold-300 ${isPast ? "grayscale-[30%] opacity-60" : ""}`}>{p.start}</p>
                <p className="text-[10px] text-white/50">
                  {isSunrise ? t(lang, "fajrWindowEnds") : `${t(lang, "salahUntil")} ${p.end}`}
                </p>
              </button>
            );
          })}
        </div>
      )}


      {monthStats && yearStats && (monthStats.daysTracked > 0 || yearStats.daysTracked > 0) && (
        <div className="rounded-2xl bg-white/10 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setShowStats((v) => !v)}
            className="flex w-full items-center justify-between gap-2 p-3 text-left sm:p-4"
          >
            <p className="text-sm font-semibold text-white">{t(lang, "prayerStats")}</p>
            <span className="flex items-center gap-2 text-xs text-white/60">
              {monthStats.completionPct}%
              <span aria-hidden>{showStats ? "▴" : "▾"}</span>
            </span>
          </button>
          {showStats && (
            <div className="animate-fade-in grid gap-3 px-3 pb-3 sm:grid-cols-2 sm:px-4 sm:pb-4">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs font-medium uppercase text-white/60">{t(lang, "monthStats")}</p>
                <p className="mt-1 text-2xl font-bold text-gold-300">{monthStats.completionPct}%</p>
                <p className="mt-1 text-xs text-white/70">
                  {monthStats.prayersPrayed}/{monthStats.prayersPossible || 0} {t(lang, "prayersLogged")}
                </p>
                <p className="text-xs text-white/60">
                  {monthStats.daysComplete} {t(lang, "daysComplete")} · {monthStats.qadaRemaining}{" "}
                  {t(lang, "qadaLeft")}
                </p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-xs font-medium uppercase text-white/60">{t(lang, "yearStats")}</p>
                <p className="mt-1 text-2xl font-bold text-gold-300">{yearStats.completionPct}%</p>
                <p className="mt-1 text-xs text-white/70">
                  {yearStats.prayersPrayed}/{yearStats.prayersPossible || 0} {t(lang, "prayersLogged")}
                </p>
                <p className="text-xs text-white/60">
                  {yearStats.daysComplete} {t(lang, "daysComplete")} · {yearStats.qadaRemaining}{" "}
                  {t(lang, "qadaLeft")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && !times && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-6 backdrop-blur-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-gold-400" />
          <p className="text-sm text-white/80">{t(lang, "salahLoading")}</p>
        </div>
      )}

      <p className="text-center text-xs font-medium text-white/60 sm:text-sm">{t(lang, "salahTapToTrack")}</p>
    </div>
  );
}
