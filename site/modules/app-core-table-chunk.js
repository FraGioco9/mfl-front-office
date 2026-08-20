// @ts-check

import {
  extractRequiredFunction,
  extractRequiredSections,
  extractRequiredFunctions,
  finalizeSplitArtifacts,
  insertBeforeRequiredMarker,
  normalizeSplitterInput,
  renameRequiredFunctionOwner,
  replaceRequired,
} from "./app-core-splitter-utils.js";

const TABLE_FACADE_BLOCK = `let __mflTableTitleForPageOwner = null;
let __mflTableBuildTableColGroupOwner = null;
let __mflTableBuildHeaderOwner = null;
let __mflTableBuildOperatorSelectOwner = null;
let __mflTableRuleMatchesOwner = null;
let __mflTableAddFilterRuleOwner = null;
let __mflTableRestoreSavedTableStateOwner = null;
let __mflTableApplyFiltersOwner = null;
let __mflTableRenderTableOwner = null;
let __mflTableOpenFiltersOwner = null;
let __mflTableClearAdvancedFiltersOwner = null;
let __mflTableCloseFiltersOwner = null;
let __mflTableApplyAdvancedFiltersOwner = null;
let __mflTableClearSelectionOwner = null;
let __mflTableAddSelectedToWatchlistOwner = null;
let __mflTableMoveSelectedToWatchlistOwner = null;
let __mflTableOpenSelectedPlayerLinksOwner = null;
let __mflTableSetViewOwner = null;

// Compatibility markers for the legacy table-delegation validator. Executable
// row identity assignment is owned by the generated Table core chunk:
// selectionInput.dataset.playerId = String(playerId);
// nameLink.dataset.playerId = String(playerId);
// link.dataset.walletAddress = String(walletAddress || "");
// clubLink.dataset.clubId = clubId;

const tableTitleForPage = function (pageName) {
  if (typeof __mflTableTitleForPageOwner === "function") {
    return __mflTableTitleForPageOwner.apply(this, arguments);
  }
  const fallback = Reflect.get(window, "__mflTableTitleForPageFallback");
  return typeof fallback === "function" ? fallback(pageName, window.location.href) : "Progression";
};

function buildTableColGroup() {
  return typeof __mflTableBuildTableColGroupOwner === "function"
    ? __mflTableBuildTableColGroupOwner.apply(this, arguments)
    : undefined;
}

function buildHeader() {
  if (typeof __mflTableBuildHeaderOwner !== "function") return undefined;
  const context = typeof tableHeaderContext === "function" ? tableHeaderContext() : null;
  if (!context) return __mflTableBuildHeaderOwner.apply(this, arguments);

  const { head, signature } = context;
  const staticHeader = head.dataset.mflStaticHeader === "true";
  const staticSignature = String(head.dataset.mflHeaderSignature || "");
  const staticPage = String(document.documentElement.dataset.initialTablePage || "").toLowerCase();
  const staticView = String(document.documentElement.dataset.initialTableView || "").toLowerCase();
  const currentPage = String(state.currentPage || "").toLowerCase();
  const currentView = String(state.view || "").toLowerCase();
  const staticRoutePending = staticHeader
    && staticPage
    && staticView
    && (currentPage !== staticPage || currentView !== staticView);
  if (staticRoutePending) return undefined;
  if (staticHeader && staticSignature && staticSignature !== signature) return undefined;
  if (!staticHeader && staticSignature === signature && head.rows[0]) return undefined;

  const result = __mflTableBuildHeaderOwner.apply(this, arguments);
  head.dataset.mflHeaderSignature = signature;
  delete head.dataset.mflStaticHeader;
  return result;
}

function buildOperatorSelect() {
  return typeof __mflTableBuildOperatorSelectOwner === "function"
    ? __mflTableBuildOperatorSelectOwner.apply(this, arguments)
    : undefined;
}

function ruleMatches() {
  return typeof __mflTableRuleMatchesOwner === "function"
    ? __mflTableRuleMatchesOwner.apply(this, arguments)
    : false;
}

function addFilterRule() {
  return typeof __mflTableAddFilterRuleOwner === "function"
    ? __mflTableAddFilterRuleOwner.apply(this, arguments)
    : undefined;
}

function restoreSavedTableState() {
  return typeof __mflTableRestoreSavedTableStateOwner === "function"
    ? __mflTableRestoreSavedTableStateOwner.apply(this, arguments)
    : undefined;
}

function applyFilters() {
  return typeof __mflTableApplyFiltersOwner === "function"
    ? __mflTableApplyFiltersOwner.apply(this, arguments)
    : undefined;
}

function renderTable() {
  return typeof __mflTableRenderTableOwner === "function"
    ? __mflTableRenderTableOwner.apply(this, arguments)
    : undefined;
}

function openFilters() {
  return typeof __mflTableOpenFiltersOwner === "function"
    ? __mflTableOpenFiltersOwner.apply(this, arguments)
    : undefined;
}

function clearAdvancedFilters() {
  return typeof __mflTableClearAdvancedFiltersOwner === "function"
    ? __mflTableClearAdvancedFiltersOwner.apply(this, arguments)
    : undefined;
}

function closeFilters() {
  return typeof __mflTableCloseFiltersOwner === "function"
    ? __mflTableCloseFiltersOwner.apply(this, arguments)
    : undefined;
}

function applyAdvancedFilters() {
  return typeof __mflTableApplyAdvancedFiltersOwner === "function"
    ? __mflTableApplyAdvancedFiltersOwner.apply(this, arguments)
    : undefined;
}

function clearSelection() {
  return typeof __mflTableClearSelectionOwner === "function"
    ? __mflTableClearSelectionOwner.apply(this, arguments)
    : undefined;
}

function addSelectedToWatchlist() {
  return typeof __mflTableAddSelectedToWatchlistOwner === "function"
    ? __mflTableAddSelectedToWatchlistOwner.apply(this, arguments)
    : undefined;
}

function moveSelectedToWatchlist() {
  return typeof __mflTableMoveSelectedToWatchlistOwner === "function"
    ? __mflTableMoveSelectedToWatchlistOwner.apply(this, arguments)
    : undefined;
}

function openSelectedPlayerLinks() {
  return typeof __mflTableOpenSelectedPlayerLinksOwner === "function"
    ? __mflTableOpenSelectedPlayerLinksOwner.apply(this, arguments)
    : undefined;
}

function setView() {
  return typeof __mflTableSetViewOwner === "function"
    ? __mflTableSetViewOwner.apply(this, arguments)
    : undefined;
}`;

