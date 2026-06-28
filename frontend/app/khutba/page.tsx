"use client";

import { useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { wsUrl } from "@/lib/api";
import { t } from "@/lib/i18n";

type Translation = {
  arabic: string;
  english: string;
  urdu: string;
};

export default function KhutbaPage() {
  const { lang } = useLang();
  const [active, setActive] = useState(false);
  const [lines, setLines] = useState<Translation[]>([]);
  const [status, setStatus] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === "translation") {
          setLines((prev) => [{ arabic: data.arabic, english: data.english, urdu: data.urdu }, ...prev].slice(0, 20));
        }
      };

      ws.onerror = () => setStatus("WebSocket error — is backend running?");
    } catch {
      setStatus("Microphone permission denied or not available");
    }
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    recorderRef.current?.stop();
    wsRef.current?.close();
    setActive(false);
    setStatus("");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-noor-800">{t(lang, "khutba")}</h1>
      <p className="text-sm text-noor-600">{t(lang, "khutbaHint")}</p>

      <button
        onClick={active ? stop : start}
        className={`btn-primary ${active ? "bg-red-700 hover:bg-red-800" : ""}`}
      >
        {active ? t(lang, "stopKhutba") : t(lang, "startKhutba")}
      </button>

      {status && <p className="text-sm text-noor-500">{status}</p>}

      <div className="space-y-4">
        {lines.map((line, i) => (
          <div key={i} className="card grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-gold-500">{t(lang, "arabic")}</p>
              <p className="font-arabic mt-1 text-right" dir="rtl">{line.arabic}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gold-500">{t(lang, "english")}</p>
              <p className="mt-1 text-sm">{line.english}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gold-500">{t(lang, "urdu")}</p>
              <p className="mt-1 text-sm" dir="rtl">{line.urdu}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
