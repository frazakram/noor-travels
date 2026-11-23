/**
 * Reports errors from the app to /api/telemetry/errors (backend/app/api/telemetry.py), so a
 * crash on someone's phone is visible without that phone on a USB cable.
 *
 * Never costs the user anything:
 * - nothing is sent while the page is busy: reports wait in a queue and go out with
 *   navigator.sendBeacon when the page is hidden, or after a few idle seconds;
 * - text/plain body, so no CORS preflight; sendBeacon never blocks navigation;
 * - at most MAX_PER_PAGE reports per page load, each distinct error once;
 * - noise that isn't ours (browser extensions, opaque cross-origin "Script error.", the benign
 *   ResizeObserver warning, aborted fetches) is dropped before it is queued.
 * No user id, query string or page content is sent.
 */

export type ReportKind = "error" | "unhandledrejection" | "react" | "native_crash" | "renderer_gone";
export type ErrorReport = {
  kind: ReportKind;
  message: string;
  stack?: string;
  path?: string;
  platform: "web" | "apk" | "native";
  app_version?: string;
  build?: string;
};

export const MAX_PER_PAGE = 10;
const FLUSH_DELAY_MS = 4000;

const NOISE = [
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /AbortError|The (user|operation) aborted/i,
  /^Load failed$/i, // Safari's generic offline fetch failure
  /chrome-extension:|moz-extension:|safari-extension:/i,
];

/** True for errors that are not this app's bugs. */
export function isNoise(message: string, stack?: string): boolean {
  return NOISE.some((re) => re.test(message) || (stack ? re.test(stack) : false));
}

/** Turns anything thrown or rejected into a message and stack. */
export function describe(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) return { message: reason.message || reason.name, stack: reason.stack };
  if (typeof reason === "string") return { message: reason };
  try {
    return { message: JSON.stringify(reason)?.slice(0, 500) || String(reason) };
  } catch {
    return { message: String(reason) };
  }
}

const clip = (s: string | undefined, n: number) => (s && s.length > n ? s.slice(0, n) : s);

/** The page-session queue: dedupes by kind + message and stops at MAX_PER_PAGE. */
export function createQueue() {
  const seen = new Set<string>();
  let pending: ErrorReport[] = [];
  return {
    add(report: ErrorReport): boolean {
      if (isNoise(report.message, report.stack)) return false;
      const key = `${report.kind}\n${report.message}`;
      if (seen.has(key) || seen.size >= MAX_PER_PAGE) return false;
      seen.add(key);
      pending.push({ ...report, message: clip(report.message, 2000)!, stack: clip(report.stack, 8000) });
      return true;
    },
    take(): ErrorReport[] {
      const out = pending;
      pending = [];
      return out;
    },
  };
}

// ---------------------------------------------------------------- browser wiring

const API = process.env.NEXT_PUBLIC_API_URL || "";
const BUILD = process.env.NEXT_PUBLIC_BUILD_SHA || undefined;
const queue = createQueue();
let context: { platform: ErrorReport["platform"]; app_version?: string } = { platform: "web" };
let timer: ReturnType<typeof setTimeout> | undefined;

export function setReportContext(next: typeof context): void {
  context = next;
}

export function flushReports(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  const reports = queue.take();
  if (!reports.length || typeof navigator === "undefined") return;
  const body = JSON.stringify({ reports });
  const url = `${API}/api/telemetry/errors`;
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
  } catch {
    /* fall through */
  }
  void fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
}

export function reportError(kind: ReportKind, reason: unknown, extra: Partial<ErrorReport> = {}): void {
  if (typeof window === "undefined") return;
  const { message, stack } = describe(reason);
  const added = queue.add({
    kind,
    message,
    stack,
    path: window.location.pathname,
    platform: context.platform,
    app_version: context.app_version,
    build: BUILD,
    ...extra,
  });
  if (added && timer === undefined) timer = setTimeout(flushReports, FLUSH_DELAY_MS);
}
