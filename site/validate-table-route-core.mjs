import { readFile } from "node:fs/promises";

import { coreSourceByDomain } from "./modules/core-source-manifest.js";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [sharedCore, tableCore, generatedTable, appConfig, routeLoader, buildCore, appEntry] = await Promise.all([
  read("./modules/core-sources/shared.js"),
  read("./modules/core-sources/table.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-entry.js"),
]);

invariant(sharedCore.length > 250_000, "The canonical shared core became unexpectedly small.");
invariant(tableCore.length > 20_000, "The canonical Table core became unexpectedly small.");
new Function(sharedCore);
new Function(tableCore);

excludes(buildCore, "app-core-table-chunk", "The canonical build must not depend on the retired Table splitter.");
excludes(buildCore, "app-core-build-normalizer", "The canonical build must not depend on the retired build normalizer.");
includes(buildCore, 'from "./modules/core-source-manifest.js"', "The build must consume the canonical source manifest.");
includes(buildCore, "for (const entry of coreSourceManifest)", "The build must generate Table and other core runtimes from the canonical manifest.");
invariant(
  coreSourceByDomain.table?.source === "table.js"
    && coreSourceByDomain.table?.runtime === "app-core-table-runtime.js",
  "Canonical manifest must map Table source ownership to its generated runtime.",
);

includes(sharedCore, "let __mflTableTitleForPageOwner = null;", "Shared core must keep the stable table-title facade slot.");
includes(sharedCore, "const tableTitleForPage = function (pageName) {", "Shared core must expose tableTitleForPage before lazy Table loading.");
includes(sharedCore, 'Reflect.get(window, "__mflTableTitleForPageFallback")', "The table-title facade must retain its bootstrap fallback.");
const titleFacadeIndex = sharedCore.indexOf("const tableTitleForPage = function (pageName) {");
const setPageIndex = sharedCore.indexOf("async function setPage(pageName, updateHash = true, options = {}) {");
invariant(titleFacadeIndex >= 0 && setPageIndex > titleFacadeIndex, "tableTitleForPage must stay declared before setPage.");
includes(tableCore, "function tableTitleForPageOwner(pageName) {", "Canonical Table source must own table-title implementation.");
includes(tableCore, "__mflTableTitleForPageOwner = tableTitleForPageOwner;", "Table loading must activate the table-title owner.");

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
  includes(sharedCore, `let ${ownerSlot} = null;`, `Shared core must keep the stable ${facade} owner slot.`);
  includes(sharedCore, `function ${facade}() {`, `Shared core must retain the ${facade} facade.`);
  includes(tableCore, `${ownerSlot} = ${chunkOwner};`, `Canonical Table source must activate ${facade}.`);
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
  includes(sharedCore, `let ${ownerSlot} = null;`, `Shared core must keep a stable owner slot for ${handler}.`);
  includes(sharedCore, `function ${handler}() {`, `Shared core must retain the ${handler} facade.`);
  includes(sharedCore, binding, `Universal binding must continue calling ${handler} through its facade.`);
  includes(tableCore, `function ${chunkOwner}(`, `Canonical Table source must own ${handler}.`);
  includes(tableCore, `${ownerSlot} = ${chunkOwner};`, `Canonical Table source must activate ${handler}.`);
}

excludes(sharedCore, "function tableNextOverallPreciseValue(row) {", "Table sorting calculations must stay lazy in Table source.");
excludes(sharedCore, "function activeFilterCount() {", "Table filter UI must stay lazy in Table source.");
excludes(sharedCore, "function currentPageRows() {", "Table paging and selection must stay lazy in Table source.");
excludes(sharedCore, "PAGER_CURRENT_PAGE_INPUT_ID", "Editable pager behavior must stay Table-owned.");
includes(tableCore, 'const PAGER_CURRENT_PAGE_INPUT_ID = "pagerCurrentPageInput";', "Table source must own the editable current-page input.");
includes(tableCore, "function cancelPagerCurrentPageEdit(input) {", "Table source must retain Escape cancellation for pager editing.");
includes(tableCore, "function installPagerEscapeCapture() {", "Table source must install its pager Escape owner.");
includes(tableCore, 'target.id !== PAGER_CURRENT_PAGE_INPUT_ID', "Pager Escape handling must remain scoped to the pager input.");
includes(tableCore, "const target = Math.min(total, Math.max(1, parsed));", "Pager input must clamp values to the live range.");
includes(tableCore, "syncPagerCurrentPage(state.page, totalPages);", "Table rendering must synchronize editable pager state.");

for (const required of [
  'selectionContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'flagContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'idContent.className = "tableControlCellContent";',
  'ageContent.className = "tableControlCellContent";',
  'const retirement = retirementMarker(row);',
  'retirement || newMintMarker(row),',
  'retirement ? "retirementMarker" : "newMintMarker",',
]) {
  includes(tableCore, required, `Canonical Table source must own control-cell behavior through ${required}`);
}
excludes(tableCore, 'appendNameMarker(markerWrap, newMintMarker(row), "newMintMarker");', "NEW must not return to the Name-cell marker slot.");
includes(sharedCore, "function formatCellValue(row, column) {", "Cross-route cell formatting must remain shared.");
includes(sharedCore, "function rowByPlayerId(playerId) {", "Cross-route player lookup must remain shared.");

includes(appConfig, 'table: "/modules/app-core-table-runtime.js"', "Canonical app config must map the Table runtime.");
includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must own Table route dependency decisions.");
includes(appConfig, 'core.push("table", "club");', "Club must load Table before Club source.");
includes(appConfig, 'const table = tablePageSet.has(page) && !(page === "database" && view === "stats");', "Database Stats must not load Table.");
includes(appConfig, 'core.push("table", "mflstats");', "MFL Stats must load Table before its route source.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "Route loader must consume canonical core paths.");
includes(routeLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "Route loader must consume canonical dependencies.");
includes(routeLoader, "for (const dependency of dependencies)", "Route dependencies must execute in declared order.");
excludes(routeLoader, "function routeCoreDependencies", "Route loader must not duplicate dependency composition.");
includes(appEntry, "function routeDependencyPlan(pageName, options = {})", "app-entry must retain the canonical route-dependency facade.");
includes(appEntry, "return routeConfig().routeDependencyPlan(pageName, options);", "app-entry must delegate dependency decisions to app config.");
excludes(appEntry, "function routeNeedsTable", "app-entry must not duplicate Table membership decisions.");

includes(sharedCore, "const initialRouteTarget = pageTargetFromPath(window.location.pathname);", "Startup must resolve the initial route canonically.");
includes(sharedCore, "await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});", "Startup must load route dependencies before startApp.");

const tableBanner = String(coreSourceByDomain.table?.banner || "");
invariant(tableBanner && generatedTable.startsWith(tableBanner), "Generated Table runtime must carry the canonical manifest-owned build banner.");
invariant(
  generatedTable.slice(tableBanner.length).replace(/\s*$/, "") === tableCore.replace(/\s*$/, ""),
  "Generated Table runtime must exactly match canonical table.js.",
);

console.log("Source-owned Table facades, editable pager, lazy route behavior, canonical dependency loading, and generated-runtime equivalence validation passed.");
