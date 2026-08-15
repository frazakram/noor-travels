export type SavedKhutbaLine = {
  arabic: string;
  english: string;
  urdu: string;
};

/** How much of the sermon actually made it into the transcript.
 *
 * Reported instead of a per-line confidence score: Deepgram's confidence sits
 * in a 0.93-0.99 band for anything containing speech (it even rose when noise
 * was added), so it cannot tell a listener which lines to trust — and it rates
 * the Arabic transcription, not the English/Urdu translation people would read
 * it as. Segment counts are a plain fact about what was captured. */
export type KhutbaCoverage = {
  /** 10-second segments recorded over the session. */
  segments: number;
  /** Segments that produced a translated line. */
  translated: number;
  /** Segments with no speech in them — a pause, not a loss. */
  skipped: number;
  /** Segments lost to a transcription or network error. */
  failed: number;
};

export type SavedKhutba = {
  id: string;
  /** ISO timestamp of when the recording was stopped. */
  savedAt: string;
  /** City/area label at the time of saving ("" when unknown). */
  location: string;
  /** Chronological transcript lines (oldest first). */
  lines: SavedKhutbaLine[];
  /** Title of the matched pre-loaded khutbah, when one was detected. */
  matchedTitle?: string;
  /** Absent on sessions saved before coverage tracking shipped. */
  coverage?: KhutbaCoverage;
};

const KEY = "noor-khutba-history";
const MAX_ENTRIES = 30;

export function loadSavedKhutbas(): SavedKhutba[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k): k is SavedKhutba =>
        k && typeof k.id === "string" && typeof k.savedAt === "string" && Array.isArray(k.lines),
    );
  } catch {
    return [];
  }
}

export function lastSavedKhutba(): SavedKhutba | null {
  return loadSavedKhutbas()[0] ?? null;
}

export function saveKhutba(
  entry: Omit<SavedKhutba, "id" | "savedAt">,
): SavedKhutba | null {
  if (typeof window === "undefined") return null;
  if (!entry.lines.length) return null;
  const saved: SavedKhutba = {
    ...entry,
    id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  const next = [saved, ...loadSavedKhutbas()].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return null;
  }
  return saved;
}

export function deleteSavedKhutba(id: string): SavedKhutba[] {
  const next = loadSavedKhutbas().filter((k) => k.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function formatKhutbaDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(
      locale === "ur" ? "ur-PK" : locale === "hi" ? "hi-IN" : "en-IN",
      { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" },
    ).format(new Date(iso));
  } catch {
    return iso;
  }
}
