"use client";

type Handlers = {
  onPause?: () => void;
  onPlay?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onStop?: () => void;
};

let wakeLock: WakeLockSentinel | null = null;
let handlers: Handlers = {};

export async function acquireWakeLock(): Promise<void> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
  try {
    if (!wakeLock) wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    /* denied or unsupported */
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await wakeLock?.release();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}

export function setupMediaSession(h: Handlers): void {
  handlers = h;
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

  navigator.mediaSession.setActionHandler("play", () => handlers.onPlay?.());
  navigator.mediaSession.setActionHandler("pause", () => handlers.onPause?.());
  navigator.mediaSession.setActionHandler("stop", () => handlers.onStop?.());
  navigator.mediaSession.setActionHandler("previoustrack", () => handlers.onPrevious?.());
  navigator.mediaSession.setActionHandler("nexttrack", () => handlers.onNext?.());
}

export function updateMediaSession(meta: {
  title: string;
  artist: string;
  album?: string;
  playing: boolean;
}): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: meta.title,
    artist: meta.artist,
    album: meta.album ?? "Noor Safar — Quran",
  });
  navigator.mediaSession.playbackState = meta.playing ? "playing" : "paused";
}

export function clearMediaSession(): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
}
