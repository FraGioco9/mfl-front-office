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
  assert.equal(release.version, "1.123.14");
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

test("nested routes load the module entry from the site root", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /new URL\("\/modules\/app-entry\.js", window\.location\.origin\)/);
  assert.doesNotMatch(bridge, /new URL\("\.\/modules\/app-entry\.js", window\.location\.href\)/);
});

test("static shell resolves Home wallet geometry before app.js executes", async () => {
  const bridge = await read("app.js");
  const index = await read("index.html");
  assert.match(bridge, /const STATIC_RELEASE_VERSION = "1\.123\.14"/);
  assert.match(bridge, /function storedWalletOptInAddress\(\)/);
  assert.match(bridge, /const storedOptIn = Boolean\(storedWalletOptInAddress\(\)\)/);
  assert.match(bridge, /const storedAccess = hasStoredProgressionAccess\(\)/);
  assert.match(bridge, /homeOptInButton\.hidden = storedOptIn/);
  assert.match(bridge, /myPlayersOptInButton\.hidden = storedOptIn/);
  assert.match(bridge, /classList\.toggle\("guest", !storedAccess\)/);
  assert.ok(bridge.indexOf("const footerVersionLink = primeStaticShell();") < bridge.indexOf("fetch(\"/release.json\""));
  assert.match(index, /root\.dataset\.storedWalletOptIn = optedIn \? "true" : "false"/);
  assert.match(index, /html\[data-stored-wallet-opt-in="true"\] :is\(#homeOptInButton, #myPlayersOptInButton\)/);
  assert.match(index, /<button id="homeOptInButton" class="homeOptInButton" type="button">/);
  assert.match(index, /<header class="topbar">/);
  assert.match(index, /<div id="menuRail" class="menuRail">/);
  assert.match(index, /<aside id="sidebar" class="sidebar">/);
  assert.match(index, /<footer class="siteFooter">/);
  assert.match(index, />Database<\/span>/);
  assert.match(index, />MFL<\/span>/);
  assert.match(index, />Evaluation<\/span>/);
});

test("Database Stats view controls and five-card geometry are static HTML", async () => {
  const bridge = await read("app.js");
  const index = await read("index.html");
  const runtime = await read("database-stats-runtime.js");
  const bootstrap = await read("database-stats-navigation-release-runtime.js");
  const entry = await read("modules/app-entry.js");
  const earlyScripts = entry.slice(entry.indexOf("const EARLY_RUNTIME_SCRIPTS"), entry.indexOf("const LATE_RUNTIME_SCRIPTS"));
  const lateScripts = entry.slice(entry.indexOf("const LATE_RUNTIME_SCRIPTS"), entry.indexOf("/** @type"));

  assert.match(index, /<section id="databaseStatsPage"[^>]*data-static-database-stats="true"[^>]*hidden>/);
  assert.match(index, /aria-label="Database views"[\s\S]*data-view="attributes">Attributes<[\s\S]*data-view="contracts">Contracts<[\s\S]*data-view="stats">Stats</);
  assert.match(index, /#databaseStatsPage \.databaseStatsCards \{\s*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/);
  for (const label of ["All", "Ultimate", "Legendary", "Rare", "Uncommon", "Limited", "Common", "Custom"]) {
    assert.match(index, new RegExp(`mflStatsFilterButton[^>]*>${label}<\\/button>`));
  }
  assert.match(bridge, /function ensureDatabaseStatsStaticPage\(\)[\s\S]*return page instanceof HTMLElement \? page : null;/);
  assert.doesNotMatch(bridge, /page\.innerHTML = `\s*<h2 class="tablePageTitle">Database/);
  assert.match(bridge, /pageName: "databasestats", pageId: "databaseStatsPage"/);
  assert.match(runtime, /const existing = document\.getElementById\("databaseStatsPage"\)/);

  for (const script of [
    "database-stats-navigation-release-runtime.js",
    "database-stats-runtime.js",
    "database-stats-state-runtime.js",
    "database-stats-tooltip-portal-runtime.js",
  ]) {
    assert.match(earlyScripts, new RegExp(script.replaceAll(".", "\\.")));
    assert.doesNotMatch(lateScripts, new RegExp(script.replaceAll(".", "\\.")));
  }
  const legacyLoad = entry.indexOf('loadClassicScript("/modules/legacy-core.js"');
  const firstStateSync = entry.indexOf("__mflDatabaseStatsStateRuntime?.sync?.()", legacyLoad);
  assert.ok(legacyLoad >= 0 && firstStateSync > legacyLoad);
  assert.match(entry, /__mflDatabaseStatsReloadBootstrap\?\.restoreRoute\?\.\(\)/);
  assert.doesNotMatch(bootstrap, /history\.pushState\s*=|history\.replaceState\s*=/);
  assert.match(entry, /runtimeWindow\.__mflDatabaseStatsReloadBootstrap\?\.finalize\?\.\(\)/);
});

test("Database Stats runtime is event-driven and cannot starve startup", async () => {
  const runtime = await read("database-stats-runtime.js");
  const stateRuntime = await read("database-stats-state-runtime.js");
  assert.doesNotMatch(runtime, /new MutationObserver|setInterval|history\.pushState\s*=|history\.replaceState\s*=/);
  assert.doesNotMatch(stateRuntime, /new MutationObserver|setInterval/);
  assert.match(runtime, /document\.addEventListener\("click", onDocumentClick, true\)/);
  assert.match(runtime, /window\.addEventListener\("popstate", onPopState\)/);
});

test("loading lock remains scoped to explicit data operations including both Stats pages", async () => {
  const bridge = await read("app.js");
  const databaseRuntime = await read("database-stats-runtime.js");
  const mflRuntime = await read("mfl-stats-first-paint-runtime.js");
  assert.match(bridge, /"databaseStatsData"/);
  assert.match(bridge, /"mflStatsData"/);
  assert.match(bridge, /runtimeWindow\.__mflWithInteractionBusy = \(callback\) => run\(callback, "interaction-loading"\)/);
  assert.match(databaseRuntime, /window\.__mflInteractionBusy\.begin\("databaseStatsData"\)/);
  assert.match(mflRuntime, /window\.__mflInteractionBusy\.begin\("mflStatsData"\)/);
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
  assert.match(portal, /event\.stopImmediatePropagation\(\)/);
  assert.match(portal, /startApplyAnimation\(renderedHistogram\)/);
  assert.match(stateRuntime, /#databaseStatsCustomTooltipPortal/);
});

test("Database Stats participates in the existing saved Database view state", async () => {
  const stateRuntime = await read("database-stats-state-runtime.js");
  const legacy = await read("modules/legacy-core.js");
  assert.match(legacy, /tableState: stripPersistentSortState\(currentTableState\(\)\)/);
  assert.match(stateRuntime, /pageViewOptions\.database\.push\("stats"\)/);
  assert.match(stateRuntime, /state\.tablePageStates\.database = \{ \.\.\.existing, view: "stats" \}/);
  assert.match(stateRuntime, /typeof saveTableState === "function"/);
  assert.match(stateRuntime, /setPage = async function setPageWithDatabaseStats/);
  assert.match(stateRuntime, /targetView === "stats"/);
  assert.match(stateRuntime, /showHomeShell = async function showHomeShellWithDatabaseStats/);
});

test("MFL Stats uses one compact grouped request and releases its shell for navigation", async () => {
  const runtime = await read("mfl-stats-first-paint-runtime.js");
  const index = await read("index.html");
  const handler = await read("api/data.js");
  const summary = await read("api/_mfl-stats-summary.js");
  const startup = await read("startup-integrity-runtime.js");
  const entry = await read("modules/app-entry.js");

  assert.match(runtime, /mode=mfl-stats-summary/);
  assert.match(runtime, /function renderSummary\(\)/);
  assert.match(runtime, /function installLegacyBridge\(\)/);
  assert.match(runtime, /function releaseStatsShellForNavigation\(target\)/);
  assert.match(runtime, /document\.documentElement\.classList\.remove\(FIRST_PAINT_GUARD_CLASS\)/);
  assert.doesNotMatch(runtime, /setInterval|loadFullMflStats|mfl-stats-all|scheduleRouteSync/);
  assert.match(runtime, /#mflStatsPage \.mflStatsHistogram \{\s*animation: none !important;\s*opacity: 1 !important;\s*transform: none !important;/);
  assert.match(index, /#mflStatsPage \.mflStatsHistogram \{\s*animation: none !important;\s*opacity: 1 !important;/);
  assert.match(handler, /mode === "mfl-stats-summary"/);
  assert.match(summary, /GROUP BY overall, age, category/);
  assert.match(summary, /THEN 'packable'/);
  assert.match(summary, /THEN 'aged'/);
  assert.match(summary, /THEN 'other'/);
  assert.match(startup, /the MFL Stats full-row loading path/);
  assert.match(startup, /window\.__mflStatsFirstPaintRuntime\?\.sync\?\.\(\)/);
  assert.match(entry, /__mflStatsFirstPaintRuntime\?\.installLegacyBridge\?\.\(\)/);
});

test("MFL stats first paint keeps the player table hidden", async () => {
  const runtime = await read("mfl-stats-first-paint-runtime.js");
  const index = await read("index.html");
  assert.match(runtime, /const FIRST_PAINT_GUARD_CLASS = "mflStatsFirstPaintGuard"/);
  assert.match(runtime, /html\.\$\{FIRST_PAINT_GUARD_CLASS\} #progressionPage \{\s*display: none !important;/);
  assert.match(runtime, /html\.\$\{FIRST_PAINT_GUARD_CLASS\} #mflStatsPage \{\s*display: block !important;/);
  assert.match(runtime, /function syncFirstPaintGuard\(\)/);
  assert.match(index, /html\[data-initial-page="mfl\/stats"\]:not\(\.mflInitialRouteResolved\) #mflStatsPage/);
  assert.doesNotMatch(runtime, /new MutationObserver/);
});

test("Changelog canonical data preserves the accepted 1.123, 1.121 and 1.120 history", async () => {
  const index = await read("index.html");
  const recent = JSON.parse(await read("releases-recent.json"));
  const versions = recent.map((entry) => entry[0]);
  assert.doesNotMatch(index, /1\.119\.29/);
  assert.match(index, /<ol class="changelogList" hidden data-history-loading="true"><\/ol>/);
  for (const version of ["v1.123.14", "v1.123.13", "v1.123.12", "v1.123.11", "v1.123.10", "v1.123.9", "v1.121.0", "v1.120.48", "v1.120.30", "v1.120.3", "v1.120.0"]) {
    assert.ok(versions.includes(version), `missing ${version}`);
  }
  assert.equal(new Set(versions).size, versions.length);
});
