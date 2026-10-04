const API = process.env.NEXT_PUBLIC_API_URL || "";
const CONSENT_KEY = "noor-feedback-consent";

export type FeedbackPayload = {
  id: string;
  rating: 1 | -1;
  question: string;
  answer: string;
  citations: string[];
  source_refs: string[];
  lang?: string;
  mode?: string;
  llm_model?: string | null;
  comment?: string;
};

/** RFC 4122 v4 id for one answer's vote; older WebViews lack crypto.randomUUID. */
export function newFeedbackId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Whether the user already agreed to share rated answers (asked once, remembered on device). */
export function hasFeedbackConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false; // storage blocked: ask each time rather than assume
  }
}

export function rememberFeedbackConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    /* storage blocked: the dialog simply shows again next time */
  }
}

export async function sendFeedback(payload: FeedbackPayload): Promise<void> {
  const res = await fetch(`${API}/api/rag/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, comment: payload.comment?.trim() || undefined }),
  });
  if (!res.ok) throw new Error(`feedback ${res.status}`);
}
