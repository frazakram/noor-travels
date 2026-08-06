"use client";

export type SharePayload = { title: string; text: string; url?: string };

/** Native share sheet (WhatsApp, Instagram, etc.) with a clipboard fallback. */
export async function shareContent(payload: SharePayload): Promise<"shared" | "copied" | "failed"> {
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
