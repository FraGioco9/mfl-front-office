import { readFileSync } from "node:fs";

const normalize = (value) => String(value).replace(/\r\n?/g, "\n");
const read = (path) => normalize(readFileSync(new URL(path, import.meta.url), "utf8"));

const routeSourcePaths = Object.freeze({
  evaluation: "./modules/core-sources/evaluation.js",
  mflstats: "./modules/core-sources/mfl-stats.js",
  club: "./modules/core-sources/club.js",
  settings: "./modules/core-sources/settings.js",
  player: "./modules/core-sources/player.js",
  table: "./modules/core-sources/table.js",
  wallet: "./modules/core-sources/wallet.js",
  watchlist: "./modules/core-sources/watchlist.js",
});

const routeChunks = Object.freeze(
  Object.fromEntries(Object.entries(routeSourcePaths).map(([domain, path]) => [domain, read(path)])),
);
const artifacts = Object.freeze({
  core: read("./modules/core-sources/shared.js"),
  routeChunks,
});

export const canonicalCoreDomains = Object.freeze({
  shared: artifacts.core,
  ...routeChunks,
});

export function readCanonicalCoreSource(domain = "shared") {
  const source = canonicalCoreDomains[domain];
  if (typeof source !== "string") {
    throw new Error(`Unknown canonical core domain: ${domain}`);
  }
  return source;
}

export function readCanonicalCoreArtifacts() {
  return artifacts;
}

export function readCombinedCanonicalCoreSource() {
  return Object.values(canonicalCoreDomains).join("\n");
}
