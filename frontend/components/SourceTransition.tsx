"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

export type SourceKind = "quran" | "hadith" | "dua";

type Origin = { x: number; y: number };
type Pending = { href: string; kind: SourceKind; label: string; startedAt: number; origin: Origin | null };
/** What has really happened so far; drives the progress line (never a fake loop). */
type Stage = "opening" | "arrived" | "ready";

/** Shown at least this long so the opening animation completes instead of flashing. */
const MIN_VISIBLE_MS = 900;
/** Never block the screen longer than this, even if navigation stalls. */
const MAX_VISIBLE_MS = 10_000;
const EXIT_MS = 640; // text fade, then the 0.5 s reveal after 0.12 s

type Open = (href: string, kind: SourceKind, label: string, origin?: Origin | null) => void;
const SourceTransitionContext = createContext<Open>(() => {});

export function useOpenSource() {
  return useContext(SourceTransitionContext);
}

export function sourceKindOf(href: string): SourceKind {
  if (href.startsWith("/quran/")) return "quran";
  if (href.includes("dua=")) return "dua";
  return "hadith";
}

/**
 * Opening a cited source from chat: navigation starts immediately, and this overlay covers the
 * wait. The scene opens from the tapped citation, tracks real progress (page loaded, then the
 * verse settled in place), and reveals the page from the centre, where the verse sits.
 */
export function SourceTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [stage, setStage] = useState<Stage>("opening");
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  const open = useCallback<Open>(
    (href, kind, label, origin = null) => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
      setLeaving(false);
      setStage("opening");
      setPending({ href, kind, label, startedAt: performance.now(), origin });
      try {
        navigator.vibrate?.(8); // a tick under the finger where supported
      } catch {
        /* not allowed in this context */
      }
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    if (!pending) return;
    const target = new URL(pending.href, window.location.origin);
    const arrived = () =>
      window.location.pathname === target.pathname && window.location.search === target.search;
    // A verse deep in a surah: stay until the reader has it centred (its "noor:ayah-ready"
    // event), so the user never sees the top of the surah first and then a jump.
    let ayahReady = !(pending.kind === "quran" && Number(target.searchParams.get("ayah")) > 1);
    const onAyahReady = () => {
      ayahReady = true;
    };
    window.addEventListener("noor:ayah-ready", onAyahReady);
    const finish = () => {
      setStage("ready");
      setLeaving(true);
      timers.current.push(window.setTimeout(() => setPending(null), EXIT_MS));
    };
    const poll = window.setInterval(() => {
      const elapsed = performance.now() - pending.startedAt;
      if (arrived()) setStage((s) => (s === "opening" ? "arrived" : s));
      if ((arrived() && ayahReady && elapsed >= MIN_VISIBLE_MS) || elapsed >= MAX_VISIBLE_MS) {
        window.clearInterval(poll);
        finish();
      }
    }, 60);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("noor:ayah-ready", onAyahReady);
    };
  }, [pending]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  return (
    <SourceTransitionContext.Provider value={open}>
      {children}
      {pending && <SourceOverlay kind={pending.kind} label={pending.label} origin={pending.origin} stage={stage} leaving={leaving} />}
    </SourceTransitionContext.Provider>
  );
}

const TITLE_KEY = { quran: "openingQuran", hadith: "openingHadith", dua: "openingDua" } as const;

// Opening words of each kind of text, shown in calligraphic type as the scene builds.
const ARABIC = {
  hadith: "قَالَ رَسُولُ ٱللَّهِ ﷺ",
  quran: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
  dua: "رَبَّنَا",
} as const;

const PROGRESS: Record<Stage, string> = { opening: "source-progress-opening", arrived: "source-progress-arrived", ready: "source-progress-ready" };

