const API = process.env.NEXT_PUBLIC_API_URL || "";

export type ChatStageName = "understanding" | "searching" | "found" | "writing";

export type ChatStage = {
  stage: ChatStageName;
  keywords?: string[];
  sources?: string[];
};

type StreamEvent =
  | ({ type: "stage" } & ChatStage)
  | { type: "result"; result: unknown }
  | { type: "error"; status?: number };

/** The stream endpoint is missing or refused before doing any work — safe to retry on /chat. */
export class StreamUnavailable extends Error {}

/**
 * Splits an NDJSON buffer into complete events plus the unfinished tail.
 * Unparseable lines are skipped: a proxy may inject blank keep-alive lines.
 */
export function parseEvents(buffer: string): { events: StreamEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: StreamEvent[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event && typeof event.type === "string") events.push(event);
    } catch {
      /* partial or foreign line */
    }
  }
  return { events, rest };
}

/**
 * POST /api/rag/chat/stream: calls onStage for each real pipeline step (the model reading the
 * question, the keywords searched, the sources found, writing) and resolves with the same
 * payload /api/rag/chat returns.
 */
export async function streamChat<T>(body: unknown, onStage: (stage: ChatStage) => void): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}/api/rag/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new StreamUnavailable("network");
  }
  if (res.status === 429) throw new Error("rate-limited");
  if (!res.ok || !res.body) throw new StreamUnavailable(String(res.status));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const { events, rest } = parseEvents(done ? buffer + "\n" : buffer);
    buffer = rest;
    for (const event of events) {
      if (event.type === "stage") onStage(event);
      else if (event.type === "result") return event.result as T;
      else if (event.type === "error") throw new Error(`chat failed (${event.status ?? 500})`);
    }
    if (done) throw new Error("stream ended without an answer");
  }
}
