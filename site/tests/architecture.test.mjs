import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

test("release metadata is the current Semantic Version source", async () => {
  const release = JSON.parse(await read("release.json"));
  assert.match(release.version, /^\d+\.\d+\.\d+$/);
  assert.equal(release.version, "1.123.9");
  assert.ok(release.description.length > 20);
});

test("application core keeps the known-good direct startup path", async () => {
  const entry = await read("modules/app-entry.js");
  const bridge = await read("app.js");
  assert.match(entry, /loadClassicScript\("\/modules\/legacy-core\.js", release\.version\)/);
  assert.doesNotMatch(entry, /prepareCoreRuntimeSource|loadPreparedClassicScript|loadPartitionedClassicScript/);
  assert.doesNotMatch(entry, /document\.(open|write|close)\s*\(/);
  assert.doesNotMatch(bridge, /document\.(open|write|close)\s*\(/);
});

test("static shell and opted-in state resolve before runtime loading", async () => {
  const bridge = await read("app.js");
  const index = await read("index.html");
  assert.match(bridge, /const STATIC_RELEASE_VERSION = "1\.123\.9"/);
  assert.match(bridge, /function primeStaticShell\(\)/);
  assert.match(bridge, /const storedAccess = hasStoredProgressionAccess\(\)/);
  assert.match(bridge, /homeOptInButton\.hidden = storedAccess/);
  assert.ok(bridge.indexOf("const footerVersionLink = primeStaticShell();") < bridge.indexOf("fetch(\"/release.json\""));
  assert.match(index, /<div id="menuRail" class="menuRail">/);
  assert.match(index, /<aside id="sidebar" class="sidebar">/);
  assert.match(index, /id="homeOptInButton"[^>]*hidden/);
  assert.match(index, /MFL Front Office v1\.123\.9/);
  assert.match(index, /\/styles\.css\?v=1\.123\.9/);
  assert.match(index, /\/app\.js\?v=1\.123\.9/);
});

test("Database Stats owns the first paint instead of the player table", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-stats-runtime.js");
  assert.match(bridge, /function ensureDatabaseStatsStaticPage\(\)/);
  assert.match(bridge, /pageName: "databasestats", pageId: "databaseStatsPage"/);
  assert.ok(bridge.indexOf("ensureDatabaseStatsStaticPage();") < bridge.indexOf("const route = initialRoute"));
  assert.match(bridge, /<article><span>Total active players<\/span><strong id="databaseStatsTotalPlayers">-<\/strong><\/article>/);
  assert.match(runtime, /const existing = document\.getElementById\("databaseStatsPage"\)/);
  assert.match(runtime, /pageCreatedByRuntime/);
});

test("loading lock remains scoped to explicit data operations", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /DATA_LOADING_REASONS = new Set\(\["startup", "interaction-loading", "ensureProgressionData", "requestIncrementalRoute"\]\)/);
  assert.match(bridge, /runtimeWindow\.__mflWithInteractionBusy = \(callback\) => run\(callback, "interaction-loading"\)/);
  assert.doesNotMatch(bridge, /DATA_LOADING_FUNCTIONS/);
  assert.doesNotMatch(bridge, /"reloadIncrementalPage",\s*"setView",\s*"setPage"/);
  assert.doesNotMatch(bridge, /window\.fetch\s*=|trackedFetch|syncKnownLoadingStates|namedTokens/);
});

test("pager and showing-player count stay hidden while data is loading", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /#progressionPage nav\.pager \{\s*padding-block: 12px !important;/);
  assert.match(bridge, /html\.\$\{DATA_LOADING_CLASS\} #progressionPage nav\.pager,\s*html\.\$\{DATA_LOADING_CLASS\} #progressionPage #watchlistPlayerCount \{\s*display: none !important;/);
});

test("Database Stats excludes canonical MFL wallet ownership and retired players", async () => {
  const views = await read("api/_data-views.js");
  const preparation = await read("../prepare_runtime_database.py");
  const runtime = await read("database-stats-runtime.js");
  assert.match(views, /SELECT lower\(wallet_address\)\s+FROM wallets/);
  assert.match(views, /normalize_wallet_name\(name\) IN/);
  assert.match(views, /"mfl trade"/);
  assert.doesNotMatch(views, /if \(tableExists\("runtime_database_stats"\)/);
  assert.match(views, /coalesce\(CAST\(retirement_years AS INTEGER\), -1\) <> 0/);
  assert.match(preparation, /SELECT lower\(wallet_address\) FROM wallets/);
  assert.match(preparation, /normalize_wallet_name\(name\) IN/);
  assert.match(runtime, /sumGroups\(groups, \(group\) => Number\(group\[2\]\) !== 0\)/);
  assert.match(runtime, /if \(Number\(group\[2\]\) === 0\) return/);
});

test("Database Stats bars animate only for explicit Apply", async () => {
  const runtime = await read("database-stats-runtime.js");
  const refinement = await read("database-stats-refinement-runtime.js");
  assert.match(runtime, /#databaseStatsPage \.mflStatsHistogramBar::after \{\s*animation: none !important;/);
  assert.match(runtime, /databaseStatsAnimate/);
  assert.match(runtime, /databaseStatsCustomApply[^\n]+applyCustomFilter\(true\)/);
  assert.match(runtime, /event\.key === "Enter"\) applyCustomFilter\(false\)/);
  assert.match(runtime, /renderStats\(false\)/);
  assert.doesNotMatch(refinement, /window\.fetch\s*=|originalFetch|STATS_ENDPOINT|DATA_ENDPOINT/);
});

test("MFL stats first paint uses a CSS guard instead of rewriting page visibility", async () => {
  const runtime = await read("mfl-stats-first-paint-runtime.js");
  assert.match(runtime, /const FIRST_PAINT_GUARD_CLASS = "mflStatsFirstPaintGuard"/);
  assert.match(runtime, /html\.\$\{FIRST_PAINT_GUARD_CLASS\} #progressionPage \{\s*display: none !important;/);
  assert.match(runtime, /html\.\$\{FIRST_PAINT_GUARD_CLASS\} #mflStatsPage \{\s*display: block !important;/);
  assert.match(runtime, /function syncFirstPaintGuard\(\)/);
  assert.doesNotMatch(runtime, /function enforceStatsShell/);
  assert.doesNotMatch(runtime, /new MutationObserver/);
});

test("Changelog has no stale static release source", async () => {
  const index = await read("index.html");
  const recent = JSON.parse(await read("releases-recent.json"));
  assert.doesNotMatch(index, /1\.119\.29/);
  assert.match(index, /<ol class="changelogList" hidden data-history-loading="true"><\/ol>/);
  assert.deepEqual(recent.map((entry) => entry[0]), ["v1.123.8", "v1.123.6", "v1.123.5", "v1.123.3", "v1.123.2", "v1.123.1", "v1.123.0"]);
});
