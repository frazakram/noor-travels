"use client";

import { nativeSetPrayerLocation } from "@/lib/native-bridge";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { applyAllNotificationSchedules } from "@/lib/notification-schedule";
import { loadNotificationPrefs } from "@/lib/notification-prefs";
import { DEFAULT_SALAH_SETTINGS, type LocationResponse, type PrayerId, type SalahSettings, type SalahTimesResponse } from "@/lib/salah";
import { distanceKm, MOVED_KM, settingsKey, usableCachedTimes } from "@/lib/salah-cache";

export type SalahState = {
  loading: boolean;
  /** i18n key ("salahErrorLoad" | "salahErrorUnsupported" | "salahErrorPermission") or "" — translate with t() at display time. */
  error: string;
  locationLabel: string;
  coords: { lat: number; lng: number } | null;
  times: SalahTimesResponse | null;
  permission: "prompt" | "granted" | "denied" | "unsupported";
  settings: SalahSettings;
  setManualLocation: (lat: number, lng: number, label: string) => void;
  setSettings: (settings: SalahSettings) => void;
  useGpsLocation: () => void;
  refresh: () => void;
};

const COORDS_KEY = "noor-salah-coords";
const LABEL_KEY = "noor-salah-label";
const MANUAL_KEY = "noor-salah-manual-location";
const SETTINGS_KEY = "noor-salah-settings";
const TIMES_KEY = "noor-salah-times";

// Prayer times need a town, not a street: a fast network-based fix is plenty, and a recent one
// is reused. A fresh high-accuracy GPS fix took ~10 s indoors and blocked the whole screen.
const QUICK_POSITION: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30 * 60_000 };

function loadCachedTimes(settings: SalahSettings): SalahTimesResponse | null {
  try {
    return usableCachedTimes(JSON.parse(localStorage.getItem(TIMES_KEY) ?? "null"), settings);
  } catch {
    return null;
  }
}

function localTodayDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function todayDateInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date())
    .replace(/\//g, "-");
}

function loadCachedCoords(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const { lat, lng } = JSON.parse(raw);
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  } catch {
    /* ignore */
  }
  return null;
}

function loadSettings(): SalahSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
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

