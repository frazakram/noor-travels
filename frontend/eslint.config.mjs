import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // This codebase predates linting and leans on write-ref-during-render and
      // hydrate-state-in-effect patterns throughout the audio/prefs stack.
      // Keep the new strict hooks rules visible as warnings while they are
      // burned down instead of failing the build.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Plain Node CommonJS build script (postinstall onnx patch).
    files: ["scripts/**"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
