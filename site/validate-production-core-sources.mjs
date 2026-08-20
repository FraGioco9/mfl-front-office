import { readFile } from "node:fs/promises";

const [ignoreSource, productionConfigSource] = await Promise.all([
  readFile(new URL("../.vercelignore", import.meta.url), "utf8"),
  readFile(new URL("./vercel.production.json", import.meta.url), "utf8"),
]);
const ignoredPaths = new Set(
  ignoreSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")),
);
const productionConfig = JSON.parse(productionConfigSource);

const requiredProductionIgnoredPaths = [
  ".gitignore",
  "site/validate*.mjs",
  "site/eslint.config.mjs",
  "site/jsconfig.json",
  "site/types",
  "site/vercel.json",
  "site/vercel.production.json",
  "site/build-app-core.mjs",
  "site/modules/app-config.js",
  "site/modules/package.json",
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

for (const path of requiredProductionIgnoredPaths) {
  if (!ignoredPaths.has(path)) {
    throw new Error(`Development-only source must not ship in production: ${path}`);
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

const productionBuildCommand = String(productionConfig.buildCommand || "").trim();
if (!productionBuildCommand) {
  throw new Error("Production Vercel config must explicitly override the package build script because compiler sources are excluded from deployment.");
}
if (/build-app-core|npm\s+(?:run\s+)?build\b/i.test(productionBuildCommand)) {
  throw new Error("Production Vercel build must deploy the prebuilt application core instead of invoking an excluded compiler source.");
}

console.log("Production source boundary and prebuilt Vercel deployment validation passed.");
