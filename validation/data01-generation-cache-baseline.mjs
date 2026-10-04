import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { publicPageSnapshotEligible } = require("../api/_data-cache-policy.js");
const source = readFileSync(new URL("../modules/core-sources/shared-incremental-routing.js", import.meta.url), "utf8");
const start = source.indexOf("function incrementalDataQuery(route, page = 1) {");
const end = source.indexOf("function databaseStatsDataCacheReady() {");
assert.ok(start >= 0 && end > start, "Execute the canonical route-query and cache owners, not a rewritten test implementation.");

const databaseA = "2026-10-04T10:00:00.000Z";
const databaseB = "2026-10-04T11:00:00.000Z";
const state = {
  manifest: { generated_at: databaseA },
  linkedWalletAddress: "",
  incrementalCacheNamespace: "",
  incrementalPayloadCache: new Map(),
  sortKey: "overall",
  sortDirection: "desc",
  pageSize: 25,
};
const context = {
  state,
  URLSearchParams,
  normalizeWalletAddress: (value) => String(value || "").trim(),
  hideRetiredInput: { checked: false },
  hideRetiringInput: { checked: false },
  hideMflPlayersInput: { checked: false },
  packablePlayersInput: { checked: false },
  newMintsInput: { checked: false },
  readFilterRules: () => [],
  serializeFilterRulesForRequest: (rules) => rules,
};
runInNewContext(`${source.slice(start, end)}
globalThis.__data01 = {
  incrementalRequestDetails,
  cachedIncrementalPayload,
  rememberIncrementalPayload,
  adoptIncrementalPayloadDataset,
  syncIncrementalCacheNamespace
};`, context);
const core = context.__data01;
const databaseRoute = { scope: "database", view: "attributes", access: "public", filterRules: [] };
const remember = (route, rows) => {
  const { cacheKey } = core.incrementalRequestDetails(route, 1);
  core.rememberIncrementalPayload(cacheKey, { generatedAt: state.manifest.generated_at, rows });
};
const cached = (route) => core.cachedIncrementalPayload(route, 1);

// One canonical SQLite namespace per database generation and linked wallet.
remember(databaseRoute, [["old database"]]);
assert.equal(cached(databaseRoute).rows[0][0], "old database");
core.adoptIncrementalPayloadDataset({ generatedAt: databaseB });
assert.equal(cached(databaseRoute), null, "Changing SQLite generatedAt must flush old completed payloads.");
remember(databaseRoute, [["current database"]]);
assert.equal(cached(databaseRoute).rows[0][0], "current database");
state.linkedWalletAddress = "0xabc";
core.syncIncrementalCacheNamespace();
assert.equal(cached(databaseRoute), null, "Changing wallet must invalidate the prior wallet/guest namespace.");
state.linkedWalletAddress = "";
core.syncIncrementalCacheNamespace();

// A marketplace snapshot changes independently of SQLite generatedAt.
// Backend excludes these routes from SQLite-only HTTP revalidation.
state.sortKey = "listing_price";
assert.equal(publicPageSnapshotEligible({ query: { scope: "database", sortKey: "listing_price" } }), false);
remember(databaseRoute, [[42, 100]]);
const marketplaceA = { generatedAt: "2026-10-04T11:05:00.000Z", prices: { 42: 100 } };
const marketplaceB = { generatedAt: "2026-10-04T11:20:00.000Z", prices: { 42: 200 } };
assert.notEqual(marketplaceA.generatedAt, marketplaceB.generatedAt);
assert.equal(state.manifest.generated_at, databaseB);
const staleListingSort = cached(databaseRoute);
assert.equal(staleListingSort?.rows[0][1], 100,
  "Baseline: a second listing-sorted route visit reuses price 100 after Marketplace has changed to 200.");

state.sortKey = "overall";
const listingFilterRoute = {
  ...databaseRoute,
  filterRules: [{ column: "listing_price", operator: ">=", value: "100" }],
};
assert.equal(publicPageSnapshotEligible({
  query: { scope: "database", sortKey: "overall", filters: JSON.stringify(listingFilterRoute.filterRules) },
}), false);
remember(listingFilterRoute, [[42, 100]]);
const staleListingFilter = cached(listingFilterRoute);
assert.equal(staleListingFilter?.rows[0][1], 100,
  "Baseline: listing-filtered pages also reuse their previous completed result.");

// This is a diagnostic assertion about stale-reuse exposure, NOT a successful
// freshness guarantee. A future product fix should invert both expectations.
console.log("DATA01_BASELINE_PASS SQLite generation changed -> cache invalidated; wallet changed -> cache invalidated.");
console.log("DATA01_BASELINE_MARKETPLACE_STALE listing-sort=1 listing-filter=1; independent marketplace generation is not part of completed-page cache freshness.");