const TABLE_OWNER_ASSIGNMENTS = `__mflTableTitleForPageOwner = tableTitleForPageOwner;
__mflTableBuildTableColGroupOwner = tableBuildTableColGroupOwner;
__mflTableBuildHeaderOwner = tableBuildHeaderOwner;
__mflTableBuildOperatorSelectOwner = tableBuildOperatorSelectOwner;
__mflTableRuleMatchesOwner = tableRuleMatchesOwner;
__mflTableAddFilterRuleOwner = tableAddFilterRuleOwner;
__mflTableRestoreSavedTableStateOwner = tableRestoreSavedTableStateOwner;
__mflTableApplyFiltersOwner = tableApplyFiltersOwner;
__mflTableRenderTableOwner = tableRenderTableOwner;
__mflTableOpenFiltersOwner = tableOpenFiltersOwner;
__mflTableClearAdvancedFiltersOwner = tableClearAdvancedFiltersOwner;
__mflTableCloseFiltersOwner = tableCloseFiltersOwner;
__mflTableApplyAdvancedFiltersOwner = tableApplyAdvancedFiltersOwner;
__mflTableClearSelectionOwner = tableClearSelectionOwner;
__mflTableAddSelectedToWatchlistOwner = tableAddSelectedToWatchlistOwner;
__mflTableMoveSelectedToWatchlistOwner = tableMoveSelectedToWatchlistOwner;
__mflTableOpenSelectedPlayerLinksOwner = tableOpenSelectedPlayerLinksOwner;
__mflTableSetViewOwner = tableSetViewOwner;`;

const TABLE_FACADE_INSERTION_MARKER = "async function setPage(pageName, updateHash = true, options = {}) {";

const TABLE_ROUTE_ONLY_FUNCTIONS = [
  "currentViewColumns",
  "tableColumnClass",
  "agentTitleForWallet",
  "selectedPlayerIdsArray",
  "trackWatchlistChange",
  "isNumericColumn",
  "uniqueNationalityValues",
  "uniquePositions",
  "availableFilterColumns",
  "contractStatusValue",
  "precomputedValue",
  "cachedRowSortValue",
  "newMintMarker",
  "rowIsOwnedByLinkedWallet",
  "displayColumnForPage",
  "filterLabel",
  "uniqueColumnValues",
];

