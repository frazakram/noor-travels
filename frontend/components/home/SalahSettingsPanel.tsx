"use client";

import { useEffect, useMemo, useState } from "react";
import { SavedToast } from "@/components/SavedToast";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import {
  DEFAULT_PRAYER_OFFSETS,
  HIGH_LATITUDE_METHODS,
  PRAYER_METHODS,
  formatPrayerClock,
  shiftTime,
  type LocationSearchResult,
  type PrayerId,
  type SalahSettings,
  type SalahTimesResponse,
} from "@/lib/salah";
import { t } from "@/lib/i18n";

type Props = {
  settings: SalahSettings;
  times: SalahTimesResponse | null;
  onSettings: (settings: SalahSettings) => void;
  onManualLocation: (lat: number, lng: number, label: string) => void;
  onUseGps: () => void;
};

const OFFSET_PRAYERS: { id: PrayerId; labelKey: "salahFajr" | "salahDhuhr" | "salahAsr" | "salahMaghrib" | "salahIsha" }[] = [
  { id: "fajr", labelKey: "salahFajr" },
  { id: "dhuhr", labelKey: "salahDhuhr" },
  { id: "asr", labelKey: "salahAsr" },
  { id: "maghrib", labelKey: "salahMaghrib" },
  { id: "isha", labelKey: "salahIsha" },
];

function sameSettings(a: SalahSettings, b: SalahSettings): boolean {
  if (a.method !== b.method || a.school !== b.school) return false;
  if ((a.latitudeAdjustment ?? 0) !== (b.latitudeAdjustment ?? 0)) return false;
  const ao = a.offsets ?? DEFAULT_PRAYER_OFFSETS;
  const bo = b.offsets ?? DEFAULT_PRAYER_OFFSETS;
  return OFFSET_PRAYERS.every(({ id }) => (ao[id] ?? 0) === (bo[id] ?? 0));
}

