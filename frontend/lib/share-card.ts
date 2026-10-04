/**
 * Share cards: a verse / hadith / dua drawn as a 1080x1350 image (4:5, shown whole in WhatsApp
 * chats and the Instagram feed). One renderer for every platform: the website shares the PNG
 * through the Web Share API, and the Android app receives the same PNG over the bridge, so the
 * design changes without an APK release.
 *
 * Layout is a pure function (layoutCard) over a text-measuring callback, so it is unit-tested
 * without a canvas; drawCard only paints what the layout decided.
 */

export type CardKind = "quran" | "hadith" | "dua";

export type CardContent = {
  kind: CardKind;
  /** "Quran 2:153", "Sahih al-Bukhari 583", a dua title. */
  reference: string;
  arabic?: string;
  translation: string;
};

export const CARD_W = 1080;
export const CARD_H = 1350;
const MARGIN_X = 96;
const CONTENT_TOP = 250; // below the ornament and kind label
const CONTENT_BOTTOM = CARD_H - 190; // above the reference and wordmark
const ARABIC_MAX = 58;
const ARABIC_MIN = 34;
const BODY_MAX = 46;
const BODY_MIN = 25;
const GAP = 44; // between the Arabic block, divider and translation

export type Measure = (text: string, font: "arabic" | "body", size: number) => number;

export type TextBlock = { lines: string[]; size: number; lineHeight: number };
export type CardLayout = { arabic: TextBlock | null; body: TextBlock; truncated: boolean };

