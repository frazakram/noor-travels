const API = process.env.NEXT_PUBLIC_API_URL || "";

// Mirrors NavigationProgress's event (not imported: that module is a client
// component and this helper must stay import-safe everywhere).
const PAGE_LOADING_EVENT = "noor:page-loading";
/** Requests faster than this never show the bar — no flicker on cached data. */
const PROGRESS_GRACE_MS = 200;

export type ApiInit = RequestInit & {
  /** Background polling (e.g. khutba live chunks) — never show the loading bar. */
  silent?: boolean;
};

function emitLoading(active: boolean) {
  window.dispatchEvent(new CustomEvent(PAGE_LOADING_EVENT, { detail: { active } }));
}

async function _fetch<T>(path: string, init?: ApiInit): Promise<T> {
  const { silent, ...rest } = init ?? {};
  // Every fetch drives the top progress bar so users always see that the app
  // is working, on whichever page the data is loading.
  let shown = false;
  const grace =
    !silent && typeof window !== "undefined"
      ? window.setTimeout(() => {
          shown = true;
          emitLoading(true);
        }, PROGRESS_GRACE_MS)
      : null;
  try {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...rest,
      });
    } catch {
      throw new Error("We could not connect right now. Please check your internet and try again.");
    }
    if (!res.ok) {
      let detail = "Something went wrong while loading this content. Please try again.";
      try {
        const body = await res.json();
        if (typeof body.detail === "string" && !looksTechnical(body.detail)) detail = body.detail;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return await res.json();
  } finally {
    if (grace != null) window.clearTimeout(grace);
    if (shown) emitLoading(false);
  }
}

/** Dynamic data: always fetch fresh (chat, search results, salah times). */
export function api<T>(path: string, init?: ApiInit): Promise<T> {
  return _fetch<T>(path, { cache: "no-store", ...init });
}

/** Static data: respect server Cache-Control headers (surahs list, duas, hadith chapters). */
export function apiStatic<T>(path: string, init?: ApiInit): Promise<T> {
  return _fetch<T>(path, init);
}

function looksTechnical(message: string): boolean {
  return /backend|websocket|python|traceback|exception|localhost|port\s*\d+|enoent|module|stack/i.test(message);
}

export function wsUrl(path: string): string {
  if (!API && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${path}`;
  }
  const base = API.replace(/^http/, "ws");
  return `${base}${path}`;
}
