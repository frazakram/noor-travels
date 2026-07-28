import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

export const alt = `${SITE_NAME} — Quran, Hadith, Duas & Prayer Times`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0d221f 0%, #1c453c 55%, #255a4e 100%)",
          color: "#f6f1e7",
          fontSize: 96,
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 9999,
              border: "6px solid #d6b87a",
              borderRightColor: "transparent",
              transform: "rotate(45deg)",
            }}
          />
          {SITE_NAME}
        </div>
        <div style={{ marginTop: 28, fontSize: 36, fontWeight: 400, color: "#cfe0da" }}>
          Quran · Hadith · Duas · Prayer Times · Live Khutba
        </div>
        <div style={{ marginTop: 16, fontSize: 28, fontWeight: 400, color: "#9db8b0" }}>
          English · Urdu · Hindi
        </div>
      </div>
    ),
    size,
  );
}
