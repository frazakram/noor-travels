/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep @xenova/transformers as a Node.js external — don't bundle ONNX/WASM through Turbopack
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-web"],
  // Acknowledge Turbopack (Next.js 16 default); no custom rules needed since
  // serverExternalPackages already excludes the package from bundling.
  turbopack: {},
  async redirects() {
    return [{ source: "/dhikr", destination: "/adhkar", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Mic is needed by khutba/recite, geolocation by prayer times — same origin only.
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        // Static datasets (question library, learn-quran course) — cache for an
        // hour, serve stale while revalidating so navigations stay instant.
        source: "/data/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
