"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { HijriCalendarModal } from "@/components/home/HijriCalendarModal";
import { qiblaBearing, upcomingHijriEvent, type SalahTimesResponse } from "@/lib/salah";
import { t } from "@/lib/i18n";

type Props = {
  coords: { lat: number; lng: number } | null;
  times: SalahTimesResponse | null;
};

function readCompassHeading(e: DeviceOrientationEvent): number | null {
  const withWebkit = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if (typeof withWebkit.webkitCompassHeading === "number") {
    return withWebkit.webkitCompassHeading;
  }
  if (typeof e.alpha === "number" && e.absolute) {
    return (360 - e.alpha) % 360;
  }
  if (typeof e.alpha === "number") {
    return (360 - e.alpha) % 360;
  }
  return null;
}

export function QiblaHijriWidget({ coords, times }: Props) {
  const { lang } = useLang();
  const [heading, setHeading] = useState<number | null>(null);
  const [compassLive, setCompassLive] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const bearing = coords ? qiblaBearing(coords.lat, coords.lng) : 0;
  const needleRotation = heading !== null ? bearing - heading : bearing;
  const hijri = times?.hijri;
  const distanceKm = coords ? Math.round(distanceToMecca(coords.lat, coords.lng)) : null;
  const cardinal = cardinalDirection(bearing);
  const aligned = heading !== null && Math.abs(((bearing - heading + 540) % 360) - 180) < 12;

  useEffect(() => {
    async function enableOrientation() {
      const DOE = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<PermissionState>;
      };
      if (typeof DOE.requestPermission === "function") {
        try {
          await DOE.requestPermission();
        } catch {
          /* user denied */
        }
      }
    }

    void enableOrientation();

    function onOrientation(e: DeviceOrientationEvent) {
      const next = readCompassHeading(e);
      if (next !== null) {
        setHeading(next);
        setCompassLive(true);
      }
    }

    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation, true);
      window.removeEventListener("deviceorientation", onOrientation, true);
    };
  }, []);

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <article className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="relative mx-auto h-20 w-20 shrink-0 sm:mx-0">
            <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full text-slate-400 dark:text-slate-500">
              <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
              <text x="32" y="12" textAnchor="middle" fontSize="8" fill="currentColor">
                N
              </text>
            </svg>
            {/* Kaaba marker — fixed qibla direction from your location */}
            {coords && (
              <span
                className="absolute left-1/2 top-1/2 text-sm"
                style={{
                  transform: `translate(-50%, -50%) rotate(${bearing}deg) translateY(-1.35rem)`,
                }}
                aria-hidden
              >
                🕋
              </span>
            )}
            {/* Your location at center */}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs" aria-hidden>
              📍
            </span>
            {/* Phone heading arrow */}
            <div
              className={`absolute left-1/2 top-3 h-10 w-1 -translate-x-1/2 origin-bottom rounded-full shadow-lg transition-transform duration-300 ${
                aligned ? "bg-emerald-500" : "bg-teal-600"
              }`}
              style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t(lang, "qiblaCompass")}</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">
              {coords ? `${Math.round(bearing)}° ${cardinal}` : "—"}
            </p>
            <p className="text-sm text-slate-500">
              {distanceKm ? `${distanceKm.toLocaleString()} ${t(lang, "qiblaKmToMecca")}` : t(lang, "qiblaAllowLocation")}
            </p>
            {coords && (
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-600 dark:text-slate-300">📍 {t(lang, "qiblaYourQibla")}:</span> {Math.round(bearing)}°
                {heading !== null && (
                  <>
                    {" · "}
                    <span className="font-medium text-slate-600 dark:text-slate-300">🧭 {t(lang, "qiblaPhoneHeading")}:</span> {Math.round(heading)}°
                  </>
                )}
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              {compassLive
                ? aligned
                  ? t(lang, "qiblaFacing")
                  : t(lang, "qiblaRotate")
                : t(lang, "qiblaHoldFlat")}
            </p>
          </div>
        </div>
      </article>
      <article className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:p-5">
        <h2 className="font-semibold text-heading">{t(lang, "hijriCalendar")}</h2>
        {hijri ? (
          <>
            <p className="mt-2 text-xl font-bold text-heading sm:text-2xl">
              {hijri.day} {hijri.month?.en} {hijri.year}
            </p>
            <p className="mt-1 text-sm text-muted">{upcomingHijriEvent(hijri)}</p>
            {hijri.holidays && hijri.holidays.length > 0 && (
              <p className="mt-2 text-xs text-accent">{hijri.holidays.join(", ")}</p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">{t(lang, "loadingHijri")}</p>
        )}
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-noor-200 px-3 py-1.5 text-xs font-medium text-accent hover:bg-noor-50 dark:border-noor-600 dark:hover:bg-noor-800"
        >
          📅 {t(lang, "openHijriCalendar")}
        </button>
      </article>
      <HijriCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        hijri={hijri}
      />
    </section>
  );
}

function cardinalDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function distanceToMecca(lat: number, lng: number): number {
  const r = 6371;
  const kaabaLat = 21.422487;
  const kaabaLng = 39.826206;
  const dLat = ((kaabaLat - lat) * Math.PI) / 180;
  const dLng = ((kaabaLng - lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat * Math.PI) / 180) *
      Math.cos((kaabaLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
