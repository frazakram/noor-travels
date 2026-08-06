"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AutoplayToggle } from "@/components/AutoplayToggle";
import { AyahWordText, type AyahWord } from "@/components/AyahWordText";
import { useLang } from "@/components/LangProvider";
import { IconButton, Icons } from "@/components/IconButton";
import { emitPageLoading, startRouteProgress } from "@/components/NavigationProgress";
import { useSurahAudio, type RepeatScope } from "@/hooks/useSurahAudio";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { isBookmarked, saveLastRead, toggleBookmark } from "@/lib/quran-bookmarks";
import { cleanQuranText, displaySurahName, stripLeadingBismillah } from "@/lib/quran-display";
import { formatSurahDuration, getSurahDurations } from "@/lib/quran-durations";
import type { Ayah, TranslationLang } from "@/lib/quran-types";
import { sourcesForPref, type TafsirPref, type TafsirSource } from "@/lib/tafsir";

const MAX_REPEAT = 5;
const MAX_SURAH = 114;
const AYAH_RENDER_CHUNK = 18;
/** After the user scrolls during playback, resume auto-follow once idle this long. */
const FOLLOW_RESUME_MS = 5000;
const BISMILLAH_WORDS: AyahWord[] = [
  { ar: "بِسْمِ", tr: "Bismi", en: "In the name" },
  { ar: "ٱللَّهِ", tr: "Allāhi", en: "of Allah" },
  { ar: "ٱلرَّحْمَـٰنِ", tr: "ar-Raḥmāni", en: "the Most Gracious" },
  { ar: "ٱلرَّحِيمِ", tr: "ar-Raḥīm", en: "the Most Merciful" },
];

type TafsirRow = { verse_key: string; source: string; text: string };

