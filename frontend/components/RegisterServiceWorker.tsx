"use client";

import { useEffect } from "react";

/** Guards against a reload loop if the reload itself still hits dead chunks. */
const SKEW_RELOAD_KEY = "noor-skew-reloaded";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  // Deployment-skew self-healing. A long-lived tab keeps running the build it
  // loaded with; after a redeploy its chunk and RSC requests 404 because the
  // old deployment's assets are gone — every navigation silently dies (seen
  // live: a tab on a dead build with all ?_rsc= fetches 404ing). A failed
  // dynamic import is the reliable symptom, so reload once to pick up the
  // live build instead of leaving the page half-interactive.
  useEffect(() => {
    function onRejection(event: PromiseRejectionEvent) {
      const message = String(
        (event.reason && (event.reason.message || event.reason.name)) || event.reason || "",
      );
      if (!/ChunkLoadError|Loading chunk .+ failed|dynamically imported module/i.test(message)) return;
      try {
        if (sessionStorage.getItem(SKEW_RELOAD_KEY)) return;
        sessionStorage.setItem(SKEW_RELOAD_KEY, "1");
      } catch {
        /* storage unavailable — reload anyway, the loop guard just won't apply */
      }
      window.location.reload();
    }
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return null;
}
