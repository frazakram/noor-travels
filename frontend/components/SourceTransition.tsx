"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

export type SourceKind = "quran" | "hadith" | "dua";

type Pending = { href: string; kind: SourceKind; label: string; startedAt: number };

/** Shown at least this long so the opening animation completes instead of flashing. */
const MIN_VISIBLE_MS = 800;
/** Never block the screen longer than this, even if navigation stalls. */
const MAX_VISIBLE_MS = 8000;
const EXIT_MS = 420;

const SourceTransitionContext = createContext<(href: string, kind: SourceKind, label: string) => void>(() => {});

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
 * wait with a short "opening the source" scene. It leaves once the destination URL is live and
 * the minimum time has passed, then dissolves into the page.
 */
export function SourceTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  const open = useCallback(
    (href: string, kind: SourceKind, label: string) => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
      setLeaving(false);
      setPending({ href, kind, label, startedAt: performance.now() });
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    if (!pending) return;
    const target = new URL(pending.href, window.location.origin);
    const arrived = () =>
      window.location.pathname === target.pathname && window.location.search === target.search;
    const finish = () => {
      setLeaving(true);
      timers.current.push(window.setTimeout(() => setPending(null), EXIT_MS));
    };
    const poll = window.setInterval(() => {
      const elapsed = performance.now() - pending.startedAt;
      if ((arrived() && elapsed >= MIN_VISIBLE_MS) || elapsed >= MAX_VISIBLE_MS) {
        window.clearInterval(poll);
        finish();
      }
    }, 60);
    return () => window.clearInterval(poll);
  }, [pending]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  return (
    <SourceTransitionContext.Provider value={open}>
      {children}
      {pending && <SourceOverlay kind={pending.kind} label={pending.label} leaving={leaving} />}
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

function SourceOverlay({ kind, label, leaving }: { kind: SourceKind; label: string; leaving: boolean }) {
  const { lang } = useLang();
  return (
    <div
      className={`source-overlay fixed inset-0 z-[90] flex items-center justify-center px-6 ${leaving ? "source-overlay-leave" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex flex-col items-center text-center">
        <div className="source-emblem relative h-44 w-44">
          <span className="source-halo absolute inset-6 rounded-full" aria-hidden />
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="source-mote" style={{ ["--a" as string]: `${i * 30}deg`, animationDelay: `${(i % 6) * 70}ms` }} aria-hidden />
          ))}
          <svg viewBox="0 0 120 120" className="source-star absolute inset-0 h-full w-full" aria-hidden>
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
        <p className="source-arabic font-arabic mt-2 text-2xl text-gold-600 dark:text-gold-300" dir="rtl" lang="ar">
          {ARABIC[kind]}
        </p>
        <p className="source-title animate-text-shimmer mt-3 text-sm font-semibold">{t(lang, TITLE_KEY[kind])}</p>
        <p className="source-label mt-1 text-xs text-muted" dir="ltr">
          {label}
        </p>
        <span className="source-progress mt-4 block h-0.5 w-40 overflow-hidden rounded-full bg-noor-200/60 dark:bg-noor-800" aria-hidden>
          <span className="block h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
        </span>
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
