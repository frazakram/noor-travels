"use client";

import { useState } from "react";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

type Hadith = {
  id: number;
  chapter_en: string;
  hadith_number: number;
  arabic: string;
  english: string;
  reference: string;
};

export default function HadithPage() {
  const { lang } = useLang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hadith[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.length < 2) return;
    setLoading(true);
    const d = await api<{ results: Hadith[] }>(`/api/hadith/search?q=${encodeURIComponent(query)}`);
    setResults(d.results);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-noor-800">{t(lang, "hadith")}</h1>
      <p className="text-sm text-noor-600">Sahih al-Bukhari — 7,277 hadiths</p>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          className="input"
          placeholder={t(lang, "search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={loading}>
          {loading ? "…" : t(lang, "search")}
        </button>
      </form>

      {results.length === 0 && query && !loading && (
        <p className="text-noor-500">{t(lang, "noResults")}</p>
      )}

      <div className="space-y-4">
        {results.map((h) => (
          <article key={h.id} className="card">
            <p className="text-xs text-gold-500">{h.reference} · {h.chapter_en}</p>
            <p className="font-arabic mt-2 text-right" dir="rtl">{h.arabic}</p>
            <p className="mt-3 text-sm leading-relaxed text-noor-800">{h.english}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
