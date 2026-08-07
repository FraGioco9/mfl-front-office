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
  assert.equal(release.version, "1.123.10");
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

test("static shell and its content resolve before runtime loading", async () => {
  const bridge = await read("app.js");
  const index = await read("index.html");
  assert.match(bridge, /const STATIC_RELEASE_VERSION = "1\.123\.10"/);
  assert.match(bridge, /function primeStaticShell\(\)/);
  assert.match(bridge, /const storedAccess = hasStoredProgressionAccess\(\)/);
  assert.match(bridge, /homeOptInButton\.hidden = storedAccess/);
  assert.ok(bridge.indexOf("const footerVersionLink = primeStaticShell();") < bridge.indexOf("fetch(\"/release.json\""));
  assert.match(index, /<header class="topbar">/);
  assert.match(index, /<div id="menuRail" class="menuRail">/);
  assert.match(index, /<aside id="sidebar" class="sidebar">/);
  assert.match(index, /<footer class="siteFooter">/);
  assert.match(index, />Database<\/span>/);
  assert.match(index, />MFL<\/span>/);
  assert.match(index, />Evaluation<\/span>/);
});

test("Database Stats owns first paint but does not alter legacy startup ordering", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-stats-runtime.js");
  const bootstrap = await read("database-stats-navigation-release-runtime.js");
  const entry = await read("modules/app-entry.js");
  const earlyScripts = entry.slice(entry.indexOf("const EARLY_RUNTIME_SCRIPTS"), entry.indexOf("const LATE_RUNTIME_SCRIPTS"));
  const lateScripts = entry.slice(entry.indexOf("const LATE_RUNTIME_SCRIPTS"), entry.indexOf("/** @type"));

  assert.match(bridge, /function ensureDatabaseStatsStaticPage\(\)/);
  assert.match(bridge, /pageName: "databasestats", pageId: "databaseStatsPage"/);
  assert.ok(bridge.indexOf("ensureDatabaseStatsStaticPage();") < bridge.indexOf("const route = initialRoute"));
  for (const label of ["All", "Ultimate", "Legendary", "Rare", "Uncommon", "Limited", "Common", "Custom"]) {
    assert.match(bridge, new RegExp(`mflStatsFilterButton[^>]*>${label}<\\/button>`));
  }
  assert.match(bridge, /<article><span>Total active players<\/span><strong id="databaseStatsTotalPlayers">-<\/strong><\/article>/);
  assert.match(runtime, /const existing = document\.getElementById\("databaseStatsPage"\)/);

  assert.doesNotMatch(earlyScripts, /database-stats/);
  assert.match(lateScripts, /database-stats-navigation-release-runtime\.js/);
  assert.match(lateScripts, /database-stats-runtime\.js/);
  assert.match(lateScripts, /database-stats-state-runtime\.js/);
  assert.doesNotMatch(bootstrap, /history\.pushState\s*=|history\.replaceState\s*=/);
  assert.match(bootstrap, /restoreRoute\(\);/);
  assert.match(entry, /runtimeWindow\.__mflDatabaseStatsReloadBootstrap\?\.finalize\?\.\(\)/);
});

test("loading lock remains scoped to explicit data operations including Database Stats", async () => {
  const bridge = await read("app.js");
  const runtime = await read("database-stats-runtime.js");
  const stateRuntime = await read("database-stats-state-runtime.js");
  assert.match(bridge, /"databaseStatsData"/);
  assert.match(bridge, /runtimeWindow\.__mflWithInteractionBusy = \(callback\) => run\(callback, "interaction-loading"\)/);
  assert.match(runtime, /window\.__mflInteractionBusy\.begin\("databaseStatsData"\)/);
  assert.match(runtime, /window\.__mflInteractionBusy\?\.end\?\.\(dataBusyToken\)/);
  assert.doesNotMatch(stateRuntime, /busyToken|syncBusyState|statsStillLoading/);
  assert.doesNotMatch(bridge, /window\.fetch\s*=|trackedFetch|syncKnownLoadingStates|namedTokens/);
});

test("pager and showing-player count stay hidden while table data is loading", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /#progressionPage nav\.pager \{\s*padding-block: 12px !important;/);
  assert.match(bridge, /html\.\$\{DATA_LOADING_CLASS\} #progressionPage nav\.pager,\s*html\.\$\{DATA_LOADING_CLASS\} #progressionPage #watchlistPlayerCount \{\s*display: none !important;/);
});

test("Database Stats excludes exact MFL ownership and counts every non-retired player", async () => {
  const stats = await read("api/_database-stats.js");
  const dataHandler = await read("api/data.js");
  const runtime = await read("database-stats-runtime.js");
  assert.match(stats, /0xff8d2bbed8164db0/);
  assert.match(stats, /0x6fec8986261ecf49/);
  assert.match(stats, /lower\(coalesce\(wallet_address, ''\)\) NOT IN \(\?, \?\)/);
  assert.doesNotMatch(stats, /wallet_name/);
  assert.match(stats, /sum\(CASE WHEN \$\{activeSql\} THEN 1 ELSE 0 END\) AS totalActivePlayers/);
  const totalsSection = stats.slice(stats.indexOf("const totals = queryOne"), stats.indexOf("return {"));
  assert.doesNotMatch(totalsSection, /overallSql/);
  assert.match(dataHandler, /require\("\.\/_database-stats"\)/);
  assert.match(runtime, /data\.totalActivePlayers/);
});

test("Database Stats bars have one Apply-only animation source", async () => {
  const runtime = await read("database-stats-runtime.js");
  const portal = await read("database-stats-tooltip-portal-runtime.js");
  const stateRuntime = await read("database-stats-state-runtime.js");
  assert.doesNotMatch(runtime, /databaseStatsAnimate/);
  assert.match(runtime, /data-database-stats-apply-transition="true"/);
  assert.match(portal, /target\.closest\('#databaseStatsCustomTooltipPortal \[data-role="apply"\]'\)/);
  assert.match(portal, /startApplyAnimation\(renderedHistogram\)/);
  assert.match(stateRuntime, /clearBarTransition\(\)/);
  assert.match(stateRuntime, /#databaseStatsCustomTooltipPortal input/);
});

test("Database Stats participates in the existing saved Database view state", async () => {
  const stateRuntime = await read("database-stats-state-runtime.js");
  const legacy = await read("modules/legacy-core.js");
  assert.match(legacy, /tableState: stripPersistentSortState\(currentTableState\(\)\)/);
  assert.match(stateRuntime, /pageViewOptions\.database\.push\("stats"\)/);
  assert.match(stateRuntime, /state\.tablePageStates\.database = \{ \.\.\.existing, view: "stats" \}/);
  assert.match(stateRuntime, /typeof saveTableState === "function"\) saveTableState\(\)/);
  assert.match(stateRuntime, /setPage = async function setPageWithDatabaseStats/);
  assert.match(stateRuntime, /targetView === "stats"/);
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

test("Changelog canonical data restores the accepted 1.121 and 1.120 history", async () => {
  const index = await read("index.html");
  const recent = JSON.parse(await read("releases-recent.json"));
  const versions = recent.map((entry) => entry[0]);
  assert.doesNotMatch(index, /1\.119\.29/);
  assert.match(index, /<ol class="changelogList" hidden data-history-loading="true"><\/ol>/);
  for (const version of ["v1.123.9", "v1.121.0", "v1.120.48", "v1.120.30", "v1.120.3", "v1.120.0"]) {
    assert.ok(versions.includes(version), `missing ${version}`);
  }
  assert.equal(new Set(versions).size, versions.length);
});
