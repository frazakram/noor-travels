import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { embedSecretMatches } from "@/lib/embed-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

type EmbedPipeline = (
  text: string,
  opts: { pooling: "mean"; normalize: boolean }
) => Promise<{ data: Float32Array }>;

/**
 * The one embedding model for semantic search. Stored vectors are tagged with `name`
 * (document_chunks.metadata.embed_model) and the backend only searches rows whose tag matches
 * the name this route reports, so changing the model needs a re-index, never a schema change.
 */
const MODEL: { id: string; name: string; dims: number; prefix: Record<"query" | "passage", string> } = {
  // Benchmarked against bge-small, gte-small, arctic-embed-s and multilingual-e5-small on our
  // corpus: all within one question of each other once passages are English-only, so the
  // smallest (fastest cold start) stays. Models like e5 need "query: "/"passage: " prefixes.
  id: "Xenova/all-MiniLM-L6-v2",
  name: "all-MiniLM-L6-v2",
  dims: 384,
  prefix: { query: "", passage: "" },
};

type Kind = keyof typeof MODEL.prefix;

let _pipe: EmbedPipeline | null = null;

async function getPipeline() {
  if (_pipe) return _pipe;
  // The onnxruntime-node → onnxruntime-web stub (scripts/patch-onnx.js postinstall)
  // intercepts the CDN wasmPaths assignment and keeps a local file:// path.
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = "/tmp/hf-cache";
  env.allowLocalModels = false;
  _pipe = (await pipeline("feature-extraction", MODEL.id, {
    dtype: "q8",
  })) as unknown as EmbedPipeline;
  return _pipe;
}

/** Only the backend should call this; when EMBED_SECRET is set, requests must carry it. */
function authorized(req: NextRequest): boolean {
  return embedSecretMatches(process.env.EMBED_SECRET, req.headers.get("x-embed-secret"));
}

const UNAUTHORIZED = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

export async function POST(req: NextRequest) {
  if (!authorized(req)) return UNAUTHORIZED();
  let body: { texts?: string[]; kind?: Kind };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const texts = body.texts;
  if (!Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json({ error: "texts must be a non-empty array" }, { status: 400 });
  }
  if (texts.length > 64) {
    return NextResponse.json({ error: "max 64 texts per request" }, { status: 400 });
  }
  // Questions are "query"; corpus text being indexed is "passage". Old callers sent no kind.
  const kind: Kind = body.kind === "passage" ? "passage" : "query";
  try {
    const pipe = await getPipeline();
    const embeddings: number[][] = [];
    for (const text of texts) {
      const out = await pipe(MODEL.prefix[kind] + String(text).slice(0, 2000), { pooling: "mean", normalize: true });
      embeddings.push(Array.from(out.data as Float32Array));
    }
    return NextResponse.json({ embeddings, dims: MODEL.dims, model: MODEL.name });
  } catch (err) {
    console.error("embed failed", err);
    return NextResponse.json({ error: "embedding failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return UNAUTHORIZED();
  try {
    await getPipeline();
    return NextResponse.json({ status: "ok", model: MODEL.name, dims: MODEL.dims });
  } catch (err) {
    console.error("embed warmup failed", err);
    return NextResponse.json({ error: "embedding model unavailable" }, { status: 500 });
  }
}