function loadManualLocation(): { lat: number; lng: number; label: string } | null {
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value.lat === "number" && typeof value.lng === "number" && typeof value.label === "string") {
      return value;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function useSalah(): SalahState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [times, setTimes] = useState<SalahTimesResponse | null>(null);
  const [permission, setPermission] = useState<SalahState["permission"]>("prompt");
  const [settings, setSettingsState] = useState<SalahSettings>(DEFAULT_SALAH_SETTINGS);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSettingsState(loadSettings());
  }, []);

  useEffect(() => {
    const onPrefs = () => {
      setSettingsState(loadSettings());
      setTick((t) => t + 1);
    };
    window.addEventListener("noor:prefs-changed", onPrefs);
    return () => window.removeEventListener("noor:prefs-changed", onPrefs);
  }, []);

  // Times currently on screen; a refresh while they are shown happens silently.
  const shownTimes = useRef<SalahTimesResponse | null>(null);
  useEffect(() => {
    shownTimes.current = times;
  }, [times]);

  const fetchForCoords = useCallback(async (lat: number, lng: number, opts = settings, tzHint?: string) => {
    const background = shownTimes.current !== null;
    if (!background) {
      setLoading(true);
      setError("");
    }
    // The place name is separate: it must never hold the prayer times back.
    api<LocationResponse>(`/api/salah/location?lat=${lat}&lng=${lng}`)
      .then((loc) => {
        setLocationLabel(loc.label);
        localStorage.setItem(LABEL_KEY, loc.label);
      })
      .catch(() => {
        /* keep the saved label */
      });
    try {
      const day = tzHint ? todayDateInTz(tzHint) : localTodayDate();
      const tzParam = tzHint ? `&timezone=${encodeURIComponent(tzHint)}` : "";
      const o = opts.offsets ?? DEFAULT_SALAH_SETTINGS.offsets;
      const adjParam = `&fajr_adj=${o.fajr}&dhuhr_adj=${o.dhuhr}&asr_adj=${o.asr}&maghrib_adj=${o.maghrib}&isha_adj=${o.isha}`;
      const latAdj = opts.latitudeAdjustment ?? 0;
      const latAdjParam = latAdj > 0 ? `&latitude_adjustment=${latAdj}` : "";
      const prayerTimes = await api<SalahTimesResponse>(
        `/api/salah/times?lat=${lat}&lng=${lng}&method=${opts.method}&school=${opts.school}&date=${day}${tzParam}${adjParam}${latAdjParam}`,
        { silent: background },
      );
      setTimes(prayerTimes);
      setError("");
      const starts: Partial<Record<PrayerId, string>> = {};
      prayerTimes.prayers.forEach((p) => {
        starts[p.id] = p.start;
      });
      applyAllNotificationSchedules(loadNotificationPrefs(), starts, prayerTimes.timezone);
      nativeSetPrayerLocation({
        lat,
        lng,
        method: opts.method,
        school: opts.school,
        latitudeAdjustment: opts.latitudeAdjustment ?? 0,
        offsets: { ...(opts.offsets ?? DEFAULT_SALAH_SETTINGS.offsets) },
        timezone: prayerTimes.timezone,
      });
      localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng }));
      localStorage.setItem(TIMES_KEY, JSON.stringify({ times: prayerTimes, settingsKey: settingsKey(opts) }));
    } catch {
      // A failed background refresh keeps the times on screen; only a first load shows an error.
      if (!background) setError("salahErrorLoad");
    } finally {
      setLoading(false);
    }
  }, [settings]);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  const setSettings = useCallback((next: SalahSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setSettingsState(next);
    setTick((t) => t + 1);
    void import("@/lib/user-prefs").then(({ schedulePrefsPush }) => {
      schedulePrefsPush({ salah: next });
    });
  }, []);

  const setManualLocation = useCallback((lat: number, lng: number, label: string) => {
    localStorage.setItem(MANUAL_KEY, JSON.stringify({ lat, lng, label }));
    localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng }));
    localStorage.setItem(LABEL_KEY, label);
    setCoords({ lat, lng });
    setLocationLabel(label);
    void fetchForCoords(lat, lng);
  }, [fetchForCoords]);

  const useGpsLocation = useCallback(() => {
    localStorage.removeItem(MANUAL_KEY);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    // 1. Today's saved times appear immediately; everything below refreshes them.
    const saved = loadCachedTimes(settings);
    if (saved) {
      setTimes(saved);
      shownTimes.current = saved;
      setLoading(false);
      const savedLabel = localStorage.getItem(LABEL_KEY);
      if (savedLabel) setLocationLabel(savedLabel);
    }

    const manual = loadManualLocation();
    if (manual) {
      setPermission("granted");
      setCoords({ lat: manual.lat, lng: manual.lng });
      setLocationLabel(manual.label);
      void fetchForCoords(manual.lat, manual.lng);
      return;
    }

    // 2. The last known place is used straight away; the phone's position is checked in the
    //    background and only matters if it has moved meaningfully.
    const cached = loadCachedCoords();
    if (cached) {
      setCoords(cached);
      const cachedLabel = localStorage.getItem(LABEL_KEY);
      if (cachedLabel) setLocationLabel(cachedLabel);
      void fetchForCoords(cached.lat, cached.lng);
    }

    if (!navigator.geolocation) {
      setPermission("unsupported");
      if (!cached) {
        setLoading(false);
        setError("salahErrorUnsupported");
      }
      return;
    }

    let active = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!active) return;
        setPermission("granted");
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (cached && distanceKm(cached, here) < MOVED_KM) return;
        setCoords(here);
        void fetchForCoords(here.lat, here.lng);
      },
      (err) => {
        if (!active) return;
        setPermission(err.code === err.PERMISSION_DENIED ? "denied" : "prompt");
        if (!cached) {
          setLoading(false);
          setError("salahErrorPermission");
        }
      },
      QUICK_POSITION,
    );
    return () => {
      active = false;
    };
  }, [fetchForCoords, tick, settings]);

  // Refresh when the calendar day changes in the user's prayer timezone
  useEffect(() => {
    if (!coords || !times?.timezone) return;

    let midnightTimer: ReturnType<typeof setTimeout> | undefined;

    function scheduleMidnightRefresh() {
      const nowMin = (() => {
        const s = new Intl.DateTimeFormat("en-GB", {
          timeZone: times!.timezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date());
        const [h, m, sec] = s.split(":").map(Number);
        return h * 3600 + m * 60 + sec;
      })();
      const secsUntilMidnight = 24 * 3600 - nowMin;
      midnightTimer = setTimeout(() => {
        void fetchForCoords(coords!.lat, coords!.lng, settings, times!.timezone);
        scheduleMidnightRefresh();
      }, secsUntilMidnight * 1000 + 1500);
    }

    scheduleMidnightRefresh();
    const interval = setInterval(() => {
      void fetchForCoords(coords.lat, coords.lng, settings, times.timezone);
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(interval);
      if (midnightTimer) clearTimeout(midnightTimer);
    };
  }, [coords, times?.timezone, fetchForCoords, settings]);

  return {
    loading,
    error,
    locationLabel,
    coords,
    times,
    permission,
    settings,
    setManualLocation,
    setSettings,
    useGpsLocation,
    refresh,
  };
}
