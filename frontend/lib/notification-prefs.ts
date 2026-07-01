"use client";

import type { PrayerId } from "@/lib/salah";

export type NotificationPrefs = {
  adhan: Record<PrayerId, boolean>;
  hadithDaily: boolean;
  hadithHour: number;
  hadithMinute: number;
};

const KEY = "noor-notification-prefs";

const DEFAULT: NotificationPrefs = {
  adhan: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
  hadithDaily: false,
  hadithHour: 8,
  hadithMinute: 0,
};

export function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw);
    return {
      adhan: { ...DEFAULT.adhan, ...(v.adhan ?? {}) },
      hadithDaily: Boolean(v.hadithDaily),
      hadithHour: Number(v.hadithHour) || 8,
      hadithMinute: Number(v.hadithMinute) || 0,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}
