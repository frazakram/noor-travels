/**
 * Re-attaching the reader to native (APK) Quran playback. The native player owns the session
 * (PlaybackSessionStore.kt); a reader that loads while it plays — after a reload, a killed
 * WebView renderer, or a notification tap — reads it once and decides here whether it is
 * showing the surah that is playing.
 */
export type NativePlaybackSession = {
  sessionId: string;
  surah: number;
  ayahIndex: number;
  playing: boolean;
  active: boolean;
  updatedAt: number;
  /** 1.9+: "finished" (queue played out) or "stopped"; empty while active. */
  endReason?: string;
};

export type ReattachDecision =
  | { attach: false }
  | { attach: true; index: number; playing: boolean; sessionId: string };

export function reattachDecision(
  session: NativePlaybackSession | null | undefined,
  surahNumber: number,
  ayahCount: number,
): ReattachDecision {
  if (!session || !session.active || session.surah !== surahNumber || ayahCount <= 0) return { attach: false };
  const index = Number.isInteger(session.ayahIndex) ? Math.min(Math.max(0, session.ayahIndex), ayahCount - 1) : 0;
  return { attach: true, index, playing: Boolean(session.playing), sessionId: String(session.sessionId ?? "") };
}

export function newSessionId(surahNumber: number): string {
  return `${surahNumber}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Native events carry the session they belong to. Apply one only if it is ours; events without
 * an id (APKs before 1.9) or before we know our id are applied as before.
 */
export function isOwnSessionEvent(eventSessionId: string | null | undefined, currentSessionId: string | null): boolean {
  if (!eventSessionId || !currentSessionId) return true;
  return eventSessionId === currentSessionId;
}

/** Everything that shapes a native queue. A paused queue is resumed only if this is unchanged. */
export type QueueSettings = {
  surah: number;
  reciter: string;
  translation: string;
  includeTranslation: boolean;
  includeTafsir: boolean;
  repeatScope: string;
  repeatCount: number;
  rangeStart?: number;
  rangeEnd?: number;
};

export function queueKey(s: QueueSettings): string {
  const range = s.repeatScope === "range" ? `${s.rangeStart ?? ""}-${s.rangeEnd ?? ""}` : "";
  return [s.surah, s.reciter, s.translation, s.includeTranslation ? 1 : 0, s.includeTafsir ? 1 : 0, s.repeatScope, s.repeatCount, range].join("|");
}

/** Play pressed while native audio is paused: resume it in place, or build a new queue? */
export function canResumeNative(opts: {
  attached: boolean;
  playing: boolean;
  requestedIndex: number;
  pausedIndex: number;
  queueKeyAtStart: string | null;
  currentQueueKey: string;
}): boolean {
  return (
    opts.attached &&
    !opts.playing &&
    opts.requestedIndex === opts.pausedIndex &&
    opts.queueKeyAtStart !== null &&
    opts.queueKeyAtStart === opts.currentQueueKey
  );
}

export type ReconcileAction =
  | { action: "none" }
  | { action: "attach"; index: number; playing: boolean; sessionId: string }
  | { action: "sync"; index: number; playing: boolean }
  | { action: "reset" }
  | { action: "finished" };

/**
 * The page re-checks the native session when the app comes back to the foreground: events
 * pushed while it was in the background (screen off, WebView paused) can be lost, and without
 * this the reader kept showing a stale ayah or "playing" after the audio had stopped, and
 * auto-play never continued to the next surah.
 */
/** A finish older than this doesn't auto-play the next surah when the app is reopened. */
export const FINISH_AUTOPLAY_WINDOW_MS = 2 * 60 * 1000;

export function reconcileDecision(
  session: NativePlaybackSession | null | undefined,
  page: { attached: boolean; sessionId: string | null; surah: number; ayahCount: number; now: number },
): ReconcileAction {
  if (!page.attached) {
    const d = reattachDecision(session, page.surah, page.ayahCount);
    return d.attach ? { action: "attach", index: d.index, playing: d.playing, sessionId: d.sessionId } : { action: "none" };
  }
  if (!session || (page.sessionId && session.sessionId !== page.sessionId)) return { action: "reset" };
  if (!session.active) {
    // Reopening the app hours after a surah ended must not start the next one unprompted.
    const recent = page.now - session.updatedAt <= FINISH_AUTOPLAY_WINDOW_MS;
    return session.endReason === "finished" && recent ? { action: "finished" } : { action: "reset" };
  }
  if (session.surah !== page.surah || page.ayahCount <= 0) return { action: "reset" };
  const index = Math.min(Math.max(0, session.ayahIndex), page.ayahCount - 1);
  return { action: "sync", index, playing: Boolean(session.playing) };
}