function SourceOverlay({ kind, label, origin, stage, leaving }: { kind: SourceKind; label: string; origin: Origin | null; stage: Stage; leaving: boolean }) {
  const { lang } = useLang();
  // The portal grows from the tapped citation (or the screen centre without one).
  const style = {
    "--ox": origin ? `${origin.x}px` : "50%",
    "--oy": origin ? `${origin.y}px` : "50%",
  } as CSSProperties;
  return (
    <div className={`source-overlay fixed inset-0 z-[90] ${leaving ? "source-overlay-leave" : ""}`} style={style} role="status" aria-live="polite">
      <svg className="source-pattern absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id="girih" width="72" height="72" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
            <g fill="none" stroke="currentColor" strokeWidth="0.8">
              <rect x="22" y="22" width="28" height="28" />
              <rect x="22" y="22" width="28" height="28" transform="rotate(45 36 36)" />
              <path d="M0 36h8M64 36h8M36 0v8M36 64v8" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#girih)" />
      </svg>

      <div className="relative flex h-full items-center justify-center px-8">
        <div className="source-stage relative flex w-full max-w-[19rem] flex-col items-center text-center">
          {/* Mihrab arch framing the scene, drawn in a gold hairline. */}
          <svg viewBox="0 0 300 380" className="source-arch absolute -inset-x-2 -top-10 h-[calc(100%+4.5rem)] w-[calc(100%+1rem)]" preserveAspectRatio="none" aria-hidden>
            <path d="M14 378 V150 C14 70 90 18 150 6 C210 18 286 70 286 150 V378" pathLength={100} />
          </svg>

          <div className="source-emblem relative mt-6 h-36 w-36">
            <span className="source-halo absolute inset-5 rounded-full" aria-hidden />
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="source-mote" style={{ ["--a" as string]: `${i * 30}deg`, animationDelay: `${(i % 6) * 90}ms` }} aria-hidden />
            ))}
            <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full" aria-hidden>
              <g className="source-star-spin">
                <rect x="24" y="24" width="72" height="72" rx="3" className="source-stroke" pathLength={100} />
                <rect x="24" y="24" width="72" height="72" rx="3" className="source-stroke source-stroke-2" pathLength={100} transform="rotate(45 60 60)" />
                <circle cx="60" cy="60" r="27" className="source-stroke source-stroke-3" pathLength={100} />
              </g>
              <g className="source-glyph">
                <SourceGlyph kind={kind} />
              </g>
            </svg>
          </div>

          <p className="source-arabic font-arabic mt-3 text-[1.7rem] leading-relaxed" dir="rtl" lang="ar">
            {ARABIC[kind]}
          </p>
          <p className="source-title font-arabic mt-2 text-lg">{t(lang, TITLE_KEY[kind])}</p>
          <p className="source-label mt-1 text-[11px] font-medium uppercase" dir="ltr">
            {label}
          </p>
          <span className={`source-progress mt-6 block h-px w-44 overflow-hidden ${PROGRESS[stage]}`} aria-hidden>
            <span className="block h-full" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Line icon at the star's centre: open mushaf on a stand, a scroll, or raised hands. */
function SourceGlyph({ kind }: { kind: SourceKind }) {
  if (kind === "quran") {
    return (
      <g className="source-icon">
        <path d="M60 52 C53 48 46 48 41 50 V68 C46 66 53 66 60 70 C67 66 74 66 79 68 V50 C74 48 67 48 60 52 Z" pathLength={100} />
        <path d="M60 52 V70" pathLength={100} />
        <path d="M46 72 L74 80 M74 72 L46 80" pathLength={100} />
      </g>
    );
  }
  if (kind === "dua") {
    return (
      <g className="source-icon">
        <path d="M52 76 C47 70 45 62 46 54 C46.5 50 50 50 50.5 54 L51.5 61 M51.5 61 V48 C51.5 45 55 45 55 48 V62 M55 62 V46 C55 43 58.5 43 58.5 46 V64 C58.5 70 56 74 52 76" pathLength={100} />
        <path d="M68 76 C73 70 75 62 74 54 C73.5 50 70 50 69.5 54 L68.5 61 M68.5 61 V48 C68.5 45 65 45 65 48 V62 M65 62 V46 C65 43 61.5 43 61.5 46 V64 C61.5 70 64 74 68 76" pathLength={100} />
      </g>
    );
  }
  return (
    <g className="source-icon">
      <path d="M46 47 H72 C75 47 76 49 76 51 V73 C76 75 75 77 72 77 H48" pathLength={100} />
      <path d="M46 47 C43 47 42 49 42 51 C42 53 43 55 46 55 H50 V73 C50 75 49 77 47 77 C45 77 44 75 44 73" pathLength={100} />
      <path d="M56 56 H70 M56 62 H70 M56 68 H66" pathLength={100} />
    </g>
  );
}
