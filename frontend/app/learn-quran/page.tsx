"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import {
  completedCount,
  fetchLearnIndex,
  levelForPoints,
  levelTitle,
  loadProgress,
  moduleTitle,
  saveProgress,
  type LearnModule,
  type LearnProgress,
  type LearnQuranIndex,
} from "@/lib/learn-quran";
import { LearnTrail } from "@/components/LearnTrail";
import { t } from "@/lib/i18n";

export default function LearnQuranPage() {
  const { lang } = useLang();
  const [index, setIndex] = useState<LearnQuranIndex | null>(null);
  const [progress, setProgress] = useState<LearnProgress>({ lessons: {}, streak: 0, points: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    setProgress(loadProgress());
    fetchLearnIndex()
      .then(setIndex)
      .catch(() => setError("learnQuranLoadError"));
    // Signed in? Pull cloud progress so another device's work shows up here.
    void import("@/lib/auth")
      .then(async (auth) => {
        if (!auth.isLoggedIn()) return;
        const remote = await auth.pullRemoteProgress();
        const merged = auth.mergeProgress(loadProgress(), remote);
        saveProgress(merged);
        setProgress(merged);
      })
      .catch(() => undefined);
  }, []);

  const totalCompleted = useMemo(() => {
    if (!index) return 0;
    const allIds = index.modules.flatMap((m) => m.lesson_ids);
    return completedCount(progress, allIds);
  }, [index, progress]);

  const totalLessons = index?.meta.total_lessons ?? 0;
  const pct = totalLessons ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  const levelInfo = levelForPoints(progress.points);

  if (error) {
    return (
      <div className="card text-center">
        <p className="text-sm text-muted">{t(lang, "learnQuranLoadError")}</p>
      </div>
    );
  }

  if (!index) {
    return <p className="text-sm text-faint">{t(lang, "loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-heading">{t(lang, "learnQuran")}</h1>
        <p className="text-sm leading-relaxed text-muted">{t(lang, "learnQuranSubtitle")}</p>
      </header>

      <LearnTrail index={index} progress={progress} lang={lang} />

      <div className="card border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent">{t(lang, "learnQuranProgress")}</p>
            <p className="mt-1 text-2xl font-bold text-heading">{pct}%</p>
            <p className="text-xs text-muted">
              {totalCompleted}/{totalLessons} {t(lang, "learnQuranLessonsDone")}
              {progress.streak > 0 && ` · ${progress.streak} ${t(lang, "salahStreak")}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-heading">
              {levelInfo.level.icon} {progress.points} <span className="text-xs font-normal text-muted">{t(lang, "learnQuranPoints")}</span>
            </p>
            <p className="text-xs font-medium text-accent">{levelTitle(levelInfo.level, lang)}</p>
            {levelInfo.next && (
              <p className="text-[10px] text-faint">
                {levelInfo.next.min - progress.points} → {levelTitle(levelInfo.next, lang)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Link
        href="/learn-quran/test"
        className="card flex items-center gap-3 border-dashed border-amber-300 transition hover:shadow-md dark:border-amber-800"
      >
        <span className="text-2xl">🧭</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-heading">{t(lang, "learnQuranMockTest")}</span>
          <span className="block text-xs text-muted">
            {progress.placement ? t(lang, "learnQuranRetakeHint") : t(lang, "learnQuranMockTestHint")}
          </span>
        </span>
        <span className="text-accent">→</span>
      </Link>

      <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-body dark:border-amber-900 dark:bg-amber-950/20">
        {t(lang, "learnQuranPrereq")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {index.modules.map((mod) => (
          <ModuleCard key={mod.id} mod={mod} lang={lang} progress={progress} />
        ))}
      </div>

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-heading">{t(lang, "learnQuranSources")}</summary>
        <ul className="mt-3 space-y-3">
          {index.meta.sources.sources.map((src) => (
            <li key={src.id} className="text-xs text-muted">
              <p className="font-medium text-body">{src.title_en}</p>
              {src.author && <p>{src.author}{src.institution ? ` · ${src.institution}` : ""}</p>}
              <p className="mt-0.5 text-faint">{src.role}</p>
              {src.url && (
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                  {src.url.replace(/^https?:\/\//, "")}
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-faint">{index.meta.sources.disclaimer_en}</p>
      </details>
    </div>
  );
}

function ModuleCard({
  mod,
  lang,
  progress,
}: {
  mod: LearnModule;
  lang: string;
  progress: LearnProgress;
}) {
  const done = completedCount(progress, mod.lesson_ids);
  const total = mod.lesson_ids.length;
  const nextId = mod.lesson_ids.find((id) => !progress.lessons[id]?.completed) ?? mod.lesson_ids[0];

  return (
    <article className="card flex flex-col gap-3 transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl dark:bg-emerald-900/40">
          {mod.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-heading">{moduleTitle(mod, lang)}</h2>
          <p className="mt-0.5 text-xs text-muted">{mod.desc_en}</p>
          <p className="mt-2 text-xs font-medium text-accent">
            {done}/{total} {t(lang as "en", "learnQuranLessonsDone")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/learn-quran/${nextId}`} className="btn-primary text-sm">
          {done === total ? t(lang as "en", "learnQuranReview") : t(lang as "en", "learnQuranContinue")}
        </Link>
        <Link
          href={`/learn-quran/${mod.lesson_ids[0]}`}
          className="rounded-full border border-subtle px-4 py-2 text-sm text-body hover:bg-surface-muted"
        >
          {t(lang as "en", "learnQuranStartModule")}
        </Link>
      </div>
    </article>
  );
}
