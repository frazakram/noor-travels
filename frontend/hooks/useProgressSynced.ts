"use client";

import { useEffect, useRef } from "react";
import { PROGRESS_SYNCED_EVENT } from "@/lib/sync-signal";

/** Calls `reload` when a sync brought in changes from another device for any of `namespaces`,
 *  so a page already on screen shows them without a reload. */
export function useProgressSynced(namespaces: string[], reload: () => void): void {
  const ref = useRef(reload);
  useEffect(() => {
    ref.current = reload;
  });
  const key = namespaces.join(",");
  useEffect(() => {
    const wanted = key.split(",");
    const on = (e: Event) => {
      const updated = (e as CustomEvent<string[]>).detail ?? [];
      if (updated.some((ns) => wanted.includes(ns))) ref.current();
    };
    window.addEventListener(PROGRESS_SYNCED_EVENT, on);
    return () => window.removeEventListener(PROGRESS_SYNCED_EVENT, on);
  }, [key]);
}
