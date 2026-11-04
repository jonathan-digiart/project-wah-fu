import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default [
  {
    ignores: [
      "node_modules/**",
      ".cache/**",
      "dist/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["experiments/adjacent-tiles/src/manager.mjs"],
    languageOptions: {
      globals: { structuredClone: "readonly", AbortController: "readonly" },
    },
  },
  {
    files: ["experiments/adjacent-tiles/src/worker-loader.mjs"],
    languageOptions: { globals: { Worker: "readonly", URL: "readonly" } },
  },
  {
    files: ["experiments/adjacent-tiles/src/worker.mjs"],
    languageOptions: { globals: { postMessage: "readonly" } },
  },
  {
    files: ["experiments/adjacent-tiles/test/*.node.mjs"],
    languageOptions: { globals: { setTimeout: "readonly" } },
  },
  {
    files: ["experiments/adjacent-tiles/collision/collider-loader.mjs"],
    languageOptions: { globals: { Worker: "readonly", URL: "readonly" } },
  },
  {
    files: ["experiments/adjacent-tiles/collision/collider-worker.mjs"],
    languageOptions: { globals: { postMessage: "readonly" } },
  },
  {
    files: ["experiments/adjacent-tiles/collision/*.node.mjs"],
    languageOptions: {
      globals: {
        AbortController: "readonly",
        structuredClone: "readonly",
        setTimeout: "readonly",
      },
    },
  },
  {
    files: ["experiments/adjacent-tiles/masked/*.node.mjs"],
    languageOptions: {
      globals: {
        AbortController: "readonly",
        structuredClone: "readonly",
        setTimeout: "readonly",
      },
    },
  },
];
