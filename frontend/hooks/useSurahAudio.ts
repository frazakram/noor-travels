"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  acquireWakeLock,
  clearMediaSession,
  releaseWakeLock,
  setupMediaSession,
  updateMediaSession,
} from "@/lib/media-session";
import {
  isNativeApp,
  nativePlayQuranQueue,
  nativeSetQuranPlaying,
  nativeStopQuranPlayback,
  nativeUpdateQuranNotification,
  type NativeQueueItem,
} from "@/lib/native-bridge";
import {
  beginPlaybackSession,
  invalidatePlaybackSession,
  playAudioUrl,
  playSpokenText,
  primeAudioPlayback,
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
  surahName?: string;
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
  surahName,
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
  const nativeModeRef = useRef(false);
  const playingRef = useRef(false);
  const playIndexRef = useRef(0);
  const includeTafsirRef = useRef(includeTafsir);
  const includeTranslationRef = useRef(includeTranslation);
  const tafsirSourceRef = useRef(tafsirSource);
  const textAyahsRef = useRef(textAyahs);
  const onPlayIndexRef = useRef(onPlayIndex);
  includeTafsirRef.current = includeTafsir;
  includeTranslationRef.current = includeTranslation;
  tafsirSourceRef.current = tafsirSource;
  onPlayIndexRef.current = onPlayIndex;
  textAyahsRef.current = textAyahs;
  playingRef.current = playing;

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

  useEffect(() => {
    setAudioReady(false);
    setAudioAyahs([]);
  }, [surahNumber, reciter, translation, includeTranslation]);

  // Prefetch the audio list so the first tap on play starts immediately.
  useEffect(() => {
    if (audioReady) return;
    const id = window.setTimeout(() => {
      void ensureAudioLoaded().catch(() => {});
    }, 400);
    return () => window.clearTimeout(id);
  }, [audioReady, ensureAudioLoaded]);

  const pause = useCallback(() => {
    const wasActive = playingRef.current || nativeModeRef.current;
    stopRef.current = true;
    nativeModeRef.current = false;
    playingRef.current = false;
    invalidatePlaybackSession();
    if (wasActive) {
      nativeStopQuranPlayback();
      nativeSetQuranPlaying(false);
    }
    void releaseWakeLock();
    clearMediaSession();
    setPlaying(false);
    setRepeatPass(1);
    setStatus("");
  }, []);

  const releaseNativePlayback = useCallback(() => {
    if (!playingRef.current && !nativeModeRef.current) return;
    nativeStopQuranPlayback();
    nativeSetQuranPlaying(false);
    void releaseWakeLock();
    clearMediaSession();
  }, []);

  useEffect(() => {
    setupMediaSession({
      onPause: () => pause(),
      onStop: () => pause(),
    });

    if (isNativeApp()) {
      (window as unknown as { noorOnAyahIndex?: (i: number) => void }).noorOnAyahIndex = (i: number) => {
        if (!nativeModeRef.current) return;
        setPlayIndex(i);
        onPlayIndexRef.current?.(i);
        const vk = textAyahsRef.current[i]?.verse_key ?? "";
        setStatus(vk);
        updateMediaSession({
          title: vk || `Ayah ${i + 1}`,
          artist: surahName ?? `Surah ${surahNumber}`,
          playing: true,
        });
      };
      (window as unknown as { noorOnPlaybackEnded?: () => void }).noorOnPlaybackEnded = () => {
        if (!nativeModeRef.current) return;
        pause();
      };
    }

    return () => {
      stopRef.current = true;
      invalidatePlaybackSession();
      releaseNativePlayback();
      delete (window as unknown as { noorOnAyahIndex?: unknown }).noorOnAyahIndex;
      delete (window as unknown as { noorOnPlaybackEnded?: unknown }).noorOnPlaybackEnded;
    };
  }, [pause, releaseNativePlayback, surahName, surahNumber]);

  const updateNowPlaying = useCallback(
    (title: string) => {
      const artist = surahName ?? `Surah ${surahNumber}`;
      updateMediaSession({ title, artist, playing: true });
      if (isNativeApp() && !nativeModeRef.current) {
        nativeUpdateQuranNotification(title, artist);
      }
    },
    [surahName, surahNumber]
  );

  async function fetchTafsirText(verseKey: string): Promise<string> {
    try {
      const row = await api<{ text: string }>(
        `/api/quran/ayahs/${verseKey}/tafsir?source=${tafsirSourceRef.current}`
      );
      return truncateForSpeech(row.text);
    } catch {
      return "";
    }
  }

  async function buildNativeQueue(
    start: number,
    audioList: AudioAyah[],
    surahPasses: number,
    ayahRepeats: number
  ): Promise<NativeQueueItem[]> {
    const items: NativeQueueItem[] = [];
    for (let pass = 1; pass <= surahPasses; pass++) {
      for (let i = start; i < audioList.length; i++) {
        const audio = audioList[i];
        const text = textAyahs[i];
        if (!audio?.audio || !text) continue;
        for (let r = 0; r < ayahRepeats; r++) {
          items.push({
            url: audio.audio,
            title: text.verse_key,
            ayahIndex: i,
            kind: "arabic",
          });
          if (includeTranslationRef.current && audio.translation_audio) {
            items.push({
              url: audio.translation_audio,
              title: `${text.verse_key} · translation`,
              ayahIndex: i,
              kind: "translation",
            });
          }
        }
      }
    }
    return items;
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
    playIndexRef.current = i;
    onPlayIndex?.(i);

    const wantTafsir = includeTafsirRef.current;
    const tafsirPromise =
      wantTafsir && !stopRef.current ? fetchTafsirText(text.verse_key) : null;

    const prefix = passLabel ? `${passLabel} · ` : "";
    const label = `${prefix}${text.verse_key}`;
    setStatus(label);
    updateNowPlaying(text.verse_key);

    stopAllPlayback();
    try {
      await playAudioUrl(audio.audio, gen);
    } catch {
      /* skip */
    }
    if (stopRef.current || sessionRef.current !== gen) return;

    if (includeTranslationRef.current) {
      const tr = getTranslation(text);
      if (tr) {
        stopAllPlayback();
        await playSpokenText(tr, translation, audio.translation_audio, gen);
      }
    }
    if (stopRef.current || sessionRef.current !== gen) return;

    if (includeTafsirRef.current) {
      const tf = tafsirPromise ? await tafsirPromise : await fetchTafsirText(text.verse_key);
      if (stopRef.current || sessionRef.current !== gen) return;
      if (tf) {
        stopAllPlayback();
        await playSpokenText(tf, speechLangForSource(tafsirSourceRef.current), null, gen);
      }
    }
  }

  const playFromIndex = useCallback(
    async (start: number) => {
      // Runs synchronously within the click gesture, before the awaits below
      // consume it — otherwise mobile autoplay policy blocks the first play.
      primeAudioPlayback();
      const audioList = await ensureAudioLoaded();
      if (!audioList.length) return;

      stopRef.current = false;
      nativeModeRef.current = false;
      const gen = beginPlaybackSession();
      sessionRef.current = gen;
      setPlaying(true);
      playingRef.current = true;
      await acquireWakeLock();
      nativeSetQuranPlaying(true);

      const surahPasses = repeatScope === "surah" ? Math.min(repeatCount, MAX_REPEAT) : 1;
      const ayahRepeats = repeatScope === "ayah" ? Math.min(repeatCount, MAX_REPEAT) : 1;

      // Native ExoPlayer queue: HTTP streams + lock-screen notification (Android APK)
      const canNative =
        isNativeApp() &&
        !includeTafsirRef.current &&
        (!includeTranslationRef.current || audioList.some((a) => a.translation_audio));

      if (canNative) {
        const queue = await buildNativeQueue(start, audioList, surahPasses, ayahRepeats);
        if (queue.length && nativePlayQuranQueue(surahName ?? `Surah ${surahNumber}`, queue)) {
          nativeModeRef.current = true;
          setPlayIndex(start);
          onPlayIndex?.(start);
          setStatus(audioList[start] ? textAyahs[start]?.verse_key ?? "" : "");
          updateNowPlaying(textAyahs[start]?.verse_key ?? `Ayah ${start + 1}`);
          return;
        }
      }

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
        playingRef.current = false;
        nativeSetQuranPlaying(false);
        void releaseWakeLock();
        clearMediaSession();
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
      surahName,
      surahNumber,
      updateNowPlaying,
    ]
  );

  const playFromIndexRef = useRef(playFromIndex);
  playFromIndexRef.current = playFromIndex;

  useEffect(() => {
    playIndexRef.current = playIndex;
  }, [playIndex]);

  // Leave native ExoPlayer queue when tafsir is turned on during playback.
  useEffect(() => {
    if (!includeTafsir || !playingRef.current || !nativeModeRef.current) return;
    const idx = playIndexRef.current;
    stopRef.current = true;
    nativeModeRef.current = false;
    nativeStopQuranPlayback();
    nativeSetQuranPlaying(false);
    stopRef.current = false;
    void playFromIndexRef.current(idx);
  }, [includeTafsir]);

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
