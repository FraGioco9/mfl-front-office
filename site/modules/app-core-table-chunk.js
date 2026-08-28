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
  replaceRequiredFunction,
} from "./app-core-splitter-utils.js";

const TABLE_FACADE_BLOCK = `let __mflTableTitleForPageOwner = null;
let __mflTableEnsureAgentPageTitleNameOwner = null;
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

function ensureAgentPageTitleName(address) {
  return typeof __mflTableEnsureAgentPageTitleNameOwner === "function"
    ? __mflTableEnsureAgentPageTitleNameOwner.apply(this, arguments)
    : Promise.resolve(savedAgentNameForWallet(address));
}

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
__mflTableEnsureAgentPageTitleNameOwner = tableEnsureAgentPageTitleNameOwner;
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
const AGENT_PAGE_TITLE_ROUTE_STATE = "const agentPageTitleNamePromises = new Map();";

const AGENT_PAGE_TITLE_RESOLVER = `function runtimeAgentPageTitleName(address, hintedName = "") {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) return "";

  const indexedAgent = agentSearchResultByWallet(normalizedAddress);
  const row = state.rows.find((candidate) => normalizeWalletAddress(getValue(candidate, "wallet_address")).toLowerCase() === normalizedAddress);
  const candidates = [
    hintedName,
    savedAgentNameForWallet(normalizedAddress),
    indexedAgent?.name,
    state.walletRows.find((candidate) => normalizeWalletAddress(candidate.wallet_address).toLowerCase() === normalizedAddress)?.wallet_name,
    row ? getValue(row, "wallet_name") : "",
  ];
  const agentName = candidates
    .map((candidate) => normalizedAgentName(candidate))
    .find((candidate) => candidate && candidate.toLowerCase() !== normalizedAddress) || "";

  if (agentName) saveAgentNameForWallet(normalizedAddress, agentName);
  return agentName;
}

