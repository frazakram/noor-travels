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
  prefetchAudioUrl,
  primeAudioPlayback,
  setGlobalPlaybackRate,
  stopAllPlayback,
  truncateForSpeech,
} from "@/lib/quran-audio";
import { speechLangForSource, type TafsirSource } from "@/lib/tafsir";
import type { TranslationLang } from "@/lib/quran-types";

const MAX_REPEAT = 5;
const BISMILLAH_WORD_COUNT = 4;
const BISMILLAH_FALLBACK_MS = 5840;
/** Native queue is precomputed, so an endless range loop is capped there. */
const NATIVE_INFINITE_PASSES = 20;

/** repeatCount value meaning "loop until paused" (range scope only). */
export const LOOP_FOREVER = 0;

export type RepeatScope = "ayah" | "surah" | "range";

type Reciter = { id: string; name: string };

function dedupeReciters(list: Reciter[]): Reciter[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const out: Reciter[] = [];
  for (const r of list) {
    if (!r?.id || seenIds.has(r.id)) continue;
    if (r.id.endsWith("-2")) continue;
    const nameKey = (r.name || r.id).trim().toLowerCase();
    if (seenNames.has(nameKey)) continue;
    seenIds.add(r.id);
    seenNames.add(nameKey);
    out.push(r);
  }
  return out;
}

