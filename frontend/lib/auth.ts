import { api } from "@/lib/api";
import type { LearnProgress } from "@/lib/learn-quran";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  lang: string;
};

const TOKEN_KEY = "noor-auth-token";
const USER_KEY = "noor-auth-user";
export const AUTH_CHANGED_EVENT = "noor:auth-changed";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

function emitAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function saveAuth(token: string, user: AuthUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* private mode — session continues in memory via module state elsewhere */
  }
  emitAuthChanged();
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuthChanged();
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type AuthResponse = { token: string; user: AuthUser };

export async function signup(email: string, password: string, name: string, lang: string): Promise<AuthUser> {
  const data = await api<AuthResponse>("/api/auth/signup", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password, name, lang }),
  });
  saveAuth(data.token, data.user);
  return data.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await api<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  saveAuth(data.token, data.user);
  return data.user;
}

// ── Learn-progress cloud sync ───────────────────────────────────────────

export async function pullRemoteProgress(): Promise<LearnProgress | null> {
  if (!isLoggedIn()) return null;
  const data = await api<{ progress: LearnProgress | null }>("/api/auth/progress", {
    headers: authHeaders(),
  });
  return data.progress;
}

export async function pushRemoteProgress(progress: LearnProgress): Promise<void> {
  if (!isLoggedIn()) return;
  await api("/api/auth/progress", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ progress }),
  });
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Fire-and-forget debounced sync — never blocks or breaks the lesson flow. */
export function scheduleProgressPush(progress: LearnProgress) {
  if (typeof window === "undefined" || !isLoggedIn()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushRemoteProgress(progress).catch(() => undefined);
  }, 1500);
}

/** Union-merge two progress records: nothing the user earned is ever lost. */
export function mergeProgress(local: LearnProgress, remote: LearnProgress | null): LearnProgress {
  if (!remote) return local;
  const lessons: LearnProgress["lessons"] = { ...remote.lessons };
  for (const [id, lp] of Object.entries(local.lessons)) {
    const other = lessons[id];
    if (!other) lessons[id] = lp;
    else {
      lessons[id] = {
        completed: lp.completed || other.completed,
        score: Math.max(lp.score ?? 0, other.score ?? 0) || undefined,
        lastStudied:
          (lp.lastStudied ?? "") > (other.lastStudied ?? "") ? lp.lastStudied : other.lastStudied,
        placed: lp.placed && other.placed,
      };
    }
  }
  const localPlacement = local.placement;
  const remotePlacement = remote.placement;
  return {
    lessons,
    streak: Math.max(local.streak, remote.streak ?? 0),
    lastStudyDate:
      (local.lastStudyDate ?? "") > (remote.lastStudyDate ?? "")
        ? local.lastStudyDate
        : remote.lastStudyDate,
    points: Math.max(local.points, remote.points ?? 0),
    placement:
      (localPlacement?.date ?? "") > (remotePlacement?.date ?? "") ? localPlacement : remotePlacement,
    badges: { ...(remote.badges ?? {}), ...(local.badges ?? {}) },
    moduleQuizzes: (() => {
      const out = { ...(remote.moduleQuizzes ?? {}) };
      for (const [id, score] of Object.entries(local.moduleQuizzes ?? {})) {
        out[id] = Math.max(out[id] ?? 0, score);
      }
      return out;
    })(),
  };
}
