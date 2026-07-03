const API = process.env.NEXT_PUBLIC_API_URL || "";

async function _fetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
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
  return res.json();
}

/** Dynamic data: always fetch fresh (chat, search results, salah times). */
export function api<T>(path: string, init?: RequestInit): Promise<T> {
  return _fetch<T>(path, { cache: "no-store", ...init });
}

/** Static data: respect server Cache-Control headers (surahs list, duas, hadith chapters). */
export function apiStatic<T>(path: string, init?: RequestInit): Promise<T> {
  return _fetch<T>(path, init);
}

/** Multipart upload: no JSON Content-Type so the browser sets the form boundary. */
export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { method: "POST", body: form, cache: "no-store" });
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
  return res.json();
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
