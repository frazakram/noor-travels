"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/LangProvider";
import { LoadingGlass } from "@/components/LoadingGlass";
import { startRouteProgress } from "@/components/NavigationProgress";
import { api } from "@/lib/api";
import {
  beginPlaybackSession,
  invalidatePlaybackSession,
  playAudioUrl,
  playSpokenText,
  stopAllPlayback,
  truncateForSpeech,
} from "@/lib/quran-audio";
import { t } from "@/lib/i18n";
import { speechLangForSource, type TafsirSource } from "@/lib/tafsir";
import type { TranslationLang } from "@/lib/quran-types";

const MAX_REPEAT = 5;
const MAX_SURAH = 114;

type RepeatScope = "ayah" | "surah";

type Reciter = { id: string; name: string };

type TranslationAudioInfo = {
  id?: string;
  name?: string;
  source?: string;
  fallback?: string;
};

type AudioAyah = {
  ayah_number: number;
  verse_key: string;
  audio: string | null;
  translation_audio?: string | null;
};

type TextAyah = {
  ayah_number: number;
  verse_key: string;
  arabic: string;
  translation?: string;
  translation_en: string;
  translation_ur: string;
  translation_hi?: string;
};

type Props = {
  surahNumber: number;
  surahName?: string;
  startAyah?: number;
};