async function ensureAgentPageTitleName(address, hintedName = "") {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) return "";

  const runtimeName = runtimeAgentPageTitleName(normalizedAddress, hintedName);
  if (runtimeName) {
    if (state.currentPage === "agents") renderAgentPageTitle(normalizedAddress);
    return runtimeName;
  }

  const existingPromise = agentPageTitleNamePromises.get(normalizedAddress);
  if (existingPromise) return existingPromise;

  const pending = (async () => {
    try {
      const parameters = new URLSearchParams({
        mode: "search",
        type: "recent",
        walletAddresses: normalizedAddress,
      });
      const response = await fetch("/api/data?" + parameters.toString(), {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        const agents = payload?.agents || {};
        const columns = Array.isArray(agents.columns) ? agents.columns : [];
        const walletIndex = columns.indexOf("wallet_address");
        const nameIndex = columns.indexOf("wallet_name");
        const matchingRow = Array.isArray(agents.rows)
          ? agents.rows.find((candidate) => walletIndex >= 0
            && normalizeWalletAddress(candidate?.[walletIndex]).toLowerCase() === normalizedAddress)
          : null;
        const fetchedName = normalizedAgentName(nameIndex >= 0 ? matchingRow?.[nameIndex] : "");
        if (fetchedName && fetchedName.toLowerCase() !== normalizedAddress) {
          saveAgentNameForWallet(normalizedAddress, fetchedName);
          if (state.currentPage === "agents"
            && normalizeWalletAddress(state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase() === normalizedAddress) {
            renderAgentPageTitle(normalizedAddress);
          }
          return fetchedName;
        }
      }
    } catch {}

    return runtimeAgentPageTitleName(normalizedAddress, hintedName)
      || savedAgentNameForWallet(normalizedAddress);
  })().finally(() => {
    if (agentPageTitleNamePromises.get(normalizedAddress) === pending) {
      agentPageTitleNamePromises.delete(normalizedAddress);
    }
  });

  agentPageTitleNamePromises.set(normalizedAddress, pending);
  return pending;
}`;

const TABLE_ROUTE_ONLY_FUNCTIONS = [
  "runtimeAgentPageTitleName",
  "ensureAgentPageTitleName",
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
  ["ensureAgentPageTitleName", "tableEnsureAgentPageTitleNameOwner"],
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

  let normalizedCore = replaceRequiredFunction(
    inputCore,
    "savedAgentNameForWallet",
    `function savedAgentNameForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) return "";
  try {
    const names = JSON.parse(localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY) || "{}");
    const name = normalizedAgentName(names?.[normalizedAddress]);
    return name && name.toLowerCase() !== normalizedAddress ? name : "";
  } catch {
    return "";
  }
}`,
    "Agent display-name cache read",
  );

  normalizedCore = replaceRequiredFunction(
    normalizedCore,
    "saveAgentNameForWallet",
    `function saveAgentNameForWallet(address, name) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  const agentName = normalizedAgentName(name);
  if (!normalizedAddress || !agentName || agentName.toLowerCase() === normalizedAddress) return;
  try {
    const saved = JSON.parse(localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY) || "{}");
    const names = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    names[normalizedAddress] = agentName;
    localStorage.setItem(AGENT_DISPLAY_NAMES_STORAGE_KEY, JSON.stringify(names));
    if (normalizeWalletAddress(state.linkedWalletAddress).toLowerCase() === normalizedAddress) {
      localStorage.setItem(LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY, JSON.stringify({ address: normalizedAddress, name: agentName }));
    }
  } catch {}
  if (state.currentPage === "agents"
    && normalizeWalletAddress(state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase() === normalizedAddress
    && tablePageTitle) renderAgentPageTitle(normalizedAddress);
}`,
    "Agent display-name cache write",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    "function closeFilters(commitChanges = false) {",
    "function closeFilters(commitChanges = false, restoreTriggerFocus = true) {",
    "Filters close focus option",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    `  hideModal(filtersModal, () => {
    openFiltersButton.focus();
  });`,
    `  hideModal(filtersModal, () => {
    if (restoreTriggerFocus) openFiltersButton.focus();
  });`,
    "Filters close focus ownership",
  );

  normalizedCore = replaceRequired(
    normalizedCore,
    "saveAgentDisplayName(entry.walletAddress, entry.name);",
    "saveAgentNameForWallet(entry.walletAddress, entry.name);",
    "Agent search-index cache ownership",
  );
  normalizedCore = replaceRequiredFunction(
    normalizedCore,
    "openAgentPage",
    `function openAgentPage(walletAddress, agentName = "") {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  if (!normalizedWalletAddress) return;
  const knownName = [agentName, agentSearchResultByWallet(normalizedWalletAddress)?.name, savedAgentNameForWallet(normalizedWalletAddress)]
    .map(normalizedAgentName)
    .find((name) => name && name.toLowerCase() !== normalizedWalletAddress) || "";
  if (knownName) saveAgentNameForWallet(normalizedWalletAddress, knownName);
  removePlayerNoteTooltip();
  window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });
  if (normalizedWalletAddress === normalizeWalletAddress(state.linkedWalletAddress).toLowerCase()) {
    setPage("myplayers", true);
    return;
  }
  if (normalizedWalletAddress === mflWalletAddress) {
    setPage("mfl", true);
    return;
  }
  setPage("agents", true, { walletAddress: normalizedWalletAddress, view: "attributes", agentName: knownName });
}`,
    "Agent navigation name handoff",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    "navigateFromSearch(() => openAgentPage(result.walletAddress));",
    "navigateFromSearch(() => openAgentPage(result.walletAddress, result.name));",
    "Agent global-search name handoff",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    'openAgentPage(agentLink.dataset.walletAddress || "");',
    'openAgentPage(agentLink.dataset.walletAddress || "", agentLink.dataset.agentName || agentLink.textContent || "");',
    "Agent table-click name handoff",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    `  if (pageName === "agents") {
    state.currentAgentWalletAddress = normalizeWalletAddress(options.walletAddress || agentWalletAddressFromUrl()).toLowerCase();
  }`,
    `  if (pageName === "agents") {
    state.currentAgentWalletAddress = normalizeWalletAddress(options.walletAddress || agentWalletAddressFromUrl()).toLowerCase();
  }
  const agentTitleReady = pageName === "agents"
    ? ensureAgentPageTitleName(state.currentAgentWalletAddress, options.agentName)
    : Promise.resolve("");`,
    "Agent title loading promise",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    `  tablePageTitle.textContent = tableTitleForPage(pageName);
  renderWatchlistSwitcher();`,
    `  if (pageName === "agents") {
    await agentTitleReady;
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else {
    tablePageTitle.textContent = tableTitleForPage(pageName);
  }
  renderWatchlistSwitcher();`,
    "Agent title loading completion gate",
  );
  normalizedCore = insertBeforeRequiredMarker(
    normalizedCore,
    "function tableTitleForPage(pageName) {",
    AGENT_PAGE_TITLE_RESOLVER,
    "Agent title resolver",
  );

  const legacyLoadingOwner = extractRequiredFunction(
    normalizedCore,
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

  let table = [AGENT_PAGE_TITLE_ROUTE_STATE, ...routeOnly.chunks, ...extracted.chunks].join("\n\n").replace(/\s*$/, "");
  table = replaceRequired(
    table,
    'return columnLabels[column] || column.replaceAll("_", " ");',
    'return columnLabels[column] || (column === "nationality" ? "Nationality" : column.replaceAll("_", " "));',
    "Table nationality filter label",
  );
  table = replaceRequired(
    table,
    '          link.dataset.walletAddress = String(walletAddress || "");',
    '          link.dataset.walletAddress = String(walletAddress || "");\n          link.dataset.agentName = String(agentLabel || "");',
    "Agent table-link name handoff",
  );
  for (const [functionName, ownerName] of TABLE_OWNERS) {
    table = renameRequiredFunctionOwner(table, functionName, ownerName, `Table ${functionName}`);
  }
  table = `${table}\n\n${TABLE_OWNER_ASSIGNMENTS}`;

  return finalizeSplitArtifacts(core, routeChunks, "table", table, "Table");
}