"use client";

import { useState } from "react";
import { IconButton, Icons } from "@/components/IconButton";
import { shareContent, type SharePayload } from "@/lib/share";
import { t, type Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
  /** Static payload — usable from server components (must be serializable). */
  payload?: SharePayload;
  /** Lazy payload — for client-only values like window.location; takes precedence over `payload`. */
  getPayload?: () => SharePayload;
  label?: string;
  tipSide?: "top" | "bottom";
  variant?: "default" | "gold" | "primary" | "hero";
  className?: string;
};

/** Icon-only share button — native share sheet (WhatsApp, Instagram, etc.), clipboard fallback. */
export function ShareButton({ lang, payload, getPayload, label, tipSide = "top", variant = "default", className }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const resolved = getPayload ? getPayload() : payload;
    if (!resolved) return;
    const result = await shareContent(resolved);
    if (result === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <IconButton
      icon={Icons.share}
      label={copied ? t(lang, "copied") : label || t(lang, "share")}
      tipSide={tipSide}
      variant={variant}
      className={className}
      onClick={() => void handleShare()}
    />
  );
}
