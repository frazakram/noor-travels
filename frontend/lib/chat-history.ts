import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { ConversationSummary, SavedMessage } from "@/lib/chat-history-model";

/** Saved chats for the signed-in user. Turns are saved by the chat endpoint itself. */
function headers(): Record<string, string> {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function listChats(query = ""): Promise<ConversationSummary[]> {
  const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return api<{ conversations: ConversationSummary[] }>(`/api/chats${q}`, { headers: headers(), silent: true }).then((r) => r.conversations);
}

export function getChat(id: string): Promise<ConversationSummary & { messages: SavedMessage[] }> {
  return api(`/api/chats/${id}`, { headers: headers() });
}

export function updateChat(id: string, patch: { starred?: boolean; title?: string }): Promise<ConversationSummary> {
  return api(`/api/chats/${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify(patch), silent: true });
}

export async function deleteChat(id: string): Promise<void> {
  const API = process.env.NEXT_PUBLIC_API_URL || "";
  // 204 has no body, so this one skips api()'s JSON parsing.
  const res = await fetch(`${API}/api/chats/${id}`, { method: "DELETE", headers: headers() });
  if (!res.ok && res.status !== 404) throw new Error(String(res.status));
}

