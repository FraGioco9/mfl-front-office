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
  assert.equal(release.version, "1.123.20");
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
  assert.match(bridge, /const STATIC_RELEASE_VERSION = "1\.123\.20"/);
  assert.match(bridge, /function storedWalletOptInAddress\(\)/);
  assert.match(bridge, /function syncStoredAccessFlags\(\)/);
  assert.match(bridge, /const \{ storedOptIn, storedAccess \} = syncStoredAccessFlags\(\)/);
  assert.match(bridge, /homeOptInButton\.hidden = storedOptIn/);
  assert.match(bridge, /myPlayersOptInButton\.hidden = storedOptIn/);
  assert.match(bridge, /classList\.toggle\("guest", !storedAccess\)/);
  assert.match(bridge, /runtimeWindow\.__mflSyncStoredAccessFlags = syncStoredAccessFlags/);
  assert.match(bridge, /syncHomeLoginButton = wrapped/);
  assert.ok(bridge.indexOf("const footerVersionLink = primeStaticShell();") < bridge.indexOf("fetch(\"/release.json\""));
  assert.match(index, /root\.dataset\.storedWalletOptIn = optedIn \? "true" : "false"/);
  assert.match(index, /root\.dataset\.storedProgressionAccess = optedIn && permission\?\.allowed === true \? "true" : "false"/);
  assert.match(index, /html\[data-stored-progression-access="false"\] #sidebar \.navButton\[data-page="progression"\]/);
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

test("wait-cursor elements are interaction locked even without a busy token", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /function elementHasWaitCursor\(element, pseudoElement = null\)/);
  assert.match(bridge, /function interactionShouldBeBlocked\(event\)/);
  assert.match(bridge, /elementHasWaitCursor\(document\.body, "::before"\)/);
  assert.match(bridge, /if \(!interactionShouldBeBlocked\(event\)\) return;/);
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
  for (const version of ["v1.123.20", "v1.123.19", "v1.123.18", "v1.123.15", "v1.123.14", "v1.123.13", "v1.123.12", "v1.123.11", "v1.123.10", "v1.123.9", "v1.121.0", "v1.120.48", "v1.120.30", "v1.120.3", "v1.120.0"]) {
    assert.ok(versions.includes(version), `missing ${version}`);
  }
  assert.equal(new Set(versions).size, versions.length);
});

test("first Database visit defaults Hide MFL players to selected", async () => {
  const index = await read("index.html");
  const legacy = await read("modules/legacy-core.js");
  assert.match(index, /<input id="hideMflPlayersInput" type="checkbox" checked>/);
  assert.match(legacy, /hideMflPlayers: pageName === "database"/);
  assert.match(legacy, /savedState\.hideMflPlayers !== undefined \? Boolean\(savedState\.hideMflPlayers\) : true/);
});

test("protected routes select the locked Opt In shell before the main runtime", async () => {
  const bridge = await read("app.js");
  const index = await read("index.html");
  assert.match(bridge, /const OPT_IN_REQUIRED_PAGE_IDS = new Set\(\["myplayers", "watchlist", "settings"\]\)/);
  assert.match(bridge, /const lockedRoute = !storedOptIn && OPT_IN_REQUIRED_PAGE_IDS\.has\(route\.pageName\)/);
  assert.match(bridge, /const initialPageId = lockedRoute \? "myPlayersLockedPage" : route\.pageId/);
  assert.match(index, /\[data-initial-page\^="my-players"\]/);
  assert.match(index, /\[data-initial-page\^="watchlist"\]/);
  assert.match(index, /\[data-initial-page="settings"\]/);
});

test("custom Database Stats treats missing retirement years as active", async () => {
  const runtime = await read("database-stats-runtime.js");
  assert.match(runtime, /function retirementYearsForGroup\(group\)/);
  assert.match(runtime, /rawValue === null \|\| rawValue === undefined \|\| rawValue === ""/);
  assert.match(runtime, /const filteredActivePlayers = sumGroups\(groups, \(group\) => !isRetiredGroup\(group\)\)/);
  assert.match(runtime, /const filteredRetiredPlayers = sumGroups\(groups, isRetiredGroup\)/);
});

