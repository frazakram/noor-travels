"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

type Surah = {
  number: number;
  name_ar: string;
  name_en: string;
  name_en_translation: string;
  revelation_type: string;
  ayah_count: number;
};

export default function QuranPage() {
  const { lang } = useLang();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ surahs: Surah[] }>("/api/quran/surahs").then((d) => {
      setSurahs(d.surahs);
      setLoading(false);
    });
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.length < 2) return;
    const d = await api<{ results: unknown[] }>(`/api/quran/search?q=${encodeURIComponent(query)}`);
    setResults(d.results);
  }

  if (loading) return <p className="text-noor-600">{t(lang, "loading")}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-noor-800">{t(lang, "quran")}</h1>

      <Link
        href="/quran/listen"
        className="card flex items-center justify-between border-gold-200 bg-gold-50/50 transition hover:border-gold-300"
      >
        <div>
          <p className="font-semibold text-noor-800">{t(lang, "listenQuran")}</p>
          <p className="text-sm text-noor-600">{t(lang, "audiobookDesc")}</p>
        </div>
        <span className="rounded-full bg-noor-700 px-3 py-1 text-xs font-medium text-white">
          ▶
        </span>
      </Link>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          className="input"
          placeholder={t(lang, "search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0">{t(lang, "search")}</button>
      </form>

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r: any) => (
            <Link key={r.verse_key} href={`/quran/${r.surah_number}`} className="card block hover:border-noor-300">
              <p className="text-xs text-gold-500">{r.verse_key}</p>
              <p className="font-arabic mt-1 text-right" dir="rtl">{r.arabic}</p>
              <p className="mt-2 text-sm text-noor-700">
                {lang === "ur" ? r.translation_ur : r.translation_en}
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {surahs.map((s) => (
          <Link
            key={s.number}
            href={`/quran/${s.number}`}
            className="card flex items-center justify-between transition hover:border-noor-300"
          >
            <div>
              <p className="font-medium text-noor-800">{s.number}. {s.name_en}</p>
              <p className="text-xs text-noor-500">{s.name_en_translation} · {s.ayah_count} {t(lang, "ayahs")}</p>
            </div>
            <p className="font-arabic text-noor-700" dir="rtl">{s.name_ar}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
