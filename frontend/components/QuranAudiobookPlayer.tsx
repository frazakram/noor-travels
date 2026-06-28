"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LangProvider";
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
import type { TranslationLang } from "@/app/quran/[surah]/page";

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
  audio: string;
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
};

export function QuranAudiobookPlayer({ surahNumber, surahName }: Props) {
  const { lang } = useLang();
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [reciter, setReciter] = useState("ar.alafasy");
  const [translationLang, setTranslationLang] = useState<TranslationLang>("en");
  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [includeTafsir, setIncludeTafsir] = useState(false);
  const [audioAyahs, setAudioAyahs] = useState<AudioAyah[]>([]);
  const [textAyahs, setTextAyahs] = useState<TextAyah[]>([]);
  const [translationAudioInfo, setTranslationAudioInfo] = useState<TranslationAudioInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState("");
  const stopRef = useRef(false);
  const sessionRef = useRef(0);

  useEffect(() => {
    const savedReciter = localStorage.getItem("noor-reciter");
    const savedTr = localStorage.getItem("noor-quran-translation") as TranslationLang | null;
    if (savedReciter) setReciter(savedReciter);
    if (savedTr && ["en", "ur", "hi"].includes(savedTr)) setTranslationLang(savedTr);
    const incTr = localStorage.getItem("noor-audio-translation");
    const incTf = localStorage.getItem("noor-audio-tafsir");
    if (incTr !== null) setIncludeTranslation(incTr === "1");
    if (incTf !== null) setIncludeTafsir(incTf === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("noor-reciter", reciter);
  }, [reciter]);

  useEffect(() => {
    localStorage.setItem("noor-quran-translation", translationLang);
    localStorage.setItem("noor-audio-translation", includeTranslation ? "1" : "0");
    localStorage.setItem("noor-audio-tafsir", includeTafsir ? "1" : "0");
  }, [translationLang, includeTranslation, includeTafsir]);

  const loadSurah = useCallback(async () => {
    setLoading(true);
    invalidatePlaybackSession();
    setPlaying(false);
    setCurrentIndex(0);
    stopRef.current = true;
    try {
      const trParam = includeTranslation ? `&translation_lang=${translationLang}` : "";
      const [editions, audio, text] = await Promise.all([
        api<{ reciters: Reciter[]; default: string }>("/api/quran/audio/editions"),
        api<{
          ayahs: AudioAyah[];
          reciter_name: string;
          translation_audio_info?: TranslationAudioInfo;
        }>(`/api/quran/audio/surahs/${surahNumber}?reciter=${encodeURIComponent(reciter)}${trParam}`),
        api<{ ayahs: TextAyah[]; surah: { name_en: string } }>(
          `/api/quran/surahs/${surahNumber}?translation=${translationLang}`
        ),
      ]);
      setReciters(editions.reciters);
      setAudioAyahs(audio.ayahs);
      setTranslationAudioInfo(audio.translation_audio_info ?? null);
      setTextAyahs(text.ayahs);
    } finally {
      setLoading(false);
      stopRef.current = false;
    }
  }, [surahNumber, reciter, translationLang, includeTranslation]);

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
    const source = translationLang === "ur" ? "maududi_ur" : "ibn_kathir_en";
    try {
      const row = await api<{ text: string }>(
        `/api/quran/ayahs/${verseKey}/tafsir?source=${source}`
      );
      return truncateForSpeech(row.text);
    } catch {
      return "";
    }
  }

  async function playFromIndex(start: number) {
    stopRef.current = false;
    const gen = beginPlaybackSession();
    sessionRef.current = gen;
    setPlaying(true);

    for (let i = start; i < audioAyahs.length; i++) {
      if (stopRef.current || sessionRef.current !== gen) break;

      const audio = audioAyahs[i];
      const text = textAyahs[i];
      if (!audio?.audio || !text) continue;

      setCurrentIndex(i);

      // Prefetch tafsir while Arabic + translation play (do not speak yet)
      const tafsirPromise =
        includeTafsir && !stopRef.current ? fetchTafsirText(text.verse_key) : null;

      // 1) Arabic recitation
      setStatus(`${text.verse_key} — ${t(lang, "arabic")}`);
      stopAllPlayback();
      try {
        await playAudioUrl(audio.audio, gen);
      } catch {
        /* skip broken ayah audio */
      }
      if (stopRef.current || sessionRef.current !== gen) break;

      // 2) Translation (human MP3 when available, else TTS)
      if (includeTranslation) {
        const tr = getTranslation(text);
        if (tr) {
          setStatus(`${text.verse_key} — ${t(lang, "translation")}`);
          stopAllPlayback();
          await playSpokenText(tr, translationLang, audio.translation_audio, gen);
        }
      }
      if (stopRef.current || sessionRef.current !== gen) break;

      // 3) Tafsir — always after recitation + translation
      if (includeTafsir && tafsirPromise) {
        setStatus(`${text.verse_key} — ${t(lang, "tafsir")}`);
        const tf = await tafsirPromise;
        if (stopRef.current || sessionRef.current !== gen) break;
        if (tf) {
          stopAllPlayback();
          await playSpokenText(tf, translationLang, null, gen);
        }
      }
    }

    if (sessionRef.current === gen) {
      setPlaying(false);
      setStatus("");
    }
  }

  function handlePlay() {
    stopRef.current = false;
    playFromIndex(currentIndex);
  }

  function handlePause() {
    stopRef.current = true;
    invalidatePlaybackSession();
    setPlaying(false);
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

  const translationSourceLabel =
    translationLang === "hi"
      ? t(lang, "translationAudioTtsFallback")
      : translationAudioInfo?.name
        ? t(lang, "translationAudioHuman")
        : "";

  if (loading) {
    return <p className="text-noor-600">{t(lang, "loading")}</p>;
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
              disabled={playing}
            />
            {t(lang, "includeTafsir")}
          </label>
        </div>

        {includeTafsir && (
          <p className="text-xs text-noor-500">{t(lang, "tafsirAudioHint")}</p>
        )}

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
