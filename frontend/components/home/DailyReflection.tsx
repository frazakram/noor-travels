"use client";

import { useEffect, useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { useCardSheen } from "@/hooks/useCardSheen";
import { api } from "@/lib/api";
import { cleanQuranText } from "@/lib/quran-display";
import { t, type Lang } from "@/lib/i18n";

type Ayah = {
  verse_key: string;
  name_en?: string;
  arabic: string;
  transliteration?: string;
  translation_en: string;
  translation_ur: string;
  translation_hi?: string;
};

type Surah = {
  number: number;
  name_en: string;
  ayah_count: number;
};

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

export function DailyReflection({ lang }: { lang: Lang }) {
  const [ayah, setAyah] = useState<Ayah | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const sheen = useCardSheen();

  useEffect(() => {
    async function load() {
      const data = await api<{ surahs: Surah[] }>("/api/quran/surahs");
      const total = data.surahs.reduce((sum, s) => sum + s.ayah_count, 0);
      let index = dayOfYear() % total;
      for (const surah of data.surahs) {
        if (index < surah.ayah_count) {
          const row = await api<Ayah>(`/api/quran/ayahs/${surah.number}:${index + 1}`);
          setAyah({ ...row, name_en: surah.name_en });
          return;
        }
        index -= surah.ayah_count;
      }
    }
    void load().catch(() => setAyah(null));
  }, []);

  const ayahTranslation = ayah
    ? cleanQuranText(lang === "ur" ? ayah.translation_ur : lang === "hi" ? ayah.translation_hi || ayah.translation_en : ayah.translation_en)
    : "";

  return (
    <section>
      <article
        className="card-touch relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-4 dark:border-teal-800 dark:from-teal-900/20 dark:to-emerald-900/20 sm:p-5"
        onPointerDown={sheen.trigger}
      >
        {sheen.active && <span key={sheen.pulseId} className="card-sheen-pulse" aria-hidden />}
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">{t(lang, "ayahOfTheDay")}</p>
          {ayah && (
            <ShareButton
              lang={lang}
              getPayload={() => ({
                title: `${ayah.name_en ?? "Quran"} ${ayah.verse_key}`,
                text: `${ayah.arabic}\n\n${ayahTranslation}\n\n— ${ayah.name_en ?? "Quran"} ${ayah.verse_key}\n${typeof window !== "undefined" ? window.location.origin + "/quran/" + ayah.verse_key.split(":")[0] + "?ayah=" + ayah.verse_key.split(":")[1] : ""}`,
              })}
              tipSide="top"
            />
          )}
        </div>
        {ayah ? (
          <>
            <p className="font-arabic mb-3 text-right text-xl leading-loose text-slate-800 dark:text-white sm:text-2xl" dir="rtl">{ayah.arabic}</p>
            {showTranslation && (
              <div className="animate-fade-in">
                {ayah.transliteration && <p className="mb-1 text-sm italic text-slate-600 dark:text-slate-300">{ayah.transliteration}</p>}
                <p className="text-sm text-slate-700 dark:text-slate-200" dir={lang === "ur" ? "rtl" : "ltr"}>{ayahTranslation}</p>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-teal-600">{ayah.name_en ?? "Quran"} · {ayah.verse_key}</p>
              <button
                type="button"
                onClick={() => setShowTranslation((v) => !v)}
                className="text-xs font-medium text-accent hover:underline"
              >
                {t(lang, showTranslation ? "hideTranslation" : "showTranslation")}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">{t(lang, "loadingAyah")}</p>
        )}
      </article>
    </section>
  );
}
