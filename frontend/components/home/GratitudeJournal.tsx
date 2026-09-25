"use client";

import { Icon } from "@/components/Icon";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
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
    <section className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-heading">
            {t(lang, "gratitudeTitle")}
          </p>
          <p className="mt-1 text-sm text-muted">{t(lang, "gratitudeHint")}</p>
        </div>
        {store.streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-noor-50 px-2.5 py-1 text-xs font-semibold text-noor-800 dark:bg-noor-800 dark:text-gold-200">
            <Icon name="flame" className="h-3.5 w-3.5 text-gold-500" /> {store.streak}
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
