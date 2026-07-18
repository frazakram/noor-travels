"use client";

const MAX_TAFSIR_CHARS = 1400;
const API = process.env.NEXT_PUBLIC_API_URL || "";

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
let playbackGeneration = 0;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isStale(gen: number): boolean {
  return gen !== playbackGeneration;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  if (voicesReady) return voicesReady;

  voicesReady = new Promise((resolve) => {
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) resolve(voices);
    };
    pick();
    window.speechSynthesis.onvoiceschanged = () => pick();
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
  return voicesReady;
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const prefs = { en: "en", ur: "ur", hi: "hi" }[lang] || "en";
  const ranked = voices.filter((v) => v.lang.toLowerCase().startsWith(prefs));
  if (ranked.length) return ranked[0];
  return voices.find((v) => v.lang.startsWith("en"));
}

export function truncateForSpeech(text: string, max = MAX_TAFSIR_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const last = cut.lastIndexOf(". ");
  return (last > 200 ? cut.slice(0, last + 1) : cut) + "…";
}

export function beginPlaybackSession(): number {
  playbackGeneration += 1;
  stopAllPlayback();
  return playbackGeneration;
}

export function invalidatePlaybackSession(): void {
  playbackGeneration += 1;
  stopAllPlayback();
}

type AudioSlot = {
  el: HTMLAudioElement;
  resolve?: () => void;
  reject?: (err: Error) => void;
  gen?: number;
  onTime?: (current: number, duration: number) => void;
  raf?: number;
  onPlay?: () => void;
};

let primary: AudioSlot | null = null;
let standby: AudioSlot | null = null;
let prefetchUrl: string | null = null;

function makeAudioEl(): HTMLAudioElement {
  const el = new Audio();
  el.setAttribute("playsinline", "true");
  (el as HTMLAudioElement & { webkitPlaysinline?: boolean }).webkitPlaysinline = true;
  el.preload = "auto";
  return el;
}

function getPrimary(): AudioSlot {
  if (!primary) primary = { el: makeAudioEl() };
  return primary;
}

function getStandby(): AudioSlot {
  if (!standby) standby = { el: makeAudioEl() };
  return standby;
}

function clearSlotHandlers(slot: AudioSlot) {
  const { el } = slot;
  if (slot.raf) cancelAnimationFrame(slot.raf);
  if (slot.onPlay) el.removeEventListener("play", slot.onPlay);
  el.onended = null;
  el.onerror = null;
  el.ontimeupdate = null;
  el.onloadeddata = null;
  el.oncanplaythrough = null;
  slot.resolve = undefined;
  slot.reject = undefined;
  slot.onTime = undefined;
  slot.gen = undefined;
  slot.raf = undefined;
  slot.onPlay = undefined;
}

type StopAt = { endAtFraction: number; contentOffsetSec: number };

function wirePlayback(
  slot: AudioSlot,
  gen: number | undefined,
  onTimeUpdate?: (current: number, duration: number) => void,
  stopAt?: StopAt
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gen !== undefined && isStale(gen)) {
      resolve();
      return;
    }

    clearSlotHandlers(slot);
    slot.gen = gen;
    slot.resolve = resolve;
    slot.reject = reject;
    slot.onTime = onTimeUpdate;

    const { el } = slot;

    const cleanupMotion = () => {
      if (slot.raf) cancelAnimationFrame(slot.raf);
      slot.raf = undefined;
      if (slot.onPlay) el.removeEventListener("play", slot.onPlay);
      slot.onPlay = undefined;
    };

    const finish = () => {
      if (slot.resolve === resolve) {
        cleanupMotion();
        clearSlotHandlers(slot);
        resolve();
      }
    };

    const emitTime = () => {
      if (gen !== undefined && isStale(gen)) return;
      const dur = el.duration;
      const knownDur = Number.isFinite(dur) && dur > 0 ? dur : 0;
      // Range loop inside a full-surah file: finish early at the end boundary.
      if (stopAt && knownDur > 0) {
        const offset = Math.min(Math.max(0, stopAt.contentOffsetSec), knownDur);
        const target =
          offset + Math.min(1, Math.max(0, stopAt.endAtFraction)) * (knownDur - offset);
        if (el.currentTime >= target - 0.08) {
          try {
            el.pause();
          } catch {
            /* ignore */
          }
          finish();
          return;
        }
      }
      if (!slot.onTime) return;
      // Emit even when duration is unknown — segment timings only need currentTime.
      slot.onTime(el.currentTime, knownDur);
    };

    el.ontimeupdate = emitTime;
    el.onended = finish;
    el.onerror = () => {
      if (slot.reject === reject) {
        cleanupMotion();
        clearSlotHandlers(slot);
        reject(new Error("Audio playback failed"));
      }
    };

    if (onTimeUpdate) {
      const tick = () => {
        if (slot.resolve !== resolve) return;
        emitTime();
        if (!el.paused && !el.ended) {
          slot.raf = requestAnimationFrame(tick);
        }
      };
      slot.onPlay = () => {
        if (slot.raf) cancelAnimationFrame(slot.raf);
        slot.raf = requestAnimationFrame(tick);
      };
      el.addEventListener("play", slot.onPlay);
    }
  });
}

