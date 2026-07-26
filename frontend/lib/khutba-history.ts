export type SavedKhutbaLine = {
  arabic: string;
  english: string;
  urdu: string;
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
