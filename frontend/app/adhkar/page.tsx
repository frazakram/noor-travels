"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { ShareButton } from "@/components/ShareButton";
import { IconButton, Icons } from "@/components/IconButton";
import { api, apiStatic } from "@/lib/api";
import {
  incrementDhikrCount,
  loadDhikrBookmarks,
  loadDhikrProgress,
  resetDhikrCount,
  toggleDhikrBookmark,
  type DhikrProgress,
} from "@/lib/dhikr-library";
import { t, type Lang } from "@/lib/i18n";
import { LoadingGlass } from "@/components/LoadingGlass";
import {
  acquireWakeLock,
  clearMediaSession,
  releaseWakeLock,
  setupMediaSession,
  updateMediaSession,
} from "@/lib/media-session";

type Adhkar = {
  id: string;
  category: "morning" | "evening" | "night";
  order_index: number;
  title_en: string;
  title_ur: string;
  title_hi: string;
  arabic: string;
  transliteration: string;
  translation_en: string;
  translation_ur: string;
  translation_hi: string;
  source: string;
  repeat_count: number;
  verse_keys: string | null;
};

type Category = "morning" | "evening" | "night";

const CATEGORIES: { id: Category; labelKey: "dhikrCategoryMorning" | "dhikrCategoryEvening" | "dhikrCategoryNight" }[] = [
  { id: "morning", labelKey: "dhikrCategoryMorning" },
  { id: "evening", labelKey: "dhikrCategoryEvening" },
  { id: "night", labelKey: "dhikrCategoryNight" },
];

// Human-recited audio only (Al Quran Cloud CDN) — no TTS. Only items whose
// arabic text is an actual Quran verse (item.verse_keys) have this available;
// translation is Urdu-only because that's the only language with a real
// human-recited verse-by-verse translation reciter (ur.khan / EveryAyah).
type SurahAyahAudio = { ayah_number: number; audio: string | null; translation_audio: string | null };
type PlayKind = "recitation" | "translation" | "all";
type PlayState = { id: string; kind: PlayKind } | null;
type AudioSegment = { itemId: string; url: string };
const TRANSLATION_LANG: Lang = "ur";

function localized(item: Adhkar, lang: Lang, field: "title" | "translation"): string {
  const suffix = lang === "ur" ? "ur" : lang === "hi" ? "hi" : "en";
  return item[`${field}_${suffix}` as keyof Adhkar] as string;
}

function stopAudioEl(el: HTMLAudioElement) {
  try {
    el.pause();
    el.currentTime = 0;
  } catch {
    /* ignore */
  }
}