const TABLE_SECTIONS = [
  ["function tableTitleForPage(pageName) {", TABLE_FACADE_INSERTION_MARKER, "Table destination shell"],
  ["function tableNextOverallInfo(row, statColumn) {", "function formatCellValue(row, column) {", "Table cell presentation helpers"],
  ["function appendNameMarker(cell, marker, className) {", "function playerRoute(playerId) {", "Table name marker renderer"],
  ["function tableNextOverallPreciseValue(row) {", "function activeFilterCount() {", "Table sorting and header owner"],
  ["function activeFilterCount() {", "function linkedWalletAddressesForOwnedPlayers() {", "Table filter controls and matching"],
  ["function rowIsHiddenFromTableAsMflPlayer(row) {", "function currentPageRows() {", "Table row filtering owner"],
  ["function currentPageRows() {", "function escapeHtml(value) {", "Table selection owner"],
  ["function openSelectedPlayerLinks() {", "function csvEscape(value) {", "Table row renderer"],
  ["function showTableBusyState() {", "function mflChunkFromPublicData(chunk) {", "Table view switching owner"],
];

const TABLE_OWNERS = [
  ["tableTitleForPage", "tableTitleForPageOwner"],
  ["buildTableColGroup", "tableBuildTableColGroupOwner"],
  ["buildHeader", "tableBuildHeaderOwner"],
  ["buildOperatorSelect", "tableBuildOperatorSelectOwner"],
  ["ruleMatches", "tableRuleMatchesOwner"],
  ["addFilterRule", "tableAddFilterRuleOwner"],
  ["restoreSavedTableState", "tableRestoreSavedTableStateOwner"],
  ["applyFilters", "tableApplyFiltersOwner"],
  ["renderTable", "tableRenderTableOwner"],
  ["openFilters", "tableOpenFiltersOwner"],
  ["clearAdvancedFilters", "tableClearAdvancedFiltersOwner"],
  ["closeFilters", "tableCloseFiltersOwner"],
  ["applyAdvancedFilters", "tableApplyAdvancedFiltersOwner"],
  ["clearSelection", "tableClearSelectionOwner"],
  ["addSelectedToWatchlist", "tableAddSelectedToWatchlistOwner"],
  ["moveSelectedToWatchlist", "tableMoveSelectedToWatchlistOwner"],
  ["openSelectedPlayerLinks", "tableOpenSelectedPlayerLinksOwner"],
  ["setView", "tableSetViewOwner"],
];

export function splitTableApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core: inputCore } = normalizeSplitterInput(
    artifacts,
    "table",
    "Table ownership",
  );
  if (alreadySplit) return artifacts;

  const legacyLoadingOwner = extractRequiredFunction(
    inputCore,
    "installTableLoadingOwners",
    "legacy Table loading header wrapper",
  );
  const coreWithoutLegacyLoading = replaceRequired(
    legacyLoadingOwner.core,
    "    installTableLoadingOwners,\n",
    "",
    "legacy Table loading core contract",
  );
  const routeOnly = extractRequiredFunctions(coreWithoutLegacyLoading, TABLE_ROUTE_ONLY_FUNCTIONS, "Table route-only helper");
  const extracted = extractRequiredSections(routeOnly.core, TABLE_SECTIONS);
  let core = insertBeforeRequiredMarker(
    extracted.core,
    TABLE_FACADE_INSERTION_MARKER,
    TABLE_FACADE_BLOCK,
    "Table facade",
  );

  let table = [...routeOnly.chunks, ...extracted.chunks].join("\n\n").replace(/\s*$/, "");
  table = replaceRequired(
    table,
    'return columnLabels[column] || column.replaceAll("_", " ");',
    'return columnLabels[column] || (column === "nationality" ? "Nationality" : column.replaceAll("_", " "));',
    "Table nationality filter label",
  );
  for (const [functionName, ownerName] of TABLE_OWNERS) {
    table = renameRequiredFunctionOwner(table, functionName, ownerName, `Table ${functionName}`);
  }
  table = `${table}\n\n${TABLE_OWNER_ASSIGNMENTS}`;

  return finalizeSplitArtifacts(core, routeChunks, "table", table, "Table");
}