type AudioAyah = {
  ayah_number: number;
  verse_key: string;
  audio: string | null;
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

type WordSegment = { word_index: number; start_ms: number; end_ms: number };
type AyahTiming = {
  segments: WordSegment[];
  timestampFrom: number;
  timestampTo: number;
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
  /** 0-based inclusive ayah indexes; used only when repeatScope is "range". */
  rangeStart?: number;
  rangeEnd?: number;
  playbackSpeed?: number;
  onPlayIndex?: (index: number) => void;
  onBismillahPlay?: () => void;
  /** Fired when playback reaches the natural end (not user pause) — used for
   *  auto-playing the next surah. */
  onPlaybackFinished?: () => void;
};

/**
 * Map playback time → word index.
 * Segments from the API are ms from ayah start (not scaled to file duration).
 * Scaling against full-file duration (esp. surah-mode) pinned the highlight on word 0.
 */
function wordIndexFromTime(
  currentSec: number,
  durationSec: number,
  wordCount: number,
  segments?: WordSegment[] | null,
  /** When audio is a full-surah file, subtract this ayah's start (seconds). */
  ayahOffsetSec = 0
): number {
  if (wordCount <= 0) return -1;
  const localSec = Math.max(0, currentSec - ayahOffsetSec);
  const ms = localSec * 1000;
  const span =
    ayahOffsetSec > 0 && Number.isFinite(durationSec) && durationSec > ayahOffsetSec
      ? durationSec - ayahOffsetSec
      : durationSec;

  if (segments && segments.length) {
    // Sparse timings (e.g. 1 segment for a 4-word ayah) pin the highlight — use proportional instead.
    const coverageOk = wordCount <= 1 || segments.length >= Math.ceil(wordCount * 0.5);
    if (coverageOk) {
      // Segment clocks come from quran.com's recording of the reciter, which can
      // be a different take than the playback file — the highlight then runs
      // early/late at a constant rate. When the spans clearly disagree, map the
      // playback position onto the segment clock instead of using it raw.
      let effMs = ms;
      let segEndMs = 0;
      for (const s of segments) segEndMs = Math.max(segEndMs, s.end_ms);
      if (segEndMs > 0 && Number.isFinite(span) && span > 0) {
        const ratio = segEndMs / (span * 1000);
        if (ratio > 0 && Math.abs(1 - ratio) > 0.08) effMs = ms * ratio;
      }
      for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i];
        if (effMs >= s.start_ms) {
          return Math.min(wordCount - 1, Math.max(0, s.word_index - 1));
        }
      }
      return 0;
    }
  }

  // Proportional fallback when timings are missing or too sparse for this reciter.
  if (!Number.isFinite(span) || span <= 0) {
    // Without duration, nudge forward slowly from wall-clock-unaware currentTime alone.
    if (localSec <= 0) return 0;
    // Assume ~0.45s/word so highlight still moves when duration is unknown.
    return Math.min(wordCount - 1, Math.floor(localSec / 0.45));
  }
  const idx = Math.floor((localSec / span) * wordCount);
  return Math.min(wordCount - 1, Math.max(0, idx));
}

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
  rangeStart,
  rangeEnd,
  playbackSpeed = 1,
  onPlayIndex,
  onBismillahPlay,
  onPlaybackFinished,
}: Options) {
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [audioAyahs, setAudioAyahs] = useState<AudioAyah[]>([]);
  const [audioReady, setAudioReady] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<"ayah" | "surah">("ayah");
  const [surahAudioAvailable, setSurahAudioAvailable] = useState(true);
  const [bismillahAudio, setBismillahAudio] = useState<string | null>(null);
  const [needsBismillah, setNeedsBismillah] = useState(false);
  const [embeddedBismillah, setEmbeddedBismillah] = useState(false);
  const [embeddedBismillahDurationMs, setEmbeddedBismillahDurationMs] = useState(0);
  const [embeddedBismillahSegments, setEmbeddedBismillahSegments] = useState<WordSegment[]>([]);
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [repeatPass, setRepeatPass] = useState(1);
  const [status, setStatus] = useState("");
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [activeBismillahWordIndex, setActiveBismillahWordIndex] = useState(-1);
  const [isPlayingBismillah, setIsPlayingBismillah] = useState(false);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const [wordTimings, setWordTimings] = useState<Record<string, AyahTiming>>({});
  const [referenceTimings, setReferenceTimings] = useState<Record<string, AyahTiming>>({});
  const [bismillahSegments, setBismillahSegments] = useState<WordSegment[]>([]);

  const stopRef = useRef(false);
  const sessionRef = useRef(0);
  const loadGenRef = useRef(0);
  const nativeModeRef = useRef(false);
  const playingRef = useRef(false);
  const playIndexRef = useRef(0);
  const surahArabicPlayedRef = useRef<string | null>(null);
  const bismillahPlayedRef = useRef(false);
  const includeTafsirRef = useRef(includeTafsir);
  const includeTranslationRef = useRef(includeTranslation);
  const tafsirSourceRef = useRef(tafsirSource);
  const textAyahsRef = useRef(textAyahs);
  const onPlayIndexRef = useRef(onPlayIndex);
  const onBismillahPlayRef = useRef(onBismillahPlay);
  const onPlaybackFinishedRef = useRef(onPlaybackFinished);
  const wordCountsRef = useRef(wordCounts);
  const wordTimingsRef = useRef(wordTimings);
  const referenceTimingsRef = useRef(referenceTimings);
  const bismillahSegmentsRef = useRef(bismillahSegments);
  const playbackSpeedRef = useRef(playbackSpeed);
  const audioListRef = useRef<AudioAyah[]>([]);
  /** Resolves once word timings for the current surah+reciter have loaded.
   *  Full-surah files need them to seek to a tapped mid-surah ayah — playing
   *  before they arrive would start from the beginning of the file. */
  const timingsReadyRef = useRef<Promise<void>>(Promise.resolve());
  includeTafsirRef.current = includeTafsir;
  includeTranslationRef.current = includeTranslation;
  tafsirSourceRef.current = tafsirSource;
  onPlayIndexRef.current = onPlayIndex;
  onBismillahPlayRef.current = onBismillahPlay;
  onPlaybackFinishedRef.current = onPlaybackFinished;
  textAyahsRef.current = textAyahs;
  playingRef.current = playing;
  wordCountsRef.current = wordCounts;
  wordTimingsRef.current = wordTimings;
  referenceTimingsRef.current = referenceTimings;
  bismillahSegmentsRef.current = bismillahSegments;
  playbackSpeedRef.current = playbackSpeed;

  useEffect(() => {
    setGlobalPlaybackRate(playbackSpeed);
  }, [playbackSpeed]);

  useEffect(() => {
    api<{ reciters: Reciter[] }>("/api/quran/audio/editions")
      .then((d) => setReciters(dedupeReciters(d.reciters || [])))
      .catch(() => {});
  }, []);

  // Prefetch words and timing data. Exact reciter timings drive ayah-mode.
  // Alafasy chapter timings are retained separately as a normalized reference
  // for full-surah files (Anas), never mistaken for exact timestamps.
  useEffect(() => {
    let cancelled = false;
    type TimingPayload = {
      available: boolean;
      ayahs: {
        verse_key: string;
        timestamp_from?: number;
        timestamp_to?: number;
        segments: WordSegment[];
      }[];
    };
    const timingUrl = (surah: number, reciterId: string) =>
      `/api/quran/surahs/${surah}/word-timings?reciter=${encodeURIComponent(reciterId)}`;
    const toMap = (payload: TimingPayload): Record<string, AyahTiming> => {
      const map: Record<string, AyahTiming> = {};
      for (const a of payload.ayahs || []) {
        map[a.verse_key] = {
          // Time-ordered, not word-ordered: a qari repeating a few words emits
          // segments whose word_index steps backward — keep that order so the
          // highlight follows the repetition.
          segments: (a.segments || []).slice().sort((x, y) => x.start_ms - y.start_ms),
          timestampFrom: a.timestamp_from ?? 0,
          timestampTo: a.timestamp_to ?? 0,
        };
      }
      return map;
    };

    api<{ ayahs: { verse_key: string; words: unknown[] }[] }>(
      `/api/quran/surahs/${surahNumber}/words`
    )
      .then((d) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const a of d.ayahs || []) counts[a.verse_key] = a.words?.length ?? 0;
        setWordCounts(counts);
      })
      .catch(() => {});

    // Refs are written directly (not only via render sync) so a play started
    // right after the fetch resolves sees the timings without waiting a frame.
    timingsReadyRef.current = Promise.all([
      api<TimingPayload>(timingUrl(surahNumber, reciter)),
      api<TimingPayload>(timingUrl(1, reciter)),
    ])
      .then(async ([own, fatiha]) => {
        if (cancelled) return;
        const ownMap = own.available ? toMap(own) : {};
        setWordTimings(ownMap);
        wordTimingsRef.current = ownMap;
        const bisSegs = fatiha.available ? toMap(fatiha)["1:1"]?.segments ?? [] : [];
        setBismillahSegments(bisSegs);
        bismillahSegmentsRef.current = bisSegs;

        if (own.available) {
          setReferenceTimings({});
          referenceTimingsRef.current = {};
        } else {
          try {
            const reference = await api<TimingPayload>(timingUrl(surahNumber, "ar.alafasy"));
            if (!cancelled) {
              const refMap = reference.available ? toMap(reference) : {};
              setReferenceTimings(refMap);
              referenceTimingsRef.current = refMap;
            }
          } catch {
            if (!cancelled) {
              setReferenceTimings({});
              referenceTimingsRef.current = {};
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWordTimings({});
          setReferenceTimings({});
          setBismillahSegments([]);
          wordTimingsRef.current = {};
          referenceTimingsRef.current = {};
          bismillahSegmentsRef.current = [];
        }
      });

    return () => {
      cancelled = true;
    };
  }, [surahNumber, reciter]);

  const getTranslation = useCallback(
    (a: TextAyah) => {
      if (translation === "ur") return a.translation_ur || a.translation || "";
      if (translation === "hi") return a.translation_hi || a.translation || a.translation_en || "";
      return a.translation_en || a.translation || "";
    },
    [translation]
  );

  const ensureAudioLoaded = useCallback(async (): Promise<{
    ayahs: AudioAyah[];
    bismillah: string | null;
    needsBis: boolean;
    embeddedBis: boolean;
    embeddedBisDurationMs: number;
    embeddedBisSegments: WordSegment[];
    mode: "ayah" | "surah";
  }> => {
    const needsTrAudio = includeTranslation && (translation === "en" || translation === "ur");
    const cachedHasTr =
      audioAyahs.length > 0 && audioAyahs.some((a) => Boolean(a.translation_audio));
    if (audioReady && audioAyahs.length && (!needsTrAudio || cachedHasTr)) {
      return {
        ayahs: audioAyahs,
        bismillah: bismillahAudio,
        needsBis: needsBismillah,
        embeddedBis: embeddedBismillah,
        embeddedBisDurationMs: embeddedBismillahDurationMs,
        embeddedBisSegments: embeddedBismillahSegments,
        mode: playbackMode,
      };
    }

    const gen = ++loadGenRef.current;
    setAudioLoading(true);
    try {
      // Always request translation audio when the spoken-translation toggle is on,
      // so switching reciter never drops Urdu/English verse audio.
      const trParam = includeTranslation ? `&translation_lang=${translation}` : "";
      const [editions, audio] = await Promise.all([
        api<{ reciters: Reciter[] }>("/api/quran/audio/editions"),
        api<{
          ayahs: AudioAyah[];
          playback_mode?: "ayah" | "surah";
          surah_audio_available?: boolean;
          bismillah_audio?: string | null;
          needs_bismillah?: boolean;
          embedded_bismillah?: boolean;
          embedded_bismillah_duration_ms?: number;
          embedded_bismillah_segments?: WordSegment[];
        }>(
          `/api/quran/audio/surahs/${surahNumber}?reciter=${encodeURIComponent(reciter)}${trParam}`
        ),
      ]);
      if (gen !== loadGenRef.current) {
        return {
          ayahs: [],
          bismillah: null,
          needsBis: false,
          embeddedBis: false,
          embeddedBisDurationMs: 0,
          embeddedBisSegments: [],
          mode: "ayah",
        };
      }
      setReciters(dedupeReciters(editions.reciters || []));
      const mode = audio.playback_mode ?? "ayah";
      setPlaybackMode(mode);
      setSurahAudioAvailable(audio.surah_audio_available ?? true);
      setAudioAyahs(audio.ayahs);
      const bis = audio.bismillah_audio ?? null;
      const needsBis = Boolean(audio.needs_bismillah && bis);
      const embeddedBis = Boolean(audio.embedded_bismillah);
      const embeddedBisDurationMs = Math.max(0, audio.embedded_bismillah_duration_ms ?? 0);
      const embeddedBisSegments = audio.embedded_bismillah_segments ?? [];
      setBismillahAudio(bis);
      setNeedsBismillah(needsBis);
      setEmbeddedBismillah(embeddedBis);
      setEmbeddedBismillahDurationMs(embeddedBisDurationMs);
      setEmbeddedBismillahSegments(embeddedBisSegments);
      setAudioReady(true);
      return {
        ayahs: audio.ayahs,
        bismillah: bis,
        needsBis,
        embeddedBis,
        embeddedBisDurationMs,
        embeddedBisSegments,
        mode,
      };
    } finally {
      if (gen === loadGenRef.current) setAudioLoading(false);
    }
  }, [
    audioReady,
    audioAyahs,
    bismillahAudio,
    needsBismillah,
    embeddedBismillah,
    embeddedBismillahDurationMs,
    embeddedBismillahSegments,
    playbackMode,
    includeTranslation,
    translation,
    surahNumber,
    reciter,
  ]);

  useEffect(() => {
    setAudioReady(false);
    setAudioAyahs([]);
    setPlaybackMode("ayah");
    setSurahAudioAvailable(true);
    setBismillahAudio(null);
    setNeedsBismillah(false);
    setEmbeddedBismillah(false);
    setEmbeddedBismillahDurationMs(0);
    setEmbeddedBismillahSegments([]);
    surahArabicPlayedRef.current = null;
    bismillahPlayedRef.current = false;
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
    setActiveWordIndex(-1);
    setActiveBismillahWordIndex(-1);
    setIsPlayingBismillah(false);
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
        setActiveWordIndex(-1);
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
        // Native queue drained on its own (user pauses clear nativeModeRef
        // before this fires) — treat it as a natural finish.
        onPlaybackFinishedRef.current?.();
      };
      // Native (ExoPlayer) playback has no web <audio> element for ontimeupdate
      // to fire on, so the word-highlight glow would otherwise never move
      // during native playback — see QuranPlaybackService.kt's notifyWordPosition.
      (
        window as unknown as {
          noorOnWordPosition?: (ayahIndex: number, positionMs: number, durationMs: number, kind: string) => void;
        }
      ).noorOnWordPosition = (ayahIndex, positionMs, durationMs, kind) => {
        if (!nativeModeRef.current || kind !== "arabic") return;
        const verseKey = textAyahsRef.current[ayahIndex]?.verse_key;
        if (!verseKey) return;
        const count = wordCountsRef.current[verseKey] ?? 0;
        if (count <= 0) return;
        const segs =
          wordTimingsRef.current[verseKey]?.segments?.length
            ? wordTimingsRef.current[verseKey].segments
            : referenceTimingsRef.current[verseKey]?.segments;
        setActiveWordIndex(
          wordIndexFromTime(positionMs / 1000, durationMs >= 0 ? durationMs / 1000 : NaN, count, segs)
        );
      };
    }

    return () => {
      stopRef.current = true;
      invalidatePlaybackSession();
      releaseNativePlayback();
      delete (window as unknown as { noorOnAyahIndex?: unknown }).noorOnAyahIndex;
      delete (window as unknown as { noorOnPlaybackEnded?: unknown }).noorOnPlaybackEnded;
      delete (window as unknown as { noorOnWordPosition?: unknown }).noorOnWordPosition;
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

  async function buildNativeQueue(opts: {
    start: number;
    audioList: AudioAyah[];
    passes: number;
    ayahRepeats: number;
    bismillah: string | null;
    needsBis: boolean;
    rangeLo?: number;
    rangeHi?: number;
    isRange?: boolean;
  }): Promise<NativeQueueItem[]> {
    const { start, audioList, passes, ayahRepeats, bismillah, needsBis, isRange } = opts;
    const rangeLo = opts.rangeLo ?? 0;
    const rangeHi = opts.rangeHi ?? audioList.length - 1;
    const items: NativeQueueItem[] = [];
    let lastArabicUrl: string | null = null;
    for (let pass = 1; pass <= passes; pass++) {
      const from = pass === 1 ? start : rangeLo;
      for (let i = from; i <= rangeHi; i++) {
        const audio = audioList[i];
        const text = textAyahs[i];
        if (!audio?.audio || !text) continue;
        for (let r = 0; r < ayahRepeats; r++) {
          // Range loops play Bismillah once up front; surah passes replay it.
          if (needsBis && bismillah && i === 0 && r === 0 && (pass === 1 || !isRange)) {
            if (bismillah !== lastArabicUrl) {
              items.push({
                url: bismillah,
                title: "Bismillah",
                ayahIndex: 0,
                kind: "arabic",
              });
              lastArabicUrl = bismillah;
            }
          }
          // Dedupe collapses full-surah-file URLs; a range loop must replay the
          // same ayah URL back-to-back, so it skips the check.
          if (isRange || audio.audio !== lastArabicUrl) {
            items.push({
              url: audio.audio,
              title: text.verse_key,
              ayahIndex: i,
              kind: "arabic",
            });
            lastArabicUrl = audio.audio;
          }
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
    opts: {
      passLabel?: string;
      seamlessArabic?: boolean;
      nextArabicUrl?: string | null;
      playBismillah?: boolean;
      bismillahUrl?: string | null;
      mode: "ayah" | "surah";
      embeddedBismillah?: boolean;
      embeddedBismillahDurationMs?: number;
      embeddedBismillahSegments?: WordSegment[];
      /** Range loop: stop a full-surah file after this ayah index. */
      rangeEndIndex?: number;
    }
  ) {
    const audio = audioList[i];
    const text = textAyahsRef.current[i];
    if (!text) return;
    // Allow translation-only when Arabic URL is missing (e.g. surah-mode gap).
    if (!audio?.audio && !(includeTranslationRef.current && (audio?.translation_audio || getTranslation(text)))) {
      return;
    }

    setPlayIndex(i);
    playIndexRef.current = i;
    onPlayIndexRef.current?.(i);
    setActiveWordIndex(-1);

    const wantTafsir = includeTafsirRef.current;
    const tafsirPromise =
      wantTafsir && !stopRef.current ? fetchTafsirText(text.verse_key) : null;

    const prefix = opts.passLabel ? `${opts.passLabel} · ` : "";
    const label = `${prefix}${text.verse_key}`;
    setStatus(label);
    updateNowPlaying(text.verse_key);

    const arabicOnly =
      !includeTranslationRef.current && !includeTafsirRef.current && opts.mode === "ayah";

    if (opts.mode === "surah" && opts.embeddedBismillah && i === 0) {
      setStatus(`${prefix}Bismillah`);
      setIsPlayingBismillah(true);
      setActiveBismillahWordIndex(0);
      setActiveWordIndex(-1);
      onBismillahPlayRef.current?.();
    }

    if (opts.playBismillah && opts.bismillahUrl && !bismillahPlayedRef.current) {
      bismillahPlayedRef.current = true;
      stopAllPlayback();
      setStatus(`${prefix}Bismillah`);
      setIsPlayingBismillah(true);
      setActiveWordIndex(-1);
      setActiveBismillahWordIndex(0);
      onBismillahPlayRef.current?.();
      if (audio?.audio) prefetchAudioUrl(audio.audio);
      try {
        await playAudioUrl(opts.bismillahUrl, {
          gen,
          seamless: false,
          playbackRate: playbackSpeedRef.current,
          onTimeUpdate: (current, duration) => {
            if (stopRef.current || sessionRef.current !== gen) return;
            setActiveBismillahWordIndex(
              wordIndexFromTime(
                current,
                duration,
                BISMILLAH_WORD_COUNT,
                bismillahSegmentsRef.current
              )
            );
          },
        });
      } catch {
        /* skip */
      }
      setIsPlayingBismillah(false);
      setActiveBismillahWordIndex(-1);
      if (stopRef.current || sessionRef.current !== gen) return;
      if (audio?.audio) prefetchAudioUrl(audio.audio);
    } else if (!opts.seamlessArabic || !arabicOnly) {
      // Hard stop when leaving Arabic-only gapless mode (translation/tafsir).
      stopAllPlayback();
    }

    const skipSurahReplay =
      opts.mode === "surah" && audio?.audio && surahArabicPlayedRef.current === audio.audio;
    if (audio?.audio && !skipSurahReplay) {
      surahArabicPlayedRef.current = audio.audio;
      if (opts.nextArabicUrl && arabicOnly) {
        prefetchAudioUrl(opts.nextArabicUrl);
      }
      const verseKey = text.verse_key;
      const isSurahFile = opts.mode === "surah";
      const seekTimingMap = Object.keys(wordTimingsRef.current).length
        ? wordTimingsRef.current
        : referenceTimingsRef.current;
      const seekTimelineEnd = Math.max(
        0,
        ...Object.values(seekTimingMap).map((t) => t.timestampTo)
      );
      const startAtFraction =
        isSurahFile && i > 0 && seekTimelineEnd > 0
          ? (seekTimingMap[verseKey]?.timestampFrom ?? 0) / seekTimelineEnd
          : undefined;
      let endAtFraction: number | undefined;
      if (
        isSurahFile &&
        opts.rangeEndIndex != null &&
        opts.rangeEndIndex < audioList.length - 1 &&
        seekTimelineEnd > 0
      ) {
        const endKey = textAyahsRef.current[opts.rangeEndIndex]?.verse_key;
        const endMs = endKey ? seekTimingMap[endKey]?.timestampTo ?? 0 : 0;
        if (endMs > 0) endAtFraction = Math.min(1, endMs / seekTimelineEnd);
      }
      try {
        await playAudioUrl(audio.audio, {
          gen,
          seamless: Boolean(opts.seamlessArabic && arabicOnly),
          playbackRate: playbackSpeedRef.current,
          startAtFraction,
          endAtFraction,
          contentOffsetSec: opts.embeddedBismillah
            ? (opts.embeddedBismillahDurationMs ?? 0) / 1000
            : 0,
          onTimeUpdate: (current, duration) => {
            if (stopRef.current || sessionRef.current !== gen) return;

            if (isSurahFile) {
              const list = audioListRef.current;
              const currentMs = current * 1000;
              const durationMs = duration > 0 ? duration * 1000 : 0;
              const embeddedBisMs = opts.embeddedBismillah
                ? Math.min(
                    opts.embeddedBismillahDurationMs || BISMILLAH_FALLBACK_MS,
                    durationMs || opts.embeddedBismillahDurationMs || BISMILLAH_FALLBACK_MS
                  )
                : 0;

              if (embeddedBisMs > 0 && currentMs < embeddedBisMs) {
                setStatus(`${prefix}Bismillah`);
                setIsPlayingBismillah(true);
                setActiveWordIndex(-1);
                setActiveBismillahWordIndex(
                  wordIndexFromTime(
                    current,
                    embeddedBisMs / 1000,
                    BISMILLAH_WORD_COUNT,
                    opts.embeddedBismillahSegments?.length
                      ? opts.embeddedBismillahSegments
                      : bismillahSegmentsRef.current
                  )
                );
                return;
              }
              setIsPlayingBismillah(false);
              setActiveBismillahWordIndex(-1);

              const exact = wordTimingsRef.current;
              const reference = referenceTimingsRef.current;
              const timingMap = Object.keys(exact).length ? exact : reference;
              const referenceEnd = Math.max(
                0,
                ...Object.values(timingMap).map((t) => t.timestampTo)
              );
              const contentMs = Math.max(0, currentMs - embeddedBisMs);
              const contentDurationMs = Math.max(1, durationMs - embeddedBisMs);
              // Exact timings use the file's own clock. Reference timings are
              // normalized across the remaining full-surah duration.
              const timelineMs =
                Object.keys(exact).length || referenceEnd <= 0
                  ? contentMs
                  : (contentMs / contentDurationMs) * referenceEnd;

              let ayahIdx = 0;
              for (let j = list.length - 1; j >= 0; j--) {
                const key = list[j]?.verse_key;
                if (!key) continue;
                const from = timingMap[key]?.timestampFrom;
                if (from != null && timelineMs >= from) {
                  ayahIdx = j;
                  break;
                }
              }
              if (ayahIdx !== playIndexRef.current) {
                playIndexRef.current = ayahIdx;
                setPlayIndex(ayahIdx);
                onPlayIndexRef.current?.(ayahIdx);
              }
              const activeKey = list[ayahIdx]?.verse_key;
              if (!activeKey) return;
              setStatus(`${prefix}${activeKey}`);
              const timing = timingMap[activeKey];
              const count = wordCountsRef.current[activeKey] ?? 0;
              if (timing) {
                const localMs = Math.max(0, timelineMs - timing.timestampFrom);
                const ayahSpanMs = Math.max(
                  1,
                  timing.timestampTo - timing.timestampFrom
                );
                setActiveWordIndex(
                  wordIndexFromTime(
                    localMs / 1000,
                    ayahSpanMs / 1000,
                    count,
                    timing.segments
                  )
                );
              } else {
                // Last-resort proportional position by cumulative word count.
                const totalWords = list.reduce(
                  (sum, row) => sum + (wordCountsRef.current[row.verse_key] ?? 0),
                  0
                );
                const wordPosition = Math.floor(
                  (contentMs / contentDurationMs) * Math.max(1, totalWords)
                );
                let before = 0;
                for (let j = 0; j < list.length; j++) {
                  const key = list[j]?.verse_key;
                  const words = key ? wordCountsRef.current[key] ?? 0 : 0;
                  if (wordPosition < before + words || j === list.length - 1) {
                    if (j !== playIndexRef.current) {
                      playIndexRef.current = j;
                      setPlayIndex(j);
                      onPlayIndexRef.current?.(j);
                    }
                    setActiveWordIndex(Math.max(0, Math.min(words - 1, wordPosition - before)));
                    break;
                  }
                  before += words;
                }
              }
              return;
            }

            const count = wordCountsRef.current[verseKey] ?? 0;
            // No exact timings for this reciter → borrow Alafasy's segments as a
            // pacing reference; wordIndexFromTime rescales them onto this file's
            // duration, which tracks recitation far better than a linear sweep.
            const segs =
              wordTimingsRef.current[verseKey]?.segments?.length
                ? wordTimingsRef.current[verseKey].segments
                : referenceTimingsRef.current[verseKey]?.segments;
            setActiveWordIndex(wordIndexFromTime(current, duration, count, segs));
          },
        });
      } catch {
        /* skip broken Arabic URL; still try translation below */
      }
    }
    setActiveWordIndex(-1);
    if (stopRef.current || sessionRef.current !== gen) return;

    if (includeTranslationRef.current) {
      const tr = getTranslation(text);
      if (tr || audio?.translation_audio) {
        stopAllPlayback();
        setStatus(`${prefix}${text.verse_key} · ${translation}`);
        await playSpokenText(tr || " ", translation, audio?.translation_audio, gen);
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
      setGlobalPlaybackRate(playbackSpeedRef.current);
      const loaded = await ensureAudioLoaded();
      const audioList = loaded.ayahs;
      if (!audioList.length) return;
      audioListRef.current = audioList;

      // Full-surah files locate ayahs by word timings; wait for them (bounded)
      // so tapping a mid-surah ayah seeks there instead of starting at ayah 1.
      if (loaded.mode === "surah") {
        await Promise.race([
          timingsReadyRef.current,
          new Promise<void>((r) => window.setTimeout(r, 4000)),
        ]);
      }

      stopRef.current = false;
      nativeModeRef.current = false;
      surahArabicPlayedRef.current = null;
      bismillahPlayedRef.current = false;
      const gen = beginPlaybackSession();
      sessionRef.current = gen;
      const playStartedAt = Date.now();
      setPlaying(true);
      playingRef.current = true;
      setActiveWordIndex(-1);
      setActiveBismillahWordIndex(-1);
      setIsPlayingBismillah(false);
      await acquireWakeLock();
      nativeSetQuranPlaying(true);

      const lastIdx = audioList.length - 1;
      const isRange = repeatScope === "range";
      const rangeLo = isRange
        ? Math.min(Math.max(0, rangeStart ?? 0), lastIdx)
        : 0;
      const rangeHi = isRange
        ? Math.min(Math.max(rangeLo, rangeEnd ?? lastIdx), lastIdx)
        : lastIdx;
      const infiniteLoop = isRange && repeatCount <= LOOP_FOREVER;
      const surahPasses =
        repeatScope === "surah" || isRange
          ? infiniteLoop
            ? Number.MAX_SAFE_INTEGER
            : Math.min(Math.max(1, repeatCount), MAX_REPEAT)
          : 1;
      const ayahRepeats =
        repeatScope === "ayah" ? Math.min(Math.max(1, repeatCount), MAX_REPEAT) : 1;
      const arabicOnly = !includeTranslationRef.current && !includeTafsirRef.current;

      // Tapping inside the loop starts there (first pass runs to the end of the
      // range); tapping outside snaps to the loop start.
      let idx = isRange ? (start >= rangeLo && start <= rangeHi ? start : rangeLo) : start;

      // Native ExoPlayer queue: HTTP streams + lock-screen notification (Android APK).
      // Range loops over a single full-surah file need in-file seeking, which the
      // queue cannot express — those fall through to web playback.
      const canNative =
        isNativeApp() &&
        !includeTafsirRef.current &&
        (!includeTranslationRef.current || audioList.some((a) => a.translation_audio)) &&
        !(isRange && loaded.mode === "surah");

      if (canNative) {
        const queue = await buildNativeQueue({
          start: idx,
          audioList,
          passes: infiniteLoop ? NATIVE_INFINITE_PASSES : surahPasses,
          ayahRepeats,
          bismillah: loaded.bismillah,
          needsBis: loaded.needsBis,
          rangeLo,
          rangeHi,
          isRange,
        });
        if (queue.length && nativePlayQuranQueue(surahName ?? `Surah ${surahNumber}`, queue)) {
          nativeModeRef.current = true;
          setPlayIndex(idx);
          onPlayIndex?.(idx);
          setStatus(audioList[idx] ? textAyahs[idx]?.verse_key ?? "" : "");
          updateNowPlaying(textAyahs[idx]?.verse_key ?? `Ayah ${idx + 1}`);
          return;
        }
      }

      // Prefetch first track for snappier start
      const firstUrl = audioList[idx]?.audio;
      if (loaded.needsBis && loaded.bismillah && idx === 0) {
        prefetchAudioUrl(loaded.bismillah);
      } else if (firstUrl) {
        prefetchAudioUrl(firstUrl);
      }

      for (let pass = 1; pass <= surahPasses; pass++) {
        if (stopRef.current || sessionRef.current !== gen) break;
        const passStartedAt = Date.now();
        if ((repeatScope === "surah" || isRange) && (surahPasses > 1 || infiniteLoop)) {
          setRepeatPass(pass);
        }
        if (pass > 1) {
          // A new surah pass must replay both embedded/separate Bismillah and
          // the full-surah Arabic file instead of treating them as duplicates.
          // Range passes replay the surah file but keep Bismillah played once.
          surahArabicPlayedRef.current = null;
          if (!isRange) bismillahPlayedRef.current = false;
        }

        let surahFileDone = false;
        for (let i = idx; i <= rangeHi; i++) {
          if (stopRef.current || sessionRef.current !== gen) break;
          for (let r = 1; r <= ayahRepeats; r++) {
            if (stopRef.current || sessionRef.current !== gen) break;
            const label = isRange
              ? infiniteLoop
                ? pass > 1
                  ? `${pass}×`
                  : undefined
                : surahPasses > 1
                  ? `${pass}/${surahPasses}`
                  : undefined
              : repeatScope === "ayah" && ayahRepeats > 1
                ? `${r}/${ayahRepeats}`
                : repeatScope === "surah" && surahPasses > 1
                  ? `${pass}/${surahPasses}`
                  : undefined;

            const nextIdx = r < ayahRepeats ? i : i + 1;
            let nextArabicUrl = nextIdx <= rangeHi ? audioList[nextIdx]?.audio : null;
            if (
              isRange &&
              nextIdx > rangeHi &&
              (infiniteLoop || pass < surahPasses)
            ) {
              // Warm the loop-around so the range restarts near-gaplessly.
              nextArabicUrl = audioList[rangeLo]?.audio ?? null;
            }

            const playBis =
              loaded.needsBis &&
              Boolean(loaded.bismillah) &&
              i === 0 &&
              r === 1 &&
              !bismillahPlayedRef.current;

            await playSingleAyah(i, audioList, gen, {
              passLabel: label,
              // Keep Arabic-only ayah mode gapless (including after Bismillah).
              seamlessArabic: arabicOnly && loaded.mode === "ayah",
              nextArabicUrl: arabicOnly ? nextArabicUrl : null,
              playBismillah: playBis,
              bismillahUrl: loaded.bismillah,
              mode: loaded.mode,
              embeddedBismillah: loaded.embeddedBis,
              embeddedBismillahDurationMs: loaded.embeddedBisDurationMs,
              embeddedBismillahSegments: loaded.embeddedBisSegments,
              rangeEndIndex: isRange ? rangeHi : undefined,
            });
            // Surah-mode Arabic-only: one file covers every ayah (tracked in onTimeUpdate).
            if (loaded.mode === "surah" && arabicOnly) {
              surahFileDone = true;
              break;
            }
          }
          if (surahFileDone) break;
        }
        idx = isRange ? rangeLo : 0;
        // Every URL failing instantly must not spin an endless loop forever.
        if (infiniteLoop && Date.now() - passStartedAt < 400) break;
      }

      if (sessionRef.current === gen) {
        const finishedNaturally = !stopRef.current;
        playingRef.current = false;
        nativeSetQuranPlaying(false);
        void releaseWakeLock();
        clearMediaSession();
        setPlaying(false);
        setRepeatPass(1);
        setStatus("");
        setActiveWordIndex(-1);
        setActiveBismillahWordIndex(-1);
        setIsPlayingBismillah(false);
        // Guard against instant-failure loops (every URL erroring) so a broken
        // network can't chain-navigate through the whole mushaf.
        if (finishedNaturally && Date.now() - playStartedAt > 3000) {
          onPlaybackFinishedRef.current?.();
        }
      }
    },
    [
      ensureAudioLoaded,
      repeatScope,
      repeatCount,
      rangeStart,
      rangeEnd,
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
    playbackMode,
    surahAudioAvailable,
    activeWordIndex,
    activeBismillahWordIndex,
    isPlayingBismillah,
    pause,
    playFromIndex,
    togglePlay,
    setPlayIndex,
  };
}
