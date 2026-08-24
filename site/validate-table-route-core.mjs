import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, tableSplitter, buildNormalizerSource, appConfig, routeLoader, buildCore, appEntry] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-table-chunk.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
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
includes(tableSplitter, "insertBeforeRequiredMarker(", "The shared Table facade must use canonical marker insertion.");
includes(tableSplitter, "TABLE_FACADE_INSERTION_MARKER,", "The shared Table facade must still target the stable setPage boundary.");
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
excludes(sharedCore, "PAGER_CURRENT_PAGE_INPUT_ID", "Editable pager behavior must remain lazy in the Table core.");
includes(tableCore, 'const PAGER_CURRENT_PAGE_INPUT_ID = "pagerCurrentPageInput";', "The Table core must own the editable current-page input.");
includes(tableCore, 'controls.input.addEventListener("blur", () => {', "The editable pager must commit when focus leaves the field.");
includes(tableCore, "function cancelPagerCurrentPageEdit(input) {", "The editable pager must retain a dedicated Escape cancel action.");
includes(tableCore, "function installPagerEscapeCapture() {", "The editable pager must install Escape before document-level global handlers.");
includes(tableCore, 'window.addEventListener("keydown", (event) => {', "The editable pager Escape owner must bind at window level.");
includes(tableCore, 'target.id !== PAGER_CURRENT_PAGE_INPUT_ID', "The window Escape owner must be scoped to the editable pager input.");
includes(tableCore, "cancelPagerCurrentPageEdit(target);", "Escape must restore the current pager value without navigating.");
includes(tableCore, 'input.dataset.cancelCommit = "true";', "Escape must suppress any pending blur commit before the pager field loses focus.");
includes(tableCore, "const target = Math.min(total, Math.max(1, parsed));", "Pager input must clamp typed values to the live 1..total page range.");
includes(tableCore, "syncPagerCurrentPage(state.page, totalPages);", "Table rendering must keep the editable pager synchronized with page state.");
for (const required of [
  'selectionContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'flagContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'idContent.className = "tableControlCellContent";',
  'ageContent.className = "tableControlCellContent";',
  'appendNameMarker(ageContent, retirementMarker(row), "retirementMarker");',
]) {
  includes(coreSource, required, `Canonical app-core must own Table control-cell alignment through ${required}`);
  includes(tableCore, required, `Generated Table core must preserve source-owned control-cell alignment through ${required}`);
}
excludes(buildNormalizerSource, "normalizeTableControlCellAlignment", "Build normalization must not rewrite Table control-cell alignment.");
excludes(buildNormalizerSource, "app-core-table-cell-alignment.js", "The obsolete Table control-cell normalizer must stay removed from build composition.");
includes(sharedCore, "function formatCellValue(row, column) {", "Cross-route player/search formatting must remain shared.");
includes(sharedCore, "function rowByPlayerId(playerId) {", "Cross-route player lookup must remain shared.");

includes(appConfig, 'table: "/modules/app-core-table-runtime.js"', "Canonical app config must map the Table chunk.");
includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must own Table route dependency decisions.");
includes(appConfig, 'core.push("table", "club");', "Club must load the Table core before the Club core.");
includes(appConfig, 'const table = tablePageSet.has(page) && !(page === "database" && view === "stats");', "Database Stats must not load the Table core.");
includes(appConfig, 'if (page === "mflstats" || (page === "mfl" && view === "stats")) {', "MFL Stats and its internal alias must share the same canonical Table-first dependency branch.");
includes(appConfig, 'core.push("table", "mflstats");', "MFL Stats must load the shared Table core before its route renderer.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "The route-core loader must consume canonical route-core paths.");
includes(routeLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "The route-core loader must consume canonical Table dependencies.");
includes(routeLoader, "for (const dependency of dependencies)", "Route-core dependencies must execute in declared order.");
excludes(routeLoader, "function routeCoreDependencies", "The route-core loader must not duplicate Table dependency decisions.");

includes(appEntry, "function routeDependencyPlan(pageName, options = {})", "app-entry must retain a stable canonical route dependency facade.");
includes(appEntry, "return routeConfig().routeDependencyPlan(pageName, options);", "app-entry must reuse canonical Table route membership and runtime decisions.");
excludes(appEntry, "function routeNeedsTable", "app-entry must not retain a duplicate Table runtime decision facade.");

includes(coreSource, "const initialRouteTarget = pageTargetFromPath(window.location.pathname);", "Direct startup must resolve the canonical initial route before startApp.");
includes(coreSource, "await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});", "Direct table startup must load canonical route dependencies before startApp.");

includes(buildCore, 'const tableRuntimePath = resolve(siteRoot, "modules/app-core-table-runtime.js");', "The build must emit a generated Table runtime.");
includes(coreSource, 'icon: "calendar-x-2"', "Canonical app-core source must own retired-player marker presentation directly.");
includes(coreSource, 'icon: "calendar-clock"', "Canonical app-core source must own retiring-player marker presentation directly.");
excludes(buildCore, "normalizeRetirementMarkerContract", "The build must not restore retirement-marker preprocessing.");
excludes(buildCore, "normalizeTooltipHeightOwnership", "The build must not restore post-split tooltip rewriting.");
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

console.log("Table route-core splitting, editable pager ownership, and globally placed facade validation passed.");
