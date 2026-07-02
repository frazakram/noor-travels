"use client";

import { useState } from "react";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { PRAYER_METHODS, type LocationSearchResult, type SalahSettings } from "@/lib/salah";
import { t } from "@/lib/i18n";

type Props = {
  settings: SalahSettings;
  onSettings: (settings: SalahSettings) => void;
  onManualLocation: (lat: number, lng: number, label: string) => void;
  onUseGps: () => void;
};

export function SalahSettingsPanel({ settings, onSettings, onManualLocation, onUseGps }: Props) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);

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
            <label className="text-xs font-medium text-muted">City / area override</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="input min-w-0" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search city or local area" />
              <button className="btn-primary min-h-11 shrink-0 px-4 sm:min-h-0" type="submit">Find</button>
            </div>
            <button type="button" onClick={onUseGps} className="text-xs text-accent hover:underline">Use precise GPS again</button>
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
            <label className="block text-xs font-medium text-muted">Calculation method</label>
            <select
              className="input"
              value={settings.method}
              onChange={(e) => onSettings({ ...settings, method: Number(e.target.value) })}
            >
              {PRAYER_METHODS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <label className="block text-xs font-medium text-muted">Asr madhab</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSettings({ ...settings, school: 0 })}
                className={`rounded-xl px-4 py-2 text-sm ${settings.school === 0 ? "bg-noor-700 text-white" : "border border-subtle text-body"}`}
              >
                Shafi / Maliki / Hanbali
              </button>
              <button
                type="button"
                onClick={() => onSettings({ ...settings, school: 1 })}
                className={`rounded-xl px-4 py-2 text-sm ${settings.school === 1 ? "bg-noor-700 text-white" : "border border-subtle text-body"}`}
              >
                Hanafi
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
