"use client";

import { Icon } from "@/components/Icon";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { qiblaBearing } from "@/lib/salah";
import { t } from "@/lib/i18n";

type Props = {
  coords: { lat: number; lng: number } | null;
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

export function QiblaCompass({ coords }: Props) {
  const { lang } = useLang();
  const [heading, setHeading] = useState<number | null>(null);
  const [compassLive, setCompassLive] = useState(false);
  const bearing = coords ? qiblaBearing(coords.lat, coords.lng) : 0;
  const needleRotation = heading !== null ? bearing - heading : bearing;
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
    <div>
        <div className="flex items-center gap-4">
          <div className="relative mx-auto h-20 w-20 shrink-0 sm:mx-0">
            <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full text-slate-400 dark:text-slate-500">
              <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
              <text x="32" y="12" textAnchor="middle" fontSize="8" fill="currentColor">
                N
              </text>
            </svg>
            {/* Qibla marker — fixed direction from your location */}
            {coords && (
              <span
                className="animate-qibla-glow absolute left-1/2 top-1/2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-noor-700 text-[8px] font-bold leading-none text-white shadow dark:bg-gold-400 dark:text-noor-950"
                style={{
                  transform: `translate(-50%, -50%) rotate(${bearing}deg) translateY(-1.35rem)`,
                }}
                aria-hidden
              >
                Q
              </span>
            )}
            {/* Your location at center */}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-noor-700 dark:text-gold-300" aria-hidden>
              <Icon name="pin" className="h-3.5 w-3.5" />
            </span>
            {/* Phone heading arrow */}
            <div
              className={`absolute left-1/2 top-3 h-10 w-1 -translate-x-1/2 origin-bottom rounded-full transition-transform duration-300 ${
                aligned ? "bg-emerald-500" : "bg-noor-600"
              }`}
              style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">
              {coords ? `${Math.round(bearing)}° ${cardinal}` : "—"}
            </p>
            <p className="text-sm text-slate-500">
              {distanceKm ? `${distanceKm.toLocaleString()} ${t(lang, "qiblaKmToMecca")}` : t(lang, "qiblaAllowLocation")}
            </p>
            {coords && (
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-600 dark:text-slate-300">{t(lang, "qiblaYourQibla")}:</span> {Math.round(bearing)}°
                {heading !== null && (
                  <>
                    {" · "}
                    <span className="font-medium text-slate-600 dark:text-slate-300">{t(lang, "qiblaPhoneHeading")}:</span> {Math.round(heading)}°
                  </>
                )}
              </p>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {compassLive
                ? aligned
                  ? t(lang, "qiblaFacing")
                  : t(lang, "qiblaRotate")
                : t(lang, "qiblaHoldFlat")}
            </p>
          </div>
        </div>
    </div>
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
