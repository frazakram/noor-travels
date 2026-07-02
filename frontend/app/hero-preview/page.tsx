"use client";

import { SalahDashboard } from "@/components/home/SalahDashboard";
import { TimeOfDayHero } from "@/components/home/TimeOfDayHero";
import type { SalahTimesResponse, TimePhase } from "@/lib/salah";

const PHASES: TimePhase[] = ["fajr", "morning", "dhuhr", "asr", "maghrib", "isha", "night"];

const MOCK_TIMES: SalahTimesResponse = {
  date: "2026-07-02",
  timezone: "Asia/Kolkata",
  latitude: 12.9713,
  longitude: 77.7362,
  method: 1,
  school: 1,
  timings: {
    fajr: "04:38",
    sunrise: "05:57",
    dhuhr: "12:23",
    asr: "16:57",
    maghrib: "18:49",
    isha: "20:08",
    midnight: "00:23",
  },
  prayers: [
    { id: "fajr", start: "04:38", end: "05:57" },
    { id: "dhuhr", start: "12:23", end: "16:57" },
    { id: "asr", start: "16:57", end: "18:49" },
    { id: "maghrib", start: "18:49", end: "20:08" },
    { id: "isha", start: "20:08", end: "00:23" },
  ],
};

export default function HeroPreviewPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <TimeOfDayHero phase="isha" coords={{ lat: 12.9713, lng: 77.7362 }}>
        <SalahDashboard
          times={MOCK_TIMES}
          locationLabel="S.M Krishna Ward, Karnataka, India"
          loading={false}
          error=""
          onRefresh={() => undefined}
        />
      </TimeOfDayHero>
      {PHASES.map((phase) => (
        <TimeOfDayHero key={phase} phase={phase} coords={{ lat: 12.9713, lng: 77.7362 }}>
          <div className="py-6">
            <p className="text-xs font-medium uppercase tracking-widest text-gold-300">{phase}</p>
            <h2 className="mt-1 text-lg font-bold text-white">Remember Allah while travelling</h2>
            <p className="mt-1 text-xs text-white/75">Thursday, 2 July 2026 · 17 Muharram 1448 AH</p>
          </div>
        </TimeOfDayHero>
      ))}
    </div>
  );
}
