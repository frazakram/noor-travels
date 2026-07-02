"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { isNativeApp } from "@/lib/native-bridge";
import { t } from "@/lib/i18n";
import {
  applyAllNotificationSchedules,
  ensureNotificationPermission,
  updateNotificationPrefs,
} from "@/lib/notification-schedule";
import { loadNotificationPrefs, type NotificationPrefs } from "@/lib/notification-prefs";
import type { PrayerId, SalahTimesResponse } from "@/lib/salah";

const PRAYERS: PrayerId[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const PRAYER_LABEL_KEYS = {
  fajr: "salahFajr",
  dhuhr: "salahDhuhr",
  asr: "salahAsr",
  maghrib: "salahMaghrib",
  isha: "salahIsha",
} as const;

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type Props = {
  times: SalahTimesResponse | null;
};

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-all duration-300 ${
        on ? "bg-gradient-to-r from-teal-600 to-teal-500 shadow-md shadow-teal-900/20" : "bg-slate-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-300 ease-out`}
        style={{ left: on ? "1.375rem" : "0.125rem" }}
      />
    </button>
  );
}

export function NotificationSettings({ times }: Props) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadNotificationPrefs());
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const native = isNativeApp();

  useEffect(() => {
    setPrefs(loadNotificationPrefs());
    if (typeof window !== "undefined" && "Notification" in window) {
      setPerm(Notification.permission);
    } else {
      setPerm("unsupported");
    }
  }, []);

  useEffect(() => {
    if (!times) return;
    const starts: Partial<Record<PrayerId, string>> = {};
    times.prayers.forEach((p) => {
      starts[p.id] = p.start;
    });
    applyAllNotificationSchedules(prefs, starts, times.timezone);
  }, [times, prefs]);

  const prayerStarts: Partial<Record<PrayerId, string>> = {};
  times?.prayers.forEach((p) => {
    prayerStarts[p.id] = p.start;
  });
  const cityTz = times?.timezone;
  const deviceTz =
    typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  async function requestPermission() {
    const ok = await ensureNotificationPermission();
    setPerm(ok ? "granted" : Notification.permission);
  }

  function setAdhan(prayer: PrayerId, enabled: boolean) {
    void (async () => {
      if (!native && enabled) await requestPermission();
      const next = updateNotificationPrefs({ adhan: { ...prefs.adhan, [prayer]: enabled } }, prayerStarts, cityTz);
      setPrefs(next);
    })();
  }

  function setHadithDaily(enabled: boolean) {
    void (async () => {
      if (!native && enabled) await requestPermission();
      const next = updateNotificationPrefs({ hadithDaily: enabled }, prayerStarts, cityTz);
      setPrefs(next);
    })();
  }

  function setHadithTime(hour: number, minute: number) {
    const next = updateNotificationPrefs({ hadithHour: hour, hadithMinute: minute }, prayerStarts, cityTz);
    setPrefs(next);
  }

  function setUseCityTimezone(enabled: boolean) {
    const next = updateNotificationPrefs({ useCityTimezone: enabled }, prayerStarts, cityTz);
    setPrefs(next);
  }

  function enableAllAdhan() {
    void (async () => {
      if (!native) await requestPermission();
      const all = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
      const next = updateNotificationPrefs({ adhan: all }, prayerStarts, cityTz);
      setPrefs(next);
    })();
  }

  const anyOn = Object.values(prefs.adhan).some(Boolean) || prefs.hadithDaily;

  return (
    <section className="card overflow-hidden border-teal-100 p-0 dark:border-teal-800/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-teal-50/50 dark:hover:bg-teal-950/20 sm:p-5"
      >
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-noor-700 text-lg text-white shadow-lg shadow-teal-900/15">
            🔔
            {anyOn && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gold-400 ring-2 ring-white dark:ring-noor-900" />}
          </span>
          <div>
            <h2 className="font-semibold text-heading">{t(lang, "notificationSettings")}</h2>
            <p className="text-xs text-muted sm:text-sm">{t(lang, "notificationSettingsHint")}</p>
          </div>
        </div>
        <span className="text-sm font-medium text-accent">{open ? t(lang, "close") : t(lang, "edit")}</span>
      </button>

      {open && (
        <div className="animate-fade-in-up space-y-5 border-t border-subtle px-4 pb-5 pt-4 sm:px-5">
          {native ? (
            <p className="rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-800 dark:bg-teal-900/30 dark:text-teal-200">
              {t(lang, "notificationsNativeHint")}
            </p>
          ) : perm !== "granted" ? (
            <button
              type="button"
              onClick={() => void requestPermission()}
              className="btn-primary w-full text-sm"
            >
              {t(lang, "allowNotifications")}
            </button>
          ) : null}

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-heading">{t(lang, "adhanNotifications")}</h3>
              <button
                type="button"
                onClick={enableAllAdhan}
                className="text-xs font-medium text-accent hover:underline"
              >
                {t(lang, "enableAllAdhan")}
              </button>
            </div>
            <div className="space-y-2">
              {PRAYERS.map((id, i) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-surface-muted/50 px-3 py-2.5 transition hover:border-teal-200 dark:hover:border-teal-700"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-heading">{t(lang, PRAYER_LABEL_KEYS[id])}</p>
                    <p className="font-mono text-xs text-accent">
                      {times?.prayers.find((p) => p.id === id)?.start ?? "—"}
                    </p>
                  </div>
                  <Toggle
                    on={prefs.adhan[id]}
                    onChange={(v) => setAdhan(id, v)}
                    label={t(lang, PRAYER_LABEL_KEYS[id])}
                  />
                </div>
              ))}
            </div>
            {cityTz && deviceTz && cityTz !== deviceTz && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-subtle bg-surface-muted/50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-heading">{t(lang, "adhanTimezone")}</p>
                  <p className="text-xs text-muted">
                    {t(lang, "adhanTimezoneHint")} · <span className="font-mono">{cityTz}</span>
                  </p>
                </div>
                <Toggle
                  on={prefs.useCityTimezone}
                  onChange={setUseCityTimezone}
                  label={t(lang, "adhanTimezone")}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gold-200/60 bg-gradient-to-br from-amber-50/80 to-teal-50/50 p-4 dark:border-gold-500/20 dark:from-amber-950/20 dark:to-teal-950/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-heading">{t(lang, "hadithNotification")}</h3>
                <p className="mt-0.5 text-xs text-muted">{t(lang, "hadithNotificationHint")}</p>
              </div>
              <Toggle
                on={prefs.hadithDaily}
                onChange={setHadithDaily}
                label={t(lang, "hadithNotification")}
              />
            </div>
            {prefs.hadithDaily && (
              <div className="mt-3 flex flex-wrap items-center gap-2 animate-fade-in">
                <label className="text-xs font-medium text-muted">{t(lang, "hadithNotifyTime")}</label>
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={prefs.hadithHour}
                  onChange={(e) => setHadithTime(Number(e.target.value), prefs.hadithMinute)}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:{String(prefs.hadithMinute).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
