"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { apiStatic } from "@/lib/api";
import { t } from "@/lib/i18n";

type Dua = {
  id: string;
  title_en: string;
  title_ur: string;
  title_hi: string;
};

type Props = {
  coords: { lat: number; lng: number } | null;
  /** Render nothing unless travel is detected or switched on (used on the home page). */
  hideWhenIdle?: boolean;
};

const TRAVEL_MODE_KEY = "noor-travel-mode";
const HOME_ANCHOR_KEY = "noor-travel-home-anchor";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function loadManualTravel(): boolean {
  try {
    return localStorage.getItem(TRAVEL_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function TravelModeWidget({ coords, hideWhenIdle = false }: Props) {
  const { lang } = useLang();
  const [manualOn, setManualOn] = useState(false);
  const [autoOn, setAutoOn] = useState(false);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [duas, setDuas] = useState<Dua[]>([]);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    setManualOn(loadManualTravel());
  }, []);

  useEffect(() => {
    apiStatic<{ duas: Dua[] }>("/api/duas/travel")
      .then((d) => setDuas((d.duas || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  // Auto-detect: moving fast, or far from a settled "home" anchor.
  useEffect(() => {
    if (!coords || typeof navigator === "undefined" || !navigator.geolocation) return;

    try {
      const raw = localStorage.getItem(HOME_ANCHOR_KEY);
      if (!raw) {
        localStorage.setItem(HOME_ANCHOR_KEY, JSON.stringify(coords));
      } else {
        const home = JSON.parse(raw) as { lat: number; lng: number };
        if (haversineKm(home, coords) > 80) setAutoOn(true);
        else if (haversineKm(home, coords) < 5) setAutoOn(false);
      }
    } catch {
      /* ignore */
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const speed = pos.coords.speed; // m/s
        if (typeof speed === "number" && speed >= 0) {
          const kmh = speed * 3.6;
          setSpeedKmh(Math.round(kmh));
          if (kmh >= 25) setAutoOn(true);
        }
        try {
          const raw = localStorage.getItem(HOME_ANCHOR_KEY);
          if (raw) {
            const home = JSON.parse(raw) as { lat: number; lng: number };
            const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (haversineKm(home, here) > 80) setAutoOn(true);
          }
        } catch {
          /* ignore */
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [coords]);

  const active = manualOn || autoOn;

  function toggleManual() {
    const next = !manualOn;
    setManualOn(next);
    localStorage.setItem(TRAVEL_MODE_KEY, next ? "1" : "0");
    if (!next) {
      // Reset home anchor when leaving travel mode manually.
      if (coords) localStorage.setItem(HOME_ANCHOR_KEY, JSON.stringify(coords));
      setAutoOn(false);
    }
  }

  function duaTitle(d: Dua) {
    if (lang === "ur") return d.title_ur;
    if (lang === "hi") return d.title_hi;
    return d.title_en;
  }

  if (hideWhenIdle && !active) return null;

  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-heading">
            {t(lang, "travelMode")}
          </p>
          <p className="mt-1 text-sm text-body">
            {active ? t(lang, "travelModeActive") : t(lang, "travelModeIdle")}
          </p>
          {speedKmh != null && speedKmh >= 5 && (
            <p className="mt-1 text-xs text-faint">
              {t(lang, "travelModeSpeed")}: {speedKmh} km/h
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={toggleManual}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            active
              ? "bg-noor-700 text-white dark:bg-noor-600"
              : "border border-subtle text-heading hover:border-noor-300"
          }`}
        >
          {active ? t(lang, "travelModeOn") : t(lang, "travelModeEnable")}
        </button>
      </div>

      {active && (
        <div className="mt-4 space-y-3 animate-fade-in">
          <div className="rounded-xl bg-noor-50/70 p-3 text-sm dark:bg-noor-800/60">
            <p className="font-medium text-heading">{t(lang, "qasrJamTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t(lang, "qasrJamHint")}</p>
          </div>

          {duas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-heading">
                {t(lang, "travelDuasQuick")}
              </p>
              {duas.map((d) => (
                <Link
                  key={d.id}
                  href="/hadith?section=duas&category=travel"
                  className="block rounded-lg bg-noor-50/70 px-3 py-2 text-sm text-heading hover:bg-noor-50 dark:bg-noor-800/60 dark:hover:bg-noor-800"
                >
                  {duaTitle(d)}
                </Link>
              ))}
            </div>
          )}

          <Link href="/hadith?section=duas&category=travel" className="inline-block text-xs font-medium text-accent hover:underline">
            {t(lang, "allTravelDuas")} →
          </Link>
        </div>
      )}
    </section>
  );
}
