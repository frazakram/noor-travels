"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { apiStatic } from "@/lib/api";
import { t } from "@/lib/i18n";

type Dua = {
  id: string;
  title_en: string;
  title_ur: string;
  title_hi: string;
  arabic: string;
  transliteration: string;
  translation_en: string;
  translation_ur: string;
  translation_hi: string;
  source: string;
};

export default function DuasPage() {
  const { lang } = useLang();
  const [duas, setDuas] = useState<Dua[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");

  const load = () => {
    setStatus("loading");
    apiStatic<{ duas: Dua[] }>("/api/duas/travel")
      .then((d) => {
        setDuas(d.duas);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(load, []);

  function title(d: Dua) {
    if (lang === "ur") return d.title_ur;
    if (lang === "hi") return d.title_hi;
    return d.title_en;
  }

  function translation(d: Dua) {
    if (lang === "ur") return d.translation_ur;
    if (lang === "hi") return d.translation_hi;
    return d.translation_en;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "duas")}</h1>
        <Link href="/library?category=dua" className="text-xs text-accent hover:underline">
          {t(lang, "duaLibraryCrossLink")} →
        </Link>
      </div>

      {status === "loading" && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="h-4 w-1/3 rounded bg-surface-muted" />
              <div className="h-6 w-full rounded bg-surface-muted" />
              <div className="h-4 w-2/3 rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="card text-center">
          <p className="text-sm text-muted">{t(lang, "learnQuranLoadError")}</p>
          <button type="button" onClick={load} className="btn-primary mt-3 text-sm">
            {t(lang, "learnQuranRetry")}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {duas.map((d) => (
          <article key={d.id} className="card">
            <h2 className="font-semibold text-heading" dir={lang === "ur" ? "rtl" : "ltr"}>
              {title(d)}
            </h2>
            <p className="font-arabic mt-3 text-right text-xl" dir="rtl">{d.arabic}</p>
            <p className="mt-2 text-sm italic text-faint">{d.transliteration}</p>
            <p className="mt-3 text-sm leading-relaxed text-body" dir={lang === "ur" ? "rtl" : "ltr"}>
              {translation(d)}
            </p>
            <p className="mt-2 text-xs text-accent">{d.source}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
