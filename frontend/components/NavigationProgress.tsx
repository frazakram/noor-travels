"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Phase = "idle" | "loading" | "done";

const PAGE_LOADING_EVENT = "noor:page-loading";

export function emitPageLoading(active: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PAGE_LOADING_EVENT, { detail: { active } }));
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevPath = useRef(pathname);
  const pendingNav = useRef(false);
  const pageLoadingCount = useRef(0);
  const phaseRef = useRef<Phase>("idle");

  function kill() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function setPhaseSafe(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function start() {
    kill();
    pendingNav.current = true;
    setPhaseSafe("loading");
    setPct(0);
    timers.current.push(setTimeout(() => setPct(22), 0));
    timers.current.push(setTimeout(() => setPct(48), 350));
    timers.current.push(setTimeout(() => setPct(68), 1400));
    timers.current.push(setTimeout(() => setPct(78), 3000));
  }

  function finish() {
    if (phaseRef.current === "idle") return;
    kill();
    pendingNav.current = false;
    setPct(100);
    setPhaseSafe("done");
    timers.current.push(
      setTimeout(() => {
        if (pageLoadingCount.current > 0) {
          setPhaseSafe("loading");
          setPct(78);
          return;
        }
        setPhaseSafe("idle");
        setPct(0);
      }, 420),
    );
  }

  function maybeFinish() {
    if (pendingNav.current || pageLoadingCount.current > 0) return;
    if (phaseRef.current === "loading") finish();
  }

  // Link / button navigation intent
  useEffect(() => {
    function onIntent(e: Event) {
      const target = e.target as Element | null;
      const a = target?.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (!href || /^(https?:|#|mailto:|tel:)/.test(href)) return;
      const dest = href.split(/[?#]/)[0];
      if (dest === pathname || dest === "") return;
      start();
    }

    document.addEventListener("pointerdown", onIntent, true);
    return () => document.removeEventListener("pointerdown", onIntent, true);
  }, [pathname]);

  // Route changed → complete bar when page work is done
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    const wasPending = pendingNav.current;
    pendingNav.current = false;
    if (phaseRef.current === "loading" || wasPending) {
      if (pageLoadingCount.current === 0) finish();
      return;
    }
    if (pageLoadingCount.current === 0) {
      start();
      timers.current.push(setTimeout(() => finish(), 220));
    }
  }, [pathname]);

  // Long-running page fetches (e.g. surah ayahs)
  useEffect(() => {
    function onPageLoading(e: Event) {
      const active = Boolean((e as CustomEvent<{ active?: boolean }>).detail?.active);
      if (active) {
        pageLoadingCount.current += 1;
        if (phaseRef.current === "idle") start();
        return;
      }
      pageLoadingCount.current = Math.max(0, pageLoadingCount.current - 1);
      if (pageLoadingCount.current === 0) maybeFinish();
    }

    window.addEventListener(PAGE_LOADING_EVENT, onPageLoading);
    return () => window.removeEventListener(PAGE_LOADING_EVENT, onPageLoading);
  }, []);

  useEffect(() => () => kill(), []);

  if (phase === "idle") return null;

  return (
    <div
      aria-hidden="true"
      className="nav-progress-bar"
      style={{
        width: `${pct}%`,
        transition:
          phase === "done"
            ? "width 200ms ease-out, opacity 350ms ease-out 80ms"
            : pct <= 22
              ? "none"
              : "width 2200ms cubic-bezier(0.04, 0.6, 0.08, 1)",
        opacity: phase === "done" ? 0 : 1,
      }}
    />
  );
}
