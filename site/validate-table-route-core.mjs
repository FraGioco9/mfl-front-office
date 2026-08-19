import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);
const matches = (source, pattern, message) => invariant(pattern.test(source), message);

const [coreSource, tableSplitter, appConfig, routeLoader, routeNormalizer, buildCore, appEntry] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-table-chunk.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-entry.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");

invariant(sharedCore.length > 250_000, "The shared application core became unexpectedly small after the Table split.");
invariant(tableCore.length > 20_000, "The Table core chunk is too small to represent the shared table engine.");
new Function(sharedCore);
new Function(tableCore);

includes(tableSplitter, 'const TABLE_FACADE_INSERTION_MARKER = "async function setPage(pageName, updateHash = true, options = {}) {";', "Table facade insertion must use a stable source marker rather than a stale numeric offset.");
excludes(tableSplitter, "firstSectionStart", "Table facade insertion must not reuse an index captured before extraction mutates the shared core.");
includes(tableSplitter, "core = core.replace(\n    TABLE_FACADE_INSERTION_MARKER,", "The shared Table facade must be inserted at the stable setPage boundary.");
includes(tableSplitter, '"Table destination shell"', "The Table splitter must extract the table destination shell.");
includes(tableSplitter, '"Table sorting and header owner"', "The Table splitter must extract sorting and header ownership.");
includes(tableSplitter, '"Table filter controls and matching"', "The Table splitter must extract filter controls and matching.");
includes(tableSplitter, '"Table selection owner"', "The Table splitter must extract selection ownership.");
includes(tableSplitter, '"Table row renderer"', "The Table splitter must extract row rendering.");

includes(sharedCore, "let __mflTableTitleForPageOwner = null;", "The shared core must keep the stable table-title facade slot for Player-only startup.");
includes(sharedCore, "const tableTitleForPage = function (pageName) {", "The shared core must expose tableTitleForPage before Player rendering can call it.");
includes(sharedCore, 'Reflect.get(window, "__mflTableTitleForPageFallback")', "The table-title facade must have a bootstrap fallback before the Table chunk loads.");
const titleFacadeIndex = sharedCore.indexOf("const tableTitleForPage = function (pageName) {");
const setPageIndex = sharedCore.indexOf("async function setPage(pageName, updateHash = true, options = {}) {");
invariant(titleFacadeIndex >= 0 && setPageIndex > titleFacadeIndex, "tableTitleForPage must be declared in shared top-level scope before setPage and Player startup execution.");
includes(tableCore, "function tableTitleForPageOwner(pageName) {", "The lazy Table chunk must retain the real table-title implementation.");
includes(tableCore, "__mflTableTitleForPageOwner = tableTitleForPageOwner;", "Loading the Table chunk must activate the real table-title owner.");

for (const [facade, ownerSlot, chunkOwner] of [
  ["buildHeader", "__mflTableBuildHeaderOwner", "tableBuildHeaderOwner"],
  ["applyFilters", "__mflTableApplyFiltersOwner", "tableApplyFiltersOwner"],
  ["renderTable", "__mflTableRenderTableOwner", "tableRenderTableOwner"],
  ["setView", "__mflTableSetViewOwner", "tableSetViewOwner"],
  ["buildOperatorSelect", "__mflTableBuildOperatorSelectOwner", "tableBuildOperatorSelectOwner"],
  ["ruleMatches", "__mflTableRuleMatchesOwner", "tableRuleMatchesOwner"],
  ["addFilterRule", "__mflTableAddFilterRuleOwner", "tableAddFilterRuleOwner"],
  ["restoreSavedTableState", "__mflTableRestoreSavedTableStateOwner", "tableRestoreSavedTableStateOwner"],
]) {
  includes(sharedCore, `let ${ownerSlot} = null;`, `The shared core must keep the stable ${facade} owner slot.`);
  includes(sharedCore, `function ${facade}() {`, `The shared core must retain the ${facade} facade.`);
  includes(tableCore, `${ownerSlot} = ${chunkOwner};`, `The Table chunk must activate ${facade}.`);
}

const universalTableHandlers = [
  ["openFilters", "__mflTableOpenFiltersOwner", "tableOpenFiltersOwner", 'openFiltersButton.addEventListener("click", openFilters);'],
  ["clearAdvancedFilters", "__mflTableClearAdvancedFiltersOwner", "tableClearAdvancedFiltersOwner", 'quickClearFiltersButton.addEventListener("click", clearAdvancedFilters);'],
  ["closeFilters", "__mflTableCloseFiltersOwner", "tableCloseFiltersOwner", 'closeFiltersButton.addEventListener("click", closeFilters);'],
  ["applyAdvancedFilters", "__mflTableApplyAdvancedFiltersOwner", "tableApplyAdvancedFiltersOwner", 'applyFiltersButton.addEventListener("click", applyAdvancedFilters);'],
  ["clearSelection", "__mflTableClearSelectionOwner", "tableClearSelectionOwner", 'clearSelectionButton.addEventListener("click", clearSelection);'],
  ["addSelectedToWatchlist", "__mflTableAddSelectedToWatchlistOwner", "tableAddSelectedToWatchlistOwner", 'addToWatchlistButton.addEventListener("click", addSelectedToWatchlist);'],
  ["moveSelectedToWatchlist", "__mflTableMoveSelectedToWatchlistOwner", "tableMoveSelectedToWatchlistOwner", 'moveToWatchlistButton?.addEventListener("click", moveSelectedToWatchlist);'],
  ["openSelectedPlayerLinks", "__mflTableOpenSelectedPlayerLinksOwner", "tableOpenSelectedPlayerLinksOwner", 'openSelectedLinksButton.addEventListener("click", openSelectedPlayerLinks);'],
];
for (const [handler, ownerSlot, chunkOwner, binding] of universalTableHandlers) {
  includes(sharedCore, `let ${ownerSlot} = null;`, `The shared core must keep a stable owner slot for ${handler}.`);
  includes(sharedCore, `function ${handler}() {`, `The shared core must retain the ${handler} facade used by universal binding.`);
  includes(sharedCore, binding, `Universal event binding must retain ${handler} through its facade.`);
  includes(tableCore, `function ${chunkOwner}(`, `The Table chunk must own the ${handler} implementation.`);
  includes(tableCore, `${ownerSlot} = ${chunkOwner};`, `The Table chunk must activate ${handler} when loaded.`);
}

