"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import {
  countToday,
  getMissedToday,
  getTodayLog,
  getWeekLogs,
  loadStreak,
  togglePrayer,
  type StreakStore,
} from "@/lib/salah-streak";
import {
  formatCountdown,
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
  const [streak, setStreak] = useState<StreakStore>({ currentStreak: 0, longestStreak: 0, logs: {} });
  const [notifySet, setNotifySet] = useState<Record<string, boolean>>(() => loadNotificationPrefs().adhan);
  const [shareStatus, setShareStatus] = useState("");
  const [showWeek, setShowWeek] = useState(false);
  const [showAllPrayers, setShowAllPrayers] = useState(false);
  const tz = times?.timezone ?? "UTC";

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
  const todayLog = now ? getTodayLog(tz) : {};
  const todayCount = countToday(todayLog);
  const weekLogs = now ? getWeekLogs(tz, lang) : [];
  const missedToday = now ? getMissedToday(tz) : 0;

  function handleToggle(prayer: PrayerId) {
    setStreak(togglePrayer(prayer, tz));
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

  async function sharePrayerTimes() {
    if (!times) return;
    const lines = [
      `Noor Safar prayer times${locationLabel ? ` for ${locationLabel}` : ""}`,
      `Date: ${times.date}`,
      `Fajr: ${times.timings.fajr} - ${times.timings.sunrise}`,
      `Sunrise: ${times.timings.sunrise}`,
      `Dhuhr: ${times.timings.dhuhr} - ${times.timings.asr}`,
      `Asr: ${times.timings.asr} - ${times.timings.maghrib}`,
      `Maghrib: ${times.timings.maghrib} - ${times.timings.isha}`,
      `Isha: ${times.timings.isha} - ${times.timings.midnight || "Fajr"}`,
      typeof window !== "undefined" ? window.location.origin : "Noor Safar",
    ];
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Noor Safar prayer times", text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShareStatus(t(lang, "copied"));
      window.setTimeout(() => setShareStatus(""), 1600);
    } catch {
      await navigator.clipboard?.writeText(text).catch(() => undefined);
      setShareStatus(t(lang, "copied"));
      window.setTimeout(() => setShareStatus(""), 1600);
    }
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
      {/* Location + streak row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {missedToday > 0 && (
            <div className="rounded-xl bg-red-500/20 px-3 py-1.5 text-center backdrop-blur-sm">
              <p className="text-lg font-bold text-red-100">{missedToday}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/70">{t(lang, "qada")}</p>
            </div>
          )}
          <div className="rounded-xl bg-white/15 px-3 py-1.5 text-center backdrop-blur-sm">
            <p className="text-lg font-bold text-gold-300">{streak.currentStreak}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/70">{t(lang, "salahStreak")}</p>
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-1.5 text-center backdrop-blur-sm">
            <p className="text-lg font-bold text-white">{todayCount}/5</p>
            <p className="text-[10px] uppercase tracking-wide text-white/70">{t(lang, "salahToday")}</p>
          </div>
        </div>
      </div>

      {/* Next salah countdown */}
      {nextInfo && times && now && (
        <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
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
            <div className="text-right">
              <p className="font-mono text-2xl font-bold tabular-nums text-gold-300 sm:text-3xl">
                {formatCountdown(nextInfo.countdownMs)}
              </p>
              <p className="text-[10px] text-white/60">{t(lang, "salahUntilAdhan")}</p>
              <p className="mt-0.5 text-[10px] text-white/70">
                {prayerLabel(nextInfo.next)} {t(lang, "adhanAt")} {formatPrayerClock(times.prayers.find((p) => p.id === nextInfo.next)?.start ?? times.timings[nextInfo.next], lang)}
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void sharePrayerTimes()}
              className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25"
            >
              {t(lang, "sharePrayerTimes")}
            </button>
            {shareStatus && <span className="text-xs text-gold-300">{shareStatus}</span>}
          </div>
          <div
            className="mt-3 h-1 overflow-hidden rounded-full bg-white/20"
            title={`${Math.round(nextInfo.progress * 100)}% through ${nextInfo.current ? prayerLabel(nextInfo.current) : "current"} window`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-400 to-amber-300 transition-all duration-1000"
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
          title="Prayer times need your location"
          message={error}
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
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                  isCurrent
                    ? "border-gold-400/80 bg-gold-400/20"
                    : isNext
                      ? "border-gold-300/40 bg-white/10"
                      : "border-white/15 bg-white/10"
                } ${canMark ? "" : "opacity-60"}`}
              >
                <span className={`text-base ${isPast ? "opacity-60 grayscale-[30%]" : ""}`}>
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
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    notifySet[prayerId!] ? "bg-gold-400 text-noor-950" : "bg-white/10 text-white/60"
                  }`}
                  title={t(lang, "notifyAtAdhan")}
                >
                  🔔
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    done
                      ? "animate-check-pop border-gold-400 bg-gold-400 text-noor-950"
                      : "border-white/25 text-transparent"
                  }`}
                >
                  ✓
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
                  isCurrent ? "pt-7" : ""
                } ${
                  isSunrise
                    ? "border-amber-200/40 bg-amber-200/10"
                    : isCurrent
                    ? "border-gold-400/80 bg-gold-400/20 shadow-lg shadow-gold-500/10 ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent"
                    : isNext
                      ? "animate-pulse border-gold-300/50 bg-white/10"
                      : "border-white/15 bg-white/10 hover:bg-white/15"
                } ${isSunrise || canMark ? "" : "cursor-not-allowed opacity-55"}`}
              >
                {isCurrent && (
                  <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-noor-950">
                    {t(lang, "salahActive")}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span className={`text-lg ${isPast ? "grayscale-[30%] opacity-60" : ""}`}>
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
                        className={`touch-target inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] ${notifySet[prayerId] ? "bg-gold-400 text-noor-950" : "bg-white/10 text-white/60"}`}
                        title={t(lang, "notifyAtAdhan")}
                      >
                        🔔
                      </span>
                    )}
                    {done && (
                      <span className="flex h-5 w-5 animate-check-pop items-center justify-center rounded-full border border-gold-400 bg-gold-400 text-[10px] text-noor-950">
                        ✓
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

      {weekLogs.length > 0 && (
        <div className="rounded-2xl bg-white/10 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setShowWeek((v) => !v)}
            className="flex w-full items-center justify-between gap-2 p-3 text-left sm:p-4"
          >
            <p className="text-sm font-semibold text-white">{t(lang, "weeklyPrayerHistory")}</p>
            <span className="flex items-center gap-2 text-xs text-white/60">
              {weekLogs.reduce((sum, d) => sum + d.prayed, 0)}/{weekLogs.length * 5}
              <span aria-hidden>{showWeek ? "▴" : "▾"}</span>
            </span>
          </button>
          {showWeek && (
            <div className="animate-fade-in px-3 pb-3 sm:px-4 sm:pb-4">
              <p className="mb-3 text-xs text-white/60">{t(lang, "qadaReminder")}</p>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {weekLogs.map((d) => (
                  <div key={d.key} className="rounded-lg bg-white/10 p-1.5 text-center sm:rounded-xl sm:p-2">
                    <p className="text-[10px] font-medium uppercase text-white/60">{d.label}</p>
                    <div className="mt-2 flex justify-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={i}
                          className={`h-2 w-2 rounded-full ${i < d.prayed ? "bg-gold-400" : "bg-white/20"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-white/50">{d.prayed}/5</p>
                  </div>
                ))}
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
