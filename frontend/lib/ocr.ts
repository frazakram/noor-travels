"use client";

/**
 * Client-side OCR via Tesseract.js — the image never leaves the browser, no
 * vision-API/LLM call anywhere in this path. Used by the "Find from Screenshot"
 * Quran verse identifier (see app/quran/find/page.tsx).
 */
export async function runOcr(image: File | Blob, onProgress?: (pct: number) => void): Promise<string> {
  // Dynamic import only — Tesseract.js touches browser-only globals (Worker), and a
  // static top-level import would break Next's build-time analysis of this client page.
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker("eng+ara", 1, {
    logger: (msg) => {
      if (msg.status === "recognizing text" && typeof msg.progress === "number") {
        onProgress?.(Math.round(msg.progress * 100));
      }
    },
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(image);
    return text.trim();
  } finally {
    // Always tear down — this is a one-off tool, not a warm/reused worker, and a
    // thrown recognition error must not leak the worker instance.
    await worker.terminate();
  }
}
