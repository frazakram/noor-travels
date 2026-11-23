"use client";

import { useEffect } from "react";
import { wireProgressSync } from "@/lib/progress-sync";

/** Syncs a signed-in user's progress across devices in the background (lib/progress-sync.ts). */
export function ProgressSync() {
  useEffect(() => wireProgressSync(), []);
  return null;
}
