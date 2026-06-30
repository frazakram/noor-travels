"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  beginPlaybackSession,
  invalidatePlaybackSession,
  playAudioUrl,
  playSpokenText,
  stopAllPlayback,
  truncateForSpeech,
} from "@/lib/quran-audio";
import { speechLangForSource, type TafsirSource } from "@/lib/tafsir";
import type { TranslationLang } from "@/lib/quran-types";

const MAX_REPEAT = 5;

export type RepeatScope = "ayah" | "surah";

type Reciter = { id: string; name: string };

type AudioAyah = {
  ayah_number: number;
  verse_key: string;
  audio: string;
  translation_audio?: string | null;
};

type TextAyah = {
  ayah_number: number;
  verse_key: string;
  translation?: string;
  translation_en: string;
  translation_ur: string;
  translation_hi?: string;
};

type Options = {
  surahNumber: number;
  translation: TranslationLang;
  textAyahs: TextAyah[];
  reciter: string;
  includeTranslation: boolean;
  includeTafsir: boolean;
  tafsirSource: TafsirSource;
  repeatScope: RepeatScope;
  repeatCount: number;
  onPlayIndex?: (index: number) => void;
};

export function useSurahAudio({
  surahNumber,
  translation,
  textAyahs,
  reciter,
  includeTranslation,
  includeTafsir,
  tafsirSource,
  repeatScope,
  repeatCount,
  onPlayIndex,
}: Options) {
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [audioAyahs, setAudioAyahs] = useState<AudioAyah[]>([]);
  const [audioReady, setAudioReady] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [repeatPass, setRepeatPass] = useState(1);
  const [status, setStatus] = useState("");
  const stopRef = useRef(false);
  const sessionRef = useRef(0);
  const loadGenRef = useRef(0);

  useEffect(() => {
    api<{ reciters: Reciter[] }>("/api/quran/audio/editions")
      .then((d) => setReciters(d.reciters))
      .catch(() => {});
  }, []);

  const getTranslation = useCallback(
    (a: TextAyah) => {
      if (a.translation) return a.translation;
      if (translation === "ur") return a.translation_ur;
      if (translation === "hi") return a.translation_hi || a.translation_en;
      return a.translation_en;
    },
    [translation]
  );

  const ensureAudioLoaded = useCallback(async (): Promise<AudioAyah[]> => {
    if (audioReady && audioAyahs.length) return audioAyahs;

    const gen = ++loadGenRef.current;
    setAudioLoading(true);
    try {
      const trParam = includeTranslation ? `&translation_lang=${translation}` : "";
      const [editions, audio] = await Promise.all([
        api<{ reciters: Reciter[] }>("/api/quran/audio/editions"),
        api<{ ayahs: AudioAyah[] }>(
          `/api/quran/audio/surahs/${surahNumber}?reciter=${encodeURIComponent(reciter)}${trParam}`
        ),
      ]);
      if (gen !== loadGenRef.current) return [];
      setReciters(editions.reciters);
      setAudioAyahs(audio.ayahs);
      setAudioReady(true);
      return audio.ayahs;
    } finally {
      if (gen === loadGenRef.current) setAudioLoading(false);
    }
  }, [audioReady, audioAyahs, includeTranslation, translation, surahNumber, reciter]);

  // Invalidate cached audio when reciter or translation-audio settings change
  useEffect(() => {
    setAudioReady(false);
    setAudioAyahs([]);
  }, [surahNumber, reciter, translation, includeTranslation]);

  useEffect(() => {
    return () => {
      stopRef.current = true;
      invalidatePlaybackSession();
    };
  }, []);

  async function fetchTafsirText(verseKey: string): Promise<string> {
    try {
      const row = await api<{ text: string }>(
        `/api/quran/ayahs/${verseKey}/tafsir?source=${tafsirSource}`
      );
      return truncateForSpeech(row.text);
    } catch {
      return "";
    }
  }

  async function playSingleAyah(
    i: number,
    audioList: AudioAyah[],
    gen: number,
    passLabel?: string
  ) {
    const audio = audioList[i];
    const text = textAyahs[i];
    if (!audio?.audio || !text) return;

    setPlayIndex(i);
    onPlayIndex?.(i);

    const tafsirPromise =
      includeTafsir && !stopRef.current ? fetchTafsirText(text.verse_key) : null;

    const prefix = passLabel ? `${passLabel} · ` : "";
    setStatus(`${prefix}${text.verse_key}`);

    stopAllPlayback();
    try {
      await playAudioUrl(audio.audio, gen);
    } catch {
      /* skip */
    }
    if (stopRef.current || sessionRef.current !== gen) return;

    if (includeTranslation) {
      const tr = getTranslation(text);
      if (tr) {
        stopAllPlayback();
        await playSpokenText(tr, translation, audio.translation_audio, gen);
      }
    }
    if (stopRef.current || sessionRef.current !== gen) return;

    if (includeTafsir && tafsirPromise) {
      const tf = await tafsirPromise;
      if (stopRef.current || sessionRef.current !== gen) return;
      if (tf) {
        stopAllPlayback();
        await playSpokenText(tf, speechLangForSource(tafsirSource), null, gen);
      }
    }
  }

  const playFromIndex = useCallback(
    async (start: number) => {
      const audioList = await ensureAudioLoaded();
      if (!audioList.length) return;

      stopRef.current = false;
      const gen = beginPlaybackSession();
      sessionRef.current = gen;
      setPlaying(true);

      const surahPasses = repeatScope === "surah" ? Math.min(repeatCount, MAX_REPEAT) : 1;
      const ayahRepeats = repeatScope === "ayah" ? Math.min(repeatCount, MAX_REPEAT) : 1;
      let idx = start;

      for (let pass = 1; pass <= surahPasses; pass++) {
        if (stopRef.current || sessionRef.current !== gen) break;
        if (repeatScope === "surah" && surahPasses > 1) setRepeatPass(pass);

        for (let i = idx; i < audioList.length; i++) {
          if (stopRef.current || sessionRef.current !== gen) break;
          for (let r = 1; r <= ayahRepeats; r++) {
            if (stopRef.current || sessionRef.current !== gen) break;
            const label =
              repeatScope === "ayah" && ayahRepeats > 1
                ? `${r}/${ayahRepeats}`
                : repeatScope === "surah" && surahPasses > 1
                  ? `${pass}/${surahPasses}`
                  : undefined;
            await playSingleAyah(i, audioList, gen, label);
          }
        }
        idx = 0;
      }

      if (sessionRef.current === gen) {
        setPlaying(false);
        setRepeatPass(1);
        setStatus("");
      }
    },
    [
      ensureAudioLoaded,
      repeatScope,
      repeatCount,
      includeTafsir,
      includeTranslation,
      getTranslation,
      tafsirSource,
      textAyahs,
      onPlayIndex,
    ]
  );

  function pause() {
    stopRef.current = true;
    invalidatePlaybackSession();
    setPlaying(false);
    setRepeatPass(1);
    setStatus("");
  }

  function togglePlay(index: number) {
    if (playing) {
      pause();
    } else {
      playFromIndex(index);
    }
  }

  return {
    reciters,
    playing,
    playIndex,
    repeatPass,
    status,
    audioLoading,
    audioReady,
    pause,
    playFromIndex,
    togglePlay,
    setPlayIndex,
  };
}
