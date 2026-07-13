"use client";

import type { PrayerId } from "@/lib/salah";

export type NotificationPrefs = {
  adhan: Record<PrayerId, boolean>;
  hadithDaily: boolean;
  hadithHour: number;
  hadithMinute: number;
  /** Schedule adhan in the prayer city's timezone instead of the device's. */
  useCityTimezone: boolean;
  /** Daily Learn Quran study reminder */
  learnQuranDaily: boolean;
  learnHour: number;
  learnMinute: number;
  /** Gratitude journal reminder (evening by default) */
  gratitudeDaily: boolean;
  gratitudeHour: number;
  gratitudeMinute: number;
};

const KEY = "noor-notification-prefs";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  adhan: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
  hadithDaily: false,
  hadithHour: 8,
  hadithMinute: 0,
  useCityTimezone: true,
  learnQuranDaily: false,
  learnHour: 9,
  learnMinute: 0,
  gratitudeDaily: false,
  gratitudeHour: 20,
  gratitudeMinute: 0,
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
      useCityTimezone:
        typeof v.useCityTimezone === "boolean" ? v.useCityTimezone : DEFAULT.useCityTimezone,
      learnQuranDaily: Boolean(v.learnQuranDaily),
      learnHour: Number.isInteger(v.learnHour) ? v.learnHour : DEFAULT.learnHour,
      learnMinute: Number.isInteger(v.learnMinute) ? v.learnMinute : DEFAULT.learnMinute,
      gratitudeDaily: Boolean(v.gratitudeDaily),
      gratitudeHour: Number.isInteger(v.gratitudeHour) ? v.gratitudeHour : DEFAULT.gratitudeHour,
      gratitudeMinute: Number.isInteger(v.gratitudeMinute)
        ? v.gratitudeMinute
        : DEFAULT.gratitudeMinute,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
  void import("@/lib/user-prefs").then(({ schedulePrefsPush }) => {
    schedulePrefsPush({ notifications: prefs });
  });
}
