"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import { api, wsUrl } from "@/lib/api";
import { decodeHtmlEntities } from "@/lib/html";
import { t } from "@/lib/i18n";

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
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSermons = useCallback(async (q = "") => {
    const path = q.trim().length >= 2 ? `/api/khutba/sermons?q=${encodeURIComponent(q)}` : "/api/khutba/sermons";
    const data = await api<{ sermons: SermonSummary[] }>(path);
    setSermons(data.sermons);
  }, []);

  useEffect(() => {
    loadSermons().catch(() => setSermons([]));
  }, [loadSermons]);

  async function openSermon(slug: string) {
    const data = await api<SermonDetail>(`/api/khutba/sermons/${encodeURIComponent(slug)}`);
    setSelected(data);
    setMatchNotice("");
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setActive(false);
    setStatus("");
  }

  async function start() {
    try {
      setMatchNotice("");
      setSelected(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ws = new WebSocket(wsUrl("/api/khutba/live"));
      wsRef.current = ws;

      ws.onopen = () => {
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        recorderRef.current = recorder;

        recorder.ondataavailable = async (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const buf = await e.data.arrayBuffer();
            ws.send(buf);
          }
        };

        recorder.start();
        intervalRef.current = setInterval(() => {
          if (recorder.state === "recording") recorder.stop();
          recorder.start();
        }, 10000);

        setActive(true);
        setStatus(t(lang, "khutbaHint"));
      };

      ws.onmessage = async (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === "translation") {
          setLines((prev) =>
            [{ arabic: data.arabic, english: data.english, urdu: data.urdu }, ...prev].slice(0, 20),
          );
        }
        if (data.type === "matched") {
          stop();
          setMatchNotice(`${t(lang, "khutbaMatched")}: ${decodeHtmlEntities(data.title)}`);
          await openSermon(data.slug);
        }
      };

      ws.onerror = () => setStatus("We could not start live listening right now. Please try again in a moment.");
    } catch {
      setStatus("Microphone access is needed for live khutba translation. Please allow microphone permission and try again.");
    }
  }

  return (
    <div className="space-y-8">
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
            title="Live listening is not ready"
            message={status}
            actionLabel="Try again"
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
      </div>

      {active && lines.length > 0 && (
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
              title="Khutbah library is preparing"
              message="The khutbah collection is not available right now. Please refresh shortly."
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
      )}
    </div>
  );
}
