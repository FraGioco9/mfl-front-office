import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

import { coreSourceByDomain } from "./modules/core-source-manifest.js";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [sharedCore, tableCore, generatedTable, appConfig, routeLoader, buildCore, appEntry] = await Promise.all([
  Promise.resolve(readCanonicalCoreSource("shared")),
  Promise.resolve(readCanonicalCoreSource("table")),
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
    && coreSourceByDomain.table?.sources?.length === 3
    && coreSourceByDomain.table.sources[0] === "table.js"
    && coreSourceByDomain.table.sources[1] === "table-render-lifecycle.js"
    && coreSourceByDomain.table.sources[2] === "table-interaction-bindings.js"
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

// Public Table facades keep stable identities; incremental behavior dispatches behind them instead of replacing those functions.
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
  const facadeMarker = facade === "applyFilters" ? "function applyFilters(options = {}) {" : `function ${facade}() {`;
  includes(sharedCore, facadeMarker, `Shared core must retain the ${facade} facade.`);
  includes(tableCore, `${ownerSlot} = ${chunkOwner};`, `Canonical Table source must activate ${facade}.`);
}

const lazyTableHandlers = [
  ["openFilters", "__mflTableOpenFiltersOwner", "tableOpenFiltersOwner", 'openFiltersButton.addEventListener("click", openFilters);'],
  ["clearAdvancedFilters", "__mflTableClearAdvancedFiltersOwner", "tableClearAdvancedFiltersOwner", 'quickClearFiltersButton.addEventListener("click", clearAdvancedFilters);'],
  ["closeFilters", "__mflTableCloseFiltersOwner", "tableCloseFiltersOwner", 'closeFiltersButton.addEventListener("click", closeFilters);'],
  ["applyAdvancedFilters", "__mflTableApplyAdvancedFiltersOwner", "tableApplyAdvancedFiltersOwner", 'applyFiltersButton.addEventListener("click", applyAdvancedFilters);'],
  ["clearSelection", "__mflTableClearSelectionOwner", "tableClearSelectionOwner", 'clearSelectionButton.addEventListener("click", clearSelection);'],
  ["addSelectedToWatchlist", "__mflTableAddSelectedToWatchlistOwner", "tableAddSelectedToWatchlistOwner", 'addToWatchlistButton.addEventListener("click", addSelectedToWatchlist);'],
  ["moveSelectedToWatchlist", "__mflTableMoveSelectedToWatchlistOwner", "tableMoveSelectedToWatchlistOwner", 'moveToWatchlistButton?.addEventListener("click", moveSelectedToWatchlist);'],
  ["openSelectedPlayerLinks", "__mflTableOpenSelectedPlayerLinksOwner", "tableOpenSelectedPlayerLinksOwner", 'openSelectedLinksButton.addEventListener("click", openSelectedPlayerLinks);'],
];
for (const [handler, ownerSlot, chunkOwner, binding] of lazyTableHandlers) {
  includes(sharedCore, `let ${ownerSlot} = null;`, `Shared core must keep a stable owner slot for ${handler}.`);
  includes(sharedCore, `function ${handler}() {`, `Shared core must retain the ${handler} facade for cross-route/global dispatch.`);
  excludes(sharedCore, binding, `Table-only DOM binding must not remain in universal Shared ownership: ${handler}.`);
  includes(tableCore, `function ${chunkOwner}(`, `Canonical Table source must own ${handler}.`);
  includes(tableCore, `${ownerSlot} = ${chunkOwner};`, `Canonical Table source must activate ${handler}.`);
  includes(tableCore, binding, `Canonical Table source must install the ${handler} DOM binding when its lazy runtime loads.`);
}

const tableControlBindings = [
  'pageSizeSelect.addEventListener("change", () => {',
  'hideRetiredInput.addEventListener("change", () => {',
  'hideRetiringInput.addEventListener("change", () => {',
  'hideMflPlayersInput?.addEventListener("change", () => {',
  'packablePlayersInput?.addEventListener("change", () => {',
  'newMintsInput.addEventListener("change", () => {',
  'showAddFilterButton.addEventListener("click", () => {',
  'addFilterSelect.addEventListener("change", () => {',
  'setupBackdropClickClose(filtersModal, () => closeFilters());',
  'clearFiltersButton.addEventListener("click", () => {',
  'prevButton.addEventListener("click", () => {',
  'nextButton.addEventListener("click", () => {',
];
for (const binding of tableControlBindings) {
  excludes(sharedCore, binding, `Table page/filter/pager binding must not remain in universal Shared ownership: ${binding}`);
  includes(tableCore, binding, `Canonical Table source must own page/filter/pager binding: ${binding}`);
}

const delegatedTableBodyInteractions = [
  "function copyDelegatedPlayerId(button, event) {",
  'tableBody?.addEventListener("pointerdown", (event) => {',
  'tableBody?.addEventListener("click", (event) => {',
  'tableBody?.addEventListener("pointermove", (event) => {',
  'tableBody?.addEventListener("pointerleave", () => {',
];
for (const owner of delegatedTableBodyInteractions) {
  excludes(sharedCore, owner, `Delegated Table-body interaction must not remain in universal Shared ownership: ${owner}`);
  includes(tableCore, owner, `Canonical Table source must own delegated Table-body interaction: ${owner}`);
}
excludes(sharedCore, "Compatibility markers for the legacy table-delegation validator", "Legacy comment-only Table delegation ownership must stay removed from Shared.");
includes(sharedCore, 'window.addEventListener("scroll", () => hidePlayerNoteTooltip({ immediate: true }), true);', "Cross-route tooltip scroll cleanup must remain shared.");
includes(sharedCore, 'window.addEventListener("resize", () => hidePlayerNoteTooltip({ immediate: true }));', "Cross-route tooltip resize cleanup must remain shared.");

for (const typedControl of [
  'const addFilterSelect = /** @type {HTMLSelectElement} */ (document.querySelector("#addFilterSelect"));',
  'const hideRetiredInput = /** @type {HTMLInputElement} */ (document.querySelector("#hideRetiredInput"));',
  'const hideRetiringInput = /** @type {HTMLInputElement} */ (document.querySelector("#hideRetiringInput"));',
  'const hideMflPlayersInput = /** @type {HTMLInputElement} */ (document.querySelector("#hideMflPlayersInput"));',
  'const packablePlayersInput = /** @type {HTMLInputElement} */ (document.querySelector("#packablePlayersInput"));',
  'const newMintsInput = /** @type {HTMLInputElement} */ (document.querySelector("#newMintsInput"));',
  'const pageSizeSelect = /** @type {HTMLSelectElement} */ (document.querySelector("#pageSizeSelect"));',
]) {
  includes(sharedCore, typedControl, `Shared DOM registry must preserve concrete Table control typing: ${typedControl}`);
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

for (const optimizedRenderContract of [
  'const compactTableLayout = window.matchMedia("(max-width: 900px)").matches;',
  'const compactJoinedAgencyLayout = window.matchMedia("(max-width: 520px)").matches;',
  'const renderColumns = currentViewColumns().map((column) => ({',
  'for (const row of pageRows) {',
  'for (const { column, className } of renderColumns) {',
  'const playerIdText = String(playerId);',
  'const playerName = formatCellValue(row, "name");',
  'const statColumnSet = new Set(statColumns);',
]) {
  includes(tableCore, optimizedRenderContract, `Table rendering must hoist row-invariant work through ${optimizedRenderContract}`);
}
excludes(tableCore, "currentViewColumns().forEach((column) => {", "Table rendering must not recompute mapped view columns once per row.");
excludes(tableCore, 'nameLink.textContent = window.matchMedia("(max-width: 900px)").matches', "Table rendering must not repeat the 900px media query inside each Name cell.");
excludes(tableCore, 'cell.textContent = window.matchMedia("(max-width: 520px)").matches', "Table rendering must not repeat the 520px media query inside each Joined Agency cell.");

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
  "Generated Table runtime must exactly match the manifest-assembled canonical Table source.",
);

console.log("Source-owned Table facades, lazy Table-only handlers, page/filter/pager controls, delegated Table-body interactions, typed control references, editable pager, canonical dependency loading, and generated-runtime equivalence validation passed.");
