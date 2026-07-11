"use client";

import { useLang } from "@/components/LangProvider";
import { NotificationSettings } from "@/components/home/NotificationSettings";
import { SalahSettingsPanel } from "@/components/home/SalahSettingsPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { useSalah } from "@/hooks/useSalah";
import type { FontScale } from "@/lib/a11y";
import { t, type Lang } from "@/lib/i18n";
import Link from "next/link";

const FONT_SCALES: FontScale[] = ["sm", "md", "lg", "xl"];

export default function SettingsPage() {
  const { lang, setLang } = useLang();
  const { fontScale, setFontScale, highContrast, setHighContrast } = useTheme();
  const salah = useSalah();

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "settings")}</h1>
        <p className="mt-1 text-sm text-muted">{t(lang, "settingsDesc")}</p>
      </div>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-heading">{t(lang, "language")}</h2>
        <div className="flex gap-2">
          {(["en", "ur", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium uppercase ${
                lang === l
                  ? "bg-teal-700 text-white dark:bg-teal-600"
                  : "border border-subtle text-muted"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-heading">{t(lang, "appearance")}</h2>
          <ThemeToggle variant="inline" />
        </div>
        <p className="text-xs text-muted">{t(lang, "appearanceHint")}</p>
        <div>
          <p className="mb-2 text-xs font-medium text-muted">{t(lang, "fontSize")}</p>
          <div className="flex flex-wrap gap-2">
            {FONT_SCALES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFontScale(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium uppercase ${
                  fontScale === s
                    ? "bg-noor-700 text-white dark:bg-noor-600"
                    : "border border-subtle text-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-heading">{t(lang, "highContrast")}</span>
          <input
            type="checkbox"
            checked={highContrast}
            onChange={(e) => setHighContrast(e.target.checked)}
            className="h-4 w-4"
          />
        </label>
      </section>

      <SalahSettingsPanel
        settings={salah.settings}
        onSettings={salah.setSettings}
        onManualLocation={salah.setManualLocation}
        onUseGps={salah.useGpsLocation}
      />

      <NotificationSettings times={salah.times} />

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-heading">{t(lang, "quickLinks")}</h2>
        <Link href="/quran" className="block text-sm text-accent hover:underline">
          {t(lang, "continueReading")} / {t(lang, "bookmarks")}
        </Link>
        <Link href="/hadith" className="block text-sm text-accent hover:underline">
          {t(lang, "hadithFavorites")}
        </Link>
        <Link href="/hadith-of-day" className="block text-sm text-accent hover:underline">
          {t(lang, "hadithArchive")}
        </Link>
        <Link href="/account" className="block text-sm text-accent hover:underline">
          {t(lang, "account")}
        </Link>
      </section>
    </div>
  );
}
