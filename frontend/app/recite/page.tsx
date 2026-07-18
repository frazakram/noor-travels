"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { displaySurahName, stripLeadingBismillah } from "@/lib/quran-display";
import type { Ayah } from "@/lib/quran-types";

const MAX_AYAHS_PER_ATTEMPT = 15;
const MAX_RECORD_SECONDS = 180;

type SurahSummary = {
  number: number;
  name_en: string;
  ayah_count: number;
};

type ScoredWord = {
  verse_key: string;
  word: string;
  status: "correct" | "close" | "wrong" | "missed";
  heard: string | null;
};

type ScoreResult = {
  type: "score" | "empty";
  score?: number;
  transcript?: string;
  total_words?: number;
  correct_words?: number;
  close_words?: number;
  wrong_words?: number;
  missed_words?: number;
  extra_words?: number;
  extras?: string[];
  words?: ScoredWord[];
};

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function RecitePage() {
  const { lang } = useLang();
  const [surahs, setSurahs] = useState<SurahSummary[]>([]);
  const [surah, setSurah] = useState(1);
  const [ayahFrom, setAyahFrom] = useState(1);
  const [ayahTo, setAyahTo] = useState(4);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [showText, setShowText] = useState(true);
  const [recording, setRecording] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRef = useRef(false);

  const surahMeta = surahs.find((s) => s.number === surah);
  const ayahCount = surahMeta?.ayah_count ?? ayahs.length ?? 1;

  useEffect(() => {
    api<{ surahs: SurahSummary[] }>("/api/quran/surahs")
      .then((d) => setSurahs(d.surahs || []))
      .catch(() => setSurahs([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAyahs([]);
    api<{ ayahs: Ayah[] }>(`/api/quran/surahs/${surah}?translation=en`)
      .then((d) => {
        if (!cancelled) setAyahs(d.ayahs || []);
      })
      .catch(() => {
        if (!cancelled) setAyahs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [surah]);

  // Keep the selection valid: inside the surah and within the attempt cap.
  useEffect(() => {
    setAyahFrom((f) => Math.min(Math.max(1, f), ayahCount));
    setAyahTo((to) => Math.min(Math.max(1, to), ayahCount));
  }, [ayahCount]);

  function changeSurah(n: number) {
    stopRecording(true);
    setSurah(n);
    setAyahFrom(1);
    setAyahTo(Math.min(4, surahs.find((s) => s.number === n)?.ayah_count ?? 4));
    setResult(null);
    setScoreError("");
  }

  function changeFrom(v: number) {
    setAyahFrom(v);
    setAyahTo((to) =>
      Math.min(Math.max(to, v), v + MAX_AYAHS_PER_ATTEMPT - 1, ayahCount)
    );
    setResult(null);
  }

  function changeTo(v: number) {
    setAyahTo(v);
    setAyahFrom((f) => Math.max(Math.min(f, v), v - MAX_AYAHS_PER_ATTEMPT + 1));
    setResult(null);
  }

  function cleanupRecorder() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
    setSeconds(0);
  }

  function stopRecording(discard = false) {
    discardRef.current = discard;
    if (!recorderRef.current) {
      cleanupRecorder();
      return;
    }
    // onstop fires after the final dataavailable → scoring starts there.
    const rec = recorderRef.current;
    if (rec.state === "recording") {
      rec.stop();
    } else {
      cleanupRecorder();
    }
  }

  async function submitRecording() {
    const blob = new Blob(chunksRef.current, {
      type: chunksRef.current[0]?.type || "audio/webm",
    });
    chunksRef.current = [];
    if (blob.size < 1000) {
      setResult({ type: "empty" });
      return;
    }
    setScoring(true);
    setScoreError("");
    try {
      const audioB64 = await blobToBase64(blob);
      const data = await api<ScoreResult>("/api/recite/score", {
        method: "POST",
        body: JSON.stringify({
          audio_b64: audioB64,
          content_type: blob.type || "audio/webm",
          surah,
          ayah_start: ayahFrom,
          ayah_end: ayahTo,
        }),
      });
      setResult(data);
    } catch {
      setScoreError(t(lang, "reciteScoreError"));
    } finally {
      setScoring(false);
    }
  }

  async function startRecording() {
    setMicError(false);
    setScoreError("");
    setResult(null);
    discardRef.current = false;
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const discard = discardRef.current;
        cleanupRecorder();
        if (!discard) void submitRecording();
      };
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) stopRecording(false);
          return s + 1;
        });
      }, 1000);
    } catch {
      setMicError(true);
    }
  }

  useEffect(() => {
    return () => {
      discardRef.current = true;
      cleanupRecorder();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAyahs = ayahs.filter(
    (a) => a.ayah_number >= ayahFrom && a.ayah_number <= ayahTo
  );

  const score = result?.type === "score" ? result.score ?? 0 : null;
  const scoreTone =
    score == null
      ? ""
      : score >= 8.5
        ? "text-emerald-600 dark:text-emerald-400"
        : score >= 6
          ? "text-gold-600 dark:text-gold-400"
          : "text-red-600 dark:text-red-400";
  const feedbackKey =
    score == null
      ? null
      : score >= 9
        ? ("recitePerfect" as const)
        : score >= 6.5
          ? ("reciteGood" as const)
          : ("reciteKeep" as const);

  const mistakes = (result?.words ?? []).filter((w) => w.status !== "correct");

  const wordClass = (status: ScoredWord["status"]) => {
    switch (status) {
      case "correct":
        return "text-heading";
      case "close":
        return "rounded bg-gold-50 px-0.5 text-gold-700 dark:bg-gold-500/15 dark:text-gold-300";
      case "wrong":
        return "rounded bg-red-50 px-0.5 text-red-700 underline decoration-red-400 decoration-wavy dark:bg-red-500/15 dark:text-red-400";
      case "missed":
        return "rounded bg-red-50 px-0.5 text-red-400 line-through decoration-red-400 dark:bg-red-500/10 dark:text-red-500/70";
    }
  };

  const statusLabel = (status: ScoredWord["status"]) =>
    status === "close"
      ? t(lang, "reciteWordsClose")
      : status === "wrong"
        ? t(lang, "reciteWordsWrong")
        : t(lang, "reciteWordsMissed");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-heading">{t(lang, "reciteTitle")}</h1>
        <p className="text-sm text-muted">{t(lang, "reciteDesc")}</p>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted">{t(lang, "reciteSelectSurah")}</label>
          <select
            className="input max-w-[230px] py-1.5 text-sm"
            value={surah}
            disabled={recording || scoring}
            onChange={(e) => changeSurah(Number(e.target.value))}
          >
            {(surahs.length ? surahs : [{ number: 1, name_en: "Al-Fatiha", ayah_count: 7 }]).map(
              (s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. {displaySurahName(s.number, s.name_en)}
                </option>
              )
            )}
          </select>
          <label className="text-xs text-muted">{t(lang, "loopFrom")}</label>
          <select
            className="input w-auto py-1.5 text-sm"
            value={ayahFrom}
            disabled={recording || scoring}
            onChange={(e) => changeFrom(Number(e.target.value))}
          >
            {Array.from({ length: ayahCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <label className="text-xs text-muted">{t(lang, "loopTo")}</label>
          <select
            className="input w-auto py-1.5 text-sm"
            value={ayahTo}
            disabled={recording || scoring}
            onChange={(e) => changeTo(Number(e.target.value))}
          >
            {Array.from({ length: ayahCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-faint">{t(lang, "reciteMaxAyahs")}</p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={recording ? () => stopRecording(false) : () => void startRecording()}
            disabled={scoring}
            className={`btn-primary min-h-11 ${recording ? "bg-red-700 hover:bg-red-800" : ""}`}
          >
            {recording ? t(lang, "reciteStop") : t(lang, "reciteStart")}
          </button>
          {recording && (
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
              {t(lang, "reciteRecording")} ({Math.floor(seconds / 60)}:
              {String(seconds % 60).padStart(2, "0")})
            </span>
          )}
          {scoring && <span className="text-sm text-accent">{t(lang, "reciteScoring")}</span>}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={showText}
              onChange={(e) => setShowText(e.target.checked)}
            />
            {t(lang, "reciteShowText")}
          </label>
        </div>

        {micError && (
          <NoticeCard
            tone="warning"
            title={t(lang, "reciteMicErrorTitle")}
            message={t(lang, "reciteMicError")}
            actionLabel={t(lang, "tryAgain")}
            onAction={() => void startRecording()}
          />
        )}
        {scoreError && (
          <NoticeCard
            tone="warning"
            title={t(lang, "reciteScoreErrorTitle")}
            message={scoreError}
            actionLabel={t(lang, "tryAgain")}
            onAction={() => void startRecording()}
          />
        )}
        {result?.type === "empty" && (
          <NoticeCard
            tone="info"
            title={t(lang, "reciteNoSpeechTitle")}
            message={t(lang, "reciteNoSpeech")}
            actionLabel={t(lang, "tryAgain")}
            onAction={() => void startRecording()}
          />
        )}
      </div>

      {result?.type === "score" && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-faint">
                {t(lang, "reciteScore")}
              </p>
              <p className={`text-5xl font-bold ${scoreTone}`}>
                {result.score?.toFixed(1)}
                <span className="ml-1 text-base font-medium text-faint">/ 10</span>
              </p>
            </div>
            {feedbackKey && <p className="text-sm font-medium text-body">{t(lang, feedbackKey)}</p>}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {result.correct_words} {t(lang, "reciteWordsCorrect")}
            </span>
            {(result.close_words ?? 0) > 0 && (
              <span className="rounded-full bg-gold-50 px-2 py-0.5 text-gold-700 dark:bg-gold-500/15 dark:text-gold-300">
                {result.close_words} {t(lang, "reciteWordsClose")}
              </span>
            )}
            {(result.wrong_words ?? 0) > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                {result.wrong_words} {t(lang, "reciteWordsWrong")}
              </span>
            )}
            {(result.missed_words ?? 0) > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                {result.missed_words} {t(lang, "reciteWordsMissed")}
              </span>
            )}
            {(result.extra_words ?? 0) > 0 && (
              <span className="rounded-full bg-noor-50 px-2 py-0.5 text-muted dark:bg-noor-800">
                {result.extra_words} {t(lang, "reciteExtraWords")}
              </span>
            )}
          </div>

          <p
            className="font-arabic text-right text-2xl leading-loose text-heading"
            dir="rtl"
            lang="ar"
          >
            {(result.words ?? []).map((w, i) => (
              <span key={`${w.verse_key}-${i}`}>
                <span className={wordClass(w.status)}>{w.word}</span>{" "}
              </span>
            ))}
          </p>

          {mistakes.length > 0 && (
            <div className="space-y-1.5 border-t border-subtle pt-3">
              <p className="text-xs font-semibold text-accent">{t(lang, "reciteMistakes")}</p>
              {mistakes.slice(0, 20).map((w, i) => (
                <p key={i} className="text-sm text-body">
                  <span className="text-xs text-faint">{w.verse_key}</span>{" "}
                  <span className="font-arabic" dir="rtl" lang="ar">
                    {w.word}
                  </span>{" "}
                  — {statusLabel(w.status)}
                  {w.heard && (
                    <>
                      {" "}
                      ({t(lang, "reciteHeardAs")}:{" "}
                      <span className="font-arabic" dir="rtl" lang="ar">
                        {w.heard}
                      </span>
                      )
                    </>
                  )}
                </p>
              ))}
              {(result.extras ?? []).length > 0 && (
                <p className="text-sm text-body">
                  {t(lang, "reciteExtraWords")}:{" "}
                  <span className="font-arabic" dir="rtl" lang="ar">
                    {(result.extras ?? []).join("، ")}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {showText && (
        <div className="space-y-3">
          {selectedAyahs.map((a) => (
            <article key={a.verse_key} className="card">
              <p className="text-xs font-medium text-accent">{a.verse_key}</p>
              <p
                className="font-arabic mt-2 text-right text-2xl leading-loose text-heading"
                dir="rtl"
                lang="ar"
              >
                {surah !== 1 && surah !== 9 && a.ayah_number === 1
                  ? stripLeadingBismillah(a.arabic)
                  : a.arabic}
              </p>
              {a.transliteration && (
                <p className="mt-2 text-sm italic text-faint" dir="ltr">
                  {a.transliteration}
                </p>
              )}
            </article>
          ))}
          {!selectedAyahs.length && (
            <p className="text-sm text-muted">{t(lang, "loading")}…</p>
          )}
        </div>
      )}
    </div>
  );
}
