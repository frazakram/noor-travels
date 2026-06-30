"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useLang } from "@/components/LangProvider";
import { IconButton, Icons } from "@/components/IconButton";
import { useSurahAudio, type RepeatScope } from "@/hooks/useSurahAudio";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cleanQuranText, displaySurahName } from "@/lib/quran-display";
import type { Ayah, TranslationLang } from "@/lib/quran-types";
import { sourcesForPref, type TafsirPref, type TafsirSource } from "@/lib/tafsir";

const MAX_REPEAT = 5;
const MAX_SURAH = 114;

type TafsirRow = { verse_key: string; source: string; text: string };

export default function SurahClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const surahNumber = Number(params.surah);
  const startAyah = Math.max(1, Number(searchParams.get("ayah")) || 1);
  const { lang } = useLang();

  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [surahName, setSurahName] = useState("");
  const [translation, setTranslation] = useState<TranslationLang>("en");
  const [showRoman, setShowRoman] = useState(true);
  const [showHiRoman, setShowHiRoman] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, { ibn_kathir_en?: string; maududi_ur?: string }>>({});
  const [loadingTafsir, setLoadingTafsir] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  const [repeatTotal, setRepeatTotal] = useState(1);
  const [repeatCurrent, setRepeatCurrent] = useState(1);
  const [tafsirPref, setTafsirPref] = useState<TafsirPref>("en");

  const [reciter, setReciter] = useState("ar.alafasy");
  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [includeTafsir, setIncludeTafsir] = useState(false);
  const [tafsirSource, setTafsirSource] = useState<TafsirSource>("ibn_kathir_en");
  const [repeatScope, setRepeatScope] = useState<RepeatScope>("ayah");
  const [audioRepeatCount, setAudioRepeatCount] = useState(1);
  const [showAudioOpts, setShowAudioOpts] = useState(false);

  const ayahRefs = useRef<Record<string, HTMLElement | null>>({});

  const scrollToAyah = useCallback(
    (index: number) => {
      if (studyMode || index < 0 || index >= ayahs.length) return;
      const key = ayahs[index]?.verse_key;
      if (!key) return;
      requestAnimationFrame(() => {
        ayahRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [studyMode, ayahs]
  );

  const audio = useSurahAudio({
    surahNumber,
    translation,
    textAyahs: ayahs,
    reciter,
    includeTranslation,
    includeTafsir,
    tafsirSource,
    repeatScope,
    repeatCount: audioRepeatCount,
    onPlayIndex: (i) => setViewIndex(i),
  });

  useEffect(() => {
    if (ayahs.length === 0) return;
    scrollToAyah(viewIndex);
  }, [viewIndex, ayahs.length, scrollToAyah]);

  useEffect(() => {
    const saved = localStorage.getItem("noor-quran-translation") as TranslationLang | null;
    if (saved && ["en", "ur", "hi"].includes(saved)) setTranslation(saved);
    const savedStudy = localStorage.getItem("noor-quran-study-mode");
    if (savedStudy === "1") setStudyMode(true);
    const savedRepeat = Number(localStorage.getItem("noor-quran-study-repeat"));
    if (savedRepeat >= 1 && savedRepeat <= MAX_REPEAT) setRepeatTotal(savedRepeat);
    const savedTafsir = localStorage.getItem("noor-quran-tafsir-pref");
    if (savedTafsir === "en" || savedTafsir === "ur" || savedTafsir === "both") {
      setTafsirPref(savedTafsir);
    }
    const savedReciter = localStorage.getItem("noor-reciter");
    if (savedReciter) setReciter(savedReciter);
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
    const savedAudioRepeat = Number(localStorage.getItem("noor-audio-repeat-count"));
    if (savedAudioRepeat >= 1 && savedAudioRepeat <= MAX_REPEAT) {
      setAudioRepeatCount(savedAudioRepeat);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("noor-quran-translation", translation);
    localStorage.setItem("noor-quran-study-mode", studyMode ? "1" : "0");
    localStorage.setItem("noor-quran-study-repeat", String(repeatTotal));
    localStorage.setItem("noor-quran-tafsir-pref", tafsirPref);
    localStorage.setItem("noor-reciter", reciter);
    localStorage.setItem("noor-audio-translation", includeTranslation ? "1" : "0");
    localStorage.setItem("noor-audio-tafsir", includeTafsir ? "1" : "0");
    localStorage.setItem("noor-audio-tafsir-source", tafsirSource);
    localStorage.setItem("noor-audio-repeat-scope", repeatScope);
    localStorage.setItem("noor-audio-repeat-count", String(audioRepeatCount));
  }, [
    translation,
    studyMode,
    repeatTotal,
    tafsirPref,
    reciter,
    includeTranslation,
    includeTafsir,
    tafsirSource,
    repeatScope,
    audioRepeatCount,
  ]);

  useEffect(() => {
    setExpanded({});
  }, [tafsirPref, surahNumber]);

  useEffect(() => {
    const idx = Math.max(0, startAyah - 1);
    setViewIndex(idx);
    setRepeatCurrent(1);
    api<{ surah: { name_en: string }; ayahs: Ayah[] }>(
      `/api/quran/surahs/${surahNumber}?translation=${translation}`
    ).then((d) => {
      setSurahName(displaySurahName(surahNumber, d.surah.name_en));
      setAyahs(d.ayahs);
      setViewIndex(Math.min(idx, Math.max(0, d.ayahs.length - 1)));
    });
  }, [surahNumber, translation, startAyah]);

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
      const sources = sourcesForPref(tafsirPref);
      const rows = await Promise.all(
        sources.map((source) =>
          api<TafsirRow>(`/api/quran/ayahs/${verseKey}/tafsir?source=${source}`).catch(() => null)
        )
      );
      setExpanded((e) => ({
        ...e,
        [verseKey]: {
          ibn_kathir_en: rows.find((r) => r?.source === "ibn_kathir_en")?.text,
          maududi_ur: rows.find((r) => r?.source === "maududi_ur")?.text,
        },
      }));
    } finally {
      setLoadingTafsir(null);
    }
  }

  function displayTranslation(a: Ayah): string {
    if (a.translation) return cleanQuranText(a.translation);
    if (translation === "ur") return cleanQuranText(a.translation_ur);
    if (translation === "hi") return cleanQuranText(a.translation_hi || "");
    return cleanQuranText(a.translation_en);
  }

  function goToAyah(index: number) {
    audio.pause();
    setViewIndex(index);
    setRepeatCurrent(1);
  }

  function handleStudyRepeat() {
    if (repeatCurrent < repeatTotal) {
      setRepeatCurrent((r) => r + 1);
      return;
    }
    if (viewIndex < ayahs.length - 1) goToAyah(viewIndex + 1);
  }

  function playAyah(index: number) {
    if (audio.playing && audio.playIndex === index) {
      audio.pause();
    } else {
      audio.pause();
      setViewIndex(index);
      audio.playFromIndex(index);
    }
  }

  const activeIndex = audio.playing ? audio.playIndex : viewIndex;
  const visibleAyahs = studyMode && ayahs.length ? [ayahs[viewIndex]] : ayahs;

  return (
    <div className="space-y-4">
      <Link
        href="/quran"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-heading"
      >
        {Icons.back} {t(lang, "backToQuran")}
      </Link>

      <div className="card sticky-below-header space-y-3 sticky-toolbar py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-heading">
            {surahNumber}. {surahName}
          </h1>
          <span className="text-xs text-faint">
            {ayahs.length ? `${activeIndex + 1}/${ayahs.length}` : "—"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {surahNumber > 1 && (
            <IconButton
              icon={Icons.prevSurah}
              label={t(lang, "prevSurah")}
              href={`/quran/${surahNumber - 1}`}
            />
          )}
          <IconButton
            icon={Icons.prevAyah}
            label={t(lang, "prevAyah")}
            disabled={viewIndex === 0}
            onClick={() => goToAyah(Math.max(0, viewIndex - 1))}
          />
          <IconButton
            icon={audio.playing ? Icons.pause : Icons.play}
            label={audio.playing ? t(lang, "pause") : t(lang, "play")}
            variant="primary"
            active={audio.playing}
            onClick={() => audio.togglePlay(viewIndex)}
          />
          <IconButton
            icon={Icons.nextAyah}
            label={t(lang, "nextAyah")}
            disabled={viewIndex >= ayahs.length - 1}
            onClick={() => goToAyah(Math.min(ayahs.length - 1, viewIndex + 1))}
          />
          {surahNumber < MAX_SURAH && (
            <IconButton
              icon={Icons.nextSurah}
              label={t(lang, "nextSurah")}
              href={`/quran/${surahNumber + 1}`}
            />
          )}
          {audio.audioLoading && (
            <span className="text-xs text-faint">{t(lang, "loading")}…</span>
          )}
          {audio.status && <span className="text-xs text-accent">{audio.status}</span>}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-x-auto border-t border-subtle pt-3">
          <span className="shrink-0 text-xs text-faint">{t(lang, "translation")}</span>
          {(["en", "ur", "hi"] as TranslationLang[]).map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => setTranslation(tr)}
              disabled={audio.playing}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium uppercase ${
                translation === tr
                  ? "bg-noor-700 text-white dark:bg-noor-600"
                  : "border border-noor-200 text-muted dark:border-noor-600"
              }`}
            >
              {tr}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAudioOpts((v) => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-muted"
            aria-expanded={showAudioOpts}
          >
            {Icons.repeat} {showAudioOpts ? "▾" : "▸"}
          </button>
        </div>

        {showAudioOpts && (
          <div className="space-y-2 rounded-lg border border-subtle bg-surface-muted p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted">{t(lang, "reciter")}</label>
              <select
                className="input max-w-[200px] py-1 text-xs"
                value={reciter}
                onChange={(e) => setReciter(e.target.value)}
                disabled={audio.playing}
              >
                {(audio.reciters.length ? audio.reciters : [{ id: reciter, name: reciter }]).map(
                  (r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  )
                )}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeTranslation}
                onChange={(e) => setIncludeTranslation(e.target.checked)}
                disabled={audio.playing}
              />
              {t(lang, "includeTranslation")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeTafsir}
                onChange={(e) => setIncludeTafsir(e.target.checked)}
                disabled={audio.playing}
              />
              {t(lang, "includeTafsir")}
            </label>
            {includeTafsir && (
              <select
                className="input py-1 text-xs"
                value={tafsirSource}
                onChange={(e) => setTafsirSource(e.target.value as TafsirSource)}
                disabled={audio.playing}
              >
                <option value="ibn_kathir_en">{t(lang, "tafsirEnglishOption")}</option>
                <option value="maududi_ur">{t(lang, "tafsirUrduOption")}</option>
              </select>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={audio.playing}
                onClick={() => setRepeatScope("ayah")}
                className={`rounded-md px-2 py-0.5 text-xs ${
                  repeatScope === "ayah"
                    ? "bg-noor-700 text-white dark:bg-noor-600"
                    : "border border-noor-200 dark:border-noor-600"
                }`}
              >
                {Icons.repeat} {t(lang, "repeatAyah")}
              </button>
              <button
                type="button"
                disabled={audio.playing}
                onClick={() => setRepeatScope("surah")}
                className={`rounded-md px-2 py-0.5 text-xs ${
                  repeatScope === "surah"
                    ? "bg-noor-700 text-white dark:bg-noor-600"
                    : "border border-noor-200 dark:border-noor-600"
                }`}
              >
                {Icons.repeat} {t(lang, "repeatSurah")}
              </button>
              {Array.from({ length: MAX_REPEAT }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={audio.playing}
                  onClick={() => setAudioRepeatCount(n)}
                  className={`h-7 w-7 rounded-full text-xs ${
                    audioRepeatCount === n
                      ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                      : "border border-noor-200 dark:border-noor-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-subtle pt-3">
          <span className="text-xs text-faint">
            {Icons.tafsir} {t(lang, "tafsirLanguage")}
          </span>
          {(
            [
              ["en", "tafsirEnglishOption"],
              ["ur", "tafsirUrduOption"],
              ["both", "tafsirBothOption"],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTafsirPref(value)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
                tafsirPref === value
                  ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                  : "border border-noor-200 text-muted dark:border-noor-600"
              }`}
            >
              {t(lang, labelKey)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            icon={Icons.book}
            label={t(lang, "allAyahs")}
            active={!studyMode}
            onClick={() => {
              setStudyMode(false);
              setRepeatCurrent(1);
            }}
          />
          <IconButton
            icon={Icons.ayah}
            label={t(lang, "ayahByAyah")}
            active={studyMode}
            onClick={() => {
              setStudyMode(true);
              setRepeatCurrent(1);
            }}
          />
          {studyMode && (
            <>
              {Array.from({ length: MAX_REPEAT }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setRepeatTotal(n);
                    setRepeatCurrent(1);
                  }}
                  className={`h-7 w-7 rounded-full text-xs font-medium ${
                    repeatTotal === n
                      ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                      : "border border-noor-200 text-muted dark:border-noor-600"
                  }`}
                >
                  {n}
                </button>
              ))}
              <IconButton
                icon={Icons.repeat}
                label={`${t(lang, "repeat")} ${repeatCurrent}/${repeatTotal}`}
                variant="gold"
                onClick={handleStudyRepeat}
                disabled={viewIndex >= ayahs.length - 1 && repeatCurrent >= repeatTotal}
              />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted">
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
        {visibleAyahs.filter(Boolean).map((a) => {
          const idx = ayahs.findIndex((x) => x.verse_key === a.verse_key);
          const isActive = idx === activeIndex;
          const isPlaying = audio.playing && idx === audio.playIndex;
          return (
            <article
              key={studyMode ? `${a.verse_key}-${viewIndex}` : a.verse_key}
              ref={(el) => {
                ayahRefs.current[a.verse_key] = el;
              }}
              className={`card scroll-mt-28 transition-all duration-300 md:scroll-mt-24 ${
                isActive
                  ? "scale-[1.008] ring-2 ring-gold-400 shadow-md dark:ring-gold-500"
                  : "hover:border-noor-200 dark:hover:border-noor-600"
              } ${studyMode ? "animate-fade-in-up" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-accent">{a.verse_key}</p>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    icon={isPlaying ? Icons.pause : Icons.play}
                    label={t(lang, "listenThisAyah")}
                    variant="gold"
                    active={isPlaying}
                    tipSide="top"
                    onClick={() => playAyah(idx)}
                  />
                  <IconButton
                    icon={Icons.tafsir}
                    label={expanded[a.verse_key] ? t(lang, "hideTafsir") : t(lang, "showTafsir")}
                    active={!!expanded[a.verse_key]}
                    tipSide="top"
                    onClick={() => toggleTafsir(a.verse_key)}
                  />
                </div>
              </div>
              <p className="font-arabic mt-2 text-right text-xl" dir="rtl">
                {a.arabic}
              </p>
              {showRoman && a.transliteration && (
                <p className="mt-2 text-sm italic text-faint" dir="ltr">
                  {a.transliteration}
                </p>
              )}
              <p
                className="mt-3 text-sm leading-relaxed text-body"
                dir={translation === "ur" ? "rtl" : "ltr"}
              >
                {displayTranslation(a)}
              </p>
              {translation === "hi" && showHiRoman && a.transliteration_hi && (
                <p className="mt-2 text-xs italic text-faint" dir="ltr">
                  {t(lang, "hindiRoman")}: {a.transliteration_hi}
                </p>
              )}
              {loadingTafsir === a.verse_key && (
                <p className="mt-2 text-xs text-faint">{t(lang, "loading")}…</p>
              )}
              {expanded[a.verse_key] && (
                <div className="mt-3 space-y-3 border-t border-subtle pt-3">
                  {(tafsirPref === "en" || tafsirPref === "both") &&
                    expanded[a.verse_key].ibn_kathir_en && (
                      <div>
                        <p className="text-xs font-semibold text-accent">
                          {t(lang, "tafsirIbnKathir")}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-body" dir="ltr">
                          {expanded[a.verse_key].ibn_kathir_en}
                        </p>
                      </div>
                    )}
                  {(tafsirPref === "ur" || tafsirPref === "both") &&
                    expanded[a.verse_key].maududi_ur && (
                      <div>
                        <p className="text-xs font-semibold text-accent">
                          {t(lang, "tafsirMaududi")}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-body" dir="rtl">
                          {expanded[a.verse_key].maududi_ur}
                        </p>
                      </div>
                    )}
                  {((tafsirPref === "en" && !expanded[a.verse_key].ibn_kathir_en) ||
                    (tafsirPref === "ur" && !expanded[a.verse_key].maududi_ur) ||
                    (tafsirPref === "both" &&
                      !expanded[a.verse_key].ibn_kathir_en &&
                      !expanded[a.verse_key].maududi_ur)) && (
                    <p className="text-sm text-faint">{t(lang, "tafsirNotAvailable")}</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
