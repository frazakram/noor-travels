"use client";

import { nativeShare } from "@/lib/native-bridge";

export type SharePayload = { title: string; text: string; url?: string };

/** Native share sheet (WhatsApp, Instagram, etc.) with a clipboard fallback. */
export async function shareContent(payload: SharePayload): Promise<"shared" | "copied" | "failed"> {
  // Inside the Android WebView, navigator.share is unimplemented — it silently falls through
  // to clipboard below instead of throwing. Route through the native bridge first so the
  // Android share sheet (and Instagram's Story target) actually opens.
  if (nativeShare(payload.title, payload.text)) {
    return "shared";
  }
  try {
    if (navigator.share) {
      await navigator.share(payload);
      return "shared";
    }
  } catch {
    /* user cancelled or the OS share sheet failed — fall through to clipboard */
  }
  try {
    await navigator.clipboard.writeText(payload.text);
    return "copied";
  } catch {
    return "failed";
  }
}
