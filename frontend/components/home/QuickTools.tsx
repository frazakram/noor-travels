"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang } from "@/components/LangProvider";
import { HijriCalendarModal } from "@/components/home/HijriCalendarModal";
import { QiblaCompass } from "@/components/home/QiblaCompass";
import { TasbeehWidget } from "@/components/home/TasbeehWidget";
import { ToolSheet } from "@/components/home/ToolSheet";
import type { SalahTimesResponse } from "@/lib/salah";
import { t } from "@/lib/i18n";

type Props = {
  coords: { lat: number; lng: number } | null;
  times: SalahTimesResponse | null;
};

type Sheet = "qibla" | "tasbeeh" | "calendar" | null;

const ICONS = {
  qibla: <><circle cx="12" cy="12" r="9" /><path d="m12 6 2.5 6L12 18l-2.5-6L12 6Z" /></>,
  tasbeeh: <><circle cx="12" cy="5" r="1.6" /><circle cx="17" cy="8" r="1.6" /><circle cx="18.5" cy="13.5" r="1.6" /><circle cx="15.5" cy="18" r="1.6" /><circle cx="9.5" cy="18" r="1.6" /><circle cx="6.5" cy="13.5" r="1.6" /><circle cx="7" cy="8" r="1.6" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  khutba: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
};

function ToolIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-noor-50 text-noor-700 transition-colors group-hover:bg-noor-100 dark:bg-noor-800 dark:text-gold-300 dark:group-hover:bg-noor-700">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICONS[name]}
      </svg>
    </span>
  );
}

export function QuickTools({ coords, times }: Props) {
  const { lang } = useLang();
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  const label = "text-xs font-medium text-heading";
  const item = "group flex flex-col items-center gap-2";

  return (
    <nav aria-label={t(lang, "quickTools")} className="grid grid-cols-4 gap-2 py-1">
      <button type="button" className={item} onClick={() => setSheet("qibla")}>
        <ToolIcon name="qibla" />
        <span className={label}>{t(lang, "toolQibla")}</span>
      </button>
      <button type="button" className={item} onClick={() => setSheet("tasbeeh")}>
        <ToolIcon name="tasbeeh" />
        <span className={label}>{t(lang, "toolTasbeeh")}</span>
      </button>
      <button type="button" className={item} onClick={() => setSheet("calendar")}>
        <ToolIcon name="calendar" />
        <span className={label}>{t(lang, "toolCalendar")}</span>
      </button>
      <Link href="/khutba" prefetch={false} className={item}>
        <ToolIcon name="khutba" />
        <span className={label}>{t(lang, "toolKhutba")}</span>
      </Link>

      <ToolSheet open={sheet === "qibla"} title={t(lang, "qiblaCompass")} onClose={close}>
        <QiblaCompass coords={coords} />
      </ToolSheet>
      <ToolSheet open={sheet === "tasbeeh"} title={t(lang, "tasbeehCounter")} onClose={close}>
        <TasbeehWidget />
      </ToolSheet>
      <HijriCalendarModal open={sheet === "calendar"} onClose={close} hijri={times?.hijri} />
    </nav>
  );
}