test("theme control matches the resolved light or dark mode before runtime startup", async () => {
  const index = await read("index.html");
  const legacy = await read("modules/legacy-core.js");
  assert.match(index, /<span class="themeMoonSymbol" aria-hidden="true">/);
  assert.match(index, /<span class="themeSunSymbol" aria-hidden="true">/);
  assert.match(index, /html\[data-theme="dark"\] #themeButton \.themeSunSymbol/);
  assert.ok(legacy.includes('applyTheme(savedTheme || document.documentElement.dataset.theme || "dark");'));
});

test("first bare Database visit exposes every view and canonicalizes to Attributes", async () => {
  const bridge = await read("app.js");
  const legacy = await read("modules/legacy-core.js");
  assert.ok(bridge.includes('window.history.replaceState({}, "", "/database/attributes");'));
  assert.ok(bridge.includes('document.documentElement.dataset.initialPage = "database/attributes";'));
  assert.ok(legacy.includes('database: ["attributes", "contracts", "stats"],'));
});

test("global busy state suppresses pointer targets and hover motion", async () => {
  const bridge = await read("app.js");
  assert.match(bridge, /"pointerover", "pointerenter", "pointermove", "mouseover", "mouseenter", "mousemove"/);
  assert.match(bridge, /pointer-events: none !important;/);
  assert.match(bridge, /transition: none !important;\s*animation: none !important;/);
});

test("Database clears uncached previous-page rows before its first payload arrives", async () => {
  const runtime = await read("modules/legacy-core.js");
  assert.match(runtime, /renderTableDestinationShell\(pageName, route\)/);
  assert.match(runtime, /route && route\.scope !== "empty" && !incrementalRouteIsCached\(route, 1\)[\s\S]*showTableBusyState\(\)/);
  assert.match(runtime, /setPage = async function setIncrementalPage[\s\S]*const route = prepareIncrementalRoute\(pageName[\s\S]*renderTableDestinationShell\(pageName, route\)/);
});

test("theme switching preserves loaded DOM and font metrics stay stable", async () => {
  const index = await read("index.html");
  const runtime = await read("modules/legacy-core.js");
  const styles = await read("styles.css");
  assert.match(runtime, /themeButton\.dataset\.activeTheme = theme/);
  assert.doesNotMatch(runtime, /themeButton\.textContent = theme === "dark"/);
  assert.match(styles, /font-size-adjust: 0\.520/);
  assert.match(index, /Titillium\+Web[^"]+display=block/);
  assert.equal((index.match(/rel="preload"[^>]+fonts\.gstatic\.com[^>]+as="font"/g) || []).length, 3);
});

test("evaluation search excludes retired compact results", async () => {
  const database = await read("api/_database.js");
  const views = await read("api/_data-views.js");
  const runtime = await read("modules/legacy-core.js");
  assert.match(database, /SEARCH_PLAYER_COLUMNS = Object\.freeze\([\s\S]*"retirement_years"/);
  assert.match(views, /excludeRetired: true/);
  assert.match(views, /coalesce\(CAST\(p\.retirement_years AS INTEGER\), -1\) <> 0/);
  assert.match(runtime, /retired: compactSearchValue\(row, columns, "retirement_years"\) !== null[\s\S]*Number\(compactSearchValue\(row, columns, "retirement_years"\)\) === 0/);
});

test("typed search renders immediately, requests all categories, reuses results, and pads its empty hint", async () => {
  const views = await read("api/_data-views.js");
  const runtime = await read("modules/legacy-core.js");
  const styles = await read("styles.css");
  const evaluationHandler = runtime.slice(
    runtime.indexOf("function handleEvaluationSearchInput()"),
    runtime.indexOf("function evaluationOverallKey"),
  );
  const globalHandler = runtime.slice(
    runtime.indexOf("function renderSearchResults()"),
    runtime.indexOf("function tableNextOverallPreciseValue"),
  );
  assert.match(runtime, /databaseSearchAbortControllers\.get\(type\)\?\.abort\(\)/);
  assert.match(runtime, /databaseSearchResponseCache/);
  assert.match(runtime, /signal: controller\.signal/);
  assert.match(evaluationHandler, /renderEvaluationSearchResults\(\);[\s\S]*requestDatabaseSearch\(query, "players"\)/);
  assert.match(globalHandler, /renderSearchResultsNow\(\);[\s\S]*requestDatabaseSearch\(query, "all"\)/);
  assert.doesNotMatch(evaluationHandler, /setTimeout/);
  assert.doesNotMatch(globalHandler, /setTimeout/);
  assert.match(views, /if \(type === "all"\) \{[\s\S]*players: playerSearchRows\(query, limit\),[\s\S]*agents: agentSearchRows\(query, limit\),[\s\S]*clubs: clubSearchRows\(query, limit\)/);
  assert.match(runtime, /return \[\.\.\.playerResults\.slice\(0, 5\), \.\.\.agentResults\.slice\(0, 5\)\]/);
  assert.match(runtime, /const MAX_TYPED_SEARCH_RESULTS = 15/);
  assert.match(runtime, /\.\.\.playerResults\.slice\(0, 5\),\s*\.\.\.clubResults,\s*\.\.\.agentResults\.slice\(0, 5\)/);
  assert.match(styles, /\.searchResults > \.searchHint \{\s*padding-left: 8px;/);
});

test("search pipelines stay independent and empty Evaluation primes recent results after readiness", async () => {
  const runtime = await read("modules/legacy-core.js");
  assert.match(runtime, /const databaseSearchSequences = new Map\(\)/);
  assert.match(runtime, /const databaseSearchAbortControllers = new Map\(\)/);
  assert.match(runtime, /databaseSearchResponseCache\.delete\("all:"\)/);
  assert.match(runtime, /function primeEmptyEvaluationSearch\(\)/);
  assert.match(runtime, /databaseSearchResponseCache\.delete\("players:"\)/);
  assert.match(runtime, /window\.addEventListener\("mfl:ready", focusSearch, \{ once: true \}\)/);
  assert.match(runtime, /evaluationSearchInput\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(runtime, /applyDatabaseSearchPayload\(\{ players: \{\}, agents: \{\}, clubs: \[\] \}, "all"\);\s*renderSearchResultsNow\(\)/);
});

test("Evaluation first paint, global font scale, Stats animation, and discount tooltip are stable", async () => {
  const index = await read("index.html");
  const styles = await read("styles.css");
  const stats = await read("database-stats-runtime.js");
  const entry = await read("modules/app-entry.js");
  const tooltip = await read("evaluation-discount-tooltip-runtime.js");
  assert.match(index, /html \{\s*font-size-adjust: 0\.520;/);
  assert.match(styles, /font-size-adjust: 0\.520/);
  assert.match(index, /data-initial-page="evaluation"[^\n]+#homePage[\s\S]*display: none !important;[\s\S]*data-initial-page="evaluation"[^\n]+#evaluationPage[\s\S]*display: block !important;/);
  assert.match(stats, /#databaseStatsPage \.mflStatsHistogram \{\s*animation: none !important;\s*opacity: 1 !important;\s*transform: none !important;/);
  assert.match(entry, /"\/evaluation-discount-tooltip-runtime\.js"/);
  assert.match(tooltip, /#evaluationDiscountTooltipPortal/);
  assert.match(tooltip, /document\.addEventListener\("pointerover", onPointerOver, true\)/);
});

test("Database Stats keeps all views bound to Database and preserves its shell after interaction", async () => {
  const index = await read("index.html");
  const runtime = await read("database-stats-runtime.js");
  assert.match(index, /aria-label="Database views"[\s\S]*data-page="database" data-view="attributes">Attributes<[\s\S]*data-page="database" data-view="contracts">Contracts<[\s\S]*data-page="database" data-view="stats">Stats</);
  assert.match(runtime, /function preserveStatsShellAfterInteraction\(\)/);
  assert.match(runtime, /if \(!destroyed && isStatsPath\(\)\) showStatsShell\(\)/);
  assert.match(runtime, /if \(isStatsPath\(\)\) preserveStatsShellAfterInteraction\(\)/);
});

test("cached Progression permission is applied after wallet restoration and before menu paint", async () => {
  const runtime = await read("modules/legacy-core.js");
  assert.match(runtime, /async function startApp\(\)[\s\S]*loadSavedTableState\(\);\s*applyStoredWalletPermission\(\);[\s\S]*updateMenuVisibility\(\)/);
  assert.doesNotMatch(runtime, /setupChangelogSections\(\);\s*applyStoredWalletPermission\(\);\s*const initialTarget/);
});
