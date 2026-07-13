"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { SavedToast } from "@/components/SavedToast";
import { isNativeApp } from "@/lib/native-bridge";
import { t } from "@/lib/i18n";
import {
  applyAllNotificationSchedules,
  ensureNotificationPermission,
  updateNotificationPrefs,
} from "@/lib/notification-schedule";
import { DEFAULT_NOTIFICATION_PREFS, loadNotificationPrefs, type NotificationPrefs } from "@/lib/notification-prefs";
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
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [draft, setDraft] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [hydrated, setHydrated] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [showSaved, setShowSaved] = useState(false);
  const native = isNativeApp();

  useEffect(() => {
    const loaded = loadNotificationPrefs();
    setPrefs(loaded);
    setDraft(loaded);
    setHydrated(true);
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

  const dirty = hydrated && JSON.stringify(draft) !== JSON.stringify(prefs);

  function saveNotifications() {
    void (async () => {
      const needsPerm =
        !native &&
        (Object.values(draft.adhan).some(Boolean) ||
          draft.hadithDaily ||
          draft.learnQuranDaily ||
          draft.gratitudeDaily);
      if (needsPerm) await requestPermission();
      const next = updateNotificationPrefs(draft, prayerStarts, cityTz);
      setPrefs(next);
      setDraft(next);
      setShowSaved(true);
    })();
  }

  function setAdhan(prayer: PrayerId, enabled: boolean) {
    setDraft((prev) => ({ ...prev, adhan: { ...prev.adhan, [prayer]: enabled } }));
  }

  function setHadithDaily(enabled: boolean) {
    setDraft((prev) => ({ ...prev, hadithDaily: enabled }));
  }

  function setHadithTime(hour: number, minute: number) {
    setDraft((prev) => ({ ...prev, hadithHour: hour, hadithMinute: minute }));
  }

  function setLearnDaily(enabled: boolean) {
    setDraft((prev) => ({ ...prev, learnQuranDaily: enabled }));
  }

  function setLearnTime(hour: number, minute: number) {
    setDraft((prev) => ({ ...prev, learnHour: hour, learnMinute: minute }));
  }

  function setGratitudeDaily(enabled: boolean) {
    setDraft((prev) => ({ ...prev, gratitudeDaily: enabled }));
  }

  function setGratitudeTime(hour: number, minute: number) {
    setDraft((prev) => ({ ...prev, gratitudeHour: hour, gratitudeMinute: minute }));
  }

  function setUseCityTimezone(enabled: boolean) {
    setDraft((prev) => ({ ...prev, useCityTimezone: enabled }));
  }

  function enableAllAdhan() {
    setDraft((prev) => ({
      ...prev,
      adhan: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
    }));
  }

  const anyOn =
    Object.values(prefs.adhan).some(Boolean) ||
    prefs.hadithDaily ||
    prefs.learnQuranDaily ||
    prefs.gratitudeDaily;

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
            {hydrated && anyOn && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gold-400 ring-2 ring-white dark:ring-noor-900" />}
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
                    on={draft.adhan[id]}
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
                  on={draft.useCityTimezone}
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
                on={draft.hadithDaily}
                onChange={setHadithDaily}
                label={t(lang, "hadithNotification")}
              />
            </div>
            {draft.hadithDaily && (
              <div className="mt-3 flex flex-wrap items-center gap-2 animate-fade-in">
                <label className="text-xs font-medium text-muted">{t(lang, "hadithNotifyTime")}</label>
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={draft.hadithHour}
                  onChange={(e) => setHadithTime(Number(e.target.value), draft.hadithMinute)}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:{String(draft.hadithMinute).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-subtle bg-surface-muted/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-heading">{t(lang, "learnNotify")}</h3>
                <p className="mt-0.5 text-xs text-muted">{t(lang, "learnNotifyHint")}</p>
              </div>
              <Toggle on={draft.learnQuranDaily} onChange={setLearnDaily} label={t(lang, "learnNotify")} />
            </div>
            {draft.learnQuranDaily && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={draft.learnHour}
                  onChange={(e) => setLearnTime(Number(e.target.value), draft.learnMinute)}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:{String(draft.learnMinute).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-subtle bg-surface-muted/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-heading">{t(lang, "gratitudeNotify")}</h3>
                <p className="mt-0.5 text-xs text-muted">{t(lang, "gratitudeNotifyHint")}</p>
              </div>
              <Toggle
                on={draft.gratitudeDaily}
                onChange={setGratitudeDaily}
                label={t(lang, "gratitudeNotify")}
              />
            </div>
            {draft.gratitudeDaily && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={draft.gratitudeHour}
                  onChange={(e) => setGratitudeTime(Number(e.target.value), draft.gratitudeMinute)}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:{String(draft.gratitudeMinute).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-subtle pt-3">
            <p className={`text-xs ${dirty ? "font-medium text-gold-700 dark:text-gold-300" : "text-faint"}`}>
              {dirty ? t(lang, "unsavedPrayerChanges") : t(lang, "prayerSettingsUpToDate")}
            </p>
            <div className="flex gap-2">
              {dirty && (
                <button
                  type="button"
                  onClick={() => setDraft(prefs)}
                  className="rounded-xl border border-subtle px-4 py-2.5 text-sm font-medium text-body"
                >
                  {t(lang, "discardChanges")}
                </button>
              )}
              <button
                type="button"
                onClick={saveNotifications}
                disabled={!dirty}
                className="btn-primary min-h-11 px-5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t(lang, "savePrayerSettings")}
              </button>
            </div>
          </div>
        </div>
      )}

      <SavedToast
        open={showSaved}
        label={t(lang, "prayerSettingsSaved")}
        onDone={() => setShowSaved(false)}
      />
    </section>
  );
}
