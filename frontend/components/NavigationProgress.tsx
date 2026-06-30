"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [pct, setPct] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevPath = useRef(pathname);

  function kill() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function start() {
    kill();
    setPhase("loading");
    setPct(0);
    timers.current.push(setTimeout(() => setPct(22), 0));
    timers.current.push(setTimeout(() => setPct(48), 350));
    timers.current.push(setTimeout(() => setPct(68), 1400));
    timers.current.push(setTimeout(() => setPct(78), 3000));
  }

  function finish() {
    kill();
    setPct(100);
    setPhase("done");
    timers.current.push(
      setTimeout(() => {
        setPhase("idle");
        setPct(0);
      }, 420),
    );
  }

  // Detect any internal link click → start bar
  useEffect(() => {
    function handle(e: MouseEvent) {
      const a = (e.target as Element).closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (!href || /^(https?:|#|mailto:|tel:)/.test(href)) return;
      const dest = href.split(/[?#]/)[0];
      if (dest === pathname || dest === "") return;
      start();
    }
    document.addEventListener("click", handle, true);
    return () => document.removeEventListener("click", handle, true);
  }, [pathname]);

  // Detect navigation complete → finish bar
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      if (phase === "loading") finish();
    }
  }, [pathname, phase]);

  useEffect(() => () => kill(), []);

  if (phase === "idle") return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        bottom: "auto",
        height: "3px",
        zIndex: 9999,
        pointerEvents: "none",
        width: `${pct}%`,
        background:
          "linear-gradient(90deg, #255a4e 0%, #3d8c78 30%, #5da892 60%, #d4a853 100%)",
        boxShadow:
          "0 0 10px 1px rgba(93,168,146,0.65), 0 0 22px 2px rgba(212,168,83,0.25)",
        borderRadius: "0 3px 3px 0",
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
