"use client";

import {
  isNativeApp,
  nativeScheduleHadithNotification,
  nativeSchedulePrayerAlarm,
  nativeSchedulePrayerAlarmTz,
} from "@/lib/native-bridge";
import { loadNotificationPrefs, saveNotificationPrefs, type NotificationPrefs } from "@/lib/notification-prefs";
import { msUntilTime, type PrayerId } from "@/lib/salah";

const NATIVE_PRAYER: Record<PrayerId, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function scheduleAdhan(prayer: PrayerId, startTime: string, enabled: boolean, timezone?: string): void {
  const [h, m] = startTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return;
  // Prayer times come in the selected city's timezone; only honor it when the pref is on.
  const tz = timezone && loadNotificationPrefs().useCityTimezone ? timezone : undefined;
  if (isNativeApp()) {
    if (!tz || !nativeSchedulePrayerAlarmTz(NATIVE_PRAYER[prayer], h, m, tz, enabled)) {
      nativeSchedulePrayerAlarm(NATIVE_PRAYER[prayer], h, m, enabled);
    }
    return;
  }
  // Web fallback: only works while tab is open (native APK recommended for real adhan)
  if (typeof window === "undefined") return;
  const key = `noor-adhan-timer-${prayer}`;
  const existing = (window as unknown as Record<string, number>)[key];
  if (existing) window.clearTimeout(existing);
  if (!enabled) return;

  let ms: number;
  if (tz) {
    ms = msUntilTime(startTime, tz);
  } else {
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    ms = target.getTime() - now.getTime();
  }
  if (ms > 2_147_000_000) return;

  (window as unknown as Record<string, number>)[key] = window.setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(`${NATIVE_PRAYER[prayer]} — Adhan`, {
        body: "It is time for salah. Open Noor Safar for prayer times.",
        icon: "/logo-sm.png",
        tag: `adhan-${prayer}`,
      });
    }
    scheduleAdhan(prayer, startTime, loadNotificationPrefs().adhan[prayer], timezone);
  }, ms);
}

export function scheduleHadithDaily(enabled: boolean, hour: number, minute: number): void {
  if (isNativeApp()) {
    nativeScheduleHadithNotification(hour, minute, enabled);
    return;
  }
  const key = "noor-hadith-timer";
  if (typeof window !== "undefined") {
    const existing = (window as unknown as Record<string, number>)[key];
    if (existing) window.clearTimeout(existing);
  }
  if (!enabled || typeof window === "undefined") return;

  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= new Date()) target.setDate(target.getDate() + 1);
  const ms = target.getTime() - Date.now();
  if (ms > 2_147_000_000) return;

  (window as unknown as Record<string, number>)[key] = window.setTimeout(async () => {
    if (Notification.permission === "granted") {
      try {
        const topic =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("noor-hotd-topic") || "all"
            : "all";
        const q = topic && topic !== "all" ? `?topic=${encodeURIComponent(topic)}` : "";
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/hadith/daily${q}`);
        const row = await res.json();
        const snippet = String(row.english || "").slice(0, 180);
        new Notification("Hadith of the day — Noor Safar", {
          body: snippet,
          icon: "/logo-sm.png",
          tag: "hadith-daily",
        });
      } catch {
        new Notification("Hadith of the day — Noor Safar", {
          body: "Open Noor Safar to read today's hadith.",
          icon: "/logo-sm.png",
        });
      }
    }
    const latest = loadNotificationPrefs();
    scheduleHadithDaily(latest.hadithDaily, latest.hadithHour, latest.hadithMinute);
  }, ms);
}

function scheduleNamedDaily(
  timerKey: string,
  enabled: boolean,
  hour: number,
  minute: number,
  title: string,
  body: string,
  tag: string,
  reschedule: () => void
): void {
  if (typeof window === "undefined") return;
  const existing = (window as unknown as Record<string, number>)[timerKey];
  if (existing) window.clearTimeout(existing);
  if (!enabled) return;

  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= new Date()) target.setDate(target.getDate() + 1);
  const ms = target.getTime() - Date.now();
  if (ms > 2_147_000_000) return;

  (window as unknown as Record<string, number>)[timerKey] = window.setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/logo-sm.png", tag });
    }
    reschedule();
  }, ms);
}

export function scheduleLearnReminder(enabled: boolean, hour: number, minute: number): void {
  scheduleNamedDaily(
    "noor-learn-timer",
    enabled,
    hour,
    minute,
    "Learn Quran — Noor Safar",
    "A short lesson keeps your streak alive.",
    "learn-quran-daily",
    () => {
      const p = loadNotificationPrefs();
      scheduleLearnReminder(p.learnQuranDaily, p.learnHour, p.learnMinute);
    }
  );
}

export function scheduleGratitudeReminder(enabled: boolean, hour: number, minute: number): void {
  scheduleNamedDaily(
    "noor-gratitude-timer",
    enabled,
    hour,
    minute,
    "Gratitude journal — Noor Safar",
    "Write one blessing from today.",
    "gratitude-daily",
    () => {
      const p = loadNotificationPrefs();
      scheduleGratitudeReminder(p.gratitudeDaily, p.gratitudeHour, p.gratitudeMinute);
    }
  );
}

export function applyAllNotificationSchedules(
  prefs: NotificationPrefs,
  prayerStarts: Partial<Record<PrayerId, string>>,
  timezone?: string,
): void {
  (Object.keys(prefs.adhan) as PrayerId[]).forEach((id) => {
    const start = prayerStarts[id];
    if (start) scheduleAdhan(id, start, prefs.adhan[id], timezone);
  });
  scheduleHadithDaily(prefs.hadithDaily, prefs.hadithHour, prefs.hadithMinute);
  scheduleLearnReminder(prefs.learnQuranDaily, prefs.learnHour, prefs.learnMinute);
  scheduleGratitudeReminder(prefs.gratitudeDaily, prefs.gratitudeHour, prefs.gratitudeMinute);
}

export function updateNotificationPrefs(
  patch: Partial<NotificationPrefs>,
  prayerStarts?: Partial<Record<PrayerId, string>>,
  timezone?: string,
): NotificationPrefs {
  const next = { ...loadNotificationPrefs(), ...patch };
  if (patch.adhan) next.adhan = { ...loadNotificationPrefs().adhan, ...patch.adhan };
  saveNotificationPrefs(next);
  if (prayerStarts) applyAllNotificationSchedules(next, prayerStarts, timezone);
  return next;
}
