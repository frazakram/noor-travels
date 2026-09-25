"use client";

import { useEffect, useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { api } from "@/lib/api";
import { cleanQuranText } from "@/lib/quran-display";
import { FEATURED_VERSE_KEYS } from "@/lib/featured-verses";
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

function todayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Deterministic string hash (FNV-1a) — scatters the daily seed across the whole Quran instead
 * of walking one ayah per day, which (via `dayOfYear() % total` — a no-op since dayOfYear caps
 * at 366 and total is ~6236) used to stay inside Al-Baqarah for most of the year. */
function hashString(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function DailyReflection({ lang }: { lang: Lang }) {
  const [ayah, setAyah] = useState<Ayah | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    async function load() {
      const verseKey = FEATURED_VERSE_KEYS[hashString(todayDateKey()) % FEATURED_VERSE_KEYS.length];
      const row = await api<Ayah>(`/api/quran/ayahs/${verseKey}`);
      setAyah(row);
    }
    void load().catch(() => setFailed(true));
  }, []);

  const ayahTranslation = ayah
    ? cleanQuranText(lang === "ur" ? ayah.translation_ur : lang === "hi" ? ayah.translation_hi || ayah.translation_en : ayah.translation_en)
    : "";

  if (failed) return <p className="text-sm text-muted">{t(lang, "genericErrorTitle")}</p>;
  if (!ayah) return <p className="text-sm text-muted">{t(lang, "loadingAyah")}</p>;

  return (
    <div>
      <p className="font-arabic text-right text-xl leading-loose text-heading sm:text-2xl" dir="rtl">{ayah.arabic}</p>
      {showTranslation && (
        <div className="mt-2 animate-fade-in">
          {ayah.transliteration && <p className="mb-1 text-sm italic text-muted">{ayah.transliteration}</p>}
          <p className="text-sm leading-relaxed text-body" dir={lang === "ur" ? "rtl" : "ltr"}>{ayahTranslation}</p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{ayah.name_en ?? "Quran"} · {ayah.verse_key}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowTranslation((v) => !v)}
            className="text-xs font-medium text-accent hover:underline"
          >
            {t(lang, showTranslation ? "hideTranslation" : "showTranslation")}
          </button>
          <ShareButton
            lang={lang}
            getPayload={() => ({
              title: `${ayah.name_en ?? "Quran"} ${ayah.verse_key}`,
              text: `${ayah.arabic}\n\n${ayahTranslation}\n\n— ${ayah.name_en ?? "Quran"} ${ayah.verse_key}\n${typeof window !== "undefined" ? window.location.origin + "/quran/" + ayah.verse_key.split(":")[0] + "?ayah=" + ayah.verse_key.split(":")[1] : ""}`,
            })}
            tipSide="top"
          />
        </div>
      </div>
    </div>
  );
}