export function SalahSettingsPanel({ settings, times, onSettings, onManualLocation, onUseGps }: Props) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [draft, setDraft] = useState<SalahSettings>(settings);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!open) setDraft(settings);
  }, [settings, open]);

  const dirty = !sameSettings(draft, settings);
  const offsets = draft.offsets ?? DEFAULT_PRAYER_OFFSETS;
  const appliedOffsets = settings.offsets ?? DEFAULT_PRAYER_OFFSETS;

  const baseStarts = useMemo(() => {
    const map: Partial<Record<PrayerId, string>> = {};
    times?.prayers.forEach((p) => {
      // API times already include saved offsets — reverse to get calculated baseline.
      map[p.id] = shiftTime(p.start, -(appliedOffsets[p.id] ?? 0));
    });
    return map;
  }, [times, appliedOffsets]);

  function setOffset(id: PrayerId, value: number) {
    const next = Math.max(-60, Math.min(60, value));
    setDraft((prev) => ({
      ...prev,
      offsets: { ...(prev.offsets ?? DEFAULT_PRAYER_OFFSETS), [id]: next },
    }));
  }

  function nudge(id: PrayerId, delta: number) {
    setOffset(id, (offsets[id] ?? 0) + delta);
  }

  function resetOffsets() {
    setDraft((prev) => ({ ...prev, offsets: { ...DEFAULT_PRAYER_OFFSETS } }));
  }

  function save() {
    onSettings(draft);
    setShowSaved(true);
  }

  async function searchCity(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    const data = await api<{ results: LocationSearchResult[] }>(`/api/salah/geocode?q=${encodeURIComponent(query)}`);
    setResults(data.results);
  }

  return (
    <section className="card p-4 sm:p-5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-noor-700 to-teal-600 text-lg text-white shadow-lg shadow-teal-900/15">
            🕌
          </span>
          <div>
            <h2 className="font-semibold text-heading">{t(lang, "prayerSettings")}</h2>
            <p className="text-xs text-muted sm:text-sm">{t(lang, "prayerSettingsHint")}</p>
          </div>
        </div>
        <span className="text-sm font-medium text-accent">{open ? t(lang, "close") : t(lang, "edit")}</span>
      </button>

      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form onSubmit={searchCity} className="space-y-2">
            <label className="text-xs font-medium text-muted">{t(lang, "cityOverride")}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="input min-w-0" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(lang, "searchCityPlaceholder")} />
              <button className="btn-primary min-h-11 shrink-0 px-4 sm:min-h-0" type="submit">{t(lang, "findCity")}</button>
            </div>
            <button type="button" onClick={onUseGps} className="text-xs text-accent hover:underline">{t(lang, "useGpsAgain")}</button>
            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((r) => (
                  <button
                    key={`${r.latitude}-${r.longitude}`}
                    type="button"
                    onClick={() => {
                      onManualLocation(r.latitude, r.longitude, r.label);
                      setResults([]);
                      setQuery(r.label);
                      setShowSaved(true);
                    }}
                    className="w-full rounded-xl border border-subtle p-3 text-left text-sm text-body hover:border-noor-300"
                  >
                    {r.label}
                    <span className="mt-0.5 block text-xs text-faint">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </form>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted">{t(lang, "calcMethod")}</label>
            <select
              className="input"
              value={draft.method}
              onChange={(e) => setDraft({ ...draft, method: Number(e.target.value) })}
            >
              {PRAYER_METHODS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <label className="block text-xs font-medium text-muted">{t(lang, "asrMadhab")}</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, school: 0 })}
                className={`rounded-xl px-4 py-2 text-sm ${draft.school === 0 ? "bg-noor-700 text-white" : "border border-subtle text-body"}`}
              >
                Shafi / Maliki / Hanbali
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, school: 1 })}
                className={`rounded-xl px-4 py-2 text-sm ${draft.school === 1 ? "bg-noor-700 text-white" : "border border-subtle text-body"}`}
              >
                Hanafi
              </button>
            </div>
            <label className="block text-xs font-medium text-muted">{t(lang, "highLatTitle")}</label>
            <p className="text-[11px] text-faint">{t(lang, "highLatHint")}</p>
            <select
              className="input"
              value={draft.latitudeAdjustment ?? 0}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  latitudeAdjustment: Number(e.target.value) as 0 | 1 | 2 | 3,
                })
              }
            >
              {HIGH_LATITUDE_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(lang, m.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 md:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <label className="block text-xs font-medium text-muted">{t(lang, "masjidAdjustTitle")}</label>
                <p className="mt-0.5 text-xs text-faint">{t(lang, "masjidAdjustHint")}</p>
              </div>
              <button
                type="button"
                onClick={resetOffsets}
                className="text-xs font-medium text-accent hover:underline"
              >
                {t(lang, "resetToCalculated")}
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {OFFSET_PRAYERS.map(({ id, labelKey }) => {
                const base = baseStarts[id];
                const preview = base ? shiftTime(base, offsets[id] ?? 0) : null;
                const offset = offsets[id] ?? 0;
                return (
                  <div
                    key={id}
                    className="rounded-2xl border border-subtle bg-surface-muted/40 p-3 dark:bg-noor-950/40"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-heading">{t(lang, labelKey)}</span>
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                        offset === 0
                          ? "bg-noor-100 text-noor-700 dark:bg-noor-800 dark:text-noor-200"
                          : "bg-gold-100 text-noor-800 dark:bg-gold-500/20 dark:text-gold-200"
                      }`}>
                        {offset > 0 ? `+${offset}` : offset}m
                      </span>
                    </div>

                    <div className="mb-3 space-y-1.5 text-xs" dir="ltr">
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 dark:bg-noor-900/70">
                        <span className="text-faint">{t(lang, "calculatedTime")}</span>
                        <span className="font-mono font-semibold text-muted">
                          {base ? formatPrayerClock(base) : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-teal-200/70 bg-teal-50/80 px-2.5 py-1.5 dark:border-teal-700/50 dark:bg-teal-900/30">
                        <span className="font-medium text-teal-800 dark:text-teal-200">{t(lang, "masjidTime")}</span>
                        <span className="font-mono text-sm font-bold text-teal-900 dark:text-gold-300">
                          {preview ? formatPrayerClock(preview) : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1" dir="ltr">
                      <button
                        type="button"
                        onClick={() => nudge(id, -5)}
                        className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-subtle px-1.5 text-[11px] font-semibold text-body active:scale-95"
                        aria-label={`${t(lang, labelKey)} -5 min`}
                      >
                        −5
                      </button>
                      <button
                        type="button"
                        onClick={() => nudge(id, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-subtle text-sm font-bold text-body active:scale-95"
                        aria-label={`${t(lang, labelKey)} -1 min`}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => nudge(id, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-subtle text-sm font-bold text-body active:scale-95"
                        aria-label={`${t(lang, labelKey)} +1 min`}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => nudge(id, 5)}
                        className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-subtle px-1.5 text-[11px] font-semibold text-body active:scale-95"
                        aria-label={`${t(lang, labelKey)} +5 min`}
                      >
                        +5
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-subtle pt-3 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-xs ${dirty ? "font-medium text-gold-700 dark:text-gold-300" : "text-faint"}`}>
              {dirty ? t(lang, "unsavedPrayerChanges") : t(lang, "prayerSettingsUpToDate")}
            </p>
            <div className="flex gap-2">
              {dirty && (
                <button
                  type="button"
                  onClick={() => setDraft(settings)}
                  className="rounded-xl border border-subtle px-4 py-2.5 text-sm font-medium text-body"
                >
                  {t(lang, "discardChanges")}
                </button>
              )}
              <button
                type="button"
                onClick={save}
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
