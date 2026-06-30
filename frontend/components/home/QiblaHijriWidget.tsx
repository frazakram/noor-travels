"use client";

import { useEffect, useState } from "react";
import { qiblaBearing, upcomingHijriEvent, type SalahTimesResponse } from "@/lib/salah";

type Props = {
  coords: { lat: number; lng: number } | null;
  times: SalahTimesResponse | null;
};

function readCompassHeading(e: DeviceOrientationEvent): number | null {
  const withWebkit = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if (typeof withWebkit.webkitCompassHeading === "number") {
    return withWebkit.webkitCompassHeading;
  }
  const absolute = e as DeviceOrientationEvent & { webkitCompassAccuracy?: number };
  if (typeof absolute.alpha === "number" && e.absolute) {
    return (360 - absolute.alpha) % 360;
  }
  if (typeof e.alpha === "number") {
    return (360 - e.alpha) % 360;
  }
  return null;
}

export function QiblaHijriWidget({ coords, times }: Props) {
  const [heading, setHeading] = useState(0);
  const bearing = coords ? qiblaBearing(coords.lat, coords.lng) : 0;
  const rotation = bearing - heading;
  const hijri = times?.hijri;
  const distanceKm = coords ? Math.round(distanceToMecca(coords.lat, coords.lng)) : null;
  const cardinal = cardinalDirection(bearing);

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
      if (next !== null) setHeading(next);
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
          <div className="relative mx-auto h-16 w-16 shrink-0 sm:mx-0 sm:h-16 sm:w-16">
            <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full text-slate-400 dark:text-slate-500">
              <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
              <text x="32" y="14" textAnchor="middle" fontSize="8" fill="currentColor">
                N
              </text>
              <text x="50" y="36" textAnchor="middle" fontSize="7" fill="currentColor">
                E
              </text>
              <text x="32" y="54" textAnchor="middle" fontSize="7" fill="currentColor">
                S
              </text>
              <text x="14" y="36" textAnchor="middle" fontSize="7" fill="currentColor">
                W
              </text>
            </svg>
            <div
              className="absolute left-1/2 top-3 h-9 w-1 -translate-x-1/2 origin-bottom rounded-full bg-teal-600 shadow-lg transition-transform duration-300"
              style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
            />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Qibla Direction</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">
              {coords ? `${Math.round(bearing)}° ${cardinal}` : "—"}
            </p>
            <p className="text-sm text-slate-500">
              {distanceKm ? `${distanceKm.toLocaleString()} km to Mecca` : "Allow location to calculate Qibla"}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Hold phone flat and rotate slowly for live compass</p>
          </div>
        </div>
      </article>
      <article className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:p-5">
        <h2 className="font-semibold text-heading">Hijri calendar</h2>
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
          <p className="mt-2 text-sm text-muted">Loading Hijri date…</p>
        )}
      </article>
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
