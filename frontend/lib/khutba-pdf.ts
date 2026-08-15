"use client";

// Raw fetch rather than lib/api's helper: that one always parses JSON, and this
// response is PDF bytes.
import { nativeSavePdf } from "@/lib/native-bridge";
import { formatKhutbaDate, type KhutbaCoverage, type SavedKhutba } from "@/lib/khutba-history";

const API = process.env.NEXT_PUBLIC_API_URL || "";

export type PdfResult = "saved" | "downloaded" | "failed";

/** Plain-language coverage summary, also stamped into the PDF header. */
export function coverageSummary(coverage: KhutbaCoverage | undefined): string {
  if (!coverage || !coverage.segments) return "";
  const { segments, translated, skipped, failed } = coverage;
  const parts = [`${translated} of ${segments} segments translated`];
  if (skipped) parts.push(`${skipped} silent`);
  if (failed) parts.push(`${failed} could not be transcribed`);
  return parts.join(" · ");
}

function safeFilename(khutba: SavedKhutba): string {
  const base = (khutba.matchedTitle || "khutba")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "khutba"}-${khutba.savedAt.slice(0, 10)}.pdf`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch the rendered PDF and hand it to the device.
 *
 * Three delivery paths, because a blob download only works in one of them:
 * inside the Android WebView there is no DownloadListener, so `<a download>`
 * and Content-Disposition are both inert and the bytes have to go through the
 * native bridge. iOS Safari ignores the `download` attribute for cross-origin
 * blobs but will open one, which at least reaches the share sheet.
 */
export async function downloadKhutbaPdf(
  khutba: SavedKhutba,
  locale: string,
  fallbackTitle = "Saved Khutba",
): Promise<PdfResult> {
  // The date is formatted here, not server-side: only the browser knows the
  // reader's timezone and locale. Sending it preformatted also keeps it out of
  // the title, which otherwise repeated the same instant in two zones.
  const title = khutba.matchedTitle?.trim() || fallbackTitle;
  const savedAtLabel = formatKhutbaDate(khutba.savedAt, locale);
  let blob: Blob;
  try {
    const res = await fetch(`${API}/api/khutba/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        saved_at: savedAtLabel,
        location: khutba.location,
        coverage: coverageSummary(khutba.coverage),
        lines: khutba.lines.map((l) => ({
          arabic: l.arabic ?? "",
          english: l.english ?? "",
          urdu: l.urdu ?? "",
        })),
      }),
    });
    if (!res.ok) return "failed";
    blob = await res.blob();
  } catch {
    return "failed";
  }

  const filename = safeFilename(khutba);

  // Android WebView: no download plumbing exists, so pass the bytes natively.
  try {
    const base64 = await blobToBase64(blob);
    if (nativeSavePdf(filename, base64)) return "saved";
  } catch {
    /* fall through to the browser path */
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke late: Safari reads the blob after the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return "downloaded";
  } catch {
    return "failed";
  }
}
