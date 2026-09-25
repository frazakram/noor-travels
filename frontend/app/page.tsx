"use client";

import { useEffect, useState } from "react";
import { ContinueReadingCard } from "@/components/home/ContinueReadingCard";
import { FridayKhutbaCard } from "@/components/home/FridayKhutbaCard";
import { GetTheAppCard } from "@/components/home/GetTheAppCard";
import { Onboarding } from "@/components/home/Onboarding";
import { QuickTools } from "@/components/home/QuickTools";
import { SalahDashboard } from "@/components/home/SalahDashboard";
import { TimeOfDayHero } from "@/components/home/TimeOfDayHero";
import { TodayCard } from "@/components/home/TodayCard";
import { TravelModeWidget } from "@/components/home/TravelModeWidget";
import { useLang } from "@/components/LangProvider";
import { useSalah } from "@/hooks/useSalah";
import { getTimePhase } from "@/lib/salah";

export default function HomePage() {
  const { lang } = useLang();
  const salah = useSalah();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tz = salah.times?.timezone ?? "UTC";
  const phase = now ? getTimePhase(salah.times?.prayers ?? null, tz, now) : "night";

  const gregorianDate = now
    ? new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : lang === "hi" ? "hi-IN" : "en-IN", {
        timeZone: tz,
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(now)
    : "";
  const hijri = salah.times?.hijri;
  const hijriDate = hijri ? `${hijri.day} ${hijri.month?.en} ${hijri.year}` : "";

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <TimeOfDayHero phase={phase} coords={salah.coords}>
        <p className="mb-3 min-h-[1.25rem] text-sm text-white/80" dir="ltr">
          {gregorianDate}
          {hijriDate ? <span className="text-white/60"> · {hijriDate}</span> : null}
        </p>
        <SalahDashboard
          times={salah.times}
          locationLabel={salah.locationLabel}
          loading={salah.loading}
          error={salah.error}
          onRefresh={salah.refresh}
        />
      </TimeOfDayHero>

      <QuickTools coords={salah.coords} times={salah.times} />

      <FridayKhutbaCard timeZone={tz} />
      <TravelModeWidget coords={salah.coords} hideWhenIdle />
      <ContinueReadingCard />
      <TodayCard />
      <GetTheAppCard />
      <Onboarding salah={salah} />
    </div>
  );
}
