import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// DATA-01C read-only diagnostic. All payloads, identity generations, Watchlist
// membership, Planner club labels, and delayed network completions are synthetic.
const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const core = read("modules/core-sources/shared-incremental-routing.js");
const summary = read("modules/core-sources/shared-home-summary.js");
const planner = read("modules/core-sources/planner.js");
const from = core.indexOf("function incrementalDataQuery(route, page = 1) {");
const to = core.indexOf("function databaseStatsDataCacheReady() {", from);
assert.ok(from >= 0 && to > from, "Must execute actual canonical cache/source functions.");
const A = "2026-10-04T10:00:00.000Z", B = "2026-10-04T11:00:00.000Z";
const state = {
  manifest: { generated_at: A }, incrementalCacheNamespace: "",
  incrementalPayloadCache: new Map(), linkedWalletAddress: "0xabc",
  pageSize: 25, sortKey: "overall", sortDirection: "desc",
};
const context = {
  state, URLSearchParams,
  normalizeWalletAddress: (value) => String(value || "").trim(),
  hideRetiredInput: { checked: false }, hideRetiringInput: { checked: false },
  hideMflPlayersInput: { checked: false }, packablePlayersInput: { checked: false },
  newMintsInput: { checked: false }, readFilterRules: () => [],
  serializeFilterRulesForRequest: (rules) => rules,
};
runInNewContext(core.slice(from, to) + `
globalThis.__cache = { incrementalRequestDetails, cachedIncrementalPayload,
  rememberIncrementalPayload, adoptIncrementalPayloadDataset, syncIncrementalCacheNamespace };`, context);
const cache = context.__cache;
const watchlist = { scope: "watchlist", view: "attributes", access: "public", playerIds: ["42"] };
const details = cache.incrementalRequestDetails(watchlist);
cache.rememberIncrementalPayload(details.cacheKey, { generatedAt: A, rows: [[42, "Old contract"]] });
assert.equal(cache.cachedIncrementalPayload(watchlist)?.rows[0][1], "Old contract");
const deployed = B; // Server publishes new immutable SQLite database while SPA remains open.
assert.notEqual(deployed, state.manifest.generated_at);
assert.equal(cache.cachedIncrementalPayload(watchlist)?.rows[0][1], "Old contract",
  "DIAGNOSTIC: cached Watchlist still returns old data when no new network response arrives.");
cache.adoptIncrementalPayloadDataset({ generatedAt: deployed });
assert.equal(cache.cachedIncrementalPayload(watchlist), null,
  "Once a new generation is observed, the real shared Watchlist cache must invalidate.");
const normal = { scope: "database", view: "attributes", access: "public", playerIds: [] };
assert.equal(cache.cachedIncrementalPayload(normal), null);

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
const pending = deferred();
const labels = {};
const element = (id) => labels[id] ||= { textContent: "", hidden: false, disabled: false };
const summaryState = { manifest: { generated_at: A } };
let fetches = 0;
const summaryContext = {
  state: summaryState,
  document: { getElementById: (id) => id === "homeSummaryRetryButton"
    ? { addEventListener() {} } : element(id) },
  statusText: element("statusText"), totalPlayers: element("totalPlayers"),
  totalWallets: element("totalWallets"), homePlayers: element("homePlayers"),
  homeWallets: element("homeWallets"),
  formatCount: (x) => String(x),
  window: { __mflDataClient: { fetch: () => { fetches++; return pending.promise; } } },
  console: { error() {} },
};
runInNewContext(summary + `
globalThis.__summary = { loadSummary, homeSummaryCacheReady,
  snapshot: () => summarySnapshot };`, summaryContext);
const initialLoad = summaryContext.__summary.loadSummary();
summaryState.manifest = { generated_at: B }; // A newer route payload has completed first.
pending.resolve({ ok: true, json: async () => ({
  manifest: { generated_at: A }, summary: {
    generatedAt: A, playerCount: 10, walletCount: 5
  }
}) });
assert.equal(await initialLoad, true);
assert.equal(summaryState.manifest.generated_at, A,
  "DIAGNOSTIC: late bootstrap A overwrites already-observed route generation B.");
assert.equal(await summaryContext.__summary.loadSummary(), true);
assert.equal(fetches, 1, "DIAGNOSTIC: Home summary stays cached and never requests generation B.");

const plannerStart = planner.indexOf("function cachedPlannerClub(clubId){");
const plannerEnd = planner.indexOf("function savePlannerClub(", plannerStart);
assert.ok(plannerStart > 0 && plannerEnd > plannerStart);
const localStorage = new Map();
localStorage.set("mfl-club-display-data-v1", JSON.stringify({
  7: { clubId: "7", name: "Before transfer", divisionName: "Diamond" }
}));
const plannerContext = {
  localStorage: { getItem: (key) => localStorage.get(key)||null },
  CLUB_DISPLAY_DATA_STORAGE_KEY: "mfl-club-display-data-v1",
};
runInNewContext(planner.slice(plannerStart, plannerEnd) +
  "\nglobalThis.__readClub = cachedPlannerClub;", plannerContext);
assert.equal(plannerContext.__readClub("7")?.name, "Before transfer",
  "DIAGNOSTIC: Planner public club display cache is independent from SQLite generation.");
assert.equal(cache.cachedIncrementalPayload(watchlist), null,
  "Watchlist cached API data must stay isolated from Planner local display cache.");

console.log("DATA01C_BASELINE_PASS: Watchlist cache only invalidates after new generation is observed; late bootstrap B->A overwrite reproduced; Planner display cache is unversioned; no live data or mutations.");
