import { readFile } from "node:fs/promises";

const ignoreSource = await readFile(new URL("../.vercelignore", import.meta.url), "utf8");
const ignoredPaths = new Set(
  ignoreSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")),
);

const requiredBuildOnlyPaths = [
  "site/build-app-core.mjs",
  "site/modules/app-core.js",
  "site/modules/app-core-build-normalizer.js",
  "site/modules/app-core-normalizer.js",
  "site/modules/app-core-route-request-normalizer.js",
  "site/modules/app-core-route-runtime-normalizer.js",
  "site/modules/app-core-startup-data-normalizer.js",
  "site/modules/app-core-table-events-normalizer.js",
  "site/modules/app-core-table-state-normalizer.js",
  "site/modules/app-core-route-chunks.js",
  "site/modules/app-core-settings-chunk.js",
  "site/modules/app-core-player-chunk.js",
  "site/modules/app-core-table-chunk.js",
  "site/modules/app-core-wallet-chunk.js",
  "site/modules/app-core-watchlist-route-chunk.js",
];

for (const path of requiredBuildOnlyPaths) {
  if (!ignoredPaths.has(path)) {
    throw new Error(`Build-only application-core source must not ship in production: ${path}`);
  }
}

for (const runtimePath of [
  "site/modules/app-core-runtime.js",
  "site/modules/app-core-evaluation-runtime.js",
  "site/modules/app-core-mfl-stats-runtime.js",
  "site/modules/app-core-club-runtime.js",
  "site/modules/app-core-settings-runtime.js",
  "site/modules/app-core-player-runtime.js",
  "site/modules/app-core-table-runtime.js",
  "site/modules/app-core-wallet-runtime.js",
  "site/modules/app-core-watchlist-runtime.js",
]) {
  if (ignoredPaths.has(runtimePath)) {
    throw new Error(`Generated application-core runtime must remain deployable: ${runtimePath}`);
  }
}

console.log("Production application-core source boundary validation passed.");
