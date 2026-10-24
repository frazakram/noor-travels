"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { Icons } from "@/components/IconButton";
import {
  loc,
  refHref,
  refLabel,
  walkthroughSteps,
  type IbadahGuide,
  type IbadahStep,
  type Ruling,
} from "@/lib/ibadah";
import { t, type Lang } from "@/lib/i18n";
import { acquireWakeLock, releaseWakeLock } from "@/lib/media-session";

const RULING_KEY = {
  fard: "ibadahFard",
  wajib: "ibadahWajib",
  sunnah: "ibadahSunnah",
  mustahab: "ibadahMustahab",
} as const;

// Obligatory steps stand out; the rest share the app's quieter chip style.
const RULING_STYLE: Record<Ruling, string> = {
  fard: "bg-noor-700 text-white dark:bg-noor-600",
  wajib: "bg-noor-600 text-white dark:bg-noor-500",
  sunnah: "bg-gold-100 text-gold-700 dark:bg-gold-700/30 dark:text-gold-300",
  mustahab: "bg-noor-50 text-noor-700 dark:bg-noor-800 dark:text-noor-200",
};

export function IbadahGuideView({ guide }: { guide: IbadahGuide }) {
  const { lang } = useLang();
  const steps = useMemo(() => walkthroughSteps(guide), [guide]);
  const [walking, setWalking] = useState(false);
  const [current, setCurrent] = useState(0);

  // Keep the screen on while someone follows the steps with wet hands.
  useEffect(() => {
    if (!walking) return;
    void acquireWakeLock();
    return () => {
      void releaseWakeLock();
    };
  }, [walking]);

  const startWalkthrough = () => {
    setCurrent(0);
    setWalking(true);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-5">
      <Link href="/ibadah" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
        {Icons.back} {t(lang, "ibadahGuide")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-heading">{loc(guide.title, lang)}</h1>
        <p className="mt-1 text-sm text-muted">{loc(guide.summary, lang)}</p>
      </div>

      {guide.status === "reviewed" && guide.reviewedBy ? (
        <p className="text-xs text-faint">✓ {t(lang, "ibadahReviewedBy").replace("{name}", guide.reviewedBy)}</p>
      ) : (
        <div role="note" className="card border-l-4 border-l-amber-500 bg-amber-50/60 py-3 text-xs text-body dark:bg-amber-950/20">
          {t(lang, "ibadahDraftNotice")}
        </div>
      )}

      {walking ? (
        <Walkthrough
          lang={lang}
          steps={steps}
          current={current}
          onMove={setCurrent}
          onExit={() => setWalking(false)}
        />
      ) : (
        <>
          {steps.length > 0 && (
            <button type="button" onClick={startWalkthrough} className="btn-primary w-full py-2.5 text-sm sm:w-auto sm:px-6">
              {t(lang, "ibadahStepByStep")}
            </button>
          )}
          {guide.sections.map((section) => (
            <section key={section.id} className="space-y-3" aria-labelledby={`sec-${section.id}`}>
              <h2 id={`sec-${section.id}`} className="text-lg font-semibold text-heading">
                {loc(section.title, lang)}
              </h2>
              {section.kind === "steps" ? (
                <ol className="space-y-3">
                  {section.items.map((step, i) => (
                    <li key={step.id}>
                      <StepCard lang={lang} step={step} number={i + 1} />
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="card divide-y divide-noor-100 dark:divide-noor-700 py-1">
                  {section.items.map((step) => (
                    <li key={step.id} className="py-3">
                      <p className="text-sm text-body">{loc(step.text, lang)}</p>
                      <Refs lang={lang} step={step} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function StepCard({ lang, step, number }: { lang: Lang; step: IbadahStep; number?: number }) {
  return (
    <article className="card space-y-3">
      <div className="flex items-start gap-3">
        {number != null && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-noor-50 text-sm font-semibold text-noor-700 dark:bg-noor-800 dark:text-gold-300">
            {number}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          {step.ruling && (
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${RULING_STYLE[step.ruling]}`}>
              {t(lang, RULING_KEY[step.ruling])}
            </span>
          )}
          <p className="text-base text-heading">{loc(step.text, lang)}</p>
        </div>
      </div>
      {step.arabic && (
        <div className="rounded-xl bg-surface-muted p-3">
          <p className="font-arabic text-right text-xl leading-loose text-heading" dir="rtl" lang="ar">
            {step.arabic}
          </p>
          {step.transliteration && <p className="mt-1 text-sm italic text-muted">{step.transliteration}</p>}
          {step.meaning && <p className="mt-1 text-sm text-body">{loc(step.meaning, lang)}</p>}
        </div>
      )}
      {step.note && <p className="text-sm text-muted">{loc(step.note, lang)}</p>}
      <Refs lang={lang} step={step} />
    </article>
  );
}

function Refs({ lang, step }: { lang: Lang; step: IbadahStep }) {
  if (!step.refs.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {step.refs.map((ref, i) => {
        const href = refHref(ref);
        const label = refLabel(ref, lang);
        return href ? (
          <Link
            key={i}
            href={href}
            prefetch={false}
            className="rounded-full border border-noor-200 px-2 py-0.5 text-[11px] text-noor-700 hover:bg-noor-50 dark:border-noor-600 dark:text-noor-200 dark:hover:bg-noor-800"
          >
            {label}
          </Link>
        ) : (
          <span key={i} className="rounded-full border border-dashed border-subtle px-2 py-0.5 text-[11px] text-faint">
            {label}
          </span>
        );
      })}
    </div>
  );
}

function Walkthrough({
  lang,
  steps,
  current,
  onMove,
  onExit,
}: {
  lang: Lang;
  steps: ReturnType<typeof walkthroughSteps>;
  current: number;
  onMove: (i: number) => void;
  onExit: () => void;
}) {
  const [finished, setFinished] = useState(false);
  const total = steps.length;
  const item = steps[current];
  const pct = Math.round(((current + 1) / total) * 100);

  if (finished) {
    return (
      <div className="card space-y-4 text-center">
        <p className="text-lg font-semibold text-heading">✓ {t(lang, "ibadahDoneMessage")}</p>
        <button type="button" onClick={onExit} className="btn-primary px-6 py-2 text-sm">
          {t(lang, "ibadahShowAll")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{t(lang, "ibadahStepOf").replace("{n}", String(current + 1)).replace("{total}", String(total))}</span>
        <button type="button" onClick={onExit} className="font-medium text-accent">
          {t(lang, "ibadahShowAll")}
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-noor-100 dark:bg-noor-800">
        <div className="h-full rounded-full bg-noor-600 transition-[width] duration-300 dark:bg-gold-400" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{loc(item.section.title, lang)}</p>
      <StepCard lang={lang} step={item.step} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onMove(Math.max(0, current - 1))}
          disabled={current === 0}
          className="flex-1 rounded-xl border border-subtle py-3 text-sm font-medium text-body disabled:opacity-40"
        >
          {t(lang, "ibadahPrevStep")}
        </button>
        {current < total - 1 ? (
          <button type="button" onClick={() => onMove(current + 1)} className="btn-primary flex-1 py-3 text-sm">
            {t(lang, "ibadahNextStep")}
          </button>
        ) : (
          <button type="button" onClick={() => setFinished(true)} className="btn-primary flex-1 py-3 text-sm">
            {t(lang, "ibadahFinish")}
          </button>
        )}
      </div>
    </div>
  );
}
