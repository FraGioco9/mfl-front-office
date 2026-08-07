import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", ".vercel/**"],
  },
  {
    files: [
      "app.js",
      "modules/app-entry.js",
      "modules/core-runtime.js",
      "modules/http.js",
      "modules/release.js",
      "modules/runtime-loader.js",
      "release-ui-runtime.js",
      "changelog-history-runtime.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["modules/legacy-core.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.browser,
    },
    rules: {},
  },
  {
    files: ["api/releases.js", "api/mfl-season-ratios-v2.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node, fetch: "readonly", AbortController: "readonly" },
    },
    rules: js.configs.recommended.rules,
  },
  {
    files: ["tests/**/*.mjs", "playwright.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: js.configs.recommended.rules,
  },
];
