"use client";

import { nativeCanShareImage, nativeShare, nativeShareImage } from "@/lib/native-bridge";
import type { CardContent } from "@/lib/share-card";

export type SharePayload = {
  title: string;
  text: string;
  url?: string;
  /** When present, the share is an image card of this content (see lib/share-card). */
  card?: CardContent;
};

export type ShareResult = "shared" | "copied" | "failed";

/** Caption sent with a card image: the full text is on the image, so just name and link it. */
function caption(payload: SharePayload): string {
  const url = payload.url ?? /https?:\/\/\S+/.exec(payload.text)?.[0];
  return url ? `${payload.title}\n${url}` : payload.title;
}

/** Image share of payload.card, or null when this platform can't share an image. */
async function shareCard(payload: SharePayload, card: CardContent): Promise<ShareResult | null> {
  const webCanShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  if (!nativeCanShareImage() && !webCanShareFiles) return null;
  const { blobToBase64, renderCard } = await import("@/lib/share-card");
  let blob: Blob;
  try {
    blob = await renderCard(card);
  } catch {
    return null;
  }
  if (nativeCanShareImage()) {
    return nativeShareImage(payload.title, caption(payload), await blobToBase64(blob)) ? "shared" : null;
  }
  const file = new File([blob], `${card.reference.replace(/[^\w-]+/g, "-")}.jpg`, { type: "image/jpeg" });
  if (!navigator.canShare({ files: [file] })) return null;
  try {
    await navigator.share({ files: [file], title: payload.title, text: caption(payload) });
    return "shared";
  } catch (err) {
    // Closing the share sheet is a choice, not a failure: don't copy text behind the user's back.
    return err instanceof DOMException && err.name === "AbortError" ? "shared" : null;
  }
}

/** Native share sheet (WhatsApp, Instagram, etc.) with an image card when possible; clipboard fallback. */
export async function shareContent(payload: SharePayload): Promise<ShareResult> {
  if (payload.card) {
    const result = await shareCard(payload, payload.card);
    if (result) return result;
  }
  // Inside the Android WebView, navigator.share is unimplemented — it silently falls through
  // to clipboard below instead of throwing. Route through the native bridge first so the
  // Android share sheet (and Instagram's Story target) actually opens.
  if (nativeShare(payload.title, payload.text)) {
    return "shared";
  }
  try {
    if (navigator.share) {
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
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
