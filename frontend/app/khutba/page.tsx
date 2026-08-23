"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { LoadingGlass } from "@/components/LoadingGlass";
import { NoticeCard } from "@/components/NoticeCard";
import { SavedToast } from "@/components/SavedToast";
import { api } from "@/lib/api";
import { decodeHtmlEntities } from "@/lib/html";
import { t } from "@/lib/i18n";
import {
  deleteSavedKhutba,
  formatKhutbaDate,
  loadSavedKhutbas,
  saveKhutba,
  type KhutbaCoverage,
  type SavedKhutba,
} from "@/lib/khutba-history";
import { coverageSummary, downloadKhutbaPdf } from "@/lib/khutba-pdf";

/** RMS below which a 10s segment is treated as speechless. Sits ~2x above the
 *  loudest room tone measured and ~30x below speech, so quiet talking is still
 *  transcribed while pauses cost nothing. */
const SILENCE_RMS = 0.005;

type Translation = {
  arabic: string;
  english: string;
  urdu: string;
};

type SermonSummary = {
  id: number;
  slug: string;
  title: string;
  source_url: string;
};

type SermonDetail = SermonSummary & {
  english_text: string;
};

export default function KhutbaPage() {
  const { lang } = useLang();
  const [active, setActive] = useState(false);
  const [lines, setLines] = useState<Translation[]>([]);
  const [status, setStatus] = useState("");
  const [sermons, setSermons] = useState<SermonSummary[]>([]);
  const [sermonQuery, setSermonQuery] = useState("");
  const [selected, setSelected] = useState<SermonDetail | null>(null);
  const [matchNotice, setMatchNotice] = useState("");
  const [suggestion, setSuggestion] = useState<{ slug: string; title: string } | null>(null);
  const [savedList, setSavedList] = useState<SavedKhutba[]>([]);
  const [openSaved, setOpenSaved] = useState<SavedKhutba | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfNotice, setPdfNotice] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  // Bumped by start() and by unmount. Queued segments carry the id they were
  // recorded under and drop themselves if it has moved on, which lets stop()
  // end the recording while still letting already-captured audio finish.
  const sessionRef = useRef(0);
  const accumulatedRef = useRef("");
  const accumulatedArRef = useRef("");
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Full chronological transcript of the current session — the on-screen list
  // is capped at 20 lines, but the saved khutba must keep everything.
  const fullLinesRef = useRef<Translation[]>([]);
  const matchedTitleRef = useRef<string | undefined>(undefined);
  const coverageRef = useRef<KhutbaCoverage>({ segments: 0, translated: 0, skipped: 0, failed: 0 });

  const loadSermons = useCallback(async (q = "") => {
    const path = q.trim().length >= 2 ? `/api/khutba/sermons?q=${encodeURIComponent(q)}` : "/api/khutba/sermons";
    const data = await api<{ sermons: SermonSummary[] }>(path);
    setSermons(data.sermons);
  }, []);

  useEffect(() => {
    loadSermons().catch(() => setSermons([]));
  }, [loadSermons]);

  // Saved khutbas live in localStorage; also open a deep-linked one (?saved=id
  // from the home widget). window.location avoids a useSearchParams Suspense
  // boundary for a param only needed after mount.
  useEffect(() => {
    const list = loadSavedKhutbas();
    setSavedList(list);
    const id = new URLSearchParams(window.location.search).get("saved");
    if (id) {
      const entry = list.find((k) => k.id === id);
      if (entry) setOpenSaved(entry);
    }
  }, []);

  async function openSermon(slug: string) {
    const data = await api<SermonDetail>(`/api/khutba/sermons/${encodeURIComponent(slug)}`);
    setSelected(data);
    setMatchNotice("");
  }

  const persistSession = useCallback(() => {
    if (!fullLinesRef.current.length) return;
    const location = localStorage.getItem("noor-salah-label") ?? "";
    const saved = saveKhutba({
      location,
      lines: fullLinesRef.current,
      matchedTitle: matchedTitleRef.current,
      coverage: { ...coverageRef.current },
    });
    fullLinesRef.current = [];
    matchedTitleRef.current = undefined;
    coverageRef.current = { segments: 0, translated: 0, skipped: 0, failed: 0 };
    if (saved) {
      setSavedList(loadSavedKhutbas());
      setSavedToast(true);
    }
  }, []);

  /** Release the mic and timers. Safe to call repeatedly. */
  const teardownCapture = useCallback(() => {
    activeRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    // stop() flushes the last partial segment through ondataavailable, so this
    // must run before the tracks end for the closing dua to be captured.
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  function stop() {
    if (!activeRef.current) return;
    const recorder = recorderRef.current;
    // MediaRecorder fires "stop" after "dataavailable", so this resolves once
    // the closing segment is already sitting in the upload queue.
    const flushed =
      recorder?.state === "recording"
        ? new Promise<void>((resolve) =>
            recorder.addEventListener("stop", () => resolve(), { once: true }),
          )
        : Promise.resolve();
    teardownCapture();
    setActive(false);
    setStatus("");
    // Auto-save the session (with date + location) so it can be re-read later.
    // Waits for the final segment and then for the queue to drain, so the
    // closing dua is in the saved transcript rather than dropped on stop.
    void flushed
      .then(() => uploadQueueRef.current)
      .catch(() => undefined)
      .then(() => persistSession());
  }

  // Leaving the page mid-session must kill the mic and the upload loop. Without
  // this the interval outlives the unmounted component, so the recorder keeps
  // capturing and posting a segment every 10s until the tab is closed.
  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      teardownCapture();
      audioCtxRef.current?.close().catch(() => undefined);
      audioCtxRef.current = null;
    };
  }, [teardownCapture]);

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

  /** True when a segment carries no speech, so it is not worth transcribing.
   *
   * Byte size cannot tell us this — 10s of digital silence still encodes to
   * ~5KB of Opus, well past any size guard. Measured levels: speech sits near
   * RMS 0.16, while room tone that models happily transcribe as subtitle
   * boilerplate ("subscribe to the channel") sits at 0.0007–0.0023. */
  async function isSilent(blob: Blob): Promise<boolean> {
    try {
      const ctx = (audioCtxRef.current ??= new AudioContext());
      const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
      const samples = buffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
      return Math.sqrt(sum / samples.length) < SILENCE_RMS;
    } catch {
      // Never let a decode failure swallow real speech — transcribe it.
      return false;
    }
  }

  async function sendChunk(blob: Blob, session: number) {
    if (sessionRef.current !== session || blob.size < 1000) return;
    coverageRef.current.segments += 1;
    if (await isSilent(blob)) {
      coverageRef.current.skipped += 1;
      return;
    }
    if (sessionRef.current !== session) return;
    // Base64 in JSON: Vercel's Python runtime corrupts binary multipart bodies.
    const audioB64 = await blobToBase64(blob);
    const data = await api<{
      type: string;
      arabic?: string;
      english?: string;
      urdu?: string;
      accumulated?: string;
      accumulated_ar?: string;
      match?: { slug: string; title: string } | null;
      suggestion?: { slug: string; title: string } | null;
    }>("/api/khutba/live-chunk", {
      method: "POST",
      // Fires every ~10s during live listening — keep the top bar quiet.
      silent: true,
      body: JSON.stringify({
        audio_b64: audioB64,
        content_type: blob.type || "audio/webm",
        accumulated: accumulatedRef.current,
        accumulated_ar: accumulatedArRef.current,
      }),
    });
    if (sessionRef.current !== session) return;
    if (data.type === "translation") {
      coverageRef.current.translated += 1;
      accumulatedRef.current = data.accumulated || accumulatedRef.current;
      accumulatedArRef.current = data.accumulated_ar || accumulatedArRef.current;
      const line = { arabic: data.arabic ?? "", english: data.english ?? "", urdu: data.urdu ?? "" };
      fullLinesRef.current = [...fullLinesRef.current, line];
      setLines((prev) => [line, ...prev].slice(0, 20));
      setStatus(t(lang, "khutbaHint"));
    } else {
      // "empty" — the segment reached Deepgram but held no speech.
      coverageRef.current.skipped += 1;
    }
    if (data.match) {
      matchedTitleRef.current = decodeHtmlEntities(data.match.title);
      stop();
      setSuggestion(null);
      setMatchNotice(`${t(lang, "khutbaMatched")}: ${decodeHtmlEntities(data.match.title)}`);
      await openSermon(data.match.slug);
    } else if (data.suggestion) {
      setSuggestion(data.suggestion);
    }
  }

  function queueChunk(blob: Blob, session: number, attempt = 0) {
    // Segments must be transcribed in order so the accumulated text stays coherent.
    uploadQueueRef.current = uploadQueueRef.current
      .then(() => sendChunk(blob, session))
      .catch((err) => {
        // Transient network/API hiccups (Deepgram/Groq briefly erroring, a
        // dropped connection) are common on a 10s cadence — one silent retry
        // clears most of them before we bother the user with an error state.
        if (attempt < 1 && sessionRef.current === session) {
          queueChunk(blob, session, attempt + 1);
          return;
        }
        coverageRef.current.failed += 1;
        // api()'s _fetch already turns network/HTTP failures into a safe,
        // user-facing message (or a generic fallback) — pass it through
        // instead of masking every failure with the same generic string.
        if (activeRef.current) {
          const message = err instanceof Error ? err.message : "";
          setStatus(message || t(lang, "khutbaChunkError"));
        }
      });
  }

  async function start() {
    try {
      setMatchNotice("");
      setSuggestion(null);
      setSelected(null);
      setOpenSaved(null);
      setLines([]);
      accumulatedRef.current = "";
      accumulatedArRef.current = "";
      fullLinesRef.current = [];
      matchedTitleRef.current = undefined;
      coverageRef.current = { segments: 0, translated: 0, skipped: 0, failed: 0 };
      uploadQueueRef.current = Promise.resolve();
      const session = (sessionRef.current += 1);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) queueChunk(e.data, session);
      };

      activeRef.current = true;
      recorder.start();
      // Restart every 10s so each blob is a complete, independently decodable file.
      intervalRef.current = setInterval(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          recorder.start();
        }
      }, 10000);

      setActive(true);
      setStatus(t(lang, "khutbaListening"));
    } catch {
      setStatus(t(lang, "khutbaMicError"));
    }
  }

  function removeSaved(id: string) {
    setSavedList(deleteSavedKhutba(id));
    setOpenSaved((cur) => (cur?.id === id ? null : cur));
  }

  async function exportPdf(khutba: SavedKhutba) {
    if (pdfBusyId) return;
    setPdfBusyId(khutba.id);
    setPdfNotice(t(lang, "khutbaPdfPreparing"));
    const result = await downloadKhutbaPdf(khutba, lang, t(lang, "savedKhutbaTitle"));
    setPdfBusyId(null);
    setPdfNotice(
      t(
        lang,
        result === "saved"
          ? "khutbaPdfSaved"
          : result === "downloaded"
            ? "khutbaPdfDownloaded"
            : "khutbaPdfFailed",
      ),
    );
    window.setTimeout(() => setPdfNotice(""), 4000);
  }

  return (
    <div className="space-y-8">
      <SavedToast
        open={savedToast}
        label={t(lang, "khutbaSaved")}
        onDone={() => setSavedToast(false)}
      />
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-heading">{t(lang, "khutba")}</h1>
        <p className="text-sm text-muted">{t(lang, "khutbaHint")}</p>

        <button
          onClick={active ? stop : start}
          className={`btn-primary min-h-11 w-full sm:w-auto ${active ? "bg-red-700 hover:bg-red-800" : ""}`}
        >
          {active ? t(lang, "stopKhutba") : t(lang, "startKhutba")}
        </button>

        {status && !active && (
          <NoticeCard
            tone="warning"
            title={t(lang, "khutbaNotReady")}
            message={status}
            actionLabel={t(lang, "tryAgain")}
            onAction={() => void start()}
          />
        )}
        {status && active && <LoadingGlass size="sm" label={status} />}
        {matchNotice && (
          <div className="card border-gold-400 bg-gold-50 dark:border-gold-500 dark:bg-noor-900/80">
            <p className="font-medium text-heading">{matchNotice}</p>
            <p className="mt-1 text-sm text-muted">{t(lang, "khutbaMatchedHint")}</p>
          </div>
        )}
        {suggestion && !matchNotice && (
          <div className="card border-gold-400 bg-gold-50 dark:border-gold-500 dark:bg-noor-900/80">
            <p className="font-medium text-heading">
              {t(lang, "khutbaSuggested")}: {decodeHtmlEntities(suggestion.title)}
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-accent hover:underline"
              onClick={() => {
                stop();
                setSuggestion(null);
                void openSermon(suggestion.slug);
              }}
            >
              {t(lang, "khutbaOpenSuggestion")} →
            </button>
          </div>
        )}
      </div>

      {!selected && lines.length > 0 && (
        <section className="space-y-4">
          {lines.map((line, i) => (
            <div key={i} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-accent">{t(lang, "arabic")}</p>
                <p className="font-arabic mt-1 text-right" dir="rtl">{line.arabic}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-accent">{t(lang, "english")}</p>
                <p className="mt-1 text-sm text-body">{line.english}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-accent">{t(lang, "urdu")}</p>
                <p className="mt-1 text-sm text-body" dir="rtl">{line.urdu}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {openSaved && !selected && (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => setOpenSaved(null)}
            className="text-sm text-accent hover:underline"
          >
            ← {t(lang, "savedKhutbas")}
          </button>
          <article className="card space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-heading">
                {openSaved.matchedTitle || t(lang, "savedKhutbaTitle")}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {formatKhutbaDate(openSaved.savedAt, lang)}
                {openSaved.location ? ` · 📍 ${openSaved.location}` : ""}
              </p>
              <p className="mt-1 text-xs text-faint">
                {t(lang, "khutbaCoverage")}:{" "}
                {coverageSummary(openSaved.coverage) || t(lang, "khutbaCoverageNone")}
              </p>
              <button
                type="button"
                onClick={() => void exportPdf(openSaved)}
                disabled={pdfBusyId === openSaved.id}
                className="btn-primary mt-3 min-h-11 disabled:opacity-60"
              >
                {pdfBusyId === openSaved.id
                  ? t(lang, "khutbaPdfPreparing")
                  : `⬇ ${t(lang, "khutbaDownloadPdf")}`}
              </button>
              {pdfNotice && <p className="mt-2 text-xs text-accent">{pdfNotice}</p>}
            </div>
            <div className="space-y-3">
              {openSaved.lines.map((line, i) => (
                <div key={i} className="grid gap-3 border-b border-subtle pb-3 last:border-b-0 last:pb-0 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium text-accent">{t(lang, "arabic")}</p>
                    <p className="font-arabic mt-1 text-right" dir="rtl">{line.arabic}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-accent">{t(lang, "english")}</p>
                    <p className="mt-1 text-sm text-body">{line.english}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-accent">{t(lang, "urdu")}</p>
                    <p className="mt-1 text-sm text-body" dir="rtl">{line.urdu}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => removeSaved(openSaved.id)}
              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              {t(lang, "khutbaDelete")}
            </button>
          </article>
        </section>
      )}

      {!selected && !openSaved && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-heading">{t(lang, "savedKhutbas")}</h2>
            <p className="text-sm text-muted">{t(lang, "savedKhutbasHint")}</p>
          </div>
          {savedList.length === 0 ? (
            <p className="text-sm text-faint">{t(lang, "khutbaNoSaved")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {savedList.map((k) => (
                <div key={k.id} className="card flex items-start justify-between gap-2 text-left">
                  <button
                    type="button"
                    onClick={() => setOpenSaved(k)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <h3 className="truncate font-medium text-heading">
                      {k.matchedTitle || t(lang, "savedKhutbaTitle")}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatKhutbaDate(k.savedAt, lang)}
                      {k.location ? ` · 📍 ${k.location}` : ""}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportPdf(k)}
                    disabled={pdfBusyId === k.id}
                    aria-label={t(lang, "khutbaDownloadPdf")}
                    title={t(lang, "khutbaDownloadPdf")}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-sm text-faint hover:text-accent disabled:opacity-50"
                  >
                    {pdfBusyId === k.id ? "…" : "⬇"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSaved(k.id)}
                    aria-label={t(lang, "khutbaDelete")}
                    title={t(lang, "khutbaDelete")}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-sm text-faint hover:text-red-600 dark:hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {selected ? (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-sm text-accent hover:underline"
          >
            ← {t(lang, "khutbaBackToList")}
          </button>
          <article className="card space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-heading">{decodeHtmlEntities(selected.title)}</h2>
              <a
                href={selected.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-accent hover:underline"
              >
                {t(lang, "khutbaSource")}: khutbah.info
              </a>
            </div>
            <div className="prose-sm max-w-none space-y-3 text-sm leading-relaxed text-body">
              {selected.english_text.split(/\n\n+/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </article>
        </section>
      ) : (
        !openSaved && (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-heading">{t(lang, "khutbaBrowse")}</h2>
              <p className="text-sm text-muted">{t(lang, "khutbaBrowseHint")}</p>
            </div>

            <input
              className="input"
              placeholder={t(lang, "search")}
              value={sermonQuery}
              onChange={(e) => {
                setSermonQuery(e.target.value);
                loadSermons(e.target.value).catch(() => undefined);
              }}
            />

            {sermons.length === 0 ? (
              <NoticeCard
                tone="info"
                title={t(lang, "khutbaLibraryPreparing")}
                message={t(lang, "khutbaLibraryEmpty")}
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {sermons.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => openSermon(s.slug)}
                    className="card text-left transition hover:border-noor-300 hover:shadow-md dark:hover:border-noor-500"
                  >
                    <h3 className="font-medium text-heading">{decodeHtmlEntities(s.title)}</h3>
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      )}
    </div>
  );
}
