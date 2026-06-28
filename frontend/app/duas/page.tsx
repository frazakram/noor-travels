"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
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

  useEffect(() => {
    api<{ duas: Dua[] }>("/api/duas/travel").then((d) => setDuas(d.duas));
  }, []);

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
      <h1 className="text-2xl font-bold text-noor-800">{t(lang, "duas")}</h1>

      <div className="space-y-4">
        {duas.map((d) => (
          <article key={d.id} className="card">
            <h2 className="font-semibold text-noor-800" dir={lang === "ur" ? "rtl" : "ltr"}>
              {title(d)}
            </h2>
            <p className="font-arabic mt-3 text-right text-xl" dir="rtl">{d.arabic}</p>
            <p className="mt-2 text-sm italic text-noor-500">{d.transliteration}</p>
            <p className="mt-3 text-sm leading-relaxed" dir={lang === "ur" ? "rtl" : "ltr"}>
              {translation(d)}
            </p>
            <p className="mt-2 text-xs text-gold-500">{d.source}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
