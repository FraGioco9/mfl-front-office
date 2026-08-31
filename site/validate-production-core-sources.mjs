import { access, readFile } from "node:fs/promises";

const [ignoreSource, canonicalConfigSource, productionConfigSource] = await Promise.all([
  readFile(new URL("../.vercelignore", import.meta.url), "utf8"),
  readFile(new URL("./vercel.json", import.meta.url), "utf8"),
  readFile(new URL("./vercel.production.json", import.meta.url), "utf8"),
]);
const ignoredPaths = new Set(
  ignoreSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")),
);
const canonicalConfig = JSON.parse(canonicalConfigSource);
const productionConfig = JSON.parse(productionConfigSource);

const requiredProductionIgnoredPaths = [
  ".gitignore",
  "site/validate*.mjs",
  "site/eslint.config.mjs",
  "site/jsconfig.json",
  "site/types",
  "site/vercel.production.json",
  "site/build-app-core.mjs",
  "site/sync-release-projections.mjs",
  "site/modules/app-config.js",
  "site/modules/pre-bootstrap-route-state.js",
  "site/modules/package.json",
  "site/modules/core-sources",
];

for (const path of requiredProductionIgnoredPaths) {
  if (!ignoredPaths.has(path)) {
    throw new Error(`Development-only source must not ship in production: ${path}`);
  }
}

const retiredApplicationCorePaths = [
  "modules/app-core.js",
  "modules/app-core-build-normalizer.js",
  "modules/app-core-splitter-utils.js",
  "modules/app-core-route-chunks.js",
  "modules/app-core-sidebar-lifecycle.js",
  "modules/app-core-evaluation-chunk.js",
  "modules/app-core-evaluation-snapshot-edit-route.js",
  "modules/app-core-settings-chunk.js",
  "modules/app-core-settings-email-reset.js",
  "modules/app-core-player-chunk.js",
  "modules/app-core-filter-control-state.js",
  "modules/app-core-table-chunk.js",
  "modules/app-core-mobile-table.js",
  "modules/app-core-table-row-centering.js",
  "modules/app-core-wallet-chunk.js",
  "modules/app-core-watchlist-route-chunk.js",
  "modules/app-core-stats-route-ownership.js",
  "modules/app-core-normalizer.js",
  "modules/app-core-club-url-normalizer.js",
  "modules/app-core-route-request-normalizer.js",
  "modules/app-core-route-runtime-normalizer.js",
  "modules/app-core-startup-data-normalizer.js",
  "modules/app-core-table-events-normalizer.js",
  "modules/app-core-table-state-normalizer.js",
];
for (const path of retiredApplicationCorePaths) {
  const productionPath = `site/${path}`;
  if (ignoredPaths.has(productionPath)) {
    throw new Error(`Retired application-core source must not leave a stale deployment-ignore entry: ${productionPath}`);
  }
  try {
    await access(new URL(`./${path}`, import.meta.url));
    throw new Error(`Retired application-core source must stay deleted: ${path}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

if (ignoredPaths.has("site/vercel.json")) {
  throw new Error("Canonical site/vercel.json must ship from the configured Vercel project root so production routing rules are applied.");
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

function validatePrebuiltBuild(config, label) {
  const buildCommand = String(config.buildCommand || "").trim();
  if (!buildCommand) {
    throw new Error(`${label} Vercel config must explicitly override the package build script because compiler sources are excluded from deployment.`);
  }
  if (/build-app-core|npm\s+(?:run\s+)?build\b/i.test(buildCommand)) {
    throw new Error(`${label} Vercel build must deploy the prebuilt application core instead of invoking an excluded compiler source.`);
  }
}

function validateSpaRouting(config, label) {
  const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
  const releaseRewrite = rewrites.find((rule) => rule?.source === "/releases.json");
  if (releaseRewrite?.destination !== "/api/releases") {
    throw new Error(`${label} Vercel config must preserve the /releases.json API rewrite before the SPA fallback.`);
  }

  const spaFallbackIndex = rewrites.findIndex(
    (rule) => rule?.source === "/(.*)" && rule?.destination === "/",
  );
  if (spaFallbackIndex < 0) {
    throw new Error(`${label} Vercel config must rewrite every unmatched SPA route to the known-working root shell.`);
  }
  if (spaFallbackIndex !== rewrites.length - 1) {
    throw new Error(`${label} Vercel SPA catch-all must be the final rewrite rule.`);
  }

  const redirects = Array.isArray(config.redirects) ? config.redirects : [];
  if (redirects.length > 0) {
    throw new Error(`${label} Vercel config must not duplicate application route canonicalization through deployment redirects.`);
  }
}

validatePrebuiltBuild(canonicalConfig, "Canonical");
validatePrebuiltBuild(productionConfig, "Production");
validateSpaRouting(canonicalConfig, "Canonical");
validateSpaRouting(productionConfig, "Production");

console.log("Canonical build-only source exclusions, retired application-core cleanup, prebuilt deployment, SPA routing, and generated runtime deployment validation passed.");
