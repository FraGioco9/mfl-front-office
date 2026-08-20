import { readFile } from "node:fs/promises";

const [ignoreSource, productionConfigSource, developmentConfigSource] = await Promise.all([
  readFile(new URL("../.vercelignore", import.meta.url), "utf8"),
  readFile(new URL("./vercel.production.json", import.meta.url), "utf8"),
  readFile(new URL("./vercel.json", import.meta.url), "utf8"),
]);
const ignoredPaths = new Set(
  ignoreSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")),
);
const productionConfig = JSON.parse(productionConfigSource);
const developmentConfig = JSON.parse(developmentConfigSource);

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

function validateSpaRouting(config, label) {
  const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
  const releaseRewrite = rewrites.find((rule) => rule?.source === "/releases.json");
  if (releaseRewrite?.destination !== "/api/releases") {
    throw new Error(`${label} Vercel config must preserve the /releases.json API rewrite before the SPA fallback.`);
  }

  const spaFallbackIndex = rewrites.findIndex(
    (rule) => rule?.source === "/(.*)" && rule?.destination === "/index.html",
  );
  if (spaFallbackIndex < 0) {
    throw new Error(`${label} Vercel config must rewrite every unmatched SPA route to /index.html.`);
  }
  if (spaFallbackIndex !== rewrites.length - 1) {
    throw new Error(`${label} Vercel SPA catch-all must be the final rewrite rule.`);
  }

  const invalidClubRedirects = new Map([
    ["/clubs/:id", "/"],
    ["/club/:id", "/"],
    ["/club/:id/:view", "/"],
    ["/club", "/"],
    ["/clubs", "/"],
  ]);
  const redirects = Array.isArray(config.redirects) ? config.redirects : [];
  for (const [source, destination] of invalidClubRedirects) {
    const redirect = redirects.find((rule) => rule?.source === source);
    if (redirect?.destination !== destination || redirect?.permanent !== false) {
      throw new Error(`${label} Vercel config must temporarily redirect invalid Club route ${source} to ${destination}.`);
    }
  }
}

validateSpaRouting(productionConfig, "Production");
validateSpaRouting(developmentConfig, "Development");

console.log("Production source boundary, prebuilt deployment, and SPA deep-link routing validation passed.");
