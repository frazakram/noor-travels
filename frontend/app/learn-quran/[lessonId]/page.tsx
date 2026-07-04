"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import {
  fetchLearnIndex,
  fetchLessons,
  lessonTitle,
  loadProgress,
  markLessonComplete,
  wordMeaning,
  type GrammarLesson,
  type LearnLesson,
  type LearnProgress,
  type LearnQuranIndex,
  type ReadingLesson,
  type RootsLesson,
  type VocabLesson,
} from "@/lib/learn-quran";
import { LearnTrail } from "@/components/LearnTrail";
import { startRouteProgress } from "@/components/NavigationProgress";
import { t } from "@/lib/i18n";

export default function LearnLessonPage() {
  const params = useParams();
  const lessonId = String(params.lessonId || "");
  const { lang } = useLang();
  const router = useRouter();
  const [index, setIndex] = useState<LearnQuranIndex | null>(null);
  const [lessons, setLessons] = useState<Record<string, LearnLesson> | null>(null);
  const [tab, setTab] = useState<"learn" | "quiz">("learn");
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [readingReveal, setReadingReveal] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<LearnProgress>({ lessons: {}, streak: 0, points: 0 });
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoadError(false);
    setProgress(loadProgress());
    Promise.all([fetchLearnIndex(), fetchLessons()])
      .then(([idx, all]) => {
        setIndex(idx);
        setLessons(all);
      })
      .catch(() => setLoadError(true));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const lesson = lessons?.[lessonId];
  const module = index?.modules.find((m) => m.lesson_ids.includes(lessonId));
  const lessonIds = module?.lesson_ids ?? [];
  const posInModule = lessonIds.indexOf(lessonId);
  const prevId = posInModule > 0 ? lessonIds[posInModule - 1] : null;
  const nextId = posInModule >= 0 && posInModule < lessonIds.length - 1 ? lessonIds[posInModule + 1] : null;

  const finishLesson = useCallback(
    (score?: number) => {
      markLessonComplete(lessonId, score);
      startRouteProgress();
      if (nextId) router.push(`/learn-quran/${nextId}`);
      else router.push("/learn-quran");
    },
    [lessonId, nextId, router],
  );

  const vocabLesson = lesson?.type === "vocabulary" ? (lesson as VocabLesson) : null;
  const quizItems = useMemo(() => {
    if (!lesson) return [];
    if (lesson.type === "vocabulary") return lesson.quiz;
    if (lesson.type === "grammar") return (lesson as GrammarLesson).practice.map((p) => ({
      type: "grammar",
      prompt_en: p.q_en,
      options: p.options,
      answer: p.answer,
    }));
    return [];
  }, [lesson]);

  function handleQuizAnswer(choice: number) {
    if (selected !== null) return;
    setSelected(choice);
    const correct = quizItems[quizIdx]?.answer === choice;
    if (correct) setQuizScore((s) => s + 1);
    setTimeout(() => {
      if (quizIdx + 1 >= quizItems.length) {
        setQuizDone(true);
        const finalScore = correct ? quizScore + 1 : quizScore;
        setProgress(markLessonComplete(lessonId, Math.round((finalScore / quizItems.length) * 100)));
      } else {
        setQuizIdx((i) => i + 1);
        setSelected(null);
      }
    }, 700);
  }

  if (loadError) {
    return (
      <div className="card text-center">
        <p className="text-sm text-muted">{t(lang, "learnQuranLoadError")}</p>
        <button type="button" onClick={load} className="btn-primary mt-3 text-sm">
          {t(lang, "learnQuranRetry")}
        </button>
      </div>
    );
  }

  if (lessons && !lesson) {
    return (
      <div className="card text-center">
        <p className="text-sm text-muted">{t(lang, "learnQuranLessonNotFound")}</p>
        <Link href="/learn-quran" className="btn-primary mt-3 inline-block text-sm">
          ← {t(lang, "learnQuranBackCourse")}
        </Link>
      </div>
    );
  }

  if (!lesson) {
    return <p className="text-sm text-faint">{t(lang, "loading")}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/learn-quran" className="text-accent hover:underline">
          ← {t(lang, "learnQuran")}
        </Link>
        {module && <span className="text-faint">/ {module.title_en}</span>}
      </div>

      {index && <LearnTrail index={index} progress={progress} lang={lang} currentLessonId={lessonId} />}

      <header>
        <h1 className="text-xl font-bold text-heading sm:text-2xl">{lessonTitle(lesson, lang)}</h1>
        {"intro_en" in lesson && <p className="mt-2 text-sm leading-relaxed text-muted">{lesson.intro_en}</p>}
        {"coverage_pct" in lesson && lesson.coverage_pct && (
          <p className="mt-1 text-xs font-medium text-accent">
            ~{lesson.coverage_pct}% {t(lang, "learnQuranCoverage")}
          </p>
        )}
      </header>

      {(lesson.type === "vocabulary" || lesson.type === "grammar") && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("learn")}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === "learn" ? "bg-teal-700 text-white" : "border border-subtle text-body"}`}
          >
            {t(lang, "learnQuranStudy")}
          </button>
          <button
            type="button"
            onClick={() => setTab("quiz")}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === "quiz" ? "bg-teal-700 text-white" : "border border-subtle text-body"}`}
          >
            {t(lang, "learnQuranQuiz")}
          </button>
        </div>
      )}

      {lesson.type === "vocabulary" && tab === "learn" && vocabLesson && (
        <VocabCards
          lesson={vocabLesson}
          lang={lang}
          cardIdx={cardIdx}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          onPrev={() => {
            setFlipped(false);
            setCardIdx((i) => Math.max(0, i - 1));
          }}
          onNext={() => {
            setFlipped(false);
            setCardIdx((i) => Math.min(vocabLesson.words.length - 1, i + 1));
          }}
        />
      )}

      {lesson.type === "grammar" && tab === "learn" && (
        <GrammarView lesson={lesson as GrammarLesson} />
      )}

      {lesson.type === "roots" && <RootsView lesson={lesson as RootsLesson} lang={lang} />}

      {lesson.type === "reading" && (
        <ReadingView
          lesson={lesson as ReadingLesson}
          lang={lang}
          reveal={readingReveal}
          onToggle={(vk) => setReadingReveal((r) => ({ ...r, [vk]: !r[vk] }))}
        />
      )}

      {tab === "quiz" && quizItems.length > 0 && (
        <div className="card">
          {!quizDone ? (
            <>
              <p className="text-xs text-faint">
                {quizIdx + 1}/{quizItems.length}
              </p>
              {"prompt_ar" in quizItems[quizIdx] && quizItems[quizIdx].prompt_ar ? (
                <p className="font-arabic mt-3 text-center text-3xl" dir="rtl">
                  {String(quizItems[quizIdx].prompt_ar)}
                </p>
              ) : null}
              <p className="mt-3 text-sm font-medium text-heading">{quizItems[quizIdx].prompt_en}</p>
              <div className="mt-4 grid gap-2">
                {quizItems[quizIdx].options.map((opt, i) => {
                  const isSel = selected === i;
                  const isCorrect = quizItems[quizIdx].answer === i;
                  let cls = "border-subtle hover:border-teal-400";
                  if (isSel) cls = isCorrect ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-red-400 bg-red-50 dark:bg-red-950/30";
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleQuizAnswer(i)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm text-body ${cls}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-lg font-semibold text-heading">
                {Math.round((quizScore / quizItems.length) * 100)}%
              </p>
              <p className="mt-1 text-sm text-muted">{t(lang, "learnQuranQuizDone")}</p>
              <p className="mt-1 text-xs font-medium text-accent">
                ⭐ {progress.points} {t(lang, "learnQuranPoints")}
              </p>
              <button type="button" onClick={() => finishLesson(Math.round((quizScore / quizItems.length) * 100))} className="btn-primary mt-4">
                {nextId ? t(lang, "learnQuranNextLesson") : t(lang, "learnQuranBackCourse")}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-subtle pt-4">
        {prevId && (
          <Link href={`/learn-quran/${prevId}`} className="rounded-full border border-subtle px-4 py-2 text-sm text-body">
            ← {t(lang, "prevPage")}
          </Link>
        )}
        {lesson.type !== "vocabulary" && lesson.type !== "grammar" && (
          <button type="button" onClick={() => finishLesson()} className="btn-primary text-sm">
            {t(lang, "learnQuranMarkDone")}
          </button>
        )}
        {tab === "learn" && (lesson.type === "vocabulary" || lesson.type === "grammar") && (
          <button
            type="button"
            onClick={() => {
              setTab("quiz");
              setQuizIdx(0);
              setQuizScore(0);
              setQuizDone(false);
              setSelected(null);
            }}
            className="btn-primary text-sm"
          >
            {t(lang, "learnQuranTakeQuiz")}
          </button>
        )}
        {nextId && (
          <Link href={`/learn-quran/${nextId}`} className="ml-auto rounded-full border border-subtle px-4 py-2 text-sm text-body">
            {t(lang, "nextPage")} →
          </Link>
        )}
      </div>
    </div>
  );
}

function VocabCards({
  lesson,
  lang,
  cardIdx,
  flipped,
  onFlip,
  onPrev,
  onNext,
}: {
  lesson: VocabLesson;
  lang: string;
  cardIdx: number;
  flipped: boolean;
  onFlip: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const word = lesson.words[cardIdx];
  if (!word) return null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onFlip}
        className="card mx-auto flex min-h-[220px] w-full max-w-md flex-col items-center justify-center border-2 border-emerald-200 bg-gradient-to-b from-white to-emerald-50/40 p-6 text-center dark:border-emerald-800 dark:from-slate-900 dark:to-emerald-950/20"
      >
        {!flipped ? (
          <>
            <p className="font-arabic text-4xl text-heading" dir="rtl">
              {word.ar}
            </p>
            <p className="mt-3 text-sm italic text-faint">{word.tr}</p>
            {word.freq > 0 && (
              <p className="mt-2 text-[10px] text-muted">
                {word.freq}× {t(lang as "en", "learnQuranInQuran")}
              </p>
            )}
            <p className="mt-4 text-xs text-accent">{t(lang as "en", "learnQuranTapReveal")}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-heading" dir={lang === "ur" ? "rtl" : "ltr"}>
              {wordMeaning(word, lang)}
            </p>
            {word.root && <p className="mt-2 text-xs text-muted">Root: {word.root}</p>}
            {word.examples && word.examples.length > 0 && (
              <p className="font-arabic mt-3 text-sm text-body" dir="rtl">
                {word.examples[0].snippet}
              </p>
            )}
          </>
        )}
      </button>
      <div className="flex items-center justify-center gap-4">
        <button type="button" onClick={onPrev} disabled={cardIdx === 0} className="rounded-full border border-subtle px-3 py-1 text-sm disabled:opacity-40">
          ←
        </button>
        <span className="text-xs text-muted">
          {cardIdx + 1}/{lesson.words.length}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={cardIdx >= lesson.words.length - 1}
          className="rounded-full border border-subtle px-3 py-1 text-sm disabled:opacity-40"
        >
          →
        </button>
      </div>
      <div className="card max-h-48 overflow-y-auto">
        <p className="mb-2 text-xs font-semibold text-heading">{t(lang as "en", "learnQuranWordList")}</p>
        <ul className="space-y-2">
          {lesson.words.map((w, i) => (
            <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-arabic text-right" dir="rtl">
                {w.ar}
              </span>
              <span className="text-muted">{wordMeaning(w, lang)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GrammarView({ lesson }: { lesson: GrammarLesson }) {
  return (
    <div className="space-y-4">
      {lesson.sections.map((sec, i) => (
        <article key={i} className="card">
          <h2 className="font-semibold text-heading">{sec.heading_en}</h2>
          <p className="mt-2 text-sm leading-relaxed text-body">{sec.body_en}</p>
          <ul className="mt-3 space-y-2">
            {sec.examples.map((ex, j) => (
              <li key={j} className="rounded-lg border border-subtle bg-surface-muted/40 p-3">
                <p className="font-arabic text-right text-lg" dir="rtl">
                  {ex.ar}
                </p>
                <p className="mt-1 text-sm text-body">{ex.en}</p>
                {ex.note && <p className="mt-1 text-xs text-faint">{ex.note}</p>}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function RootsView({ lesson, lang }: { lesson: RootsLesson; lang: string }) {
  return (
    <div className="space-y-4">
      {lesson.roots.map((root, i) => (
        <article key={i} className="card">
          <h2 className="font-arabic text-2xl text-heading" dir="rtl">
            {root.root}
          </h2>
          <ul className="mt-3 space-y-2">
            {root.words.map((w, j) => (
              <li key={j} className="flex justify-between gap-2 text-sm">
                <span className="font-arabic" dir="rtl">
                  {w.ar}
                </span>
                <span className="text-muted">{w.en}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
      <Link href={`/quran/${lesson.practice_ayah.split(":")[0]}`} className="text-sm text-accent underline">
        {t(lang as "en", "learnQuranReadInQuran")} ({lesson.practice_ayah})
      </Link>
    </div>
  );
}

function ReadingView({
  lesson,
  lang,
  reveal,
  onToggle,
}: {
  lesson: ReadingLesson;
  lang: string;
  reveal: Record<string, boolean>;
  onToggle: (vk: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{t(lang as "en", "learnQuranReadingHint")}</p>
      {lesson.verses.map((v, i) => {
        const showTranslation = reveal[v.verse_key] ?? i < lesson.hide_translation_after;
        return (
          <article key={v.verse_key} className="card">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-accent">{v.verse_key}</span>
              <button type="button" onClick={() => onToggle(v.verse_key)} className="text-xs text-accent underline">
                {showTranslation ? t(lang as "en", "hideTranslation") : t(lang as "en", "showTranslation")}
              </button>
            </div>
            <p className="font-arabic mt-3 text-right text-xl leading-loose" dir="rtl">
              {v.arabic}
            </p>
            {v.words.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {v.words.map((w, wi) => (
                  <span
                    key={wi}
                    className="rounded-lg border border-subtle bg-surface-muted/50 px-2 py-1 text-center"
                    title={w.en}
                  >
                    <span className="font-arabic block text-sm" dir="rtl">
                      {w.ar}
                    </span>
                    <span className="block text-[10px] text-muted">{w.en}</span>
                  </span>
                ))}
              </div>
            )}
            {showTranslation && (
              <p className="mt-3 text-sm leading-relaxed text-body" dir={lang === "ur" ? "rtl" : "ltr"}>
                {lang === "ur" && v.translation_ur ? v.translation_ur : v.translation_en}
              </p>
            )}
            {!showTranslation && (
              <p className="mt-2 text-xs italic text-faint">{t(lang as "en", "learnQuranArabicOnly")}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