/** Greedy word wrap; a single word wider than the line is kept whole (no mid-word breaks). */
export function wrap(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fit(text: string, font: "arabic" | "body", max: number, min: number, height: number, measure: Measure, lineFactor: number): TextBlock | null {
  const width = CARD_W - MARGIN_X * 2;
  for (let size = max; size >= min; size -= 2) {
    const lines = wrap(text, width, (s) => measure(s, font, size));
    const lineHeight = Math.round(size * lineFactor);
    if (lines.length * lineHeight <= height) return { lines, size, lineHeight };
  }
  return null;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Cut at the last sentence end that fits, so a shortened hadith never stops mid-thought. */
function shorten(text: string, maxChars: number): string {
  const head = text.slice(0, maxChars);
  const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf('." '), head.lastIndexOf("? "), head.lastIndexOf("! "));
  return `${(end > maxChars * 0.4 ? head.slice(0, end + 1) : head.replace(/\s+\S*$/, "")).trim()} …`;
}

/**
 * Decides what goes on the card. The translation must appear in full when at all possible:
 * the Arabic is dropped before any translation is shortened, and only text too long even at
 * the smallest size is cut, at a sentence boundary (the caption carries the full-text link).
 */
export function layoutCard(input: CardContent, measure: Measure): CardLayout {
  // Source texts carry hard line breaks mid-sentence; the card wraps on its own.
  const content = { ...input, translation: normalize(input.translation) };
  const room = CONTENT_BOTTOM - CONTENT_TOP;
  const arabic = normalize(input.arabic ?? "");
  if (arabic) {
    for (let arabicShare = 0.45; arabicShare >= 0.3; arabicShare -= 0.05) {
      const a = fit(arabic, "arabic", ARABIC_MAX, ARABIC_MIN, room * arabicShare, measure, 1.75);
      if (!a) continue;
      const used = a.lines.length * a.lineHeight + GAP * 2;
      const b = fit(content.translation, "body", BODY_MAX, BODY_MIN, room - used, measure, 1.45);
      if (b) return { arabic: a, body: b, truncated: false };
    }
  }
  const body = fit(content.translation, "body", BODY_MAX, BODY_MIN, room, measure, 1.45);
  if (body) return { arabic: null, body, truncated: false };
  let chars = content.translation.length;
  while (chars > 80) {
    chars = Math.floor(chars * 0.85);
    const b = fit(shorten(content.translation, chars), "body", BODY_MIN + 4, BODY_MIN, room, measure, 1.45);
    if (b) return { arabic: null, body: b, truncated: true };
  }
  return { arabic: null, body: fit(shorten(content.translation, 80), "body", BODY_MIN, BODY_MIN, room * 4, measure, 1.45)!, truncated: true };
}

const COLORS = {
  top: "#0F3D3E",
  bottom: "#0A2020",
  gold: "#E0BC6A",
  goldSoft: "rgba(224, 188, 106, 0.55)",
  arabic: "#F3E3B5",
  body: "#E8F1EE",
  faint: "rgba(232, 241, 238, 0.45)",
};

const KIND_LABEL: Record<CardKind, string> = { quran: "QURAN", hadith: "HADITH", dua: "DUA" };

function fontFamily(variable: string, fallback: string): string {
  const v = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return v || fallback;
}

/** Renders the card to a JPEG. Browser only. */
export async function renderCard(content: CardContent): Promise<Blob> {
  const arabicFamily = fontFamily("--font-amiri", "serif");
  const bodyFamily = fontFamily("--font-inter", "sans-serif");
  // Canvas text uses only fonts already loaded; make sure both are before measuring.
  await Promise.all([
    document.fonts.load(`700 48px ${arabicFamily}`, "بسم"),
    document.fonts.load(`400 40px ${bodyFamily}`),
    document.fonts.load(`600 40px ${bodyFamily}`),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  // An Urdu translation is Arabic script, right to left: set it in the Arabic typeface.
  const rtlBody = /[\u0600-\u06FF]/.test(content.translation);
  // JPEG: a fraction of the PNG size for the same card (WhatsApp recompresses anyway).
  const fontFor = (font: "arabic" | "body", size: number) =>
    font === "arabic" || rtlBody ? `${font === "arabic" ? 700 : 400} ${size}px ${arabicFamily}` : `400 ${size}px ${bodyFamily}`;
  const measure: Measure = (text, font, size) => {
    ctx.font = fontFor(font, size);
    return ctx.measureText(text).width;
  };
  const layout = layoutCard(content, measure);

  // Background: the app's deep green, with a soft gold glow behind the ornament.
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, COLORS.top);
  bg.addColorStop(1, COLORS.bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W / 2, 120, 10, CARD_W / 2, 120, 420);
  glow.addColorStop(0, "rgba(224, 188, 106, 0.16)");
  glow.addColorStop(1, "rgba(224, 188, 106, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawStar(ctx, CARD_W / 2, 118, 46);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.gold;
  ctx.font = `600 22px ${bodyFamily}`;
  ctx.letterSpacing = "6px";
  ctx.fillText(KIND_LABEL[content.kind], CARD_W / 2, 206);
  ctx.letterSpacing = "0px";

  // Vertically centre the content block in its area.
  const arabicH = layout.arabic ? layout.arabic.lines.length * layout.arabic.lineHeight + GAP * 2 : 0;
  const bodyH = layout.body.lines.length * layout.body.lineHeight;
  let y = CONTENT_TOP + Math.max(0, (CONTENT_BOTTOM - CONTENT_TOP - arabicH - bodyH) / 2);

  if (layout.arabic) {
    ctx.fillStyle = COLORS.arabic;
    ctx.font = fontFor("arabic", layout.arabic.size);
    ctx.direction = "rtl";
    for (const line of layout.arabic.lines) {
      y += layout.arabic.lineHeight;
      ctx.fillText(line, CARD_W / 2, y - layout.arabic.lineHeight * 0.28);
    }
    ctx.direction = "ltr";
    y += GAP;
    ctx.strokeStyle = COLORS.goldSoft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CARD_W / 2 - 60, y - GAP / 2);
    ctx.lineTo(CARD_W / 2 + 60, y - GAP / 2);
    ctx.stroke();
    y += GAP - layout.arabic.lineHeight * 0.1;
  }

  ctx.fillStyle = COLORS.body;
  ctx.font = fontFor("body", layout.body.size);
  ctx.direction = rtlBody ? "rtl" : "ltr";
  for (const line of layout.body.lines) {
    y += layout.body.lineHeight;
    ctx.fillText(line, CARD_W / 2, y - layout.body.lineHeight * 0.25);
  }
  ctx.direction = "ltr";

  ctx.fillStyle = COLORS.gold;
  ctx.font = `600 32px ${bodyFamily}`;
  ctx.fillText(content.reference, CARD_W / 2, CARD_H - 118);
  ctx.fillStyle = COLORS.faint;
  ctx.font = `400 22px ${bodyFamily}`;
  ctx.fillText("Noor Safar", CARD_W / 2, CARD_H - 62);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92),
  );
}

/** The rub el hizb used across the app: two squares at 45 degrees and a ring. */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  for (const angle of [0, Math.PI / 4]) {
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.goldSoft;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** Base64 of an image blob, for the Android bridge. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
