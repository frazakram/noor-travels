"use client";

import { useEffect, useState } from "react";
import { reportError } from "@/lib/error-reporter";
import { t, type Lang } from "@/lib/i18n";

/** Last-resort screen when the root layout itself fails (app/error.tsx can't render then). It
 *  replaces the whole document, so no providers or app styles are available: plain markup only. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Only ever rendered in the browser (after a client-side failure), so storage is available.
  const [lang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem("noor-lang");
      return saved === "ur" || saved === "hi" ? saved : "en";
    } catch {
      return "en";
    }
  });
  useEffect(() => {
    reportError("react", error);
  }, [error]);
  return (
    <html lang={lang} dir={lang === "ur" ? "rtl" : "ltr"}>
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0d221f", color: "#f0f7f4", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>{t(lang, "genericErrorTitle")}</h1>
            <p style={{ fontSize: 14, opacity: 0.8, margin: "0 0 20px" }}>{t(lang, "genericErrorBody")}</p>
            <button
              type="button"
              onClick={reset}
              style={{ background: "#3d8c78", color: "#fff", border: 0, borderRadius: 12, padding: "10px 20px", fontSize: 14 }}
            >
              {t(lang, "tryAgain")}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
