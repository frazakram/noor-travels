"use client";

import { api } from "@/lib/api";
import { AUTH_CHANGED_EVENT, getToken, isLoggedIn } from "@/lib/auth";
import {
  DEFAULT_A11Y,
  applyA11yPrefs,
  loadA11yPrefs,
  saveA11yPrefs,
  type A11yPrefs,
} from "@/lib/a11y";
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notification-prefs";
import {
  DEFAULT_SALAH_SETTINGS,
  type SalahSettings,
} from "@/lib/salah";
import type { Lang } from "@/lib/i18n";

export type ThemePref = "light" | "dark";

export type CloudUserPrefs = {
  theme?: ThemePref;
  lang?: Lang;
  a11y?: A11yPrefs;
  salah?: SalahSettings;
  notifications?: NotificationPrefs;
  /** Client ms timestamp — newer write wins when merging. */
  updatedAt?: number;
};

const THEME_KEY = "noor-theme";
const LANG_KEY = "noor-lang";
const SALAH_KEY = "noor-salah-settings";
const UPDATED_AT_KEY = "noor-prefs-updated-at";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function readUpdatedAt(): number {
  try {
    const n = Number(localStorage.getItem(UPDATED_AT_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function touchUpdatedAt(at = Date.now()): number {
  try {
    localStorage.setItem(UPDATED_AT_KEY, String(at));
  } catch {
    /* ignore */
  }
  return at;
}

function loadSalahSettings(): SalahSettings {
  try {
    const raw = localStorage.getItem(SALAH_KEY);
    if (!raw) return DEFAULT_SALAH_SETTINGS;
    const value = JSON.parse(raw);
    const offsets = { ...DEFAULT_SALAH_SETTINGS.offsets };
    for (const id of Object.keys(offsets) as (keyof typeof offsets)[]) {
      const v = Number(value.offsets?.[id]);
      if (Number.isInteger(v) && Math.abs(v) <= 60) offsets[id] = v;
    }
    return {
      method: Number(value.method) || DEFAULT_SALAH_SETTINGS.method,
      school: value.school === 0 ? 0 : 1,
      offsets,
      latitudeAdjustment: ([0, 1, 2, 3] as const).includes(value.latitudeAdjustment)
        ? value.latitudeAdjustment
        : 0,
    };
  } catch {
    return DEFAULT_SALAH_SETTINGS;
  }
}

export function collectLocalPrefs(): CloudUserPrefs {
  const themeRaw = localStorage.getItem(THEME_KEY);
  const langRaw = localStorage.getItem(LANG_KEY);
  return {
    theme: themeRaw === "dark" ? "dark" : "light",
    lang: langRaw === "ur" || langRaw === "hi" || langRaw === "en" ? langRaw : "en",
    a11y: loadA11yPrefs(),
    salah: loadSalahSettings(),
    notifications: loadNotificationPrefs(),
    updatedAt: readUpdatedAt(),
  };
}

/** Apply remote prefs into localStorage (+ DOM for theme/a11y/lang). */
export function applyCloudPrefsLocally(prefs: CloudUserPrefs): void {
  if (prefs.theme === "light" || prefs.theme === "dark") {
    localStorage.setItem(THEME_KEY, prefs.theme);
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
  }
  if (prefs.lang === "en" || prefs.lang === "ur" || prefs.lang === "hi") {
    localStorage.setItem(LANG_KEY, prefs.lang);
    document.documentElement.lang = prefs.lang === "ur" ? "ur" : prefs.lang === "hi" ? "hi" : "en";
    document.documentElement.dataset.uiLang = prefs.lang;
  }
  if (prefs.a11y) {
    const a11y = {
      fontScale: (["sm", "md", "lg", "xl"] as const).includes(prefs.a11y.fontScale as never)
        ? prefs.a11y.fontScale
        : DEFAULT_A11Y.fontScale,
      highContrast: Boolean(prefs.a11y.highContrast),
    };
    saveA11yPrefs(a11y);
    applyA11yPrefs(a11y);
  }
  if (prefs.salah) {
    localStorage.setItem(SALAH_KEY, JSON.stringify({ ...DEFAULT_SALAH_SETTINGS, ...prefs.salah }));
  }
  if (prefs.notifications) {
    saveNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...prefs.notifications });
  }
  touchUpdatedAt(Number(prefs.updatedAt) || Date.now());
}

export async function pullRemotePrefs(): Promise<CloudUserPrefs | null> {
  if (!isLoggedIn()) return null;
  const data = await api<{ prefs: CloudUserPrefs | null }>("/api/auth/preferences", {
    headers: authHeaders(),
  });
  return data.prefs;
}

export async function pushRemotePrefs(prefs: CloudUserPrefs): Promise<void> {
  if (!isLoggedIn()) return;
  await api("/api/auth/preferences", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ prefs }),
  });
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced cloud sync of the current device prefs. */
export function schedulePrefsPush(partial?: Partial<CloudUserPrefs>) {
  if (typeof window === "undefined" || !isLoggedIn()) return;
  const at = touchUpdatedAt();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const local = { ...collectLocalPrefs(), ...partial, updatedAt: at };
    pushRemotePrefs(local).catch(() => undefined);
  }, 900);
}

/**
 * On login / app start: pull cloud prefs and apply if remote is newer (or local is default-ish).
 * Always merges by updatedAt — newer wins.
 */
export async function syncPrefsFromCloud(): Promise<CloudUserPrefs | null> {
  if (!isLoggedIn()) return null;
  try {
    const remote = await pullRemotePrefs();
    const local = collectLocalPrefs();
    if (!remote) {
      await pushRemotePrefs(local);
      return local;
    }
    const remoteAt = Number(remote.updatedAt) || 0;
    const localAt = Number(local.updatedAt) || 0;
    if (remoteAt >= localAt) {
      applyCloudPrefsLocally(remote);
      window.dispatchEvent(new Event("noor:prefs-changed"));
      return remote;
    }
    await pushRemotePrefs(local);
    return local;
  } catch {
    return null;
  }
}

/** Call after login/signup so a fresh session picks up cloud prefs. */
export function wirePrefsSyncOnAuth() {
  if (typeof window === "undefined") return;
  const run = () => {
    void syncPrefsFromCloud();
  };
  window.addEventListener(AUTH_CHANGED_EVENT, run);
  if (isLoggedIn()) run();
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, run);
}
