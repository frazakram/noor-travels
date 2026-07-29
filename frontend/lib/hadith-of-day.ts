export type DailyHadith = {
  id: number;
  collection: string;
  chapter_en?: string;
  hadith_number: number;
  arabic: string;
  english: string;
  reference: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftDateString(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Backend base URL for server-side fetches — same-origin routing in prod (see vercel.json). */
function backendBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://noor-travels-chi.vercel.app"
  );
}

/** Deterministic per-date hadith — same date always returns the same row (see backend `/api/hadith/daily`). */
export async function getHadithForDate(date: string): Promise<DailyHadith | null> {
  const res = await fetch(`${backendBase()}/api/hadith/daily?date=${date}`, {
    next: { revalidate: date === todayDateString() ? 3600 : false },
  });
  if (!res.ok) return null;
  return res.json();
}
