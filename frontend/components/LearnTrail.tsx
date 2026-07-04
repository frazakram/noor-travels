"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  completedCount,
  moduleTitle,
  type LearnProgress,
  type LearnQuranIndex,
} from "@/lib/learn-quran";
import { t } from "@/lib/i18n";

/** Animated course path: module medallions with progress rings, a lesson
 *  gem per stop, a rotating golden ring on "you are here", drawn-on
 *  checkmarks and a shimmering completed track. Pure CSS — no libraries. */
export function LearnTrail({
  index,
  progress,
  lang,
  currentLessonId,
}: {
  index: LearnQuranIndex;
  progress: LearnProgress;
  lang: string;
  currentLessonId?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLAnchorElement | null>(null);

  const modules = [...index.modules].sort((a, b) => a.order - b.order);
  const allIds = modules.flatMap((m) => m.lesson_ids);
  const currentId =
    currentLessonId && allIds.includes(currentLessonId)
      ? currentLessonId
      : allIds.find((id) => !progress.lessons[id]?.completed) ?? allIds[allIds.length - 1];

  useEffect(() => {
    const el = currentRef.current;
    const scroller = scrollerRef.current;
    if (el && scroller) {
      scroller.scrollTo({ left: Math.max(0, el.offsetLeft - scroller.clientWidth / 2), behavior: "smooth" });
    }
  }, [currentId]);

  let nodeSeq = 0; // staggers the entrance animation across the whole trail

  return (
    <div className="relative">
      <style>{TRAIL_CSS}</style>
      <div
        ref={scrollerRef}
        className="lq-trail -mx-1 flex items-center gap-0 overflow-x-auto px-2 pb-9 pt-3"
        aria-label="Course path"
      >
        {modules.map((mod, mi) => {
          const done = completedCount(progress, mod.lesson_ids);
          const total = mod.lesson_ids.length;
          const allDone = done === total;
          const modDelay = `${Math.min(nodeSeq++ * 45, 900)}ms`;
          const ringPct = total ? done / total : 0;
          const R = 24;
          const CIRC = 2 * Math.PI * R;
          return (
            <div key={mod.id} className="flex shrink-0 items-center">
              {mi > 0 && (
                <Connector done={completedCount(progress, modules[mi - 1].lesson_ids) === modules[mi - 1].lesson_ids.length} />
              )}
              {/* Module medallion with progress ring */}
              <div className="lq-pop relative" style={{ animationDelay: modDelay }}>
                <div className={`relative h-14 w-14 ${allDone ? "lq-medal-done" : ""}`}>
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
                    <circle cx="28" cy="28" r={R} fill="none" strokeWidth="3.5" className="stroke-emerald-100 dark:stroke-emerald-950" />
                    <circle
                      cx="28"
                      cy="28"
                      r={R}
                      fill="none"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={CIRC}
                      strokeDashoffset={CIRC * (1 - ringPct)}
                      className={`lq-ringfill ${allDone ? "stroke-amber-400" : "stroke-emerald-500"}`}
                    />
                  </svg>
                  <span
                    className={`absolute inset-[7px] flex items-center justify-center overflow-hidden rounded-full text-xl shadow-sm ${
                      allDone
                        ? "bg-gradient-to-br from-amber-200 via-yellow-100 to-amber-300 dark:from-amber-500 dark:via-yellow-400 dark:to-amber-600"
                        : "bg-gradient-to-br from-white to-emerald-50 dark:from-slate-800 dark:to-emerald-950/60"
                    }`}
                    title={moduleTitle(mod, lang)}
                  >
                    <span className={allDone ? "lq-medal-icon" : ""}>{mod.icon}</span>
                    {allDone && <span className="lq-shine" aria-hidden />}
                  </span>
                </div>
                <span className="absolute left-1/2 top-full mt-0.5 w-[80px] -translate-x-1/2 truncate text-center text-[9px] font-medium text-muted">
                  {moduleTitle(mod, lang)}
                </span>
              </div>

              {mod.lesson_ids.map((id, li) => {
                const lessonDone = !!progress.lessons[id]?.completed;
                const isCurrent = id === currentId;
                const prevDone = li === 0 ? true : !!progress.lessons[mod.lesson_ids[li - 1]]?.completed;
                const delay = `${Math.min(nodeSeq++ * 45, 900)}ms`;
                return (
                  <div key={id} className="flex items-center">
                    <Connector done={lessonDone || (isCurrent && prevDone)} />
                    <div className="lq-pop relative flex items-center" style={{ animationDelay: delay }}>
                      {isCurrent ? (
                        <Link
                          href={`/learn-quran/${id}`}
                          ref={currentRef}
                          title={id}
                          className="lq-here relative flex h-11 w-11 items-center justify-center"
                        >
                          <span className="lq-halo absolute inset-0 rounded-full bg-amber-400/50" aria-hidden />
                          <span className="lq-orbit absolute inset-0 rounded-full" aria-hidden />
                          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-400 shadow-md shadow-amber-500/40 dark:from-amber-400 dark:via-yellow-300 dark:to-amber-500">
                            <svg viewBox="0 0 24 24" className="lq-star h-[18px] w-[18px] fill-white drop-shadow" aria-hidden>
                              <path d="M12 2.5l2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 16.3l-5.6 3.2 1.4-6.2L3 9l6.4-.6L12 2.5z" />
                            </svg>
                          </span>
                          <span className="lq-spark lq-spark-a" aria-hidden />
                          <span className="lq-spark lq-spark-b" aria-hidden />
                        </Link>
                      ) : (
                        <Link
                          href={`/learn-quran/${id}`}
                          title={id}
                          className={`group relative flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-125 ${
                            lessonDone
                              ? "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-sm shadow-emerald-500/40"
                              : "border-2 border-dashed border-slate-300 bg-white/60 dark:border-slate-600 dark:bg-slate-800/60"
                          }`}
                        >
                          {lessonDone ? (
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                              <path
                                d="M5 13l4 4 10-10"
                                stroke="white"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lq-check"
                                style={{ animationDelay: delay }}
                              />
                            </svg>
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 transition group-hover:bg-emerald-400 dark:bg-slate-600" />
                          )}
                        </Link>
                      )}
                      {isCurrent && (
                        <span className="lq-herechip absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-1.5 py-px text-[8px] font-bold text-white shadow">
                          {t(lang as "en", "learnQuranYouAreHere")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        <div className="w-2 shrink-0" />
      </div>
      {/* soft edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent dark:from-slate-950/90" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent dark:from-slate-950/90" />
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <span className="relative h-1 w-5 shrink-0 overflow-hidden rounded-full sm:w-7" aria-hidden>
      {done ? (
        <span className="lq-flow absolute inset-0" />
      ) : (
        <span className="absolute inset-0 border-t-2 border-dashed border-slate-300 dark:border-slate-700" style={{ top: "1px" }} />
      )}
    </span>
  );
}

const TRAIL_CSS = `
.lq-trail { scrollbar-width: thin; }
.lq-trail::-webkit-scrollbar { height: 4px; }
.lq-trail::-webkit-scrollbar-thumb { background: rgba(16,185,129,.3); border-radius: 4px; }

@keyframes lq-pop {
  0% { opacity: 0; transform: translateY(10px) scale(.5); }
  70% { transform: translateY(-2px) scale(1.06); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.lq-pop { animation: lq-pop .5s cubic-bezier(.34,1.56,.64,1) both; }

@keyframes lq-check { to { stroke-dashoffset: 0; } }
.lq-check { stroke-dasharray: 24; stroke-dashoffset: 24; animation: lq-check .45s ease-out .35s both; }

@keyframes lq-ringfill { from { stroke-dashoffset: 150.8; } }
.lq-ringfill { transition: stroke-dashoffset 1s cubic-bezier(.22,1,.36,1); animation: lq-ringfill 1.2s cubic-bezier(.22,1,.36,1); }

@keyframes lq-flow-slide { to { background-position: 24px 0; } }
.lq-flow {
  background: repeating-linear-gradient(90deg,#34d399 0 6px,#fbbf24 6px 12px,#34d399 12px 24px);
  background-size: 24px 100%;
  animation: lq-flow-slide 1.2s linear infinite;
  opacity: .85;
}

@keyframes lq-halo-ping {
  0% { transform: scale(.7); opacity: .7; }
  80%, 100% { transform: scale(1.5); opacity: 0; }
}
.lq-halo { animation: lq-halo-ping 1.8s cubic-bezier(0,0,.2,1) infinite; }

@keyframes lq-orbit-spin { to { transform: rotate(360deg); } }
.lq-orbit {
  background: conic-gradient(from 0deg, transparent 0 300deg, #f59e0b 330deg, #fef3c7 350deg, transparent 360deg);
  animation: lq-orbit-spin 2.6s linear infinite;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
}

@keyframes lq-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.lq-here { animation: lq-bob 2s ease-in-out infinite; }

@keyframes lq-star-spin { 0%,100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(8deg) scale(1.12); } }
.lq-star { animation: lq-star-spin 2s ease-in-out infinite; }

@keyframes lq-twinkle {
  0%, 100% { opacity: 0; transform: scale(.3) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(90deg); }
}
.lq-spark {
  position: absolute; width: 6px; height: 6px;
  background: radial-gradient(circle, #fde68a 30%, transparent 70%);
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
  animation: lq-twinkle 1.6s ease-in-out infinite;
}
.lq-spark-a { top: -2px; right: -3px; }
.lq-spark-b { bottom: 2px; left: -4px; animation-delay: .8s; width: 5px; height: 5px; }

@keyframes lq-shine-sweep {
  0% { transform: translateX(-130%) skewX(-20deg); }
  60%, 100% { transform: translateX(160%) skewX(-20deg); }
}
.lq-shine {
  position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.85) 50%, transparent 60%);
  animation: lq-shine-sweep 2.8s ease-in-out infinite;
}

@keyframes lq-medal-glow {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(245,158,11,.4)); }
  50% { filter: drop-shadow(0 0 8px rgba(245,158,11,.8)); }
}
.lq-medal-done { animation: lq-medal-glow 2.4s ease-in-out infinite; }

@keyframes lq-medal-icon-pop { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
.lq-medal-icon { display: inline-block; animation: lq-medal-icon-pop 2.4s ease-in-out infinite; }

@keyframes lq-chip { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
.lq-herechip { animation: lq-chip 2s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .lq-pop, .lq-check, .lq-ringfill, .lq-flow, .lq-halo, .lq-orbit, .lq-here,
  .lq-star, .lq-spark, .lq-shine, .lq-medal-done, .lq-medal-icon, .lq-herechip { animation: none; }
  .lq-check { stroke-dashoffset: 0; }
  .lq-pop { opacity: 1; }
}
`;
