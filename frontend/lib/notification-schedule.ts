"use client";

import {
  isNativeApp,
  nativeScheduleHadithNotification,
  nativeSchedulePrayerAlarm,
} from "@/lib/native-bridge";
import { loadNotificationPrefs, saveNotificationPrefs, type NotificationPrefs } from "@/lib/notification-prefs";
import type { PrayerId } from "@/lib/salah";

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

export function scheduleAdhan(prayer: PrayerId, startTime: string, enabled: boolean): void {
  const [h, m] = startTime.split(":").map(Number);
  if (isNativeApp()) {
    nativeSchedulePrayerAlarm(NATIVE_PRAYER[prayer], h, m, enabled);
    return;
  }
  // Web fallback: only works while tab is open (native APK recommended for real adhan)
  if (!enabled || typeof window === "undefined") return;
  const prefs = loadNotificationPrefs();
  const key = `noor-adhan-timer-${prayer}`;
  const existing = (window as unknown as Record<string, number>)[key];
  if (existing) window.clearTimeout(existing);

  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const ms = target.getTime() - now.getTime();
  if (ms > 2_147_000_000) return;

  (window as unknown as Record<string, number>)[key] = window.setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(`${NATIVE_PRAYER[prayer]} — Adhan`, {
        body: "It is time for salah. Open Noor Safar for prayer times.",
        icon: "/logo-sm.png",
        tag: `adhan-${prayer}`,
      });
    }
    scheduleAdhan(prayer, startTime, prefs.adhan[prayer]);
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/hadith/daily`);
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
    scheduleHadithDaily(true, hour, minute);
  }, ms);
}

export function applyAllNotificationSchedules(
  prefs: NotificationPrefs,
  prayerStarts: Partial<Record<PrayerId, string>>,
): void {
  (Object.keys(prefs.adhan) as PrayerId[]).forEach((id) => {
    const start = prayerStarts[id];
    if (start) scheduleAdhan(id, start, prefs.adhan[id]);
  });
  scheduleHadithDaily(prefs.hadithDaily, prefs.hadithHour, prefs.hadithMinute);
}

export function updateNotificationPrefs(
  patch: Partial<NotificationPrefs>,
  prayerStarts?: Partial<Record<PrayerId, string>>,
): NotificationPrefs {
  const next = { ...loadNotificationPrefs(), ...patch };
  if (patch.adhan) next.adhan = { ...loadNotificationPrefs().adhan, ...patch.adhan };
  saveNotificationPrefs(next);
  if (prayerStarts) applyAllNotificationSchedules(next, prayerStarts);
  return next;
}
