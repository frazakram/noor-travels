"use client";

import type { PrayerId } from "@/lib/salah";

export type NotificationPrefs = {
  adhan: Record<PrayerId, boolean>;
  hadithDaily: boolean;
  hadithHour: number;
  hadithMinute: number;
  /** Schedule adhan in the prayer city's timezone instead of the device's. */
  useCityTimezone: boolean;
};

const KEY = "noor-notification-prefs";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  adhan: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
  hadithDaily: false,
  hadithHour: 8,
  hadithMinute: 0,
  useCityTimezone: true,
};

const DEFAULT = DEFAULT_NOTIFICATION_PREFS;

export function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw);
    return {
      adhan: { ...DEFAULT.adhan, ...(v.adhan ?? {}) },
      hadithDaily: Boolean(v.hadithDaily),
      hadithHour: Number.isInteger(v.hadithHour) ? v.hadithHour : DEFAULT.hadithHour,
      hadithMinute: Number.isInteger(v.hadithMinute) ? v.hadithMinute : DEFAULT.hadithMinute,
      useCityTimezone: typeof v.useCityTimezone === "boolean" ? v.useCityTimezone : DEFAULT.useCityTimezone,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}
