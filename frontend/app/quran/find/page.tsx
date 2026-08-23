"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import { IconButton, Icons } from "@/components/IconButton";
import { LoadingGlass } from "@/components/LoadingGlass";
import { emitPageLoading } from "@/components/NavigationProgress";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { runOcr } from "@/lib/ocr";
import { cleanQuranText } from "@/lib/quran-display";

type Candidate = {
  verse_key: string;
  surah_number: number;
  ayah_number: number;
  arabic: string;
  translation_en: string;
  translation_ur: string;
  translation_hi: string;
  match_type: "arabic" | "english";
  confidence: "high" | "medium" | "low";
  score: number;
};

type Stage = "upload" | "reading" | "edit" | "searching" | "results";

const CONFIDENCE_KEY = {
  high: "confidenceHigh",
  medium: "confidenceMedium",
  low: "confidenceLow",
} as const;

const CONFIDENCE_CLASS: Record<Candidate["confidence"], string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default function FindFromScreenshotPage() {
  const { lang } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState("");

  async function handleFiles(files: File[]) {
    setError("");
    setStage("reading");
    setProgress(0);
    try {
      const extracted: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const perFileProgress = (pct: number) =>
          setProgress(Math.round(((i + pct / 100) / files.length) * 100));
        const result = await runOcr(files[i], perFileProgress);
        if (result.trim()) extracted.push(result.trim());
      }
      setText(extracted.join("\n\n"));
      setStage("edit");
    } catch {
      setError(t(lang, "ocrFailed"));
      setStage("upload");
    }
  }

  async function handleSearch() {
    if (text.trim().length < 3) return;
    setError("");
    setStage("searching");
    emitPageLoading(true);
    try {
      const data = await api<{ detected_script: string; candidates: Candidate[] }>("/api/quran/identify", {
        method: "POST",
        body: JSON.stringify({ text: text.trim() }),
      });
      setCandidates(data.candidates);
      setStage("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : t(lang, "noMatchFound"));
      setStage("edit");
    } finally {
      emitPageLoading(false);
    }
  }

  function reset() {
    setStage("upload");
    setText("");
    setCandidates([]);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function translationFor(c: Candidate): string {
    const raw = lang === "ur" ? c.translation_ur : lang === "hi" ? c.translation_hi || c.translation_en : c.translation_en;
    return cleanQuranText(raw);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <IconButton icon={Icons.back} label={t(lang, "quran")} href="/quran" />
        <div>
          <h1 className="text-2xl font-bold text-heading">{t(lang, "findFromScreenshot")}</h1>
          <p className="mt-1 text-sm text-muted">{t(lang, "findFromScreenshotDesc")}</p>
        </div>
      </div>

      {error && <NoticeCard tone="error" title={t(lang, "ocrFailed")} message={error} />}

      {stage === "upload" && (
        <label className="card flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed py-12 text-center hover:border-noor-300 dark:hover:border-noor-500">
          <span className="text-3xl" aria-hidden>
            📷
          </span>
          <span className="font-medium text-heading">{t(lang, "uploadScreenshot")}</span>
          <span className="text-xs text-faint">{t(lang, "uploadScreenshotHint")}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) void handleFiles(files);
            }}
          />
        </label>
      )}

      {stage === "reading" && (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <LoadingGlass size="lg" />
          <p className="text-sm text-muted">{t(lang, "extractingText")}</p>
          <p className="text-xs text-faint">{progress}%</p>
        </div>
      )}

      {(stage === "edit" || stage === "searching") && (
        <div className="card space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {t(lang, "editExtractedText")}
          </p>
          <textarea
            className="input min-h-[120px] resize-y text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            dir="auto"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary min-h-11 sm:min-h-0"
              onClick={() => void handleSearch()}
              disabled={stage === "searching" || text.trim().length < 3}
            >
              {stage === "searching" ? t(lang, "matchingQuran") : t(lang, "searchThisText")}
            </button>
            <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={reset}>
              {t(lang, "tryAnotherImage")}
            </button>
          </div>
        </div>
      )}

      {stage === "results" && (
        <div className="space-y-3">
          {candidates.length === 0 ? (
            <NoticeCard
              tone="warning"
              title={t(lang, "noMatchFound")}
              message={t(lang, "noMatchFoundHint")}
              actionLabel={t(lang, "tryAnotherImage")}
              onAction={reset}
            />
          ) : (
            <>
              {candidates.map((c) => (
                <Link
                  key={c.verse_key}
                  href={`/quran/${c.surah_number}?ayah=${c.ayah_number}`}
                  className="card block hover:border-noor-300 dark:hover:border-noor-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-accent">{c.verse_key}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONFIDENCE_CLASS[c.confidence]}`}>
                      {t(lang, CONFIDENCE_KEY[c.confidence])} · {Math.round(c.score * 100)}%
                    </span>
                  </div>
                  <p className="font-arabic mt-2 text-right text-lg" dir="rtl">
                    {c.arabic}
                  </p>
                  <p className="mt-2 text-sm text-body" dir={lang === "ur" ? "rtl" : "ltr"}>
                    {translationFor(c)}
                  </p>
                  <p className="mt-2 text-xs font-medium text-accent">{t(lang, "goToAyah")} →</p>
                </Link>
              ))}
              <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={reset}>
                {t(lang, "tryAnotherImage")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