export function QuranAudiobookPlayer({ surahNumber, surahName, startAyah = 1 }: Props) {
  const { lang } = useLang();
  const router = useRouter();
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [reciter, setReciter] = useState("ar.alafasy");
  const [translationLang, setTranslationLang] = useState<TranslationLang>("en");
  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [includeTafsir, setIncludeTafsir] = useState(false);
  const [tafsirSource, setTafsirSource] = useState<TafsirSource>("ibn_kathir_en");
  const [repeatScope, setRepeatScope] = useState<RepeatScope>("ayah");
  const [repeatCount, setRepeatCount] = useState(1);
  const [audioAyahs, setAudioAyahs] = useState<AudioAyah[]>([]);
  const [textAyahs, setTextAyahs] = useState<TextAyah[]>([]);
  const [translationAudioInfo, setTranslationAudioInfo] = useState<TranslationAudioInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [repeatPass, setRepeatPass] = useState(1);
  const [status, setStatus] = useState("");
  const [playbackMode, setPlaybackMode] = useState<"ayah" | "surah">("ayah");
  const [surahAudioAvailable, setSurahAudioAvailable] = useState(true);
  const [bismillahAudio, setBismillahAudio] = useState<string | null>(null);
  const [needsBismillah, setNeedsBismillah] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const stopRef = useRef(false);
  const sessionRef = useRef(0);
  const surahArabicPlayedRef = useRef<string | null>(null);
  const bismillahPlayedRef = useRef(false);
  const includeTafsirRef = useRef(includeTafsir);
  const includeTranslationRef = useRef(includeTranslation);
  const tafsirSourceRef = useRef(tafsirSource);
  const translationLangRef = useRef(translationLang);
  const currentIndexRef = useRef(0);
  includeTafsirRef.current = includeTafsir;
  includeTranslationRef.current = includeTranslation;
  tafsirSourceRef.current = tafsirSource;
  translationLangRef.current = translationLang;

  useEffect(() => {
    const savedReciter = localStorage.getItem("noor-reciter");
    const savedTr = localStorage.getItem("noor-quran-translation") as TranslationLang | null;
    if (savedReciter) setReciter(savedReciter);
    if (savedTr && ["en", "ur", "hi"].includes(savedTr)) setTranslationLang(savedTr);
    const incTr = localStorage.getItem("noor-audio-translation");
    const incTf = localStorage.getItem("noor-audio-tafsir");
    if (incTr !== null) setIncludeTranslation(incTr === "1");
    if (incTf !== null) setIncludeTafsir(incTf === "1");
    const savedTafsirSource = localStorage.getItem("noor-audio-tafsir-source");
    if (savedTafsirSource === "ibn_kathir_en" || savedTafsirSource === "maududi_ur") {
      setTafsirSource(savedTafsirSource);
    }
    const savedScope = localStorage.getItem("noor-audio-repeat-scope");
    if (savedScope === "ayah" || savedScope === "surah") setRepeatScope(savedScope);
    const savedRepeat = Number(localStorage.getItem("noor-audio-repeat-count"));
    if (savedRepeat >= 1 && savedRepeat <= MAX_REPEAT) setRepeatCount(savedRepeat);
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    localStorage.setItem("noor-reciter", reciter);
  }, [prefsHydrated, reciter]);

  useEffect(() => {
    if (!prefsHydrated) return;
    localStorage.setItem("noor-quran-translation", translationLang);
    localStorage.setItem("noor-audio-translation", includeTranslation ? "1" : "0");
    localStorage.setItem("noor-audio-tafsir", includeTafsir ? "1" : "0");
    localStorage.setItem("noor-audio-repeat-scope", repeatScope);
    localStorage.setItem("noor-audio-repeat-count", String(repeatCount));
    localStorage.setItem("noor-audio-tafsir-source", tafsirSource);
  }, [prefsHydrated, translationLang, includeTranslation, includeTafsir, repeatScope, repeatCount, tafsirSource]);

  const loadSurah = useCallback(async () => {
    setLoading(true);
    invalidatePlaybackSession();
    setPlaying(false);
    setRepeatPass(1);
    stopRef.current = true;
    try {
      const trParam = includeTranslation ? `&translation_lang=${translationLang}` : "";
      const [editions, audio, text] = await Promise.all([
        api<{ reciters: Reciter[]; default: string }>("/api/quran/audio/editions"),
        api<{
          ayahs: AudioAyah[];
          reciter_name: string;
          playback_mode?: "ayah" | "surah";
          surah_audio_available?: boolean;
          translation_audio_info?: TranslationAudioInfo;
          bismillah_audio?: string | null;
          needs_bismillah?: boolean;
        }>(`/api/quran/audio/surahs/${surahNumber}?reciter=${encodeURIComponent(reciter)}${trParam}`),
        api<{ ayahs: TextAyah[]; surah: { name_en: string } }>(
          `/api/quran/surahs/${surahNumber}?translation=${translationLang}`
        ),
      ]);
      setReciters(
        (editions.reciters || []).filter(
          (r, i, arr) =>
            r?.id &&
            !r.id.endsWith("-2") &&
            arr.findIndex((x) => x.id === r.id) === i &&
            arr.findIndex((x) => (x.name || "").toLowerCase() === (r.name || "").toLowerCase()) === i
        )
      );
      setPlaybackMode(audio.playback_mode ?? "ayah");
      setSurahAudioAvailable(audio.surah_audio_available ?? true);
      setBismillahAudio(audio.bismillah_audio ?? null);
      setNeedsBismillah(Boolean(audio.needs_bismillah && audio.bismillah_audio));
      surahArabicPlayedRef.current = null;
      bismillahPlayedRef.current = false;
      setAudioAyahs(audio.ayahs);
      setTranslationAudioInfo(audio.translation_audio_info ?? null);
      setTextAyahs(text.ayahs);
      const idx = Math.max(0, Math.min(audio.ayahs.length - 1, startAyah - 1));
      setCurrentIndex(idx);
    } finally {
      setLoading(false);
      stopRef.current = false;
    }
  }, [surahNumber, reciter, translationLang, includeTranslation, startAyah]);

  useEffect(() => {
    loadSurah();
    return () => {
      stopRef.current = true;
      invalidatePlaybackSession();
    };
  }, [loadSurah]);

  function getTranslation(a: TextAyah): string {
    if (a.translation) return a.translation;
    if (translationLang === "ur") return a.translation_ur;
    if (translationLang === "hi") return a.translation_hi || a.translation_en;
    return a.translation_en;
  }

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

  async function playSingleAyah(i: number, gen: number, passLabel?: string) {
    const audio = audioAyahs[i];
    const text = textAyahs[i];
    if (!audio?.audio || !text) return;

    setCurrentIndex(i);
    currentIndexRef.current = i;

    const wantTafsir = includeTafsirRef.current;
    const tafsirPromise =
      wantTafsir && !stopRef.current ? fetchTafsirText(text.verse_key) : null;

    const prefix = passLabel ? `${passLabel} · ` : "";

    setStatus(`${prefix}${text.verse_key} — ${t(lang, "arabic")}`);
    stopAllPlayback();
    if (i === 0 && needsBismillah && bismillahAudio && !bismillahPlayedRef.current) {
      bismillahPlayedRef.current = true;
      setStatus(`${prefix}Bismillah`);
      try {
        await playAudioUrl(bismillahAudio, gen);
      } catch {
        /* Continue with the ayah if the optional clip fails. */
      }
      if (stopRef.current || sessionRef.current !== gen) return;
      stopAllPlayback();
      setStatus(`${prefix}${text.verse_key} — ${t(lang, "arabic")}`);
    }
    const skipSurahReplay =
      playbackMode === "surah" && audio.audio && surahArabicPlayedRef.current === audio.audio;
    if (audio.audio && !skipSurahReplay) {
      surahArabicPlayedRef.current = audio.audio;
      try {
        await playAudioUrl(audio.audio, gen);
      } catch {
        /* skip broken ayah audio */
      }
    }
    if (stopRef.current || sessionRef.current !== gen) return;

    if (includeTranslationRef.current) {
      const tr = getTranslation(text);
      if (tr) {
        setStatus(`${prefix}${text.verse_key} — ${t(lang, "translation")}`);
        stopAllPlayback();
        await playSpokenText(tr, translationLangRef.current, audio.translation_audio, gen);
      }
    }
    if (stopRef.current || sessionRef.current !== gen) return;

    if (includeTafsirRef.current) {
      const tf = tafsirPromise ? await tafsirPromise : await fetchTafsirText(text.verse_key);
      if (stopRef.current || sessionRef.current !== gen) return;
      if (tf) {
        setStatus(`${prefix}${text.verse_key} — ${t(lang, "tafsir")}`);
        stopAllPlayback();
        await playSpokenText(tf, speechLangForSource(tafsirSourceRef.current), null, gen);
      }
    }
  }

  async function playFromIndex(start: number) {
    stopRef.current = false;
    surahArabicPlayedRef.current = null;
    bismillahPlayedRef.current = false;
    const gen = beginPlaybackSession();
    sessionRef.current = gen;
    setPlaying(true);

    const surahPasses = repeatScope === "surah" ? repeatCount : 1;
    const ayahRepeats = repeatScope === "ayah" ? repeatCount : 1;

    for (let pass = 1; pass <= surahPasses; pass++) {
      if (stopRef.current || sessionRef.current !== gen) break;
      if (repeatScope === "surah" && surahPasses > 1) {
        setRepeatPass(pass);
      }
      if (pass > 1) {
        surahArabicPlayedRef.current = null;
        bismillahPlayedRef.current = false;
      }

      const passLabel =
        repeatScope === "surah" && surahPasses > 1
          ? `${t(lang, "repeatPass")} ${pass}/${surahPasses}`
          : undefined;

      for (let i = start; i < audioAyahs.length; i++) {
        if (stopRef.current || sessionRef.current !== gen) break;

        for (let r = 1; r <= ayahRepeats; r++) {
          if (stopRef.current || sessionRef.current !== gen) break;

          const ayahLabel =
            repeatScope === "ayah" && ayahRepeats > 1
              ? `${t(lang, "repeatPass")} ${r}/${ayahRepeats}`
              : passLabel;

          await playSingleAyah(i, gen, ayahLabel);
        }
      }

      start = 0;
    }

    if (sessionRef.current === gen) {
      setPlaying(false);
      setRepeatPass(1);
      setStatus("");
    }
  }

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  function handlePlay() {
    stopRef.current = false;
    playFromIndex(currentIndex);
  }

  function handlePause() {
    stopRef.current = true;
    invalidatePlaybackSession();
    setPlaying(false);
    setRepeatPass(1);
    setStatus("");
  }

  function handlePrev() {
    handlePause();
    setCurrentIndex((i) => Math.max(0, i - 1));
  }

  function handleNext() {
    handlePause();
    setCurrentIndex((i) => Math.min(audioAyahs.length - 1, i + 1));
  }

  function goToSurah(next: number) {
    handlePause();
    startRouteProgress();
    router.push(`/quran/listen/${next}`);
  }

  const translationSourceLabel =
    translationLang === "hi"
      ? t(lang, "translationAudioTtsFallback")
      : translationAudioInfo?.name
        ? t(lang, "translationAudioHuman")
        : "";

  if (loading) {
    return <LoadingGlass size="md" label={t(lang, "loading")} />;
  }

  const current = textAyahs[currentIndex];

  return (
    <div className="space-y-5">
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-noor-800">
            {surahNumber}. {surahName || t(lang, "audiobook")}
          </h2>
          <Link href="/quran/listen" className="text-sm text-noor-600 underline hover:text-noor-800">
            {t(lang, "changeSurah")}
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-noor-200 px-3 py-1.5 text-sm disabled:opacity-40"
            onClick={() => goToSurah(surahNumber - 1)}
            disabled={surahNumber <= 1 || playing}
          >
            ← {t(lang, "prevSurah")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-noor-200 px-3 py-1.5 text-sm disabled:opacity-40"
            onClick={() => goToSurah(surahNumber + 1)}
            disabled={surahNumber >= MAX_SURAH || playing}
          >
            {t(lang, "nextSurah")} →
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-noor-600">{t(lang, "reciter")}</span>
            <select
              className="input mt-1"
              value={reciter}
              onChange={(e) => setReciter(e.target.value)}
              disabled={playing}
            >
              {reciters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          {playbackMode === "surah" && (
            <p className="sm:col-span-2 text-xs text-muted">{t(lang, "reciterSurahMode")}</p>
          )}
          {playbackMode === "surah" && !surahAudioAvailable && (
            <p className="sm:col-span-2 text-xs text-amber-700 dark:text-amber-400">
              {t(lang, "reciterSurahUnavailable")}
            </p>
          )}

          <label className="block text-sm">
            <span className="text-noor-600">{t(lang, "translation")}</span>
            <select
              className="input mt-1"
              value={translationLang}
              onChange={(e) => setTranslationLang(e.target.value as TranslationLang)}
              disabled={playing}
            >
              <option value="en">{t(lang, "english")}</option>
              <option value="ur">{t(lang, "urdu")}</option>
              <option value="hi">{t(lang, "hindi")}</option>
            </select>
          </label>
        </div>

        {includeTranslation && translationSourceLabel && (
          <p className="text-xs text-noor-500">{translationSourceLabel}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeTranslation}
              onChange={(e) => setIncludeTranslation(e.target.checked)}
              disabled={playing}
            />
            {t(lang, "includeTranslation")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeTafsir}
              onChange={(e) => setIncludeTafsir(e.target.checked)}
            />
            {t(lang, "includeTafsir")}
          </label>
        </div>

        {includeTafsir && (
          <label className="block text-sm">
            <span className="text-noor-600">{t(lang, "tafsirLanguage")}</span>
            <select
              className="input mt-1"
              value={tafsirSource}
              onChange={(e) => setTafsirSource(e.target.value as TafsirSource)}
            >
              <option value="ibn_kathir_en">{t(lang, "tafsirIbnKathir")}</option>
              <option value="maududi_ur">{t(lang, "tafsirMaududi")}</option>
            </select>
          </label>
        )}

        {includeTafsir && (
          <p className="text-xs text-noor-500">{t(lang, "tafsirAudioHint")}</p>
        )}

        <div className="rounded-lg border border-noor-100 bg-noor-50/50 p-3 space-y-3">
          <p className="text-xs font-medium text-noor-700">{t(lang, "repeat")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={playing}
              onClick={() => setRepeatScope("ayah")}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                repeatScope === "ayah" ? "bg-noor-700 text-white" : "border border-noor-200 text-noor-600"
              }`}
            >
              {t(lang, "repeatAyah")}
            </button>
            <button
              type="button"
              disabled={playing}
              onClick={() => setRepeatScope("surah")}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                repeatScope === "surah" ? "bg-noor-700 text-white" : "border border-noor-200 text-noor-600"
              }`}
            >
              {t(lang, "repeatSurah")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-noor-500">{t(lang, "repeatTimes")}:</span>
            {Array.from({ length: MAX_REPEAT }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                disabled={playing}
                onClick={() => setRepeatCount(n)}
                className={`h-8 w-8 rounded-full text-xs font-medium ${
                  repeatCount === n ? "bg-gold-500 text-white" : "border border-noor-200 text-noor-600"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!playing ? (
            <button type="button" className="btn-primary" onClick={handlePlay}>
              {t(lang, "play")} {current ? `(${current.verse_key})` : ""}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handlePause}>
              {t(lang, "pause")}
            </button>
          )}
          <button
            type="button"
            className="rounded-xl border border-noor-200 px-4 py-2 text-sm"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            {t(lang, "prevAyah")}
          </button>
          <button
            type="button"
            className="rounded-xl border border-noor-200 px-4 py-2 text-sm"
            onClick={handleNext}
            disabled={currentIndex >= audioAyahs.length - 1}
          >
            {t(lang, "nextAyah")}
          </button>
          <span className="text-xs text-noor-500">
            {currentIndex + 1} / {audioAyahs.length}
            {playing && repeatScope === "surah" && repeatCount > 1 && (
              <> · {t(lang, "repeatPass")} {repeatPass}/{repeatCount}</>
            )}
          </span>
        </div>

        {status && <p className="text-sm text-gold-600">{status}</p>}
      </div>

      {current && (
        <article className={`card transition ring-2 ${playing ? "ring-gold-400" : "ring-transparent"}`}>
          <p className="text-xs font-medium text-gold-500">{current.verse_key}</p>
          <p className="font-arabic mt-2 text-right text-xl" dir="rtl">
            {current.arabic}
          </p>
          {includeTranslation && (
            <p
              className="mt-3 text-sm leading-relaxed text-noor-800"
              dir={translationLang === "en" ? "ltr" : "rtl"}
            >
              {getTranslation(current)}
            </p>
          )}
        </article>
      )}

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {textAyahs.map((a, idx) => (
          <button
            key={a.verse_key}
            type="button"
            onClick={() => {
              handlePause();
              setCurrentIndex(idx);
            }}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
              idx === currentIndex
                ? "border-noor-500 bg-noor-50"
                : "border-noor-100 hover:border-noor-200"
            }`}
          >
            <span className="font-medium text-noor-700">{a.verse_key}</span>
            <span className="ml-2 text-noor-500 line-clamp-1">{getTranslation(a)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
