import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("v1.123.31 stale-wait compatibility remains while real busy tokens own click locking", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /const STATIC_RELEASE_VERSION = "1\.123\.36"/);
  assert.match(bridge, /function interactionShouldBeBlocked\(\)/);
  assert.match(bridge, /return activeTokens\.size > 0;/);
  assert.doesNotMatch(bridge, /function elementHasWaitCursor/);
});

test("v1.123.31 Evaluation focus behavior is retained by the consolidated Evaluation runtime", async () => {
  const bridge = await read("app.js");
  const runtime = await read("evaluation-static-chrome-runtime.js");
  assert.match(bridge, /evaluationSearchInput\.inert = loadingEvaluation/);
  assert.match(bridge, /evaluationSearchInput\.dataset\.staticFocusGuard = "true"/);
  assert.match(runtime, /function evaluationReady\(\)/);
  assert.match(runtime, /function syncSearchFocusGuard\(\)/);
  assert.match(runtime, /input\.inert = false/);
  assert.match(runtime, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(runtime, /document\.scrollingElement\.scrollTop = 0/);
  assert.doesNotMatch(runtime, /setInterval/);
});

test("v1.123.31 Watchlist title behavior is retained by the dedicated Watchlist runtime", async () => {
  const runtime = await read("watchlist-route-ui-runtime.js");
  const core = await read("modules/legacy-core.js");
  assert.match(runtime, /const nextTitle = `Watchlist - \$\{name\}`/);
  assert.match(runtime, /function syncWatchlistTitle\(\)/);
  assert.match(runtime, /liveWatchlistName\(watchlistId\)[\s\S]*cachedWatchlistName\(watchlistId\)/);
  assert.match(runtime, /stableWatchlistName/);
  assert.match(runtime, /currentName: \(\) => currentWatchlistIdentity\(\)\.name/);
  assert.match(core, /window\.__mflWatchlistRouteUiRuntime\?\.currentName\?\.\(\)/);
  assert.match(core, /pageName === "watchlist" \|\| \/\^\\\/watchlist/);
});

test("v1.123.31 installs full global search before legacy page startup waits", async () => {
  const entry = await read("modules/app-entry.js");
  const searchRuntime = await read("global-search-runtime.js");
  const early = entry.slice(entry.indexOf("const EARLY_RUNTIME_SCRIPTS"), entry.indexOf("const LATE_RUNTIME_SCRIPTS"));
  const late = entry.slice(entry.indexOf("const LATE_RUNTIME_SCRIPTS"), entry.indexOf("/** @type"));
  assert.match(early, /global-search-runtime\.js/);
  assert.doesNotMatch(late, /global-search-runtime\.js/);
  assert.match(searchRuntime, /type: "all"/);
  assert.match(searchRuntime, /applyDatabaseSearchPayload\(payload, "all"\)/);
  assert.match(searchRuntime, /globalSearchAuthoritative = "true"/);
});

test("v1.123.31 Database Stats totals share the grouped ownership and Overall scope", async () => {
  const stats = await read("api/_database-stats.js");
  assert.match(stats, /FROM players\s*WHERE \$\{excludedOwnershipSql\}\s*AND \$\{overallSql\} IS NOT NULL/);
  assert.match(stats, /SELECT count\(\*\) AS totalRetiredPlayers[\s\S]*WHERE \$\{excludedOwnershipSql\}[\s\S]*AND \$\{retiredSql\}[\s\S]*AND \$\{overallSql\} IS NOT NULL/);
  assert.match(stats, /retiredTotals = queryOne\([\s\S]*ownershipParameters/);
});
