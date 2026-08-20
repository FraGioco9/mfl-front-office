import { readFile } from "node:fs/promises";

const [ignoreSource, productionConfigSource, developmentConfigSource, deployWorkflowSource] = await Promise.all([
  readFile(new URL("./.vercelignore", import.meta.url), "utf8"),
  readFile(new URL("./vercel.production.json", import.meta.url), "utf8"),
  readFile(new URL("./vercel.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/vercel-site-update.yml", import.meta.url), "utf8"),
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
  "validate*.mjs",
  "eslint.config.mjs",
  "jsconfig.json",
  "types",
  "vercel.json",
  "vercel.production.json",
  "build-app-core.mjs",
  "modules/app-config.js",
  "modules/package.json",
  "modules/app-core.js",
  "modules/app-core-build-normalizer.js",
  "modules/app-core-normalizer.js",
  "modules/app-core-route-request-normalizer.js",
  "modules/app-core-route-runtime-normalizer.js",
  "modules/app-core-startup-data-normalizer.js",
  "modules/app-core-table-events-normalizer.js",
  "modules/app-core-table-state-normalizer.js",
  "modules/app-core-route-chunks.js",
  "modules/app-core-settings-chunk.js",
  "modules/app-core-player-chunk.js",
  "modules/app-core-table-chunk.js",
  "modules/app-core-wallet-chunk.js",
  "modules/app-core-watchlist-route-chunk.js",
];

for (const path of requiredProductionIgnoredPaths) {
  if (!ignoredPaths.has(path)) {
    throw new Error(`Development-only source must not ship in the site-root Vercel deployment: ${path}`);
  }
}

for (const runtimePath of [
  "modules/app-core-runtime.js",
  "modules/app-core-evaluation-runtime.js",
  "modules/app-core-mfl-stats-runtime.js",
  "modules/app-core-club-runtime.js",
  "modules/app-core-settings-runtime.js",
  "modules/app-core-player-runtime.js",
  "modules/app-core-table-runtime.js",
  "modules/app-core-wallet-runtime.js",
  "modules/app-core-watchlist-runtime.js",
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

if (!deployWorkflowSource.includes("working-directory: site")) {
  throw new Error("The Vercel deployment workflow must run the Vercel CLI from the site project root.");
}
if (!deployWorkflowSource.includes("--local-config vercel.production.json")) {
  throw new Error("The site-root Vercel deployment must load vercel.production.json relative to the site directory.");
}
if (deployWorkflowSource.includes("mkdir -p .vercel") || deployWorkflowSource.includes("site/vercel.production.json")) {
  throw new Error("The Vercel deployment workflow must not link or configure the repository root as the Vercel project root.");
}
for (const variable of ["VERCEL_ORG_ID", "VERCEL_PROJECT_ID", "VERCEL_TOKEN"]) {
  if (!deployWorkflowSource.includes(`${variable}:`)) {
    throw new Error(`The Vercel deployment workflow must provide ${variable} directly to the site-root CLI invocation.`);
  }
}

console.log("Site-root production boundary, prebuilt deployment, and SPA deep-link routing validation passed.");
