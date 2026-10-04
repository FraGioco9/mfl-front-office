import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { publicPageSnapshotEligible } = require("../api/_data-cache-policy.js");
const source = readFileSync(new URL("../modules/core-sources/shared-incremental-routing.js", import.meta.url), "utf8");
const start = source.indexOf("function incrementalDataQuery(route, page = 1) {");
const end = source.indexOf("function databaseStatsDataCacheReady() {");
assert.ok(start >= 0 && end > start, "Use the actual route query and cache owner.");

const dbA = "2026-10-04T10:00:00.000Z";
const dbB = "2026-10-04T11:00:00.000Z";
const state = {
  manifest: { generated_at: dbA },
  linkedWalletAddress: "",
  incrementalCacheNamespace: "",
  incrementalPayloadCache: new Map(),
  sortKey: "overall",
  sortDirection: "desc",
  pageSize: 25,
};
const ctx = {
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
  syncIncrementalCacheNamespace,
  incrementalQueryEmbedsMarketplace
};`, ctx);
const owner = ctx.__data01;
const route = { scope: "database", view: "attributes", access: "public", filterRules: [] };
const details = (r = route) => owner.incrementalRequestDetails(r, 1);
const cache = (r = route) => owner.cachedIncrementalPayload(r, 1);
const store = (r, payload) => owner.rememberIncrementalPayload(details(r).cacheKey, payload);

// Non-marketplace routes retain their completed payload reuse.
store(route, { generatedAt: dbA, rows: [["A"]] });
assert.equal(cache(route)?.rows[0][0], "A");
owner.adoptIncrementalPayloadDataset({ generatedAt: dbB });
assert.equal(cache(route), null, "A changed SQLite generation must clear old results.");
store(route, { generatedAt: dbB, rows: [["B"]] });
assert.equal(cache(route)?.rows[0][0], "B");
state.linkedWalletAddress = "0xabc";
owner.syncIncrementalCacheNamespace();
assert.equal(cache(route), null, "Wallet switch must clear previous namespace.");
state.linkedWalletAddress = "";
owner.syncIncrementalCacheNamespace();

// Marketplace A and B share SQLite generation dbB. The completed cache must
// never turn a revisit into a stale result for price sorting or filtering.
const marketplaceA = "2026-10-04T11:05:00.000Z";
const marketplaceB = "2026-10-04T11:20:00.000Z";
assert.notEqual(marketplaceA, marketplaceB);
assert.equal(state.manifest.generated_at, dbB);
state.sortKey = "listing_price";
const sortedQuery = details().query;
assert.equal(owner.incrementalQueryEmbedsMarketplace(sortedQuery), true);
assert.equal(publicPageSnapshotEligible({ query: { scope: "database", sortKey: "listing_price" } }), false);
store(route, { generatedAt: dbB, rows: [[42, 100]] });
assert.equal(cache(route), null, "A price-sorted revisit must not reuse Marketplace A after Marketplace B.");
state.sortKey = "overall";

const priceRules = [{ column: "listing_price", operator: ">=", value: "100" }];
const priceRoute = { ...route, filterRules: priceRules };
assert.equal(owner.incrementalQueryEmbedsMarketplace(details(priceRoute).query), true);
assert.equal(publicPageSnapshotEligible({
  query: { scope: "database", sortKey: "overall", filters: JSON.stringify(priceRules) },
}), false);
store(priceRoute, { generatedAt: dbB, rows: [[42, 100]] });
assert.equal(cache(priceRoute), null, "A listing-filtered revisit must not reuse removed listings or stale counts.");
assert.equal(owner.incrementalQueryEmbedsMarketplace(new URLSearchParams({ sortKey: "overall", filters: "{bad-json" })), false);
assert.equal(owner.incrementalQueryEmbedsMarketplace(new URLSearchParams({ sortKey: "overall", filters: "[]" })), false);

// Request owner must skip *both* completed-cache read and write for listing
// queries, without removing the independent in-flight promise deduplication.
assert.ok(source.includes("const cacheable = !incrementalQueryEmbedsMarketplace(query);"),
  "Marketplace freshness must be decided from the actual outgoing query.");
assert.ok(source.includes("const cachedPayload = !force && cacheable ? readIncrementalPayloadCache(cacheKey) : null;"),
  "Authoritative listing requests must bypass cached-response reads.");
assert.ok(source.includes("if (cacheable) rememberIncrementalPayload(responseCacheKey, payload);"),
  "Authoritative listing responses must not accumulate as reusable completed payloads.");
assert.ok(source.includes("state.incrementalRequestPromises.get(cacheKey)"),
  "Preserve same-request in-flight deduplication.");
assert.ok(source.includes("if (force) state.incrementalPayloadCache.delete(cacheKey);"),
  "Preserve existing forced reload invalidation.");

for (let i = 0; i < 70; i += 1) owner.rememberIncrementalPayload(`lru-test-${i}`, { rows: [[i]] });
assert.ok(state.incrementalPayloadCache.size <= 64, "Other completed page payloads must remain bounded to 64.");

console.log("DATA01_FRESHNESS_PASS: SQLite A/B and wallet invalidation; ordinary cache retained; listing-sort/filter bypass completed reuse; in-flight and LRU guards retained.");
