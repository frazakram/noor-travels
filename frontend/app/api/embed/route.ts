import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipe: any = null;

async function getPipeline() {
  if (_pipe) return _pipe;
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = "/tmp/hf-cache";
  env.allowLocalModels = false;
  // device:"wasm" forces onnxruntime-web (pure WASM) — onnxruntime-node
  // dynamically links libonnxruntime.so which isn't available on Vercel Lambda.
  _pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
    device: "wasm",
  });
  return _pipe;
}

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    await getPipeline();
    return NextResponse.json({ status: "ok", model: "Xenova/all-MiniLM-L6-v2", dims: 384 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