export default function SurahClient() {
  const params = useParams();
  const router = useRouter();
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
  const [tafsirPref, setTafsirPref] = useState<TafsirPref>("en");

  const [reciter, setReciter] = useState("ar.alafasy");
  const [surahDurationSec, setSurahDurationSec] = useState<number | null>(null);
  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [includeTafsir, setIncludeTafsir] = useState(false);
  const [tafsirSource, setTafsirSource] = useState<TafsirSource>("ibn_kathir_en");
  const [repeatScope, setRepeatScope] = useState<RepeatScope>("ayah");
  const [audioRepeatCount, setAudioRepeatCount] = useState(1);
  // 1-based ayah numbers for the memorisation loop ("range" scope).
  // rangeEnd 0 = "last ayah of surah" until ayahs load (not a fixed 3-ayah window).
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [showAudioOpts, setShowAudioOpts] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [showTranslationText, setShowTranslationText] = useState(true);
  const [surahLoading, setSurahLoading] = useState(true);
  const [surahError, setSurahError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [renderLimit, setRenderLimit] = useState(AYAH_RENDER_CHUNK);
  const [wordsByVerse, setWordsByVerse] = useState<Record<string, AyahWord[]>>({});
  const [bookmarkedKeys, setBookmarkedKeys] = useState<Record<string, boolean>>({});

  const ayahRefs = useRef<Record<string, HTMLElement | null>>({});
  const bismillahRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastUserScrollAt = useRef(0);
  const programmaticScrollRef = useRef(false);
  const lastReadTimer = useRef<number | undefined>(undefined);
  const pendingScrollRef = useRef(false);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const isFollowingPlayback = useCallback(
    () => Date.now() - lastUserScrollAt.current > FOLLOW_RESUME_MS,
    []
  );

  const scrollToAyah = useCallback(
    (index: number) => {
      if (studyMode || index < 0 || index >= ayahs.length) return;
      if (!isFollowingPlayback()) return;
      const key = ayahs[index]?.verse_key;
      if (!key) return;
      // Progressive render: ensure the target ayah is mounted before scrolling.
      if (index >= renderLimit) {
        setRenderLimit((limit) => Math.min(ayahs.length, Math.max(limit, index + 6)));
      }
      programmaticScrollRef.current = true;
      requestAnimationFrame(() => {
        const el = ayahRefs.current[key];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        window.setTimeout(() => {
          programmaticScrollRef.current = false;
        }, 700);
      });
    },
    [studyMode, ayahs, renderLimit, isFollowingPlayback]
  );

  const audio = useSurahAudio({
    surahNumber,
    surahName: surahName || `Surah ${surahNumber}`,
    translation,
    textAyahs: ayahs,
    reciter,
    includeTranslation,
    includeTafsir,
    tafsirSource,
    repeatScope,
    repeatCount: audioRepeatCount,
    rangeStart: rangeStart - 1,
    rangeEnd: (rangeEnd < 1 ? ayahs.length || 1 : rangeEnd) - 1,
    playbackSpeed,
    onPlayIndex: (i) => {
      setViewIndex(i);
      if (isFollowingPlayback()) scrollToAyah(i);
    },
    onBismillahPlay: () => {
      if (!isFollowingPlayback()) return;
      programmaticScrollRef.current = true;
      requestAnimationFrame(() => {
        bismillahRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          programmaticScrollRef.current = false;
        }, 700);
      });
    },
    onPlaybackFinished: () => {
      // Memorisation loops end deliberately — never yank the user to a new surah.
      if (!autoPlayNext || repeatScope === "range") return;
      if (surahNumber >= MAX_SURAH) return;
      startRouteProgress();
      router.push(`/quran/${surahNumber + 1}?autoplay=1`);
    },
  });

  // ?autoplay=1 (set when auto-advancing surahs) starts playback once loaded.
  const autoPlayedRef = useRef(false);
  useEffect(() => {
    autoPlayedRef.current = false;
  }, [surahNumber]);
  useEffect(() => {
    if (autoPlayedRef.current || surahLoading || !ayahs.length) return;
    // Only honored when the user's own toggle is on — a shared ?autoplay=1
    // link must not chain-play (autoplay policy would silently skip every
    // ayah and cascade-navigate through the mushaf).
    if (!autoPlayNext || searchParams.get("autoplay") !== "1") return;
    autoPlayedRef.current = true;
    lastUserScrollAt.current = 0;
    void audio.playFromIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- audio changes every render; the ref guards re-entry
  }, [surahLoading, ayahs.length, autoPlayNext, searchParams]);

  // Follow playback; a user scroll pauses following, which resumes after a few
  // idle seconds (so trackpad-momentum or a stray touch never kills it for good).
  // Our own scrollIntoView is ignored via programmaticScrollRef.
  useEffect(() => {
    if (!audio.playing) {
      lastUserScrollAt.current = 0;
      return;
    }

    const markUserScroll = () => {
      if (programmaticScrollRef.current) return;
      lastUserScrollAt.current = Date.now();
    };

    window.addEventListener("wheel", markUserScroll, { passive: true });
    window.addEventListener("touchmove", markUserScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", markUserScroll);
      window.removeEventListener("touchmove", markUserScroll);
    };
  }, [audio.playing]);

  // Retry scroll once progressive rendering catches up to the playing ayah.
  const prevRenderLimitRef = useRef(renderLimit);
  useEffect(() => {
    const grew = renderLimit > prevRenderLimitRef.current;
    prevRenderLimitRef.current = renderLimit;
    if (!grew || !audio.playing || !isFollowingPlayback()) return;
    if (audio.playIndex < renderLimit) scrollToAyah(audio.playIndex);
  }, [renderLimit, audio.playIndex, audio.playing, scrollToAyah, isFollowingPlayback]);

  useEffect(() => {
    const saved = localStorage.getItem("noor-quran-translation") as TranslationLang | null;
    if (saved && ["en", "ur", "hi"].includes(saved)) setTranslation(saved);
    const savedStudy = localStorage.getItem("noor-quran-study-mode");
    if (savedStudy === "1") setStudyMode(true);
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
    if (savedScope === "ayah" || savedScope === "surah" || savedScope === "range") {
      setRepeatScope(savedScope);
    }
    const savedRepeatRaw = localStorage.getItem("noor-audio-repeat-count");
    const savedAudioRepeat = savedRepeatRaw === null ? NaN : Number(savedRepeatRaw);
    if (savedAudioRepeat >= 1 && savedAudioRepeat <= MAX_REPEAT) {
      setAudioRepeatCount(savedAudioRepeat);
    } else if (savedAudioRepeat === 0 && savedScope === "range") {
      // 0 = loop forever, only meaningful for the range scope.
      setAudioRepeatCount(0);
    }
    const savedSpeed = Number(localStorage.getItem("noor-audio-speed"));
    if ([0.75, 1, 1.25, 1.5].includes(savedSpeed)) setPlaybackSpeed(savedSpeed);
    if (localStorage.getItem("noor-audio-autoplay-next") === "1") setAutoPlayNext(true);
    if (localStorage.getItem("noor-read-translation") === "0") setShowTranslationText(false);
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSurahDurations(reciter).then((durations) => {
      if (cancelled) return;
      setSurahDurationSec(durations[String(surahNumber)] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [reciter, surahNumber]);

  useEffect(() => {
    if (!prefsHydrated) return;
    localStorage.setItem("noor-quran-translation", translation);
    localStorage.setItem("noor-quran-study-mode", studyMode ? "1" : "0");
    localStorage.setItem("noor-quran-tafsir-pref", tafsirPref);
    localStorage.setItem("noor-reciter", reciter);
    localStorage.setItem("noor-audio-translation", includeTranslation ? "1" : "0");
    localStorage.setItem("noor-audio-tafsir", includeTafsir ? "1" : "0");
    localStorage.setItem("noor-audio-tafsir-source", tafsirSource);
    localStorage.setItem("noor-audio-repeat-scope", repeatScope);
    localStorage.setItem("noor-audio-repeat-count", String(audioRepeatCount));
    localStorage.setItem("noor-audio-speed", String(playbackSpeed));
    localStorage.setItem("noor-audio-autoplay-next", autoPlayNext ? "1" : "0");
    localStorage.setItem("noor-read-translation", showTranslationText ? "1" : "0");
  }, [
    prefsHydrated,
    translation,
    studyMode,
    tafsirPref,
    reciter,
    includeTranslation,
    includeTafsir,
    tafsirSource,
    repeatScope,
    audioRepeatCount,
    playbackSpeed,
    autoPlayNext,
    showTranslationText,
  ]);

  useEffect(() => {
    setExpanded({});
  }, [tafsirPref, surahNumber]);

  // Loop range is per-surah: reset on navigation; resolve end→last once ayahs load.
  // Only reset on surah change (not translation reload) so a custom From/To sticks.
  useEffect(() => {
    setRangeStart(1);
    setRangeEnd(0);
  }, [surahNumber]);

  useEffect(() => {
    if (!ayahs.length) return;
    setRangeStart((s) => Math.min(Math.max(1, s), ayahs.length));
    setRangeEnd((e) => (e < 1 || e > ayahs.length ? ayahs.length : e));
  }, [ayahs.length]);

  // Persist last-read position (debounced) so travelers can resume.
  useEffect(() => {
    if (!ayahs.length || viewIndex < 0 || viewIndex >= ayahs.length) return;
    const a = ayahs[viewIndex];
    if (!a) return;
    window.clearTimeout(lastReadTimer.current);
    lastReadTimer.current = window.setTimeout(() => {
      saveLastRead({
        surah: surahNumber,
        ayah: a.ayah_number,
        surahName: surahName || undefined,
      });
    }, 400);
    return () => window.clearTimeout(lastReadTimer.current);
  }, [viewIndex, ayahs, surahNumber, surahName]);

  useEffect(() => {
    const map: Record<string, boolean> = {};
    for (const a of ayahs) {
      if (isBookmarked(a.verse_key)) map[a.verse_key] = true;
    }
    setBookmarkedKeys(map);
  }, [ayahs]);

  useEffect(() => {
    let cancelled = false;
    api<{ ayahs: { verse_key: string; words: AyahWord[] }[] }>(
      `/api/quran/surahs/${surahNumber}/words`
    )
      .then((d) => {
        if (cancelled) return;
        const map: Record<string, AyahWord[]> = {};
        for (const a of d.ayahs || []) map[a.verse_key] = a.words;
        setWordsByVerse(map);
      })
      .catch(() => {
        if (!cancelled) setWordsByVerse({});
      });
    return () => {
      cancelled = true;
    };
  }, [surahNumber]);

  useEffect(() => {
    if (!prefsHydrated) return;
    const idx = Math.max(0, startAyah - 1);
    setViewIndex(idx);
    setSurahLoading(true);
    setSurahError(false);
    setAyahs([]);
    setRenderLimit(AYAH_RENDER_CHUNK);
    api<{ surah: { name_en: string }; ayahs: Ayah[] }>(
      `/api/quran/surahs/${surahNumber}?translation=${translation}`
    )
      .then((d) => {
        setSurahName(displaySurahName(surahNumber, d.surah.name_en));
        setAyahs(d.ayahs);
        const nextIndex = Math.min(idx, Math.max(0, d.ayahs.length - 1));
        setViewIndex(nextIndex);
        setRenderLimit(Math.min(d.ayahs.length, Math.max(AYAH_RENDER_CHUNK, nextIndex + 6)));
        pendingScrollRef.current = nextIndex > 0;
      })
      .catch(() => setSurahError(true))
      .finally(() => setSurahLoading(false));
  }, [surahNumber, translation, startAyah, prefsHydrated, loadAttempt]);

  // Deep links (?ayah=N from shares and continue-reading) scroll to the ayah once loaded.
  useEffect(() => {
    if (surahLoading || studyMode || !pendingScrollRef.current || !ayahs.length) return;
    pendingScrollRef.current = false;
    scrollToAyah(viewIndex);
  }, [surahLoading, studyMode, ayahs.length, viewIndex, scrollToAyah]);

  useEffect(() => {
    if (studyMode || surahLoading || ayahs.length === 0 || renderLimit >= ayahs.length) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setRenderLimit((limit) => Math.min(ayahs.length, limit + AYAH_RENDER_CHUNK));
      },
      { rootMargin: "240px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [studyMode, surahLoading, ayahs.length, renderLimit]);

  useEffect(() => {
    emitPageLoading(surahLoading);
    return () => emitPageLoading(false);
  }, [surahLoading]);

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

  function toggleAyahBookmark(a: Ayah) {
    const next = toggleBookmark({
      surah: surahNumber,
      ayah: a.ayah_number,
      verseKey: a.verse_key,
      surahName: surahName || undefined,
    });
    setBookmarkedKeys((prev) => ({
      ...prev,
      [a.verse_key]: next.some((b) => b.verseKey === a.verse_key),
    }));
  }

  async function shareAyah(a: Ayah) {
    const tr = displayTranslation(a);
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/quran/${surahNumber}?ayah=${a.ayah_number}`
        : "";
    const text = `${a.arabic}\n\n${tr}\n\n— ${a.verse_key}\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: a.verse_key, text, url });
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus(t(lang, "copied"));
        window.setTimeout(() => setShareStatus(""), 1500);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setShareStatus(t(lang, "copied"));
        window.setTimeout(() => setShareStatus(""), 1500);
      } catch {
        /* ignore */
      }
    }
  }

  function displayTranslation(a: Ayah): string {
    if (translation === "ur") {
      return cleanQuranText(a.translation_ur || a.translation || "");
    }
    if (translation === "hi") {
      return cleanQuranText(a.translation_hi || a.translation || "");
    }
    return cleanQuranText(a.translation_en || a.translation || "");
  }

  function goToAyah(index: number) {
    audio.pause();
    lastUserScrollAt.current = 0;
    setViewIndex(index);
    scrollToAyah(index);
  }

  function playAyah(index: number) {
    if (audio.playing && audio.playIndex === index) {
      audio.pause();
    } else {
      audio.pause();
      lastUserScrollAt.current = 0;
      setViewIndex(index);
      audio.playFromIndex(index);
    }
  }

  function toggleToolbarPlay() {
    if (audio.playing) {
      audio.pause();
    } else {
      lastUserScrollAt.current = 0;
      audio.playFromIndex(viewIndex);
    }
  }

  // Spacebar toggles play/pause, like any media player — but not while the
  // user is typing/selecting in a form control (reciter picker, repeat count, etc).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" && e.key !== " ") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isFormControl =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!target?.isContentEditable;
      if (isFormControl) return;
      e.preventDefault();
      toggleToolbarPlay();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleToolbarPlay]);

  const activeIndex = audio.playing
    ? audio.isPlayingBismillah
      ? -1
      : audio.playIndex
    : viewIndex;
  const visibleAyahs = studyMode && ayahs.length ? [ayahs[viewIndex]] : ayahs.slice(0, renderLimit);

  useEffect(() => {
    if (studyMode || ayahs.length === 0) return;
    setRenderLimit((limit) => {
      const needed = Math.min(ayahs.length, Math.max(limit, activeIndex + 8));
      return needed === limit ? limit : needed;
    });
  }, [activeIndex, ayahs.length, studyMode]);

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
          <div>
            <h1 className="text-xl font-bold text-heading">
              {surahNumber}. {surahName}
            </h1>
            {surahDurationSec != null && (
              <p className="text-xs text-faint">{formatSurahDuration(surahDurationSec, lang)}</p>
            )}
          </div>
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
            onClick={toggleToolbarPlay}
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
          <AutoplayToggle
            on={autoPlayNext}
            onChange={setAutoPlayNext}
            label={t(lang, "autoPlayNext")}
          />
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
              onClick={() => {
                if (audio.playing) audio.pause();
                setTranslation(tr);
              }}
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
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-noor-200 px-2 py-1 text-xs text-muted hover:bg-noor-50 dark:border-noor-600 dark:hover:bg-noor-800"
            aria-expanded={showAudioOpts}
            aria-label={t(lang, "audioOptions")}
            title={t(lang, "audioOptions")}
          >
            <span className="inline-flex text-noor-700 dark:text-noor-200">{Icons.audioOpts}</span>
            <span className="hidden sm:inline">{t(lang, "audioOptions")}</span>
            <span aria-hidden>{showAudioOpts ? "▾" : "▸"}</span>
          </button>
        </div>

        {showAudioOpts && (
          <div className="space-y-2 rounded-lg border border-subtle bg-surface-muted p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted">{t(lang, "reciter")}</label>
              <select
                className="input max-w-[200px] py-1 text-xs"
                value={reciter}
                onChange={(e) => {
                  if (audio.playing) audio.pause();
                  setReciter(e.target.value);
                }}
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
            {audio.playbackMode === "surah" && (
              <p className="text-[11px] text-muted">{t(lang, "reciterSurahMode")}</p>
            )}
            {audio.playbackMode === "surah" && !audio.surahAudioAvailable && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                {t(lang, "reciterSurahUnavailable")}
              </p>
            )}
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
              />
              {t(lang, "includeTafsir")}
            </label>
            {includeTafsir && (
              <select
                className="input py-1 text-xs"
                value={tafsirSource}
                onChange={(e) => setTafsirSource(e.target.value as TafsirSource)}
              >
                <option value="ibn_kathir_en">{t(lang, "tafsirEnglishOption")}</option>
                <option value="maududi_ur">{t(lang, "tafsirUrduOption")}</option>
              </select>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">{t(lang, "playbackSpeed")}</span>
              {[0.75, 1, 1.25, 1.5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPlaybackSpeed(s)}
                  className={`rounded-md px-2 py-0.5 text-xs ${
                    playbackSpeed === s
                      ? "bg-noor-700 text-white dark:bg-noor-600"
                      : "border border-noor-200 dark:border-noor-600"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={audio.playing}
                onClick={() => {
                  setRepeatScope("ayah");
                  if (audioRepeatCount === 0) setAudioRepeatCount(1);
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
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
                onClick={() => {
                  setRepeatScope("surah");
                  if (audioRepeatCount === 0) setAudioRepeatCount(1);
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                  repeatScope === "surah"
                    ? "bg-noor-700 text-white dark:bg-noor-600"
                    : "border border-noor-200 dark:border-noor-600"
                }`}
              >
                {Icons.repeat} {t(lang, "repeatSurah")}
              </button>
              <button
                type="button"
                disabled={audio.playing}
                onClick={() => {
                  // Toggle: click again to turn off loop-range (back to per-ayah).
                  if (repeatScope === "range") {
                    setRepeatScope("ayah");
                    if (audioRepeatCount === 0) setAudioRepeatCount(1);
                    return;
                  }
                  const len = ayahs.length || 1;
                  const from = Math.min(viewIndex + 1, len);
                  setRangeStart(from);
                  setRangeEnd(len);
                  setRepeatScope("range");
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                  repeatScope === "range"
                    ? "bg-noor-700 text-white dark:bg-noor-600"
                    : "border border-noor-200 dark:border-noor-600"
                }`}
                aria-pressed={repeatScope === "range"}
                title={
                  repeatScope === "range" ? t(lang, "loopRangeOff") : t(lang, "loopRangeHint")
                }
              >
                {Icons.repeat} {t(lang, "loopRange")}
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
              {repeatScope === "range" && (
                <button
                  type="button"
                  disabled={audio.playing}
                  onClick={() => setAudioRepeatCount(0)}
                  aria-label={t(lang, "loopForever")}
                  title={t(lang, "loopForever")}
                  className={`h-7 w-7 rounded-full text-sm leading-none ${
                    audioRepeatCount === 0
                      ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                      : "border border-noor-200 dark:border-noor-600"
                  }`}
                >
                  ∞
                </button>
              )}
            </div>
            {repeatScope === "range" && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-muted">{t(lang, "loopFrom")}</label>
                  <select
                    className="input w-auto py-1 text-xs"
                    value={rangeStart}
                    disabled={audio.playing}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setRangeStart(v);
                      setRangeEnd((end) =>
                        Math.max(end < 1 ? ayahs.length : end, v)
                      );
                    }}
                  >
                    {ayahs.map((a) => (
                      <option key={a.verse_key} value={a.ayah_number}>
                        {a.ayah_number}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs text-muted">{t(lang, "loopTo")}</label>
                  <select
                    className="input w-auto py-1 text-xs"
                    value={rangeEnd < 1 ? ayahs.length || 1 : rangeEnd}
                    disabled={audio.playing}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setRangeEnd(v);
                      setRangeStart((s) => Math.min(s, v));
                    }}
                  >
                    {ayahs.map((a) => (
                      <option key={a.verse_key} value={a.ayah_number}>
                        {a.ayah_number}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-muted">{t(lang, "loopRangeHint")}</p>
              </div>
            )}
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
            onClick={() => setStudyMode(false)}
          />
          <IconButton
            icon={Icons.ayah}
            label={t(lang, "ayahByAyah")}
            active={studyMode}
            onClick={() => setStudyMode(true)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showTranslationText}
            onChange={(e) => setShowTranslationText(e.target.checked)}
          />
          {t(lang, "showTranslation")}
        </label>
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
        {surahLoading && (
          <p className="text-sm text-muted">{t(lang, "loading")}…</p>
        )}
        {!surahLoading && surahError && (
          <div className="card space-y-3 text-center">
            <p className="text-sm text-muted">{t(lang, "surahLoadError")}</p>
            <button
              type="button"
              className="rounded-md border border-noor-200 px-3 py-1.5 text-sm font-medium text-heading dark:border-noor-600"
              onClick={() => setLoadAttempt((n) => n + 1)}
            >
              {t(lang, "tryAgain")}
            </button>
          </div>
        )}
        {!surahLoading && surahNumber !== 1 && surahNumber !== 9 && (!studyMode || viewIndex === 0) && (
          <div
            ref={bismillahRef}
            className="scroll-mt-28 py-2 text-heading"
            aria-label="Bismillah"
          >
            <AyahWordText
              verseKey="bismillah"
              words={BISMILLAH_WORDS}
              activeWordIndex={audio.activeBismillahWordIndex}
              fallbackArabic="بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
              isPlaying={audio.playing && audio.isPlayingBismillah}
              align="center"
            />
          </div>
        )}
        {!surahLoading &&
          visibleAyahs.filter(Boolean).map((a, localIdx) => {
          const idx = studyMode ? viewIndex : localIdx;
          const isActive = idx === activeIndex;
          const isPlaying =
            audio.playing && !audio.isPlayingBismillah && idx === audio.playIndex;
          return (
            <article
              key={studyMode ? `${a.verse_key}-${viewIndex}` : a.verse_key}
              ref={(el) => {
                ayahRefs.current[a.verse_key] = el;
              }}
              className={`ayah-card card scroll-mt-28 transition-all duration-300 md:scroll-mt-24 ${
                isActive
                  ? "scale-[1.008] ring-2 ring-gold-400 shadow-md dark:ring-gold-500"
                  : "hover:border-noor-200 dark:hover:border-noor-600"
              } ${studyMode ? "animate-fade-in-up" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-accent">{a.verse_key}</p>
                  {repeatScope === "range" &&
                    a.ayah_number >= rangeStart &&
                    a.ayah_number <= (rangeEnd < 1 ? ayahs.length : rangeEnd) && (
                      <span
                        className="inline-flex items-center rounded-full border border-gold-300 bg-gold-50 px-1.5 py-0.5 text-[10px] font-medium text-noor-800 dark:border-gold-600 dark:bg-noor-800 dark:text-gold-400"
                        title={t(lang, "loopRange")}
                      >
                        {Icons.repeat}
                      </span>
                    )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    icon={bookmarkedKeys[a.verse_key] ? "★" : "☆"}
                    label={
                      bookmarkedKeys[a.verse_key] ? t(lang, "bookmarkSaved") : t(lang, "bookmark")
                    }
                    active={!!bookmarkedKeys[a.verse_key]}
                    tipSide="top"
                    onClick={() => toggleAyahBookmark(a)}
                  />
                  <IconButton
                    icon={Icons.share}
                    label={shareStatus || t(lang, "shareAyah")}
                    tipSide="top"
                    onClick={() => void shareAyah(a)}
                  />
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
              <AyahWordText
                verseKey={a.verse_key}
                words={wordsByVerse[a.verse_key]}
                activeWordIndex={isPlaying ? audio.activeWordIndex : -1}
                fallbackArabic={
                  surahNumber !== 1 && surahNumber !== 9 && a.ayah_number === 1
                    ? stripLeadingBismillah(a.arabic)
                    : a.arabic
                }
                isPlaying={isPlaying}
              />
              {showRoman && a.transliteration && (
                <p className="mt-2 text-sm italic text-faint" dir="ltr">
                  {a.transliteration}
                </p>
              )}
              {showTranslationText && (
                <p
                  className="mt-3 text-sm leading-relaxed text-body"
                  dir={translation === "ur" ? "rtl" : "ltr"}
                >
                  {displayTranslation(a)}
                </p>
              )}
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
        {!surahLoading && !studyMode && renderLimit < ayahs.length && (
          <div ref={loadMoreRef} className="py-3 text-center text-xs text-faint">
            {t(lang, "loading")}… ({renderLimit}/{ayahs.length})
          </div>
        )}
      </div>
    </div>
  );
}
