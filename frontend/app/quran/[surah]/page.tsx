"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

export type TranslationLang = "en" | "ur" | "hi";

type Ayah = {
  ayah_number: number;
  verse_key: string;
  arabic: string;
  transliteration: string;
  transliteration_hi?: string;
  translation_en: string;
  translation_ur: string;
  translation_hi?: string;
  translation?: string;
};

type TafsirRow = { verse_key: string; source: string; text: string };

export default function SurahPage() {
  const params = useParams();
  const surahNumber = Number(params.surah);
  const { lang } = useLang();
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [surahName, setSurahName] = useState("");
  const [translation, setTranslation] = useState<TranslationLang>("en");
  const [showRoman, setShowRoman] = useState(true);
  const [showHiRoman, setShowHiRoman] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, { ibn_kathir_en?: string; maududi_ur?: string }>>({});
  const [loadingTafsir, setLoadingTafsir] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("noor-quran-translation") as TranslationLang | null;
    if (saved && ["en", "ur", "hi"].includes(saved)) setTranslation(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("noor-quran-translation", translation);
    api<{ surah: { name_en: string }; ayahs: Ayah[] }>(
      `/api/quran/surahs/${surahNumber}?translation=${translation}`
    ).then((d) => {
      setSurahName(d.surah.name_en);
      setAyahs(d.ayahs);
    });
  }, [surahNumber, translation]);

  async function toggleTafsir(verseKey: string) {
    if (expanded[verseKey]) {
      setExpanded((e) => {
        const n = { ...e };
        delete n[verseKey];
        return n;
      });
      return;
    }
    setLoadingTafsir(verseKey);
    try {
      const [en, ur] = await Promise.all([
        api<TafsirRow>(`/api/quran/ayahs/${verseKey}/tafsir?source=ibn_kathir_en`).catch(() => null),
        api<TafsirRow>(`/api/quran/ayahs/${verseKey}/tafsir?source=maududi_ur`).catch(() => null),
      ]);
      setExpanded((e) => ({
        ...e,
        [verseKey]: {
          ibn_kathir_en: en?.text,
          maududi_ur: ur?.text,
        },
      }));
    } finally {
      setLoadingTafsir(null);
    }
  }

  function displayTranslation(a: Ayah): string {
    if (a.translation) return a.translation;
    if (translation === "ur") return a.translation_ur;
    if (translation === "hi") return a.translation_hi || "";
    return a.translation_en;
  }

  return (
    <div className="space-y-4">
      <Link
        href="/quran"
        className="inline-flex items-center gap-1 text-sm font-medium text-noor-600 hover:text-noor-800"
      >
        ← {t(lang, "backToQuran")}
      </Link>

      <div className="card sticky top-[6.75rem] z-10 space-y-3 bg-white/95 py-3 backdrop-blur md:top-16">
        <h1 className="text-xl font-bold text-noor-800">
          {surahNumber}. {surahName}
        </h1>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={`/quran/listen/${surahNumber}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gold-300 bg-gold-50 px-3 py-1.5 text-sm font-medium text-noor-800 hover:bg-gold-100"
          >
            <span aria-hidden className="text-base leading-none">
              ▶
            </span>
            {t(lang, "audiobook")}
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-xs text-noor-500">{t(lang, "translation")}:</span>
            {(["en", "ur", "hi"] as TranslationLang[]).map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => setTranslation(tr)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium uppercase ${
                  translation === tr ? "bg-noor-700 text-white" : "border border-noor-200 text-noor-600"
                }`}
              >
                {tr === "en" ? t(lang, "english") : tr === "ur" ? t(lang, "urdu") : t(lang, "hindi")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-noor-600">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showRoman} onChange={(e) => setShowRoman(e.target.checked)} />
          {t(lang, "arabicRoman")}
        </label>
        {translation === "hi" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showHiRoman} onChange={(e) => setShowHiRoman(e.target.checked)} />
            {t(lang, "hindiRoman")}
          </label>
        )}
      </div>

      <div className="space-y-4">
        {ayahs.map((a) => (
          <article key={a.verse_key} className="card">
            <p className="text-xs font-medium text-gold-500">{a.verse_key}</p>
            <p className="font-arabic mt-2 text-right text-xl" dir="rtl">{a.arabic}</p>
            {showRoman && a.transliteration && (
              <p className="mt-2 text-sm italic text-noor-500" dir="ltr">{a.transliteration}</p>
            )}
            <p
              className="mt-3 text-sm leading-relaxed text-noor-800"
              dir={translation === "ur" ? "rtl" : "ltr"}
            >
              {displayTranslation(a)}
            </p>
            {translation === "hi" && showHiRoman && a.transliteration_hi && (
              <p className="mt-2 text-xs italic text-noor-500" dir="ltr">
                {t(lang, "hindiRoman")}: {a.transliteration_hi}
              </p>
            )}

            <button
              type="button"
              onClick={() => toggleTafsir(a.verse_key)}
              className="mt-3 text-xs font-medium text-noor-700 underline hover:text-noor-900"
            >
              {loadingTafsir === a.verse_key
                ? t(lang, "loading")
                : expanded[a.verse_key]
                  ? t(lang, "hideTafsir")
                  : t(lang, "showTafsir")}
            </button>

            {expanded[a.verse_key] && (
              <div className="mt-3 space-y-3 border-t border-noor-100 pt-3">
                {expanded[a.verse_key].ibn_kathir_en && (
                  <div>
                    <p className="text-xs font-semibold text-gold-600">{t(lang, "tafsirIbnKathir")}</p>
                    <p className="mt-1 text-sm leading-relaxed text-noor-700" dir="ltr">
                      {expanded[a.verse_key].ibn_kathir_en}
                    </p>
                  </div>
                )}
                {expanded[a.verse_key].maududi_ur && (
                  <div>
                    <p className="text-xs font-semibold text-gold-600">{t(lang, "tafsirMaududi")}</p>
                    <p className="mt-1 text-sm leading-relaxed text-noor-700" dir="rtl">
                      {expanded[a.verse_key].maududi_ur}
                    </p>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
