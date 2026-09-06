import js from "@eslint/js";
import globals from "globals";

const recommendedRules = {
  ...js.configs.recommended.rules,
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
};

export default [
  {
    ignores: [
      "node_modules/**",
      ".vercel/**",
      "modules/app-core-runtime.js",
      "modules/app-core-*-runtime.js",
    ],
  },
  {
    files: ["bootstrap.js", "modules/*.js"],
    ignores: ["modules/app-core.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules: recommendedRules,
  },
  {
    files: ["bootstrap-core.js", "*-runtime.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.browser,
    },
    rules: {
      ...recommendedRules,
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-undef": "off",
    },
  },
  {
    files: ["modules/app-core.js"],
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
    files: [
      "build-*.mjs",
      "style-bundle.mjs",
      "validation-text.mjs",
      "vercel-config-source.mjs",
      "ci-quality-scope.mjs",
      "validate*.mjs",
      "validation/*.mjs",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: js.configs.recommended.rules,
  },
];
