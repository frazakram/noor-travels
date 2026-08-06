"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { useCardSheen } from "@/hooks/useCardSheen";
import {
  getTodayEntry,
  loadJournal,
  saveTodayEntry,
  type JournalStore,
} from "@/lib/gratitude-journal";
import { getTimePhase, type SalahTimesResponse } from "@/lib/salah";
import { t } from "@/lib/i18n";

type Props = {
  times: SalahTimesResponse | null;
};

export function GratitudeJournal({ times }: Props) {
  const { lang } = useLang();
  const tz = times?.timezone ?? "UTC";
  const [store, setStore] = useState<JournalStore>({ entries: {}, streak: 0 });
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const sheen = useCardSheen();

  useEffect(() => {
    const s = loadJournal();
    setStore(s);
    setText(getTodayEntry(tz)?.text ?? "");
  }, [tz]);

  const phase = times ? getTimePhase(times.prayers, tz) : "night";
  const anchor = phase === "fajr" || phase === "morning" ? "fajr" : phase === "isha" || phase === "night" ? "isha" : "other";

  function handleSave() {
    const next = saveTodayEntry(text, tz, anchor);
    setStore(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <section
      className="card-touch relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-4 dark:border-emerald-500/25 dark:from-emerald-950/25 dark:to-teal-950/15 sm:p-5"
      onPointerDown={sheen.trigger}
    >
      {sheen.active && <span key={sheen.pulseId} className="card-sheen-pulse" aria-hidden />}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
            {t(lang, "gratitudeTitle")}
          </p>
          <p className="mt-1 text-sm text-muted">{t(lang, "gratitudeHint")}</p>
        </div>
        {store.streak > 0 && (
          <span className="rounded-full bg-emerald-600/15 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            🔥 {store.streak}
          </span>
        )}
      </div>
      <textarea
        className="input mt-3 min-h-[88px] resize-y text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t(lang, "gratitudePlaceholder")}
        maxLength={800}
        aria-label={t(lang, "gratitudeTitle")}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-faint">
          {anchor === "fajr"
            ? t(lang, "gratitudeFajr")
            : anchor === "isha"
              ? t(lang, "gratitudeIsha")
              : t(lang, "gratitudeAnytime")}
        </p>
        <button type="button" onClick={handleSave} className="btn-primary px-3 py-1.5 text-xs">
          {saved ? t(lang, "gratitudeSaved") : t(lang, "gratitudeSave")}
        </button>
      </div>
    </section>
  );
}