function DhikrCard({
  item,
  lang,
  translationLang,
  count,
  bookmarked,
  playing,
  audioBusy,
  onIncrement,
  onReset,
  onToggleBookmark,
  onPlayRecitation,
  onPlayTranslation,
}: {
  item: Adhkar;
  lang: Lang;
  translationLang: Lang;
  count: number;
  bookmarked: boolean;
  playing: PlayState;
  audioBusy: boolean;
  onIncrement: () => void;
  onReset: () => void;
  onToggleBookmark: () => void;
  onPlayRecitation: () => void;
  onPlayTranslation: () => void;
}) {
  const title = localized(item, translationLang, "title");
  const translation = localized(item, translationLang, "translation");
  const done = count >= item.repeat_count;
  const isActive = playing?.id === item.id;
  const isPlayingRecitation = isActive && (playing.kind === "recitation" || playing.kind === "all");
  const isPlayingTranslation = isActive && playing.kind === "translation";
  const canRecite = Boolean(item.verse_keys);

  return (
    <article
      className={`card scroll-mt-28 transition ${
        done ? "border-gold-300 dark:border-gold-600" : ""
      } ${isActive ? "ring-2 ring-gold-400 dark:ring-gold-500" : ""}`}
      data-adhkar-id={item.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-heading" dir={translationLang === "ur" ? "rtl" : "ltr"}>
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-accent">{item.source}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            icon={bookmarked ? Icons.bookmarkFilled : Icons.bookmark}
            label={bookmarked ? t(lang, "dhikrBookmarked") : t(lang, "dhikrBookmark")}
            active={bookmarked}
            onClick={onToggleBookmark}
            tipSide="top"
          />
          <ShareButton
            lang={lang}
            getPayload={() => ({
              title,
              text: `${title}\n\n${item.arabic}\n\n${translation}\n\n— ${item.source}\n${
                typeof window !== "undefined" ? window.location.origin + "/adhkar" : ""
              }`,
            })}
            tipSide="top"
          />
        </div>
      </div>

      <p className="font-arabic mt-3 text-right text-xl leading-loose" dir="rtl">
        {item.arabic}
      </p>
      <p className="mt-2 text-sm italic text-faint">{item.transliteration}</p>
      <p className="mt-3 text-sm leading-relaxed text-body" dir={translationLang === "ur" ? "rtl" : "ltr"}>
        {translation}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPlayRecitation}
            disabled={!canRecite || (audioBusy && !isPlayingRecitation)}
            title={canRecite ? t(lang, "dhikrPlayRecitation") : t(lang, "dhikrRecitationUnavailable")}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition active:scale-95 disabled:opacity-40 ${
              isPlayingRecitation && playing?.kind === "recitation"
                ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                : "border border-noor-200 text-noor-800 hover:bg-noor-50 dark:border-noor-600 dark:text-noor-100 dark:hover:bg-noor-800"
            }`}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden>
              {isPlayingRecitation && playing?.kind === "recitation" ? Icons.pause : Icons.play}
            </span>
            {t(lang, "dhikrPlayRecitation")}
          </button>
          <button
            type="button"
            onClick={onPlayTranslation}
            disabled={!canRecite || (audioBusy && !isPlayingTranslation)}
            title={canRecite ? t(lang, "dhikrPlayTranslation") : t(lang, "dhikrRecitationUnavailable")}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition active:scale-95 disabled:opacity-40 ${
              isPlayingTranslation
                ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                : "border border-noor-200 text-noor-800 hover:bg-noor-50 dark:border-noor-600 dark:text-noor-100 dark:hover:bg-noor-800"
            }`}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden>
              {isPlayingTranslation ? Icons.pause : Icons.audioOpts}
            </span>
            {t(lang, "dhikrPlayTranslation")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {count > 0 && (
            <button
              type="button"
              onClick={onReset}
              aria-label={t(lang, "dhikrReset")}
              title={t(lang, "dhikrReset")}
              className="touch-target flex h-9 w-9 items-center justify-center rounded-full text-base text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            >
              ↺
            </button>
          )}
          <button
            type="button"
            onClick={onIncrement}
            title={t(lang, "dhikrTapToCount")}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm transition-transform active:scale-95 sm:min-h-9 ${
              done
                ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                : "bg-noor-700 text-white hover:bg-noor-800 dark:bg-noor-600 dark:hover:bg-noor-500"
            }`}
          >
            <span className="tabular-nums">
              {count}/{item.repeat_count}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default function AdhkarPage() {
  const { lang } = useLang();
  const [items, setItems] = useState<Adhkar[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [category, setCategory] = useState<Category>("morning");
  const [query, setQuery] = useState("");
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [includeTranslation, setIncludeTranslation] = useState(true);

  const [progress, setProgress] = useState<DhikrProgress>({ date: "", counts: {} });
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  const [playing, setPlaying] = useState<PlayState>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const surahCacheRef = useRef<Map<number, Map<number, SurahAyahAudio>>>(new Map());
  const playTokenRef = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem("noor-adhkar-include-translation");
    if (saved !== null) setIncludeTranslation(saved === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("noor-adhkar-include-translation", includeTranslation ? "1" : "0");
  }, [includeTranslation]);

  useEffect(() => {
    setProgress(loadDhikrProgress());
    setBookmarks(loadDhikrBookmarks());
    setStatus("loading");
    // no-store: an earlier empty seed response was Cache-Control'd for 1h and
    // sticky-served "No results" even after Postgres was populated.
    api<{ adhkar: Adhkar[] }>("/api/adhkar/")
      .then((d) => {
        const list = Array.isArray(d?.adhkar) ? d.adhkar : [];
        setItems(list);
        setStatus(list.length ? "done" : "error");
      })
      .catch(() => setStatus("error"));

    const el = new Audio();
    audioElRef.current = el;
    return () => {
      stopAudioEl(el);
      audioElRef.current = null;
      clearMediaSession();
      void releaseWakeLock();
    };
  }, []);

  const visibleItems = useMemo(() => {
    let list = items.filter((i) => i.category === category);
    if (showBookmarksOnly) list = list.filter((i) => bookmarks.includes(i.id));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        [i.title_en, i.title_ur, i.title_hi, i.transliteration, i.translation_en, i.arabic].some((f) =>
          f.toLowerCase().includes(q),
        ),
      );
    }
    return list;
  }, [items, category, query, showBookmarksOnly, bookmarks]);

  const categoryItems = useMemo(
    () => items.filter((i) => i.category === category).sort((a, b) => a.order_index - b.order_index),
    [items, category],
  );
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const completedCount = categoryItems.filter((i) => (progress.counts[i.id] ?? 0) >= i.repeat_count).length;
  const allDone = categoryItems.length > 0 && completedCount === categoryItems.length;
  const isPlayingAll = playing?.kind === "all";

  const handleIncrement = useCallback((item: Adhkar) => {
    setProgress(incrementDhikrCount(item.id, item.repeat_count));
  }, []);

  const handleReset = useCallback((item: Adhkar) => {
    setProgress(resetDhikrCount(item.id));
  }, []);

  const handleToggleBookmark = useCallback((item: Adhkar) => {
    setBookmarks(toggleDhikrBookmark(item.id));
  }, []);

  const stopPlayback = useCallback(() => {
    playTokenRef.current += 1;
    if (audioElRef.current) stopAudioEl(audioElRef.current);
    setPlaying(null);
    setAudioBusy(false);
    clearMediaSession();
    void releaseWakeLock();
  }, []);

  const scrollToItem = useCallback((itemId: string) => {
    const el = document.querySelector(`[data-adhkar-id="${itemId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const playSegments = useCallback(
    (segments: AudioSegment[], token: number, kind: PlayKind) => {
      const el = audioElRef.current;
      if (!el || !segments.length) {
        setPlaying(null);
        setAudioBusy(false);
        return;
      }
      let idx = 0;
      let retries = 0;
      // Transient CDN hiccups (a slow mobile network, a momentary 5xx from
      // the third-party audio host) must not read as "audio stopped working" —
      // retry the same clip a couple of times before giving up on it.
      const MAX_RETRIES = 2;

      const playCurrent = () => {
        if (token !== playTokenRef.current) return;
        if (idx >= segments.length) {
          setPlaying(null);
          setAudioBusy(false);
          clearMediaSession();
          void releaseWakeLock();
          return;
        }
        const seg = segments[idx];
        setPlaying({ id: seg.itemId, kind });
        scrollToItem(seg.itemId);
        const item = itemsById.get(seg.itemId);
        updateMediaSession({
          title: item ? localized(item, lang, "title") : t(lang, "dhikr"),
          artist: t(lang, "dhikr"),
          album: t(lang, CATEGORIES.find((c) => c.id === category)!.labelKey),
          playing: true,
        });
        void acquireWakeLock();
        // Hard-reset the element before assigning a new source — reusing the
        // same <audio> across items without this can leave a prior source's
        // decode/network state wedged on some mobile browsers, especially
        // after the element was paused (e.g. screen lock) and resumed.
        el.pause();
        el.removeAttribute("src");
        el.load();
        el.src = seg.url;
        void el.play().catch(() => retryOrAdvance());
      };

      const retryOrAdvance = () => {
        if (token !== playTokenRef.current) return;
        if (retries < MAX_RETRIES) {
          retries += 1;
          window.setTimeout(playCurrent, 500 * retries);
        } else {
          idx += 1;
          retries = 0;
          playCurrent();
        }
      };

      el.onended = () => {
        idx += 1;
        retries = 0;
        playCurrent();
      };
      el.onerror = () => retryOrAdvance();
      setAudioBusy(false);
      playCurrent();
    },
    [scrollToItem, itemsById, lang, category],
  );

  // Fetches (and caches per surah) both the Arabic recitation and the
  // human-recited Urdu translation audio in one call — same CDN the Quran
  // reader uses, so no TTS round-trip is ever needed here.
  const resolveVerseAudio = useCallback(
    async (verseKeys: string, kind: "arabic" | "translation"): Promise<string[]> => {
      const keys = verseKeys.split(",").map((k) => k.trim()).filter(Boolean);
      const urls: string[] = [];
      for (const key of keys) {
        const [surahStr, ayahStr] = key.split(":");
        const surah = Number(surahStr);
        const ayah = Number(ayahStr);
        let surahMap = surahCacheRef.current.get(surah);
        if (!surahMap) {
          const d = await apiStatic<{ ayahs: SurahAyahAudio[] }>(
            `/api/quran/audio/surahs/${surah}?reciter=ar.alafasy&translation_lang=ur`,
          );
          surahMap = new Map(d.ayahs.map((a) => [a.ayah_number, a]));
          surahCacheRef.current.set(surah, surahMap);
        }
        const entry = surahMap.get(ayah);
        const url = kind === "arabic" ? entry?.audio : entry?.translation_audio;
        if (url) urls.push(url);
      }
      return urls;
    },
    [],
  );

  const buildItemSegments = useCallback(
    async (item: Adhkar, opts: { arabic: boolean; translation: boolean }): Promise<AudioSegment[]> => {
      // Human-recited audio only exists for actual Quran verses. Non-Quran
      // duas have no Qari/translation reciter to fall back to (no TTS here).
      if (!item.verse_keys) return [];
      const segs: AudioSegment[] = [];
      if (opts.arabic) {
        const urls = await resolveVerseAudio(item.verse_keys, "arabic");
        for (const url of urls) segs.push({ itemId: item.id, url });
      }
      if (opts.translation) {
        const urls = await resolveVerseAudio(item.verse_keys, "translation");
        for (const url of urls) segs.push({ itemId: item.id, url });
      }
      return segs;
    },
    [resolveVerseAudio],
  );

  const handlePlayRecitation = useCallback(
    async (item: Adhkar) => {
      if (playing?.id === item.id && playing.kind === "recitation") {
        stopPlayback();
        return;
      }
      if (!item.verse_keys) return;
      stopPlayback();
      const token = ++playTokenRef.current;
      setAudioBusy(true);
      setPlaying({ id: item.id, kind: "recitation" });
      try {
        const segs = await buildItemSegments(item, {
          arabic: true,
          translation: includeTranslation,
        });
        if (token !== playTokenRef.current) return;
        playSegments(segs, token, "recitation");
      } catch {
        if (token === playTokenRef.current) {
          setAudioBusy(false);
          setPlaying(null);
        }
      }
    },
    [playing, stopPlayback, buildItemSegments, includeTranslation, playSegments],
  );

  const handlePlayTranslation = useCallback(
    async (item: Adhkar) => {
      if (playing?.id === item.id && playing.kind === "translation") {
        stopPlayback();
        return;
      }
      stopPlayback();
      const token = ++playTokenRef.current;
      setAudioBusy(true);
      setPlaying({ id: item.id, kind: "translation" });
      try {
        const segs = await buildItemSegments(item, {
          arabic: false,
          translation: true,
        });
        if (token !== playTokenRef.current) return;
        playSegments(segs, token, "translation");
      } catch {
        if (token === playTokenRef.current) {
          setAudioBusy(false);
          setPlaying(null);
        }
      }
    },
    [playing, stopPlayback, buildItemSegments, playSegments],
  );

  const handlePlayAll = useCallback(async () => {
    if (isPlayingAll) {
      stopPlayback();
      return;
    }
    if (!categoryItems.length) return;
    stopPlayback();
    const token = ++playTokenRef.current;
    setAudioBusy(true);
    setPlaying({ id: categoryItems[0].id, kind: "all" });
    try {
      const segs: AudioSegment[] = [];
      for (const item of categoryItems) {
        if (token !== playTokenRef.current) return;
        const part = await buildItemSegments(item, {
          arabic: true,
          translation: includeTranslation,
        });
        segs.push(...part);
      }
      if (token !== playTokenRef.current) return;
      if (!segs.length) {
        setAudioBusy(false);
        setPlaying(null);
        return;
      }
      playSegments(segs, token, "all");
    } catch {
      if (token === playTokenRef.current) {
        setAudioBusy(false);
        setPlaying(null);
      }
    }
  }, [isPlayingAll, stopPlayback, categoryItems, buildItemSegments, includeTranslation, playSegments]);

  // Changing category / filters while a full playlist is running would desync — stop.
  useEffect(() => {
    if (playing?.kind === "all") stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on category change
  }, [category]);

  // Lock-screen / notification media controls (mirrors the Quran reader).
  useEffect(() => {
    setupMediaSession({
      onPlay: () => void audioElRef.current?.play(),
      onPause: () => audioElRef.current?.pause(),
      onStop: () => stopPlayback(),
    });
  }, [stopPlayback]);

  // Screen Wake Lock is auto-released by the browser whenever the document
  // goes hidden (screen lock, backgrounding) — that alone can leave the
  // <audio> element paused with nothing re-requesting the lock or resuming
  // playback once the screen comes back on. Recover on the way back in.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== "visible" || !playing) return;
      void acquireWakeLock();
      const el = audioElRef.current;
      if (el && el.paused && el.src) void el.play().catch(() => undefined);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playing]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "dhikr")}</h1>
        <p className="text-sm text-muted">{t(lang, "dhikrSubtitle")}</p>
      </div>

      <Link
        href="/recite"
        className="card flex items-center gap-3 hover:border-noor-300 dark:hover:border-noor-500"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-300 bg-gold-50 text-noor-800 dark:border-gold-600 dark:bg-noor-800 dark:text-gold-400"
          aria-hidden
        >
          {Icons.mic}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-heading">{t(lang, "recite")}</p>
          <p className="text-xs text-faint">{t(lang, "reciteCardDesc")}</p>
        </div>
      </Link>

      <div className="card space-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="shrink-0 text-xs text-faint">{t(lang, "translation")}</span>
          <span className="shrink-0 rounded-md bg-noor-700 px-2.5 py-1 text-xs font-medium text-white dark:bg-noor-600">
            {t(lang, "urdu")}
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-body">
          <input
            type="checkbox"
            checked={includeTranslation}
            onChange={(e) => {
              if (playing) stopPlayback();
              setIncludeTranslation(e.target.checked);
            }}
            disabled={!!playing}
          />
          {t(lang, "includeTranslation")}
        </label>
        <div className="flex flex-wrap items-center gap-2 border-t border-subtle pt-3">
          <button
            type="button"
            onClick={() => void handlePlayAll()}
            disabled={audioBusy && !isPlayingAll}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition active:scale-95 disabled:opacity-40 ${
              isPlayingAll
                ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                : "bg-noor-700 text-white hover:bg-noor-800 dark:bg-noor-600"
            }`}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden>
              {isPlayingAll ? Icons.pause : Icons.play}
            </span>
            {isPlayingAll
              ? t(lang, "dhikrStopAudio")
              : `${t(lang, "dhikrPlayAll")} — ${t(lang, CATEGORIES.find((c) => c.id === category)!.labelKey)}`}
          </button>
          {audioBusy && <LoadingGlass size="sm" label={t(lang, "loading")} />}
        </div>
        <p className="text-[11px] text-muted">{t(lang, "dhikrPlayAllHint")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              if (playing) stopPlayback();
              setCategory(c.id);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              category === c.id
                ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
                : "border border-subtle text-muted"
            }`}
          >
            {t(lang, c.labelKey)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowBookmarksOnly((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            showBookmarksOnly
              ? "bg-gold-500 text-white dark:bg-gold-400 dark:text-noor-950"
              : "border border-subtle text-muted"
          }`}
        >
          {t(lang, "dhikrBookmarksOnly")}
          {bookmarks.length ? ` (${bookmarks.length})` : ""}
        </button>
      </div>

      <input
        className="input w-full"
        placeholder={t(lang, "search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!showBookmarksOnly && categoryItems.length > 0 && (
        <div className="rounded-xl border border-subtle bg-noor-50/50 px-4 py-2.5 text-sm dark:bg-noor-900/30">
          {allDone ? (
            <span className="font-medium text-gold-600 dark:text-gold-400">{t(lang, "dhikrAllDone")}</span>
          ) : (
            <span className="text-muted">
              {t(lang, "dhikrProgressToday")}: {completedCount}/{categoryItems.length}{" "}
              {t(lang, "dhikrCompletedToday")}
            </span>
          )}
        </div>
      )}

      {status === "loading" && <LoadingGlass size="lg" label={t(lang, "loading")} />}
      {status === "error" && <p className="text-sm text-faint">{t(lang, "chatError")}</p>}

      {status === "done" && visibleItems.length === 0 && (
        <p className="text-sm text-faint">
          {showBookmarksOnly ? t(lang, "dhikrNoBookmarks") : t(lang, "noResults")}
        </p>
      )}

      <div className="space-y-4">
        {visibleItems.map((item) => (
          <DhikrCard
            key={item.id}
            item={item}
            lang={lang}
            translationLang={TRANSLATION_LANG}
            count={progress.counts[item.id] ?? 0}
            bookmarked={bookmarks.includes(item.id)}
            playing={playing}
            audioBusy={audioBusy}
            onIncrement={() => handleIncrement(item)}
            onReset={() => handleReset(item)}
            onToggleBookmark={() => handleToggleBookmark(item)}
            onPlayRecitation={() => void handlePlayRecitation(item)}
            onPlayTranslation={() => void handlePlayTranslation(item)}
          />
        ))}
      </div>
    </div>
  );
}
