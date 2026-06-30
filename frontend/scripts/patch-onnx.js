#!/usr/bin/env node
/**
 * Replaces the native onnxruntime-node installed under @huggingface/transformers
 * with a stub that re-exports onnxruntime-web (pure WASM, no native .so files).
 *
 * @huggingface/transformers loads onnxruntime-node at the TOP LEVEL of its
 * Node.js build (transformers.node.cjs), so device:"wasm" cannot prevent it.
 * This stub intercepts that require at the file-system level.
 *
 * onnxruntime-web is already a direct dependency of @huggingface/transformers
 * and lives in the same node_modules, so require('onnxruntime-web') from the
 * stub path resolves correctly.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname, '..', 'node_modules',
  '@huggingface', 'transformers', 'node_modules', 'onnxruntime-node'
);

if (!fs.existsSync(target)) {
  console.log('[patch-onnx] onnxruntime-node not found nested under @huggingface/transformers — skipping');
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

fs.writeFileSync(
  path.join(target, 'package.json'),
  JSON.stringify({ name: 'onnxruntime-node', version: '1.21.0-stub', main: 'index.js' }, null, 2)
);

fs.writeFileSync(
  path.join(target, 'index.js'),
  `// WASM stub — redirects onnxruntime-node to onnxruntime-web (pure WASM).
// Also intercepts the CDN https:// wasmPaths assignment that @huggingface/transformers
// makes at module-init time (line ~3086 of transformers.node.cjs). Node.js ESM
// import() only supports file:// and data:// URLs, so we must keep a local path.
const path = require('path');
const ort = require('onnxruntime-web');

if (ort.env && ort.env.wasm) {
  // Local dist directory — all WASM/MJS files live here
  const localDist = 'file://' + path.join(__dirname, '..', 'onnxruntime-web', 'dist') + '/';

  let _wasmPaths = localDist;
  Object.defineProperty(ort.env.wasm, 'wasmPaths', {
    get() { return _wasmPaths; },
    set(val) {
      // Reject CDN https:// URLs; keep the local file:// path instead
      if (typeof val === 'string' && val.startsWith('https://')) return;
      _wasmPaths = val;
    },
    configurable: true,
    enumerable: true,
  });
}

module.exports = ort;
`
);

console.log('[patch-onnx] Replaced onnxruntime-node with onnxruntime-web stub');
