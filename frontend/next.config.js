/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tell Next.js not to bundle @xenova/transformers — let Node.js require() it
  // at runtime so it can access its ONNX/WASM assets correctly.
  serverExternalPackages: ["@xenova/transformers"],
  webpack(config) {
    // Silence the "Critical dependency" warning from onnxruntime-node
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

module.exports = nextConfig;
