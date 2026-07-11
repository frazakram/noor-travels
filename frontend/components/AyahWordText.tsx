"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type AyahWord = {
  ar: string;
  tr: string;
  en: string;
};

type Props = {
  verseKey: string;
  words?: AyahWord[] | null;
  activeWordIndex: number;
  fallbackArabic: string;
  isPlaying: boolean;
  align?: "right" | "center";
};

/** Renders Arabic words with hover meanings and active-word highlight during recitation. */
export function AyahWordText({
  verseKey,
  words: wordsProp,
  activeWordIndex,
  fallbackArabic,
  isPlaying,
  align = "right",
}: Props) {
  const [words, setWords] = useState<AyahWord[] | null>(wordsProp ?? null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (wordsProp) {
      setWords(wordsProp);
      return;
    }
    let cancelled = false;
    // Lazy single-ayah fetch if parent map not ready yet
    api<{ ayahs: { verse_key: string; words: AyahWord[] }[] }>(
      `/api/quran/surahs/${verseKey.split(":")[0]}/words`
    )
      .then((d) => {
        if (cancelled) return;
        const row = d.ayahs?.find((a) => a.verse_key === verseKey);
        if (row) setWords(row.words);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [verseKey, wordsProp]);

  if (!words?.length) {
    return (
      <p
        className={`font-arabic ayah-words mt-2 text-xl ${
          align === "center" ? "text-center" : "text-right"
        }`}
        dir="rtl"
      >
        {fallbackArabic}
      </p>
    );
  }

  return (
    <p
      className={`font-arabic ayah-words mt-2 text-xl ${
        align === "center" ? "text-center" : "text-right"
      }`}
      dir="rtl"
    >
      {words.map((w, i) => {
        const active = isPlaying && activeWordIndex === i;
        const tip = w.en || w.tr;
        return (
          <span
            key={`${verseKey}-${i}`}
            className="relative inline-block align-baseline"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered((h) => (h === i ? null : h))}
            tabIndex={tip ? 0 : undefined}
          >
            <span
              className={`ayah-word ${
                active ? "ayah-word-active" : "hover:bg-noor-100/80 dark:hover:bg-noor-800/80"
              }`}
            >
              {w.ar}
            </span>
            {hovered === i && tip && (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max max-w-[14rem] -translate-x-1/2 rounded-md bg-noor-900 px-2 py-1 text-center text-xs font-sans font-medium normal-case not-italic leading-snug text-white shadow-lg dark:bg-noor-100 dark:text-noor-950"
                dir="ltr"
              >
                {tip}
              </span>
            )}
          </span>
        );
      })}
    </p>
  );
}