// Shortest valid silent WAV (44-byte header, zero samples).
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/**
 * Must be called synchronously inside a user gesture (click/tap), before any
 * awaits. Playing a silent clip unlocks the shared element so later play()
 * calls — after network fetches have consumed the gesture — are not blocked
 * by mobile autoplay policy.
 */
export function primeAudioPlayback(): void {
  if (typeof window === "undefined") return;
  try {
    const slot = getPrimary();
    const el = slot.el;
    if (!el.paused && !el.src.startsWith("data:")) return;
    el.muted = true;
    el.src = SILENT_WAV;
    void el
      .play()
      .then(() => {
        if (el.src.startsWith("data:")) el.pause();
        el.muted = false;
      })
      .catch(() => {
        el.muted = false;
      });
  } catch {
    /* ignore */
  }
}

function sameAudioUrl(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    return new URL(a, window.location.href).href === new URL(b, window.location.href).href;
  } catch {
    return a.endsWith(b) || b.endsWith(a);
  }
}

/** Warm the next ayah URL so Arabic-only playback can swap with almost no gap. */
export function prefetchAudioUrl(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;
  prefetchUrl = url;
  const slot = getStandby();
  if (sameAudioUrl(slot.el.src, url) && slot.el.readyState >= 2) return;
  try {
    slot.el.muted = true;
    slot.el.src = url;
    slot.el.load();
  } catch {
    /* ignore */
  }
}

export type PlayAudioOptions = {
  gen?: number;
  onTimeUpdate?: (current: number, duration: number) => void;
  /** Prefer a prefetched standby element for near-gapless ayah transitions. */
  seamless?: boolean;
  /** HTMLAudio playbackRate (0.5–2). Default 1. */
  playbackRate?: number;
  /** Seek within a full-surah file: offset + fraction of remaining content. */
  startAtFraction?: number;
  contentOffsetSec?: number;
  /** Stop early within a full-surah file (same content-fraction scale as startAtFraction). */
  endAtFraction?: number;
};

let currentPlaybackRate = 1;

export function setGlobalPlaybackRate(rate: number): void {
  currentPlaybackRate = Math.min(2, Math.max(0.5, rate));
  for (const slot of [primary, standby]) {
    if (slot?.el) {
      try {
        slot.el.playbackRate = currentPlaybackRate;
      } catch {
        /* ignore */
      }
    }
  }
}

export function getGlobalPlaybackRate(): number {
  return currentPlaybackRate;
}

function applyRate(el: HTMLAudioElement, rate?: number) {
  const r = rate ?? currentPlaybackRate;
  try {
    el.playbackRate = r;
  } catch {
    /* ignore */
  }
}

export function playAudioUrl(url: string, genOrOpts?: number | PlayAudioOptions): Promise<void> {
  const opts: PlayAudioOptions =
    typeof genOrOpts === "number" || genOrOpts === undefined
      ? { gen: genOrOpts }
      : genOrOpts;
  const {
    gen,
    onTimeUpdate,
    seamless,
    playbackRate,
    startAtFraction,
    contentOffsetSec,
    endAtFraction,
  } = opts;
  if (playbackRate != null) setGlobalPlaybackRate(playbackRate);

  if (gen !== undefined && isStale(gen)) {
    return Promise.resolve();
  }

  const stopAt: StopAt | undefined =
    endAtFraction != null && endAtFraction > 0 && endAtFraction < 1
      ? { endAtFraction, contentOffsetSec: contentOffsetSec ?? 0 }
      : undefined;

  // Gapless path: standby already holds this URL — swap roles and play immediately.
  if (
    seamless &&
    standby &&
    prefetchUrl === url &&
    sameAudioUrl(standby.el.src, url) &&
    standby.el.readyState >= 1
  ) {
    return playPrefetched(
      url,
      gen,
      onTimeUpdate,
      startAtFraction,
      contentOffsetSec,
      stopAt
    );
  }

  return playOnPrimary(url, gen, onTimeUpdate, startAtFraction, contentOffsetSec, stopAt);
}

async function seekForContentFraction(
  el: HTMLAudioElement,
  fraction?: number,
  offsetSec = 0
): Promise<void> {
  if (fraction == null || fraction <= 0) {
    el.currentTime = 0;
    return;
  }
  if (!Number.isFinite(el.duration) || el.duration <= 0) {
    await new Promise<void>((resolve) => {
      const done = () => {
        el.removeEventListener("loadedmetadata", done);
        resolve();
      };
      el.addEventListener("loadedmetadata", done, { once: true });
      window.setTimeout(done, 5000);
    });
  }
  if (!Number.isFinite(el.duration) || el.duration <= 0) return;
  const offset = Math.min(Math.max(0, offsetSec), el.duration);
  const target = offset + Math.min(1, Math.max(0, fraction)) * (el.duration - offset);
  el.currentTime = Math.min(Math.max(0, target), Math.max(0, el.duration - 0.1));
}

