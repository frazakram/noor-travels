"use client";

import { useCallback, useRef, useState } from "react";

// Must stay >= the .card-sheen-pulse(-dark) animation-duration in globals.css (currently 2.4s),
// plus a small buffer so React doesn't unmount the overlay before the sweep finishes painting.
const SHEEN_DURATION_MS = 2500;

/** Gold "touched" shimmer for a home dashboard card: fires once, only on the card tapped —
 * not a continuous loop running on every card at once. */
export function useCardSheen() {
  const [active, setActive] = useState(false);
  const [pulseId, setPulseId] = useState(0);
  const activeRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const trigger = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    // Touch devices can fire pointerdown twice for one tap (touch + synthetic mouse). A second
    // call mid-sweep must not remount the overlay — that killed the first frame before it could
    // paint, reading as a fast flash followed by the real sweep. Just extend the hold instead.
    if (!activeRef.current) {
      activeRef.current = true;
      setPulseId((id) => id + 1);
      setActive(true);
    }
    timeoutRef.current = window.setTimeout(() => {
      activeRef.current = false;
      setActive(false);
    }, SHEEN_DURATION_MS);
  }, []);

  return { active, pulseId, trigger };
}
