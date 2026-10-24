"use client";

import { memo, useEffect, useState, useSyncExternalStore } from "react";
import { getWordHighlight, subscribeWordHighlight } from "@/lib/word-highlight";

export type AyahWord = {
  ar: string;
  tr: string;
  en: string;
};

type Props = {
  verseKey: string;
  words?: AyahWord[] | null;
  /** Fixed highlight (Bismillah). Ayah text uses followLiveHighlight instead. */
  activeWordIndex?: number;
  /** Read the recited word from lib/word-highlight while this ayah is playing. */
  followLiveHighlight?: boolean;
  fallbackArabic: string;
  isPlaying: boolean;
  align?: "right" | "center";
};

/** Renders Arabic words with hover meanings and active-word highlight during recitation. */
export const AyahWordText = memo(function AyahWordText({
  verseKey,
  words: wordsProp,
  activeWordIndex: fixedActiveWordIndex = -1,
  followLiveHighlight = false,
  fallbackArabic,
  isPlaying,
  align = "right",
}: Props) {
  const [words, setWords] = useState<AyahWord[] | null>(wordsProp ?? null);
  // Ayahs that aren't playing select a constant, so a word change never re-renders them.
  const liveWordIndex = useSyncExternalStore(
    subscribeWordHighlight,
    () => (followLiveHighlight && isPlaying ? getWordHighlight() : -1),
    () => -1,
  );
  const activeWordIndex = followLiveHighlight ? liveWordIndex : fixedActiveWordIndex;
  const [hovered, setHovered] = useState<number | null>(null);

  // The reader supplies the words once its single surah-wide request resolves; until then the
  // plain Arabic is shown. (A per-ayah fetch here used to request the whole surah once per ayah.)
  useEffect(() => {
    setWords(wordsProp ?? null);
  }, [wordsProp]);

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
});
