"use client";

import { useEffect, useState } from "react";
import { ContinueReadingCard } from "@/components/home/ContinueReadingCard";
import { DailyReflection } from "@/components/home/DailyReflection";
import { GratitudeJournal } from "@/components/home/GratitudeJournal";
import { HadithOfTheDay } from "@/components/home/HadithOfTheDay";
import { LastSavedKhutba } from "@/components/home/LastSavedKhutba";
import { QiblaHijriWidget } from "@/components/home/QiblaHijriWidget";
import { SalahDashboard } from "@/components/home/SalahDashboard";
import { NotificationSettings } from "@/components/home/NotificationSettings";
import { SalahSettingsPanel } from "@/components/home/SalahSettingsPanel";
import { TasbeehWidget } from "@/components/home/TasbeehWidget";
import { TimeOfDayHero } from "@/components/home/TimeOfDayHero";
import { TravelModeWidget } from "@/components/home/TravelModeWidget";
import { useChat } from "@/components/ChatProvider";
import { useLang } from "@/components/LangProvider";
import { useSalah } from "@/hooks/useSalah";
import { getTimePhase, qiblaBearing } from "@/lib/salah";
import { t } from "@/lib/i18n";
import Link from "next/link";

export default function HomePage() {
  const { lang } = useLang();
  const { openChat } = useChat();
  const salah = useSalah();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tz = salah.times?.timezone ?? "UTC";
  const phase = now ? getTimePhase(salah.times?.prayers ?? null, tz, now) : "night";
  const qibla = salah.coords ? Math.round(qiblaBearing(salah.coords.lat, salah.coords.lng)) : null;

  const gregorianDate = now
    ? new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : lang === "hi" ? "hi-IN" : "en-IN", {
        timeZone: tz,
        day: "numeric",
        month: "long",
        year: "numeric",
        weekday: "long",
      }).format(now)
    : "Loading local time…";
  const hijriDate = salah.times?.hijri
    ? `${salah.times.hijri.day} ${salah.times.hijri.month?.en} ${salah.times.hijri.year} AH`
    : "";

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-4">
      <TimeOfDayHero phase={phase} coords={salah.coords}>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" dir="ltr">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-white/10 shadow-lg ring-1 ring-white/20 backdrop-blur-sm sm:h-12 sm:w-12">
              <svg viewBox="0 0 64 64" className="h-6 w-6 text-white sm:h-7 sm:w-7" aria-hidden="true">
                <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
                <path
                  d="M32 8 L38 32 L32 56 L26 32 Z"
                  fill="currentColor"
                  style={{ transformOrigin: "32px 32px", transform: `rotate(${qibla ?? 0}deg)` }}
                />
                <circle cx="32" cy="32" r="4" fill="#d4a853" />
              </svg>
              <span className="text-[7px] font-medium text-white/75 sm:text-[8px]">Qibla {qibla ?? "—"}°</span>
            </div>
            <div>
              <p className="text-xs font-medium text-gold-300">{t(lang, "appName")}</p>
              <h1 className="mt-0.5 text-lg font-bold text-white sm:text-xl">{t(lang, "tagline")}</h1>
              <p className="mt-1 max-w-md text-[10px] text-white/75 sm:text-xs">
                {gregorianDate}{hijriDate ? ` · ${hijriDate}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={openChat}
            className="w-full shrink-0 rounded-lg bg-teal-700 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-teal-950/20 transition hover:scale-[1.02] hover:bg-teal-600 active:scale-[0.98] sm:w-auto sm:py-1.5"
          >
            {t(lang, "openChat")}
          </button>
        </div>

        <SalahDashboard
          times={salah.times}
          locationLabel={salah.locationLabel}
          loading={salah.loading}
          error={salah.error}
          onRefresh={salah.refresh}
        />
      </TimeOfDayHero>

      <div className="space-y-4">
        <ContinueReadingCard />

        <TravelModeWidget coords={salah.coords} />

        <DailyReflection lang={lang} />

        <GratitudeJournal times={salah.times} />

        <HadithOfTheDay lang={lang} />

        <TasbeehWidget />

        <QiblaHijriWidget coords={salah.coords} times={salah.times} />

        <div className="grid items-start gap-4 sm:grid-cols-2">
          <SalahSettingsPanel
            settings={salah.settings}
            times={salah.times}
            onSettings={salah.setSettings}
            onManualLocation={salah.setManualLocation}
            onUseGps={salah.useGpsLocation}
          />

          <NotificationSettings times={salah.times} />
        </div>

        <p className="text-center text-sm text-muted">
          <Link href="/settings" className="font-medium text-accent hover:underline">
            {t(lang, "settings")} →
          </Link>
        </p>

        <LastSavedKhutba />
      </div>
    </div>
  );
}
