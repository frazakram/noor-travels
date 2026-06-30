/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep @xenova/transformers as a Node.js external — don't bundle ONNX/WASM through Turbopack
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  // Acknowledge Turbopack (Next.js 16 default); no custom rules needed since
  // serverExternalPackages already excludes the package from bundling.
  turbopack: {},
};

module.exports = nextConfig;
