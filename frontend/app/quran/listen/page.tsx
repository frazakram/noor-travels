"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

type Surah = {
  number: number;
  name_en: string;
  name_ar: string;
  ayah_count: number;
};

export default function ListenQuranPage() {
  const { lang } = useLang();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<{ surahs: Surah[] }>("/api/quran/surahs").then((d) => setSurahs(d.surahs));
  }, []);

  const filtered = surahs.filter(
    (s) =>
      !query ||
      s.name_en.toLowerCase().includes(query.toLowerCase()) ||
      String(s.number) === query.trim()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-noor-800">{t(lang, "audiobook")}</h1>
        <p className="mt-1 text-sm text-noor-600">{t(lang, "audiobookDesc")}</p>
      </div>

      <input
        className="input"
        placeholder={t(lang, "searchSurah")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <Link
            key={s.number}
            href={`/quran/listen/${s.number}`}
            className="card flex items-center justify-between transition hover:border-noor-300"
          >
            <div>
              <p className="font-medium text-noor-800">
                {s.number}. {s.name_en}
              </p>
              <p className="text-xs text-noor-500">
                {s.ayah_count} {t(lang, "ayahs")}
              </p>
            </div>
            <p className="font-arabic text-noor-700" dir="rtl">
              {s.name_ar}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
