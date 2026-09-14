import { readdir, readFile } from "node:fs/promises";
import { coreSourceManifest } from "./modules/core-source-manifest.js";

const siteRoot = new URL("./", import.meta.url);
const MIGRATED_RUNTIMES = Object.freeze([
  "bug-report-runtime.js",
  "database-stats-runtime.js",
  "evaluation-discount-rate-runtime.js",
  "global-search-runtime.js",
  "marketplace-overlay-runtime.js",
  "nationality-filter-options-runtime.js",
]);
// Follow the manifest so transport ownership remains complete as canonical cores are split into lexical fragments.
const CORE_SOURCE_NAMES = Object.freeze([...new Set(coreSourceManifest.flatMap(({ sources }) => sources))]);
const MIGRATED_CORE_SOURCES = Object.freeze([
  "club.js",
  "evaluation.js",
  "shared-incremental-routing.js",
  "table.js",
  "wallet.js",
]);
const directApiFetch = /(^|[^.\w$])fetch\s*\(\s*["'`]\/api\//gm;

const runtimeNames = (await readdir(siteRoot))
  .filter((name) => name.endsWith("-runtime.js"))
  .sort();
const runtimeSources = new Map(await Promise.all(runtimeNames.map(async (name) => [
  name,
  String(await readFile(new URL(name, siteRoot), "utf8")).replace(/\r\n?/g, "\n"),
])));
const coreSources = new Map(await Promise.all(CORE_SOURCE_NAMES.map(async (name) => [
  name,
  String(await readFile(new URL(`modules/core-sources/${name}`, siteRoot), "utf8")).replace(/\r\n?/g, "\n"),
])));

const directOwners = [];
for (const [name, source] of runtimeSources) {
  if (directApiFetch.test(source)) directOwners.push(name);
  directApiFetch.lastIndex = 0;
}

if (directOwners.length) {
  throw new Error(`Standalone runtimes must not depend on the global fetch compatibility bridge for /api calls. Remaining owners: ${directOwners.join(", ")}`);
}

for (const name of MIGRATED_RUNTIMES) {
  const source = runtimeSources.get(name) || "";
  if (!source.includes("__mflDataClient")) {
    throw new Error(`${name} must resolve the canonical data client explicitly.`);
  }
  if (/(^|[^.\w$])fetch\s*\(\s*["'`]\/api\//m.test(source)) {
    throw new Error(`${name} must not depend on the global fetch compatibility bridge for API calls.`);
  }
}

for (const [name, source] of coreSources) {
  if (/(^|[^.\w$])fetch\s*\(\s*["'`]\/api\//m.test(source)) {
    throw new Error(`${name} must not use bare same-origin API fetch; canonical core traffic belongs to the data client.`);
  }
}

for (const name of MIGRATED_CORE_SOURCES) {
  const source = coreSources.get(name) || "";
  if (!source.includes("window.__mflDataClient.fetch")) {
    throw new Error(`${name} must route its same-origin API calls through the canonical data client.`);
  }
}

const appEntry = String(await readFile(new URL("modules/app-entry.js", siteRoot), "utf8")).replace(/\r\n?/g, "\n");
if (appEntry.includes("installDataClientCompatibilityBridge")
    || appEntry.includes("window.fetch =")
    || appEntry.includes("__mflApiFetchPolicyInstalled")) {
  throw new Error("The retired global fetch compatibility bridge must not return.");
}

const walletCore = coreSources.get("wallet.js") || "";
if (!walletCore.includes('fetch("https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/leaderboards/users/global"')
    || !walletCore.includes("fetch(`${FLOW_DISCOVERY_AUTHN_ENDPOINT}?${query.toString()}`")) {
  throw new Error("Wallet external MFL/Flow transport must remain native fetch rather than being routed through the same-origin API client.");
}

const nationality = runtimeSources.get("nationality-filter-options-runtime.js") || "";
if (!nationality.includes("dedupe: true") || !nationality.includes('key: "nationality-filter-options"')) {
  throw new Error("Nationality filter options must retain canonical GET deduplication.");
}

const databaseStats = runtimeSources.get("database-stats-runtime.js") || "";
if (!databaseStats.includes("dedupe: true") || !databaseStats.includes("`database-stats:${VERSION}`")) {
  throw new Error("Database Stats must retain release-keyed canonical GET deduplication.");
}

const globalSearch = runtimeSources.get("global-search-runtime.js") || "";
if (!globalSearch.includes("function dataClientFetch(input, init = {}, options = {})")
    || !globalSearch.includes('dataClientFetch("/api/wallet-preferences"')
    || !globalSearch.includes("dataClientFetch(`/api/data?${parameters}`")) {
  throw new Error("Global Search must route wallet and database API reads through the canonical data client while retaining its own abort sequencing.");
}

const marketplace = runtimeSources.get("marketplace-overlay-runtime.js") || "";
if (!marketplace.includes('dataClient.fetch("/api/marketplace"')) {
  throw new Error("Marketplace overlay must use the canonical client directly.");
}

console.log("Data-client ownership guard passed for all standalone runtimes and canonical core sources; the global fetch compatibility bridge is retired.");
