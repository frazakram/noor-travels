"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

export type SourceKind = "quran" | "hadith" | "dua";

type Origin = { x: number; y: number };
type Pending = { href: string; kind: SourceKind; label: string; startedAt: number; origin: Origin | null };
/** What has really happened so far; drives the progress line (never a fake loop). */
type Stage = "opening" | "arrived" | "ready";

/** Shown at least this long so the launch (ignition and lift-off) always plays out in full. */
const MIN_VISIBLE_MS = 1500;
/** Never block the screen longer than this, even if navigation stalls. */
const MAX_VISIBLE_MS = 10_000;
const EXIT_MS = 760; // blast-off, then the sky clears

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

const PROGRESS: Record<Stage, string> = { opening: "source-progress-opening", arrived: "source-progress-arrived", ready: "source-progress-ready" };

/** Fixed pseudo-random layout so the sky looks scattered but renders the same every time. */
function scatter(count: number, seed: number) {
  let x = seed;
  const next = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  return Array.from({ length: count }, () => ({ left: next() * 100, top: next() * 100, size: next(), delay: next() }));
}
const STARS = scatter(36, 7);
const STREAKS = scatter(16, 11);
const PUFFS = Array.from({ length: 9 }, (_, i) => ({ dx: (i - 4) * 22, delay: (i % 3) * 70 }));

function SourceOverlay({ kind, label, stage, leaving }: { kind: SourceKind; label: string; origin: Origin | null; stage: Stage; leaving: boolean }) {
  const { lang } = useLang();
  return (
    <div className={`source-overlay fixed inset-0 z-[90] overflow-hidden ${leaving ? "source-overlay-leave" : ""}`} role="status" aria-live="polite">
      {/* Night sky: twinkling stars, then speed streaks once the rocket is moving. */}
      <div className="source-sky absolute inset-0" aria-hidden>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="source-star-dot"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: 1 + s.size * 2.2, height: 1 + s.size * 2.2, animationDelay: `${s.delay * 2}s` }}
          />
        ))}
        {STREAKS.map((s, i) => (
          <span
            key={i}
            className="source-streak"
            style={{ left: `${4 + s.left * 92}%`, height: 50 + s.size * 110, animationDuration: `${0.55 + s.delay * 0.7}s`, animationDelay: `${0.5 + s.top * 0.6}s` }}
          />
        ))}
      </div>

      <div className="source-rocket-lane absolute left-1/2 top-0 h-full w-0" aria-hidden>
        <div className="source-rocket">
          <div className="source-rumble">
            <svg viewBox="0 0 120 210" className="h-[11.5rem] w-auto -translate-x-1/2 overflow-visible">
              <defs>
                <linearGradient id="rocket-flame" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff7d6" />
                  <stop offset="0.35" stopColor="#f4c75a" />
                  <stop offset="0.75" stopColor="#e07a2e" stopOpacity="0.85" />
                  <stop offset="1" stopColor="#e07a2e" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="rocket-body" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="0.55" stopColor="#faf8f5" />
                  <stop offset="1" stopColor="#d9cfbf" />
                </linearGradient>
              </defs>
              {/* Flame: two flickering layers under the nozzle. */}
              <g className="source-flame">
                <path d="M60 128 C80 150 74 182 60 208 C46 182 40 150 60 128 Z" fill="url(#rocket-flame)" />
                <path className="source-flame-core" d="M60 130 C70 146 67 166 60 182 C53 166 50 146 60 130 Z" fill="#fffbe9" />
              </g>
              {/* Fins */}
              <path d="M34 88 L12 134 L36 126 Z" fill="#2d7060" />
              <path d="M86 88 L108 134 L84 126 Z" fill="#1f5246" />
              {/* Body and nose */}
              <path d="M60 6 C86 30 92 72 88 124 L32 124 C28 72 34 30 60 6 Z" fill="url(#rocket-body)" />
              <path d="M60 6 C71 16 78 27 81 38 L39 38 C42 27 49 16 60 6 Z" fill="#e0bc6a" />
              <rect x="31" y="112" width="58" height="8" rx="2" fill="#c49a3c" />
              {/* Porthole with a crescent */}
              <circle cx="60" cy="72" r="16" fill="#0d221f" stroke="#e0bc6a" strokeWidth="4" />
              <path d="M64 63 a10 10 0 1 0 0 18 a8 8 0 1 1 0 -18 Z" fill="#e0bc6a" />
              <path d="M52 124 L68 124 L65 132 L55 132 Z" fill="#3d8c78" />
              <path d="M60 96 L60 124" stroke="#2d7060" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Launch-pad smoke: stays on the ground and billows out as the rocket lifts away. */}
      <div className="source-ground absolute bottom-0 left-1/2 h-0 w-0" aria-hidden>
        {PUFFS.map((p, i) => (
          <span key={i} className="source-puff" style={{ ["--dx" as string]: `${p.dx}px`, animationDelay: `${p.delay}ms` }} />
        ))}
      </div>

      <div className="source-copy absolute inset-x-0 bottom-[14%] flex flex-col items-center px-8 text-center">
        <p className="source-title text-lg font-semibold">{t(lang, TITLE_KEY[kind])}</p>
        <p className="source-label mt-1 text-xs font-semibold uppercase" dir="ltr">
          {label}
        </p>
        <span className={`source-progress mt-5 block h-1 w-48 overflow-hidden rounded-full ${PROGRESS[stage]}`} aria-hidden>
          <span className="block h-full rounded-full" />
        </span>
      </div>
    </div>
  );
}
