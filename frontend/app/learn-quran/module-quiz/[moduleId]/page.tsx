"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLang } from "@/components/LangProvider";
import { startRouteProgress } from "@/components/NavigationProgress";
import {
  awardModuleBadge,
  fetchLearnIndex,
  fetchLessons,
  isModuleComplete,
  loadProgress,
  moduleTitle,
  questionsForLesson,
  type LearnModule,
  type TestQuestion,
} from "@/lib/learn-quran";
import { t } from "@/lib/i18n";

export default function ModuleQuizPage() {
  const { lang } = useLang();
  const params = useParams();
  const router = useRouter();
  const moduleId = String(params.moduleId || "");
  const [mod, setMod] = useState<LearnModule | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const index = await fetchLearnIndex();
        const m = index.modules.find((x) => x.id === moduleId) ?? null;
        if (!m) {
          setError("missing");
          return;
        }
        const progress = loadProgress();
        if (!isModuleComplete(progress, m)) {
          setError("incomplete");
          setMod(m);
          return;
        }
        setMod(m);
        const all = await fetchLessons();
        const pool: TestQuestion[] = [];
        for (const id of m.lesson_ids) {
          const lesson = all[id];
          if (!lesson) continue;
          pool.push(...questionsForLesson(lesson).slice(0, 3));
        }
        // Shuffle and cap
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        if (!cancelled) setQuestions(pool.slice(0, 10));
      } catch {
        if (!cancelled) setError("load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  const pct = useMemo(
    () => (questions.length ? Math.round((score / questions.length) * 100) : 0),
    [score, questions.length]
  );

  function answer(optionIdx: number) {
    const q = questions[idx];
    if (!q) return;
    const correct = optionIdx === q.answer;
    const nextScore = score + (correct ? 1 : 0);
    if (idx + 1 >= questions.length) {
      setScore(nextScore);
      setDone(true);
      awardModuleBadge(moduleId, Math.round((nextScore / questions.length) * 100));
    } else {
      setScore(nextScore);
      setIdx((i) => i + 1);
    }
  }

  if (error === "incomplete" && mod) {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-muted">{t(lang, "moduleQuizLocked")}</p>
        <Link href="/learn-quran" className="text-sm text-accent hover:underline">
          ← {t(lang, "learnQuran")}
        </Link>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-muted">{t(lang, "learnQuranLoadError")}</p>;
  }

  if (!mod || (!questions.length && !done)) {
    return <p className="text-sm text-faint">{t(lang, "loading")}</p>;
  }

  if (done) {
    const passed = pct >= 70;
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-bold text-heading">{t(lang, "moduleQuizDone")}</h1>
        <p className="text-sm text-muted">
          {moduleTitle(mod, lang)} · {pct}%
        </p>
        <p className="text-sm text-body">
          {passed ? t(lang, "moduleQuizPassed") : t(lang, "moduleQuizRetry")}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            startRouteProgress();
            router.push("/learn-quran");
          }}
        >
          {t(lang, "learnQuranBackCourse")}
        </button>
      </div>
    );
  }

  const q = questions[idx];
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          {t(lang, "moduleQuiz")} · {idx + 1}/{questions.length}
        </p>
        <h1 className="mt-1 text-xl font-bold text-heading">{moduleTitle(mod, lang)}</h1>
      </header>
      {q.prompt_ar && (
        <p className="font-arabic text-right text-2xl" dir="rtl">
          {q.prompt_ar}
        </p>
      )}
      <p className="text-sm text-body">{q.prompt_en}</p>
      <div className="space-y-2">
        {q.options.map((opt, i) => (
          <button
            key={`${idx}-${i}`}
            type="button"
            onClick={() => answer(i)}
            className="card w-full text-left text-sm hover:border-noor-300 dark:hover:border-noor-500"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
