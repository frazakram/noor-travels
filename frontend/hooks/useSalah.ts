"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { applyAllNotificationSchedules } from "@/lib/notification-schedule";
import { loadNotificationPrefs } from "@/lib/notification-prefs";
import { DEFAULT_SALAH_SETTINGS, type LocationResponse, type PrayerId, type SalahSettings, type SalahTimesResponse } from "@/lib/salah";

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

  const fetchForCoords = useCallback(async (lat: number, lng: number, opts = settings, tzHint?: string) => {
    setLoading(true);
    setError("");
    try {
      const day = tzHint ? todayDateInTz(tzHint) : localTodayDate();
      const tzParam = tzHint ? `&timezone=${encodeURIComponent(tzHint)}` : "";
      const o = opts.offsets ?? DEFAULT_SALAH_SETTINGS.offsets;
      const adjParam = `&fajr_adj=${o.fajr}&dhuhr_adj=${o.dhuhr}&asr_adj=${o.asr}&maghrib_adj=${o.maghrib}&isha_adj=${o.isha}`;
      const latAdj = opts.latitudeAdjustment ?? 0;
      const latAdjParam = latAdj > 0 ? `&latitude_adjustment=${latAdj}` : "";
      const [loc, prayerTimes] = await Promise.all([
        api<LocationResponse>(`/api/salah/location?lat=${lat}&lng=${lng}`),
        api<SalahTimesResponse>(
          `/api/salah/times?lat=${lat}&lng=${lng}&method=${opts.method}&school=${opts.school}&date=${day}${tzParam}${adjParam}${latAdjParam}`,
        ),
      ]);
      setLocationLabel(loc.label);
      setTimes(prayerTimes);
      const starts: Partial<Record<PrayerId, string>> = {};
      prayerTimes.prayers.forEach((p) => {
        starts[p.id] = p.start;
      });
      applyAllNotificationSchedules(loadNotificationPrefs(), starts, prayerTimes.timezone);
      localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng }));
      localStorage.setItem(LABEL_KEY, loc.label);
    } catch {
      setError("salahErrorLoad");
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
    const manual = loadManualLocation();
    if (manual) {
      setPermission("granted");
      setCoords({ lat: manual.lat, lng: manual.lng });
      setLocationLabel(manual.label);
      void fetchForCoords(manual.lat, manual.lng);
      return;
    }

    if (!navigator.geolocation) {
      setPermission("unsupported");
      const cached = loadCachedCoords();
      if (cached) {
        setCoords(cached);
        void fetchForCoords(cached.lat, cached.lng);
      } else {
        setLoading(false);
        setError("salahErrorUnsupported");
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermission("granted");
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setCoords({ lat, lng });
        void fetchForCoords(lat, lng);
        if (accuracy > 500) {
          setError("");
        }
      },
      (err) => {
        setPermission(err.code === err.PERMISSION_DENIED ? "denied" : "prompt");
        const cached = loadCachedCoords();
        const cachedLabel = localStorage.getItem(LABEL_KEY);
        if (cached) {
          setCoords(cached);
          if (cachedLabel) setLocationLabel(cachedLabel);
          void fetchForCoords(cached.lat, cached.lng);
        } else {
          setLoading(false);
          setError("salahErrorPermission");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
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
