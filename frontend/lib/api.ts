const API = process.env.NEXT_PUBLIC_API_URL || "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
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
