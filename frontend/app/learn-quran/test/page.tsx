"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import {
  applyPlacement,
  buildPlacementTest,
  buildReadingCheck,
  fetchLearnIndex,
  fetchLessons,
  moduleTitle,
  SCRIPT_CHECK_MODULE_ID,
  type LearnLesson,
  type LearnQuranIndex,
  type TestQuestion,
} from "@/lib/learn-quran";
import { startRouteProgress } from "@/components/NavigationProgress";
import { t } from "@/lib/i18n";

const PASS_RATIO = 2 / 3;

type TestItem = { moduleId: string; question: TestQuestion };

export default function PlacementTestPage() {
  const { lang } = useLang();
  const router = useRouter();
  const [index, setIndex] = useState<LearnQuranIndex | null>(null);
  const [lessons, setLessons] = useState<Record<string, LearnLesson> | null>(null);
  const [items, setItems] = useState<TestItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<{ moduleId: string; correct: boolean }[]>([]);
  const [done, setDone] = useState(false);
  const [applied, setApplied] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoadError(false);
    Promise.all([fetchLearnIndex(), fetchLessons()])
      .then(([i, l]) => {
        setIndex(i);
        setLessons(l);
        setItems(buildTest(i, l));
      })
      .catch(() => setLoadError(true));
  };

  useEffect(load, []);

  function buildTest(i: LearnQuranIndex, l: Record<string, LearnLesson>): TestItem[] {
    // Script reading first: the whole course assumes the learner decodes
    // Arabic letters — verify before measuring vocabulary/grammar.
    const script = buildReadingCheck(5).map((question) => ({
      moduleId: SCRIPT_CHECK_MODULE_ID,
      question,
    }));
    return [...script, ...buildPlacementTest(i, l, 3)];
  }

  const summary = useMemo(() => {
    if (!index || !done) return null;
    const perModule: Record<string, { correct: number; total: number }> = {};
    for (const mod of index.modules) perModule[mod.id] = { correct: 0, total: 0 };
    const script = { correct: 0, total: 0 };
    for (const r of results) {
      const bucket = r.moduleId === SCRIPT_CHECK_MODULE_ID ? script : perModule[r.moduleId];
      if (!bucket) continue; // stale module id — skip rather than crash
      bucket.total += 1;
      if (r.correct) bucket.correct += 1;
    }
    const ordered = [...index.modules].sort((a, b) => a.order - b.order);
    const firstWeak = ordered.find((m) => {
      const s = perModule[m.id];
      return s.total > 0 && s.correct / s.total < PASS_RATIO;
    });
    const canReadScript = script.total === 0 || script.correct / script.total >= 0.6;
    // Weak script reading overrides everything: start at the very beginning.
    const placedModuleId = canReadScript ? (firstWeak ?? ordered[ordered.length - 1]).id : ordered[0].id;
    const correctTotal = results.filter((r) => r.correct).length;
    return {
      perModule,
      script,
      canReadScript,
      placedModuleId,
      correctTotal,
      allPassed: canReadScript && !firstWeak,
    };
  }, [index, done, results]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="card text-center">
          <p className="text-sm text-muted">{t(lang, "learnQuranLoadError")}</p>
          <button type="button" onClick={load} className="btn-primary mt-3 text-sm">
            {t(lang, "learnQuranRetry")}
          </button>
        </div>
      </div>
    );
  }

  if (!index || !lessons || items.length === 0) {
    return <p className="text-sm text-faint">{t(lang, "loading")}</p>;
  }

  const item = items[idx];

  // choice === -1 means "I don't know": counted as not-known, and the
  // correct option is revealed so the moment still teaches something.
  function answer(choice: number) {
    if (selected !== null || !item) return;
    setSelected(choice);
    const correct = item.question.answer === choice;
    setTimeout(() => {
      setResults((r) => [...r, { moduleId: item.moduleId, correct }]);
      if (idx + 1 >= items.length) setDone(true);
      else {
        setIdx((i) => i + 1);
        setSelected(null);
      }
    }, choice === -1 ? 900 : 600);
  }

  function handleApply() {
    if (!index || !summary || applied) return;
    applyPlacement(index, summary.perModule, summary.placedModuleId, summary.correctTotal);
    setApplied(true);
    const placed = index.modules.find((m) => m.id === summary.placedModuleId);
    startRouteProgress();
    router.push(`/learn-quran/${placed?.lesson_ids[0] ?? ""}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="text-sm">
        <Link href="/learn-quran" className="text-accent hover:underline">
          ← {t(lang, "learnQuran")}
        </Link>
      </div>
      <header>
        <h1 className="text-xl font-bold text-heading sm:text-2xl">{t(lang, "learnQuranMockTest")}</h1>
        <p className="mt-1 text-sm text-muted">{t(lang, "learnQuranMockTestHint")}</p>
      </header>

      {!done ? (
        <div className="card">
          <div className="flex items-center justify-between text-xs text-faint">
            <span>
              {idx + 1}/{items.length}
            </span>
            <span>
              {item.moduleId === SCRIPT_CHECK_MODULE_ID
                ? t(lang, "learnQuranScriptCheck")
                : moduleTitle(index.modules.find((m) => m.id === item.moduleId)!, lang)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${(idx / items.length) * 100}%` }}
            />
          </div>
          {item.question.prompt_ar && (
            <p className="font-arabic mt-4 text-center text-3xl" dir="rtl">
              {item.question.prompt_ar}
            </p>
          )}
          <p className="mt-3 text-sm font-medium text-heading">
            {item.moduleId === SCRIPT_CHECK_MODULE_ID ? t(lang, "learnQuranHowRead") : item.question.prompt_en}
          </p>
          <div className="mt-4 grid gap-2">
            {item.question.options.map((opt, i) => {
              const isSel = selected === i;
              const isCorrect = item.question.answer === i;
              let cls = "border-subtle hover:border-teal-400";
              if (isSel)
                cls = isCorrect
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-red-400 bg-red-50 dark:bg-red-950/30";
              else if (selected !== null && isCorrect)
                cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => answer(i)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm text-body ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => answer(-1)}
              className={`rounded-xl border border-dashed px-4 py-2.5 text-center text-xs font-medium transition ${
                selected === -1
                  ? "border-slate-400 bg-surface-muted text-body"
                  : "border-subtle text-muted hover:border-slate-400 hover:text-body"
              }`}
            >
              🤷 {t(lang, "learnQuranDontKnow")}
            </button>
          </div>
        </div>
      ) : (
        summary && (
          <div className="space-y-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-heading">
                {summary.correctTotal}/{items.length}
              </p>
              <p className="mt-1 text-sm text-muted">
                {t(lang, "learnQuranTestResult")} · +{summary.correctTotal * 2} {t(lang, "learnQuranPoints")}
              </p>
            </div>

            {!summary.canReadScript && (
              <div className="card border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
                <p className="text-sm font-medium text-heading">⚠️ {t(lang, "learnQuranScriptWarnTitle")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t(lang, "learnQuranScriptWarn")}</p>
              </div>
            )}

            <div className="card space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-lg">🔤</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm text-body">{t(lang, "learnQuranScriptCheck")}</p>
                    <span className="text-xs text-muted">
                      {summary.script.correct}/{summary.script.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={`h-full rounded-full ${summary.canReadScript ? "bg-emerald-500" : "bg-amber-400"}`}
                      style={{
                        width: `${summary.script.total ? (summary.script.correct / summary.script.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              {[...index.modules]
                .sort((a, b) => a.order - b.order)
                .map((mod) => {
                  const s = summary.perModule[mod.id];
                  const isHere = mod.id === summary.placedModuleId && !summary.allPassed;
                  const passed = s.total > 0 && s.correct / s.total >= PASS_RATIO;
                  return (
                    <div key={mod.id} className="flex items-center gap-3">
                      <span className="w-6 text-center text-lg">{mod.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm text-body">{moduleTitle(mod, lang)}</p>
                          <span className="text-xs text-muted">
                            {s.correct}/{s.total}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className={`h-full rounded-full ${passed ? "bg-emerald-500" : "bg-amber-400"}`}
                            style={{ width: `${s.total ? (s.correct / s.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      {isHere && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                          {t(lang, "learnQuranYouAreHere")}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="flex flex-wrap gap-2">
              {!applied && (
                <button type="button" onClick={handleApply} className="btn-primary text-sm">
                  {summary.allPassed ? t(lang, "learnQuranBackCourse") : t(lang, "learnQuranApplyPlacement")}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setItems(buildTest(index, lessons));
                  setIdx(0);
                  setSelected(null);
                  setResults([]);
                  setDone(false);
                  setApplied(false);
                }}
                className="rounded-full border border-subtle px-4 py-2 text-sm text-body"
              >
                {t(lang, "learnQuranRetake")}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
