"use client";

import { useEffect } from "react";

/** Marks WebView / installed app so CSS can add extra status-bar padding. */
export function AppShellDetect() {
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;
    const androidShell = /NoorSafarAndroid/i.test(ua) || /; wv\)/i.test(ua);
    if (standalone || androidShell) {
      document.documentElement.classList.add("app-shell");
    }
  }, []);

  return null;
}
