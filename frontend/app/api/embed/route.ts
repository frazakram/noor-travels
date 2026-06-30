import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Must run in Node.js runtime — Edge runtime can't cache models to /tmp
export const runtime = "nodejs";
// Keep the Lambda warm between requests (Vercel Pro feature)
export const maxDuration = 30;

// Module-level singleton — survives across warm Lambda invocations
let _pipe: ((text: string, opts: Record<string, unknown>) => Promise<{ data: Float32Array }>) | null = null;

async function getPipeline() {
  if (_pipe) return _pipe;

  // Cache models in /tmp so they survive across warm invocations
  const { pipeline, env } = await import("@xenova/transformers");
  env.cacheDir = "/tmp/xenova";
  env.allowLocalModels = false;

  // quantized=true → uses the int8 ONNX model (~22 MB vs ~86 MB)
  _pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    quantized: true,
  }) as typeof _pipe;

  return _pipe!;
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
      const out = await pipe(String(text).slice(0, 2000), {
        pooling: "mean",
        normalize: true,
      });
      embeddings.push(Array.from(out.data));
    }

    return NextResponse.json({ embeddings, dims: 384 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Health-check / warm-up via GET
export async function GET() {
  try {
    await getPipeline();
    return NextResponse.json({ status: "ok", model: "Xenova/all-MiniLM-L6-v2", dims: 384 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