excludes(sharedCore, "function tableNextOverallPreciseValue(row) {", "Table sorting calculations must not remain in the shared core.");
excludes(sharedCore, "function activeFilterCount() {", "Table filter UI must not remain in the shared core.");
excludes(sharedCore, "function currentPageRows() {", "Table paging and selection must not remain in the shared core.");
excludes(sharedCore, "function showTableBusyState() {", "Table busy-state rendering must not remain in the shared core.");
includes(sharedCore, "function formatCellValue(row, column) {", "Cross-route player/search formatting must remain shared.");
includes(sharedCore, "function rowByPlayerId(playerId) {", "Cross-route player lookup must remain shared.");

includes(appConfig, 'table: "/modules/app-core-table-runtime.js"', "Canonical app config must map the Table chunk.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "The route-core loader must consume canonical route-core paths.");
includes(routeLoader, 'if (page === "club") return ["table", "club"];', "Club must load the Table core before the Club core.");
includes(routeLoader, 'if (page === "database" && view === "stats") return [];', "Database Stats must not load the Table core.");
includes(routeLoader, 'if (page === "mfl" && view === "stats") return ["mflstats"];', "MFL Stats must keep its independent core.");
includes(routeLoader, "for (const dependency of dependencies)", "Route-core dependencies must execute in declared order.");

const routeNeedsTableStart = appEntry.indexOf("function routeNeedsTable(pageName, options = {}) {");
const routeNeedsTableEnd = appEntry.indexOf("function routeNeedsWatchlist(pageName)", routeNeedsTableStart);
invariant(routeNeedsTableStart >= 0 && routeNeedsTableEnd > routeNeedsTableStart, "app-entry must retain a stable Table runtime decision facade.");
const routeNeedsTableSection = appEntry.slice(routeNeedsTableStart, routeNeedsTableEnd);
includes(routeNeedsTableSection, 'Reflect.get(window, "__mflRouteUsesTableInfrastructure")', "app-entry must reuse central table-route membership.");
excludes(routeNeedsTableSection, '["mfl", "agents", "progression", "watchlist", "myplayers", "club"]', "app-entry must not duplicate the table-capable page list.");

includes(routeNormalizer, "const directTableRoute = (", "Direct startup must classify table routes before startApp.");
includes(routeNormalizer, 'await window.__mflEnsureRouteCore("table");', "Direct table startup must load the Table core before startApp.");
matches(routeNormalizer, /!\/\^.*database.*stats.*test\(initialRoutePath\)/, "Direct Database Stats startup must stay outside the Table core.");

includes(buildCore, 'const tableRuntimePath = resolve(siteRoot, "modules/app-core-table-runtime.js");', "The build must emit a generated Table runtime.");
includes(buildCore, "normalizeRetirementMarkerContract", "The build must apply the canonical retirement-marker preprocessing before route splitting.");
includes(buildCore, "normalizeTooltipHeightOwnership(String(artifacts.routeChunks?.table", "The built Table runtime must receive canonical tooltip normalization.");
const generatedTable = await read("./modules/app-core-table-runtime.js");
const tableBanner = "// Generated Table core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedTable.startsWith(tableBanner), "Generated Table runtime must carry the build ownership banner.");
const generatedTableBody = generatedTable.slice(tableBanner.length).replace(/\s*$/, "");
invariant(generatedTableBody.length > 20_000, "Generated Table runtime is unexpectedly small.");
new Function(generatedTableBody);
for (const owner of [
  "function tableTitleForPageOwner(pageName) {",
  "function tableBuildHeaderOwner(",
  "function tableApplyFiltersOwner(",
  "function tableRenderTableOwner(",
  "function tableSetViewOwner(",
]) {
  includes(generatedTableBody, owner, `Generated Table runtime must retain route owner ${owner}.`);
}
includes(generatedTableBody, 'icon: "calendar-x-2"', "Generated Table runtime must contain the build-time retired-player marker contract.");
includes(generatedTableBody, 'icon: "calendar-clock"', "Generated Table runtime must contain the build-time retiring-player marker contract.");

console.log("Table route-core splitting and globally placed facade validation passed.");
