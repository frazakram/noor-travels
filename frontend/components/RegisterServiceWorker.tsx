"use client";

import { useEffect } from "react";

/** Guards against a reload loop if the reload itself still hits dead chunks. */
const SKEW_RELOAD_KEY = "noor-skew-reloaded";

function reloadOnce() {
  try {
    if (sessionStorage.getItem(SKEW_RELOAD_KEY)) return;
    sessionStorage.setItem(SKEW_RELOAD_KEY, "1");
  } catch {
    /* storage unavailable — reload anyway, the loop guard just won't apply */
  }
  window.location.reload();
}

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  // Deployment-skew self-healing. A long-lived tab keeps running the build it
  // loaded with; after a redeploy, every RSC payload it requests carries that
  // old build's id, and the new server 404s it — confirmed live: a wall of
  // `?_rsc=<oldBuildId>` 404s across every route, with the page never visibly
  // updating because Next's soft navigation just silently fails.
  //
  // fetch() does NOT throw on a 404 — it resolves normally with ok:false — so
  // the ChunkLoadError listener below (which only fires on a *thrown*
  // rejection, e.g. a failed dynamic import() of a JS chunk) cannot see this
  // failure mode at all; it's a different mechanism and needs a second guard.
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await nativeFetch(...args);
      if (!res.ok) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
        if (url.includes("_rsc=") && (res.status === 404 || res.status === 400)) reloadOnce();
      }
      return res;
    };
    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  useEffect(() => {
    function onRejection(event: PromiseRejectionEvent) {
      const message = String(
        (event.reason && (event.reason.message || event.reason.name)) || event.reason || "",
      );
      if (!/ChunkLoadError|Loading chunk .+ failed|dynamically imported module/i.test(message)) return;
      reloadOnce();
    }
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return null;
}
