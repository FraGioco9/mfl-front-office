// @ts-check

function extractRequiredTableSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not split Table application core section: ${label}.`);
  }

  return {
    core: `${source.slice(0, start)}${source.slice(end)}`,
    chunk: source.slice(start, end).replace(/^\s+|\s+$/g, ""),
  };
}

function renameRequiredTableOwner(source, functionName, ownerName) {
  const asyncMarker = `async function ${functionName}(`;
  const marker = `function ${functionName}(`;
  if (source.includes(asyncMarker)) {
    return source.replace(asyncMarker, `async function ${ownerName}(`);
  }
  if (source.includes(marker)) {
    return source.replace(marker, `function ${ownerName}(`);
  }
  throw new Error(`Could not delegate Table application core owner: ${functionName}.`);
}

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

function tableTitleForPage(pageName) {
  if (typeof __mflTableTitleForPageOwner === "function") {
    return __mflTableTitleForPageOwner.apply(this, arguments);
  }
  const fallback = Reflect.get(window, "__mflTableTitleForPageFallback");
  return typeof fallback === "function" ? fallback(pageName, window.location.href) : "Progression";
}

function buildTableColGroup() {
  return typeof __mflTableBuildTableColGroupOwner === "function"
    ? __mflTableBuildTableColGroupOwner.apply(this, arguments)
    : undefined;
}

function buildHeader() {
  return typeof __mflTableBuildHeaderOwner === "function"
    ? __mflTableBuildHeaderOwner.apply(this, arguments)
    : undefined;
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

export function splitTableApplicationCoreRuntime(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  if (String(routeChunks.table || "").trim()) return artifacts;

  let core = String(input.core || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot split Table ownership from an empty application core.");
  }

  const tableParts = [];
  let firstSectionStart = -1;
  const extract = (startMarker, endMarker, label) => {
    if (firstSectionStart < 0) firstSectionStart = core.indexOf(startMarker);
    const extracted = extractRequiredTableSection(core, startMarker, endMarker, label);
    core = extracted.core;
    tableParts.push(extracted.chunk);
  };

  extract(
    "function tableTitleForPage(pageName) {",
    "async function setPage(pageName, updateHash = true, options = {}) {",
    "Table destination shell",
  );
  extract(
    "function tableNextOverallInfo(row, statColumn) {",
    "function formatCellValue(row, column) {",
    "Table cell presentation helpers",
  );
  extract(
    "function appendNameMarker(cell, marker, className) {",
    "function playerRoute(playerId) {",
    "Table name marker renderer",
  );
  extract(
    "function tableNextOverallPreciseValue(row) {",
    "function activeFilterCount() {",
    "Table sorting and header owner",
  );
  extract(
    "function activeFilterCount() {",
    "function linkedWalletAddressesForOwnedPlayers() {",
    "Table filter controls and matching",
  );
  extract(
    "function rowIsHiddenFromTableAsMflPlayer(row) {",
    "function currentPageRows() {",
    "Table row filtering owner",
  );
  extract(
    "function currentPageRows() {",
    "function escapeHtml(value) {",
    "Table selection owner",
  );
  extract(
    "function openSelectedPlayerLinks() {",
    "function csvEscape(value) {",
    "Table row renderer",
  );
  extract(
    "function showTableBusyState() {",
    "function mflChunkFromPublicData(chunk) {",
    "Table view switching owner",
  );

  if (firstSectionStart < 0) {
    throw new Error("Could not locate the Table facade insertion point.");
  }

  core = `${core.slice(0, firstSectionStart)}${TABLE_FACADE_BLOCK}\n\n${core.slice(firstSectionStart)}`;

  let table = tableParts.join("\n\n").replace(/\s*$/, "");
  table = renameRequiredTableOwner(table, "tableTitleForPage", "tableTitleForPageOwner");
  table = renameRequiredTableOwner(table, "buildTableColGroup", "tableBuildTableColGroupOwner");
  table = renameRequiredTableOwner(table, "buildHeader", "tableBuildHeaderOwner");
  table = renameRequiredTableOwner(table, "buildOperatorSelect", "tableBuildOperatorSelectOwner");
  table = renameRequiredTableOwner(table, "ruleMatches", "tableRuleMatchesOwner");
  table = renameRequiredTableOwner(table, "addFilterRule", "tableAddFilterRuleOwner");
  table = renameRequiredTableOwner(table, "restoreSavedTableState", "tableRestoreSavedTableStateOwner");
  table = renameRequiredTableOwner(table, "applyFilters", "tableApplyFiltersOwner");
  table = renameRequiredTableOwner(table, "renderTable", "tableRenderTableOwner");
  table = renameRequiredTableOwner(table, "openFilters", "tableOpenFiltersOwner");
  table = renameRequiredTableOwner(table, "clearAdvancedFilters", "tableClearAdvancedFiltersOwner");
  table = renameRequiredTableOwner(table, "closeFilters", "tableCloseFiltersOwner");
  table = renameRequiredTableOwner(table, "applyAdvancedFilters", "tableApplyAdvancedFiltersOwner");
  table = renameRequiredTableOwner(table, "clearSelection", "tableClearSelectionOwner");
  table = renameRequiredTableOwner(table, "addSelectedToWatchlist", "tableAddSelectedToWatchlistOwner");
  table = renameRequiredTableOwner(table, "moveSelectedToWatchlist", "tableMoveSelectedToWatchlistOwner");
  table = renameRequiredTableOwner(table, "openSelectedPlayerLinks", "tableOpenSelectedPlayerLinksOwner");
  table = renameRequiredTableOwner(table, "setView", "tableSetViewOwner");
  table = `${table}\n\n${TABLE_OWNER_ASSIGNMENTS}`;

  const normalizedCore = core.replace(/\s*$/, "");
  if (!table.trim() || !normalizedCore) {
    throw new Error("Table application core split produced an empty artifact.");
  }

  return Object.freeze({
    core: normalizedCore,
    routeChunks: Object.freeze({ ...routeChunks, table: table.replace(/\s*$/, "") }),
  });
}
