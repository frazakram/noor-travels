"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
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
  type SavedKhutba,
} from "@/lib/khutba-history";

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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  const accumulatedRef = useRef("");
  const accumulatedArRef = useRef("");
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Full chronological transcript of the current session — the on-screen list
  // is capped at 20 lines, but the saved khutba must keep everything.
  const fullLinesRef = useRef<Translation[]>([]);
  const matchedTitleRef = useRef<string | undefined>(undefined);

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
    });
    fullLinesRef.current = [];
    matchedTitleRef.current = undefined;
    if (saved) {
      setSavedList(loadSavedKhutbas());
      setSavedToast(true);
    }
  }, []);

  function stop() {
    activeRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
    setStatus("");
    // Auto-save the session (with date + location) so it can be re-read later.
    persistSession();
  }

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

  async function sendChunk(blob: Blob) {
    if (!activeRef.current || blob.size < 1000) return;
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
    if (!activeRef.current) return;
    if (data.type === "translation") {
      accumulatedRef.current = data.accumulated || accumulatedRef.current;
      accumulatedArRef.current = data.accumulated_ar || accumulatedArRef.current;
      const line = { arabic: data.arabic ?? "", english: data.english ?? "", urdu: data.urdu ?? "" };
      fullLinesRef.current = [...fullLinesRef.current, line];
      setLines((prev) => [line, ...prev].slice(0, 20));
      setStatus(t(lang, "khutbaHint"));
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

  function queueChunk(blob: Blob) {
    // Segments must be transcribed in order so the accumulated text stays coherent.
    uploadQueueRef.current = uploadQueueRef.current
      .then(() => sendChunk(blob))
      .catch(() => {
        if (activeRef.current) setStatus(t(lang, "khutbaChunkError"));
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
      uploadQueueRef.current = Promise.resolve();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) queueChunk(e.data);
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
      setStatus("Microphone access is needed for live khutba translation. Please allow microphone permission and try again.");
    }
  }

  function removeSaved(id: string) {
    setSavedList(deleteSavedKhutba(id));
    setOpenSaved((cur) => (cur?.id === id ? null : cur));
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
        {status && active && <p className="text-sm text-faint">{status}</p>}
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
