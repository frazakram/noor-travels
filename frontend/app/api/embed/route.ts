import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { embedSecretMatches } from "@/lib/embed-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

type EmbedPipeline = (
  text: string,
  opts: { pooling: "mean"; normalize: boolean }
) => Promise<{ data: Float32Array }>;

let _pipe: EmbedPipeline | null = null;

async function getPipeline() {
  if (_pipe) return _pipe;
  // The onnxruntime-node → onnxruntime-web stub (scripts/patch-onnx.js postinstall)
  // intercepts the CDN wasmPaths assignment and keeps a local file:// path.
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = "/tmp/hf-cache";
  env.allowLocalModels = false;
  _pipe = (await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
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
  let body: { texts?: string[] };
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
  try {
    const pipe = await getPipeline();
    const embeddings: number[][] = [];
    for (const text of texts) {
      const out = await pipe(String(text).slice(0, 2000), { pooling: "mean", normalize: true });
      embeddings.push(Array.from(out.data as Float32Array));
    }
    return NextResponse.json({ embeddings, dims: 384 });
  } catch (err) {
    console.error("embed failed", err);
    return NextResponse.json({ error: "embedding failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return UNAUTHORIZED();
  try {
    await getPipeline();
    return NextResponse.json({ status: "ok", model: "Xenova/all-MiniLM-L6-v2", dims: 384 });
  } catch (err) {
    console.error("embed warmup failed", err);
    return NextResponse.json({ error: "embedding model unavailable" }, { status: 500 });
  }
}