async function playPrefetched(
  url: string,
  gen: number | undefined,
  onTimeUpdate?: (current: number, duration: number) => void,
  startAtFraction?: number,
  contentOffsetSec?: number,
  stopAt?: StopAt
): Promise<void> {
  const next = getStandby();
  const prev = getPrimary();

  // Swap slots so the warm element becomes primary.
  primary = next;
  standby = prev;
  prefetchUrl = null;

  // Soft-stop previous without tearing down the new primary.
  try {
    prev.el.pause();
    prev.el.removeAttribute("src");
    prev.el.load();
  } catch {
    /* ignore */
  }
  if (prev.resolve) {
    const r = prev.resolve;
    clearSlotHandlers(prev);
    r();
  }

  const slot = getPrimary();
  const done = wirePlayback(slot, gen, onTimeUpdate, stopAt);
  slot.el.muted = false;
  applyRate(slot.el);
  await seekForContentFraction(slot.el, startAtFraction, contentOffsetSec);
  try {
    await slot.el.play();
  } catch {
    // Fallback: load on primary normally
    return playOnPrimary(
      url,
      gen,
      onTimeUpdate,
      startAtFraction,
      contentOffsetSec,
      stopAt
    );
  }
  return done;
}

async function playOnPrimary(
  url: string,
  gen: number | undefined,
  onTimeUpdate?: (current: number, duration: number) => void,
  startAtFraction?: number,
  contentOffsetSec?: number,
  stopAt?: StopAt
): Promise<void> {
  const slot = getPrimary();

  // Resolve any in-flight waiter without a hard pause gap when possible.
  if (slot.resolve) {
    const r = slot.resolve;
    clearSlotHandlers(slot);
    r();
  }

  const done = wirePlayback(slot, gen, onTimeUpdate, stopAt);
  const { el } = slot;
  el.muted = false;
  applyRate(el);

  if (!sameAudioUrl(el.src, url)) {
    el.src = url;
  } else if (startAtFraction == null) {
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }

  try {
    await seekForContentFraction(el, startAtFraction, contentOffsetSec);
    await el.play();
    applyRate(el);
  } catch (err) {
    clearSlotHandlers(slot);
    throw err instanceof Error ? err : new Error("Audio playback failed");
  }
  return done;
}

export function stopAudio(): void {
  for (const slot of [primary, standby]) {
    if (!slot) continue;
    try {
      slot.el.pause();
      slot.el.currentTime = 0;
    } catch {
      /* ignore */
    }
    if (slot.resolve) {
      const r = slot.resolve;
      clearSlotHandlers(slot);
      r();
    } else {
      clearSlotHandlers(slot);
    }
  }
  prefetchUrl = null;

  const w = window as unknown as { __noorBlobUrl?: string };
  if (w.__noorBlobUrl) {
    URL.revokeObjectURL(w.__noorBlobUrl);
    w.__noorBlobUrl = undefined;
  }
}

async function speakViaApi(text: string, lang: string, gen?: number): Promise<void> {
  if (gen !== undefined && isStale(gen)) return;

  const res = await fetch(`${API}/api/tts/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: truncateForSpeech(text, 2000), lang }),
  });
  if (!res.ok) throw new Error(`TTS API ${res.status}`);
  if (gen !== undefined && isStale(gen)) return;

  const blob = await res.blob();
  const w = window as unknown as { __noorBlobUrl?: string };
  if (w.__noorBlobUrl) URL.revokeObjectURL(w.__noorBlobUrl);
  const url = URL.createObjectURL(blob);
  w.__noorBlobUrl = url;
  await playAudioUrl(url, { gen });
}

async function speakViaBrowser(text: string, lang: string, gen?: number): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (gen !== undefined && isStale(gen)) return;

  const voices = await loadVoices();
  window.speechSynthesis.cancel();
  await delay(150);
  if (gen !== undefined && isStale(gen)) return;

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(voices, lang);
    utter.lang = lang === "ur" ? "ur-PK" : lang === "hi" ? "hi-IN" : "en-US";
    if (voice) utter.voice = voice;
    utter.rate = lang === "ur" || lang === "hi" ? 0.9 : 0.95;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

/** Play URL if present, otherwise TTS. Used for translation + tafsir fallback. */
export async function playSpokenText(
  text: string,
  lang: string,
  audioUrl?: string | null,
  gen?: number
): Promise<void> {
  if (gen !== undefined && isStale(gen)) return;
  const trimmed = (text || "").trim();
  // Prefer recorded translation audio even when verse text failed to load.
  if (!trimmed && !audioUrl) return;

  stopAudio();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  await delay(80);
  if (gen !== undefined && isStale(gen)) return;

  if (audioUrl) {
    try {
      await playAudioUrl(audioUrl, { gen });
      return;
    } catch {
      /* fall through to TTS */
    }
  }

  if (!trimmed) return;

  try {
    await speakViaApi(trimmed, lang, gen);
  } catch {
    await speakViaBrowser(trimmed, lang, gen);
  }
}

export async function speakText(text: string, lang: string): Promise<void> {
  return playSpokenText(text, lang, null);
}

export function stopSpeech(): void {
  stopAudio();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function stopAllPlayback(): void {
  stopSpeech();
}
