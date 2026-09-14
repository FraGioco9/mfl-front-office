import { access, readFile } from "node:fs/promises";
import { createNextRewrites } from "./next.config.mjs";

const [ignoreSource, packageSource, prepareSource] = await Promise.all([
  readFile(new URL("./.vercelignore", import.meta.url), "utf8"),
  readFile(new URL("./package.json", import.meta.url), "utf8"),
  readFile(new URL("./prepare-next-runtime.mjs", import.meta.url), "utf8"),
]);
const ignoredPaths = new Set(
  ignoreSource.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")),
);
const packageJson = JSON.parse(packageSource);

for (const requiredBuildSource of [
  "html-sources",
  "responsive-sources",
  "modules/core-sources",
  "build-app-core.mjs",
  "build-html.mjs",
  "build-responsive.mjs",
  "build-styles.mjs",
  "prepare-next-runtime.mjs",
  "next.config.mjs",
]) {
  if (ignoredPaths.has(requiredBuildSource)) {
    throw new Error(`Next production build source must remain available to Vercel: ${requiredBuildSource}`);
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
  try {
    await access(new URL(`./${path}`, import.meta.url));
    throw new Error(`Retired application-core source must stay deleted: ${path}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
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
  await access(new URL(`./${runtimePath}`, import.meta.url));
}

if (!String(packageJson.scripts?.build || "").endsWith("next build")) {
  throw new Error("Production build must finish with next build.");
}
if (!prepareSource.includes('name.endsWith("-runtime.js")')
    || !prepareSource.includes('join("modules", entry.name)')) {
  throw new Error("Next public compatibility projection must include legacy runtime assets and generated application-core runtimes.");
}

const rewrites = createNextRewrites();
if (!rewrites.beforeFiles?.some((rule) => rule.source === "/releases.json" && rule.destination === "/api/releases")) {
  throw new Error("Next must preserve the /releases.json API rewrite before SPA fallback.");
}
if (!rewrites.fallback?.some((rule) => rule.source === "/:path*" && rule.destination === "/index.html")) {
  throw new Error("Next must rewrite every unmatched SPA route to the compatibility index shell.");
}

console.log("Next production build-source availability, retired-core cleanup, SPA routing, and compatibility projection validation passed.");
