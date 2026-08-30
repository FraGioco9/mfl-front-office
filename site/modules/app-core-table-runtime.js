// Generated Table core chunk from modules/app-core.js. Do not edit directly.
const agentPageTitleNamePromises = new Map();

function runtimeAgentPageTitleName(address, hintedName = "") {
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

async function tableEnsureAgentPageTitleNameOwner(address, hintedName = "") {
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
}

function currentViewColumns(pageName = state.currentPage, viewName = state.view) {
  return (views[viewName]?.columns || []).map((column) => displayColumnForPage(column, pageName));
}

function tableColumnClass(column) {
  if (column === "overall") {
    return "col-stat col-overall";
  }

  return statColumns.includes(column) ? "col-stat" : tableColumnClasses[column] || "";
}

function agentTitleForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) {
    return "";
  }

  const agentName = savedAgentNameForWallet(normalizedAddress)
    || normalizedAgentName(state.walletRows.find((row) => normalizeWalletAddress(row.wallet_address).toLowerCase() === normalizedAddress)?.wallet_name)
    || normalizedAgentName(state.rows.find((row) => normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase() === normalizedAddress)?.wallet_name);

  return agentName ? `${agentName} - ${normalizedAddress}` : normalizedAddress;
}

function selectedPlayerIdsArray() {
  return Array.from(state.selectedPlayerIds).map((playerId) => String(playerId));
}

function trackWatchlistChange(playerId, added) {
  const key = String(playerId);

  if (added) {
    state.watchlistPlayerIdsAdded.add(key);
    state.watchlistPlayerIdsRemoved.delete(key);
  } else {
    state.watchlistPlayerIdsRemoved.add(key);
    state.watchlistPlayerIdsAdded.delete(key);
  }
  syncActiveWatchlistFromSet();
}

function isNumericColumn(column) {
  return numberColumns.has(column) || column.endsWith("_all") || column.endsWith("_current_season");
}

function uniqueNationalityValues() {
  return uniqueColumnValues("nationality")
    .map((value) => ({ value, label: formatNationality(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function uniquePositions() {
  return POSITION_ORDER;
}

function availableFilterColumns(pageName = tablePageKey() || state.currentPage || "progression", viewName = state.view) {
  const normalizedView = normalizeViewForPage(viewName, pageName);
  const columns = (pageName === "mfl" || pageName === "agents")
    ? baseFilterColumns.filter((column) => column !== agentColumn && (pageName !== "mfl" || column !== contractStatusFilterColumn))
    : [...baseFilterColumns];

  if (normalizedView === "current") {
    columns.push(...statColumns.map((column) => `${column}_prog_current_season`));
  } else if (normalizedView === "all") {
    columns.push(...statColumns.map((column) => `${column}_prog_all`));
  }

  return columns;
}

function contractStatusValue(row) {
  const clubName = getValue(row, "active_contract_club_name");
  if (isDevelopmentCenterClubName(clubName)) {
    return "development_center";
  }

  return rowHasActiveContract(row) ? "under_contract" : "free_agent";
}

function precomputedValue(row, column) {
  return hasColumn(column) ? getValue(row, column) : null;
}

function cachedRowSortValue(row, key, compute) {
  let cache = state.rowSortCache.get(row);

  if (!cache) {
    cache = {};
    state.rowSortCache.set(row, cache);
  }

  if (Object.prototype.hasOwnProperty.call(cache, key)) {
    return cache[key];
  }

  const value = compute();
  cache[key] = value;
  return value;
}

function newMintMarker(row) {
  if (getValue(row, "player_seasons") !== 1) {
    return null;
  }

  return {
    svg: "newPlayer",
    label: "New mint",
  };
}

function rowIsOwnedByLinkedWallet(row) {
  const walletAddress = normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase();
  return Boolean(walletAddress && linkedWalletAddressesForOwnedPlayers().has(walletAddress));
}

function displayColumnForPage(column, pageName = state.currentPage) {
  return column === agentColumn && joinedAgencyPages().has(pageName) ? joinedAgencyColumn : column;
}

function filterLabel(column) {
  if (column.endsWith("_prog_current_season")) {
    return `${filterLabel(column.replace("_prog_current_season", ""))} Progression`;
  }

  if (column.endsWith("_prog_all")) {
    return `${filterLabel(column.replace("_prog_all", ""))} Progression`;
  }

  return columnLabels[column] || (column === "nationality" ? "Nationality" : column.replaceAll("_", " "));
}

function uniqueColumnValues(column) {
  const values = new Set();
  if (state.incrementalMode && column === "nationality" && state.searchIndex.length) {
    state.searchIndex.forEach((entry) => {
      if (entry.nationalityRaw) {
        values.add(String(entry.nationalityRaw));
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  const columnIndex = state.columns.indexOf(column);

  if (columnIndex < 0) {
    return [];
  }

  state.rows.forEach((row) => {
    const value = row[columnIndex];

    if (value !== null && value !== undefined && value !== "") {
      values.add(String(value));
    }
  });

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function tableTitleForPageOwner(pageName) {
  if (pageName === "watchlist" || /^\/watchlist(?:\/|$)/i.test(window.location.pathname)) {
    return `Watchlist - ${currentWatchlistName()}`;
  }

  if (pageName === "myplayers") {
    return "My Players";
  }

  if (pageName === "database") {
    return "Database";
  }

  if (pageName === "mfl" || pageName === "mflstats") {
    return "MFL Wallet";
  }

  if (pageName === "agents") {
    const walletAddress = normalizeWalletAddress(state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase();
    return agentTitleForWallet(walletAddress);
  }

  return "Progression";
}

function renderTableLoadingShell(pageName) {
  state.currentPage = pageName;
  const tablePage = tablePages.has(pageName);

  if (!tablePage) {
    return;
  }

  const clubPage = pageName === "club";
  if (clubPage) {
    state.pendingTableControlRestore = null;
    filterRules.replaceChildren();
    hideRetiredInput.checked = false;
    hideRetiringInput.checked = false;
    if (hideMflPlayersInput) hideMflPlayersInput.checked = false;
    if (packablePlayersInput) packablePlayersInput.checked = false;
    newMintsInput.checked = false;
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = true;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      pager.hidden = true;
    });
  } else {
    restoreSavedTableState(pageName);
    globalThis.syncQuickFilterLabels?.();
    syncRestoredTableControls(pageName);
  }

  updateViewButtons();
  buildHeader();
  if (pageName === "agents") {
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else if (pageName !== "club") {
    tablePageTitle.textContent = tableTitleForPage(pageName);
  }
  emptyState.hidden = true;
  emptyState.textContent = "";
  tableBody.replaceChildren();
  window.__mflTableLoadingRuntime?.show?.();
}

function tableNextOverallInfo(row, statColumn) {
  const precomputedGap = precomputedValue(row, "next_overall_gap");
  const gap = precomputedGap === null || precomputedGap === undefined ? nextOverallGap(row) : Number(precomputedGap);
  const maxOverall = Number(statDisplayValue(row, "overall") || 0) >= 99;

  if (statColumn === "overall") {
    return maxOverall
      ? { text: "MAX", className: "neutral" }
      : { text: `+${formatDecimal(gap)}`, className: "easy" };
  }

  const primary = playerPositions(row)[0];
  const weight = POSITION_GROUP_WEIGHTS[primary]?.[statColumn] || 0;

  if (!weight) {
    return null;
  }

  const precomputedColumn = `${statColumn}_to_next_overall`;
  const precomputedNeeded = precomputedValue(row, precomputedColumn);

  if (precomputedNeeded !== null && precomputedNeeded !== undefined && precomputedNeeded !== "") {
    const neededStatGain = Number(precomputedNeeded);
    return {
      text: `+${formatRoundedUpDecimal(neededStatGain, 1)}`,
      className: nextOverallColorClass(neededStatGain),
    };
  }

  if (maxOverall || Number(getValue(row, statColumn) || 0) >= 99) {
    return { text: "MAX", className: "neutral" };
  }

  if (hasColumn(precomputedColumn)) {
    return null;
  }

  const neededStatGain = gap / (weight / 100);
  return {
    text: `+${formatRoundedUpDecimal(neededStatGain, 1)}`,
    className: nextOverallColorClass(neededStatGain),
  };
}

function appendNextOverallTableValue(cell, row, statColumn) {
  const precomputedOverall = precomputedValue(row, "next_overall");
  const value = statColumn === "overall"
    ? (precomputedOverall === null || precomputedOverall === undefined ? primaryPreciseOverall(row) : precomputedOverall)
    : getValue(row, statColumn);

  if (value === null || value === undefined || value === "") {
    cell.textContent = "NULL";
    return;
  }

  const displayValue = statColumn === "overall" ? formatDecimal(value) : String(value);
  cell.append(displayValue);
  const nextOverall = tableNextOverallInfo(row, statColumn);

  if (!nextOverall) {
    return;
  }

  const element = document.createElement("span");
  const overallClass = statColumn === "overall" ? " tableNextOverallValueOverall" : "";
  element.className = `nextOverallValue tableNextOverallValue${overallClass} ${nextOverall.className}`;
  element.textContent = ` (${nextOverall.text})`;
  cell.appendChild(element);
}

function appendStatValue(cell, row, statColumn) {
  const value = getValue(row, statColumn);
  const progressionColumn = getProgressionColumn(statColumn);

  if (state.view === "next") {
    appendNextOverallTableValue(cell, row, statColumn);
    return;
  }

  if (value === null || value === undefined || value === "") {
    cell.textContent = "NULL";
    return;
  }

  const contentHost = statColumn === "overall" ? document.createElement("span") : cell;

  if (statColumn === "overall") {
    contentHost.className = "tableOverallCellContent";
    const rarityCircle = document.createElement("span");
    rarityCircle.className = "tableOverallRarityCircle";
    rarityCircle.style.setProperty("--mfl-overall-rarity-color", rarityColorForOverall(value));
    rarityCircle.setAttribute("aria-hidden", "true");
    contentHost.appendChild(rarityCircle);
    cell.appendChild(contentHost);
  }

  contentHost.append(String(value));

  if (!progressionColumn) {
    return;
  }

  const progression = Number(getValue(row, progressionColumn) || 0);

  if (progression === 0) {
    return;
  }

  const progressionElement = document.createElement("span");
  progressionElement.className = progression > 0 ? "progressionValue positive" : "progressionValue negative";
  progressionElement.textContent = `${statColumn === "overall" ? "\u00A0" : " "}(${progression > 0 ? "+" : ""}${progression})`;
  contentHost.appendChild(progressionElement);
}

function tableInteractiveKey(type, id) {
  const key = String(id || "").trim();
  return key ? `${type}:${key}` : "";
}

function markTableInteractiveHover(element, type, id) {
  const key = tableInteractiveKey(type, id);
  if (!element || !key) {
    return;
  }
  element.dataset.tableInteractiveKey = key;
  if (state.hoveredTableInteractiveKey === key) {
    element.classList.add("tableInteractiveHovered");
  }
}
function createCopyPlayerIdButton(playerId, label = String(playerId)) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copyPlayerIdButton";
  button.textContent = label;
  button.dataset.playerId = String(playerId);
  button.dataset.tooltip = "Click to copy";
  button.setAttribute("aria-label", "Click to copy");
  markTableInteractiveHover(button, "id", playerId);
  return button;
}

function appendNameMarker(cell, marker, className) {
  if (!marker) {
    return;
  }

  const markerElement = document.createElement("span");
  markerElement.className = `${className} retirementMarker--${marker.status || "default"}`;
  if (marker.icon) {
    const markerIcon = document.createElement("img");
    markerIcon.src = `/retirement-${marker.icon}.svg`;
    markerIcon.width = 16;
    markerIcon.height = 16;
    markerIcon.alt = "";
    markerIcon.setAttribute("aria-hidden", "true");
    markerElement.appendChild(markerIcon);
  } else if (marker.svg === "newPlayer") {
    const markerIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    markerIcon.classList.add("newMintIcon");
    markerIcon.setAttribute("viewBox", "0 0 24 24");
    markerIcon.setAttribute("aria-hidden", "true");
    markerIcon.innerHTML = '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"></path><path d="M5 3v4"></path><path d="M3 5h4"></path>';
    markerElement.appendChild(markerIcon);
  } else {
    markerElement.textContent = marker.emoji;
  }
  markerElement.dataset.tooltip = marker.label;
  markerElement.setAttribute("aria-label", marker.label);
  cell.appendChild(markerElement);
}

function tableNextOverallPreciseValue(row) {
  return cachedRowSortValue(row, "next_overall_precise", () => {
    const precomputedOverall = precomputedValue(row, "next_overall");
    return precomputedOverall === null || precomputedOverall === undefined ? primaryPreciseOverall(row) : Number(precomputedOverall);
  });
}

function tableNextOverallNeededValue(row, statColumn) {
  return cachedRowSortValue(row, `next_overall_needed:${statColumn}`, () => {
    const maxOverall = Number(statDisplayValue(row, "overall") || 0) >= 99;

    if (maxOverall) {
      return null;
    }

    if (statColumn === "overall") {
      const precomputedGap = precomputedValue(row, "next_overall_gap");
      return precomputedGap === null || precomputedGap === undefined ? nextOverallGap(row) : Number(precomputedGap);
    }

    const precomputedColumn = `${statColumn}_to_next_overall`;
    const precomputedNeeded = precomputedValue(row, precomputedColumn);

    if (precomputedNeeded !== null && precomputedNeeded !== undefined && precomputedNeeded !== "") {
      return Number(precomputedNeeded);
    }

    if (hasColumn(precomputedColumn)) {
      return null;
    }

    const primary = playerPositions(row)[0];
    const weight = POSITION_GROUP_WEIGHTS[primary]?.[statColumn] || 0;

    if (!weight || Number(getValue(row, statColumn) || 0) >= 99) {
      return null;
    }

    return nextOverallGap(row) / (weight / 100);
  });
}

function tableNextOverallSortValue(row, statColumn) {
  return tableNextOverallNeededValue(row, statColumn);
}

function compareNextOverallRows(a, b, column, direction) {
  const aNeeded = tableNextOverallSortValue(a, column);
  const bNeeded = tableNextOverallSortValue(b, column);
  const primaryComparison = comparePrimitiveValues(aNeeded, bNeeded, -direction, true);

  if (primaryComparison !== 0) {
    return primaryComparison;
  }

  const aCurrent = column === "overall" ? tableNextOverallPreciseValue(a) : getValue(a, column);
  const bCurrent = column === "overall" ? tableNextOverallPreciseValue(b) : getValue(b, column);
  return comparePrimitiveValues(aCurrent, bCurrent, direction, true);
}

function sortableValue(row, column) {
  if (column === "active_contract_club_division") {
    const divisionRank = contractDivisionSortValue(getValue(row, column));
    return divisionRank === null ? null : -divisionRank;
  }

  if (state.view === "next" && statColumns.includes(column)) {
    return tableNextOverallSortValue(row, column);
  }

  if (state.currentPage === "progression" && (state.view === "current" || state.view === "all") && statColumns.includes(column)) {
    return [
      getValue(row, getProgressionColumn(column)),
      getValue(row, column),
    ];
  }

  return getValue(row, column);
}


let playerTableActionMenu = null;
let playerTableActionTrigger = null;
let playerTableActionPlayerId = "";
let playerTableActionRenderSignature = "";
let playerTableActionWindowOuterWidth = 0;
let playerTableActionWindowOuterHeight = 0;
let playerTableActionScrollLeft = 0;
let playerTableActionScrollTop = 0;

const PLAYER_TABLE_ACTION_ICONS = Object.freeze({
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25"></circle><path d="M5.5 19c.7-4 3-6 6.5-6s5.8 2 6.5 6"></path></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"></path><path d="M19 5l-8 8"></path><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path></svg>',
  evaluate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"></path><path d="M17 7.5c-.8-1.4-2.4-2.2-5-2.2-3 0-5 1.3-5 3.4 0 2.4 2.4 3.1 5 3.4 3 .4 5 1.1 5 3.4 0 2.1-2 3.4-5 3.4-2.7 0-4.4-.9-5.3-2.5"></path></svg>',
  watchlist: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.7l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.72 6.9 19.4l.98-5.68L3.65 9.7l5.8-.83L12 3.7z"></path></svg>',
  watchlistFilled: '<svg data-filled="true" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.7l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.72 6.9 19.4l.98-5.68L3.65 9.7l5.8-.83L12 3.7z"></path></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="10" height="10" rx="1.5"></rect><path d="M15 8V6.5A1.5 1.5 0 0 0 13.5 5h-7A1.5 1.5 0 0 0 5 6.5v7A1.5 1.5 0 0 0 6.5 15H8"></path></svg>',
});


function currentPlayerTableActionRenderSignature(playerId = playerTableActionPlayerId) {
  const key = String(playerId || "").trim();
  if (!key || !tablePageKey()) return "";
  const rowIds = currentPageRows().map((row) => String(getValue(row, "player_id") || ""));
  return JSON.stringify({
    route: `${window.location.pathname}${window.location.search}`,
    pageName: state.currentPage,
    viewName: state.view,
    page: state.page,
    pageSize: state.pageSize,
    sortKey: state.sortKey,
    sortDirection: state.sortDirection,
    playerId: key,
    rowIds,
  });
}

function capturePlayerTableActionGeometry() {
  playerTableActionWindowOuterWidth = Number(window.outerWidth || 0);
  playerTableActionWindowOuterHeight = Number(window.outerHeight || 0);
  const scroller = document.querySelector("#progressionPage .playerTableScroller");
  playerTableActionScrollLeft = scroller instanceof HTMLElement ? scroller.scrollLeft : 0;
  playerTableActionScrollTop = scroller instanceof HTMLElement ? scroller.scrollTop : 0;
}

function restorePlayerTableActionMenuAfterRender(renderSignature) {
  if (!renderSignature
    || !(playerTableActionMenu instanceof HTMLElement)
    || playerTableActionMenu.dataset.open !== "true"
    || renderSignature !== currentPlayerTableActionRenderSignature()) {
    if (playerTableActionMenu?.dataset.open === "true") closePlayerTableActionMenu();
    return false;
  }

  const key = String(playerTableActionPlayerId || "").trim();
  const trigger = Array.from(tableBody.querySelectorAll(".playerTableActionsButton"))
    .find((button) => button instanceof HTMLButtonElement && String(button.dataset.playerId || "") === key);
  if (!(trigger instanceof HTMLButtonElement)) {
    closePlayerTableActionMenu();
    return false;
  }

  if (playerTableActionTrigger instanceof HTMLButtonElement && playerTableActionTrigger !== trigger) {
    playerTableActionTrigger.setAttribute("aria-expanded", "false");
  }
  playerTableActionTrigger = trigger;
  playerTableActionTrigger.setAttribute("aria-expanded", "true");
  playerTableActionRenderSignature = currentPlayerTableActionRenderSignature(key);
  capturePlayerTableActionGeometry();
  positionPlayerTableActionMenu();
  return true;
}

function handlePlayerTableActionWindowResize() {
  if (!(playerTableActionMenu instanceof HTMLElement) || playerTableActionMenu.dataset.open !== "true") return;
  const nextOuterWidth = Number(window.outerWidth || 0);
  const nextOuterHeight = Number(window.outerHeight || 0);
  const realWindowResize = Boolean(
    (playerTableActionWindowOuterWidth && nextOuterWidth !== playerTableActionWindowOuterWidth)
    || (playerTableActionWindowOuterHeight && nextOuterHeight !== playerTableActionWindowOuterHeight)
  );
  if (realWindowResize) {
    closePlayerTableActionMenu();
    return;
  }
  positionPlayerTableActionMenu();
}

function handlePlayerTableActionScrollerScroll(scroller) {
  if (!(playerTableActionMenu instanceof HTMLElement) || playerTableActionMenu.dataset.open !== "true") return;
  if (!(scroller instanceof HTMLElement)) return;
  if (scroller.scrollLeft !== playerTableActionScrollLeft || scroller.scrollTop !== playerTableActionScrollTop) {
    closePlayerTableActionMenu();
    return;
  }
  positionPlayerTableActionMenu();
}

function closePlayerTableActionMenu({ restoreFocus = false } = {}) {
  if (!(playerTableActionMenu instanceof HTMLElement)) return false;
  playerTableActionMenu.dataset.open = "false";
  if (playerTableActionTrigger instanceof HTMLButtonElement) {
    playerTableActionTrigger.setAttribute("aria-expanded", "false");
    if (restoreFocus && playerTableActionTrigger.isConnected) playerTableActionTrigger.focus({ preventScroll: true });
  }
  playerTableActionTrigger = null;
  playerTableActionPlayerId = "";
  playerTableActionRenderSignature = "";
  playerTableActionWindowOuterWidth = 0;
  playerTableActionWindowOuterHeight = 0;
  playerTableActionScrollLeft = 0;
  playerTableActionScrollTop = 0;
  return true;
}

function positionPlayerTableActionMenu() {
  if (!(playerTableActionMenu instanceof HTMLElement)
    || !(playerTableActionTrigger instanceof HTMLButtonElement)
    || !playerTableActionTrigger.isConnected) return false;
  const triggerRect = playerTableActionTrigger.getBoundingClientRect();
  const menuRect = playerTableActionMenu.getBoundingClientRect();
  const edgeGap = 8;
  const menuGap = 6;
  let left = triggerRect.left;
  left = Math.max(edgeGap, Math.min(left, window.innerWidth - menuRect.width - edgeGap));
  let top = triggerRect.bottom + menuGap;
  if (top + menuRect.height > window.innerHeight - edgeGap) {
    top = Math.max(edgeGap, triggerRect.top - menuRect.height - menuGap);
  }
  playerTableActionMenu.style.left = `${Math.round(left)}px`;
  playerTableActionMenu.style.top = `${Math.round(top)}px`;
  return true;
}

function createPlayerTableActionItem(action, label, iconKey) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "playerTableActionItem";
  button.dataset.mflDropdownOption = "true";
  button.dataset.playerTableAction = action;
  button.setAttribute("role", "menuitem");
  button.innerHTML = `<span class="playerTableActionIcon">${PLAYER_TABLE_ACTION_ICONS[iconKey]}</span><span>${label}</span>`;
  return button;
}

function ensurePlayerTableActionMenu() {
  if (playerTableActionMenu instanceof HTMLElement && playerTableActionMenu.isConnected) return playerTableActionMenu;
  const menu = document.createElement("div");
  menu.className = "playerTableActionMenu";
  menu.dataset.mflDropdownMenu = "true";
  menu.dataset.open = "false";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Player actions");
  document.body.appendChild(menu);
  playerTableActionMenu = menu;

  menu.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const item = event.target.closest("[data-player-table-action]");
    if (!(item instanceof HTMLButtonElement)) return;
    const playerId = String(playerTableActionPlayerId || "").trim();
    if (!playerId) return;
    const action = String(item.dataset.playerTableAction || "");
    closePlayerTableActionMenu();
    if (action === "profile") {
      rememberSearchResult(playerId);
      void setPage("player", true, { playerId });
      return;
    }
    if (action === "mfl") {
      window.open(`https://app.playmfl.com/players/${encodeURIComponent(playerId)}`, "_blank", "noopener");
      return;
    }
    if (action === "evaluate") {
      const playerRow = state.rows.find((row) => String(getValue(row, "player_id")) === playerId);
      const playerName = playerRow ? formatCellValue(playerRow, "name") : "";
      rememberEvaluationResult(playerId);
      state.evaluationPlayerId = playerId;
      if (playerName) {
        evaluationSearchInput.value = playerName;
        try {
          sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${playerId}`, playerName);
        } catch {
          // Session storage is an optional first-paint cache only.
        }
      }
      clearEvaluationSearchFocus();
      void setPage("evaluation", true, { playerId });
      return;
    }
    if (action === "watchlist") {
      toggleWatchlistPlayer(playerId, true);
      return;
    }
    if (action === "copy") copyPlayerId(playerId);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!(playerTableActionMenu instanceof HTMLElement) || playerTableActionMenu.dataset.open !== "true") return;
    if (!(event.target instanceof Node)) return;
    if (playerTableActionMenu.contains(event.target) || playerTableActionTrigger?.contains(event.target)) return;
    closePlayerTableActionMenu();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || playerTableActionMenu?.dataset.open !== "true") return;
    event.preventDefault();
    closePlayerTableActionMenu({ restoreFocus: true });
  }, true);
  window.addEventListener("resize", handlePlayerTableActionWindowResize);
  const tableScroller = document.querySelector("#progressionPage .playerTableScroller");
  tableScroller?.addEventListener("scroll", () => handlePlayerTableActionScrollerScroll(tableScroller), { passive: true });
  return menu;
}

function openPlayerTableActionMenu(trigger, playerId) {
  const menu = ensurePlayerTableActionMenu();
  const key = String(playerId || "").trim();
  if (!(trigger instanceof HTMLButtonElement) || !key) return false;
  if (playerTableActionTrigger === trigger && menu.dataset.open === "true") {
    closePlayerTableActionMenu({ restoreFocus: true });
    return false;
  }
  closePlayerTableActionMenu();
  playerTableActionTrigger = trigger;
  playerTableActionPlayerId = key;
  playerTableActionRenderSignature = currentPlayerTableActionRenderSignature(key);
  capturePlayerTableActionGeometry();
  trigger.setAttribute("aria-expanded", "true");
  const items = [
    createPlayerTableActionItem("profile", "Player profile", "profile"),
    createPlayerTableActionItem("mfl", "MFL profile", "external"),
    createPlayerTableActionItem("evaluate", "Evaluate", "evaluate"),
  ];
  if (hasWalletOptIn()) {
    const watchlistIsActive = playerIsInAnyWatchlist(key);
    const watchlistLabel = watchlistIsActive ? "Remove from watchlist" : "Add to watchlist";
    items.push(createPlayerTableActionItem("watchlist", watchlistLabel, watchlistIsActive ? "watchlistFilled" : "watchlist"));
  }
  items.push(createPlayerTableActionItem("copy", `#${key}`, "copy"));
  menu.replaceChildren(...items);
  menu.dataset.open = "false";
  positionPlayerTableActionMenu();
  void menu.offsetWidth;
  requestAnimationFrame(() => {
    if (playerTableActionTrigger !== trigger || !trigger.isConnected) return;
    menu.dataset.open = "true";
    positionPlayerTableActionMenu();
  });
  return true;
}

function createPlayerTableActionsButton(playerId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "playerTableActionsButton";
  button.dataset.playerId = String(playerId);
  button.setAttribute("aria-label", `Actions for player ${playerId}`);
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.25"></circle><circle cx="12" cy="12" r="1.25"></circle><circle cx="19" cy="12" r="1.25"></circle></svg>';
  button.addEventListener("pointerdown", (event) => event.stopPropagation());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPlayerTableActionMenu(button, playerId);
  });
  return button;
}

function tableBuildTableColGroupOwner() {
  const targetClasses = [
    "col-select",
    "col-actions",
    ...currentViewColumns().map((column) => tableColumnClass(column)),
  ];
  const existingCols = Array.from(tableColGroup.children);
  const alreadyCanonical = existingCols.length === targetClasses.length
    && existingCols.every((col, index) => col.className === targetClasses[index]);
  if (alreadyCanonical) return;

  const fragment = document.createDocumentFragment();
  targetClasses.forEach((columnClass) => {
    const col = document.createElement("col");
    if (columnClass) col.classList.add(...columnClass.split(" "));
    fragment.appendChild(col);
  });

  tableColGroup.replaceChildren(fragment);
}
function tableBuildHeaderOwner() {
  buildTableColGroup();
  const headerRow = document.createElement("tr");
  const selectionHeader = document.createElement("th");
  const selectVisibleInput = document.createElement("input");

  selectionHeader.className = "selectionCell";
  selectVisibleInput.id = "selectVisiblePlayersInput";
  selectVisibleInput.type = "checkbox";
  selectVisibleInput.disabled = true;
  selectVisibleInput.setAttribute("aria-label", "Select visible players");

  selectVisibleInput.addEventListener("change", () => setVisiblePlayersSelected(selectVisibleInput.checked));
  selectionHeader.appendChild(selectVisibleInput);
  headerRow.appendChild(selectionHeader);

  const actionsHeader = document.createElement("th");
  actionsHeader.className = "rowActionsCell";
  actionsHeader.setAttribute("aria-label", "Player actions");
  headerRow.appendChild(actionsHeader);

  const mobileTable = window.matchMedia("(max-width: 900px)").matches;
  const compactTableHeadings = window.matchMedia("(max-width: 520px)").matches;

  currentViewColumns().forEach((column) => {
    const cell = document.createElement("th");
    const columnClass = tableColumnClass(column);
    if (columnClass) {
      cell.classList.add(...columnClass.split(" "));
    }
    const clubPositionSort = state.currentPage === "club" && column === "positions";
    const isSorted = state.currentPage !== "club" && state.sortKey === column;
    const label = document.createElement("span");
    cell.dataset.tableColumn = column;
    const fullLabel = columnLabels[column] || "";
    const compactLabel = ({
      overall: "OVR",
      pace: "PAC",
      shooting: "SHO",
      passing: "PAS",
      dribbling: "DRI",
      defense: "DEF",
      physical: "PHY",
      goalkeeping: "GK",
      player_seasons: "SZN",
    }[column] || fullLabel);
    label.dataset.mflFullTableLabel = fullLabel;
    label.dataset.mflCompactTableLabel = compactLabel;
    label.textContent = !mobileTable
      ? (column === agentColumn && state.currentPage === "mfl" ? "" : fullLabel)
      : column === "listing_price" || (column === agentColumn && state.currentPage === "mfl")
        ? ""
        : column === "positions"
          ? "POSITIONS"
          : compactTableHeadings
            ? compactLabel
            : fullLabel;
    if (column === "listing_price") cell.setAttribute("aria-label", "Listing");
    cell.appendChild(label);

    if (clubPositionSort) {
      const arrow = document.createElement("span");
      arrow.className = "sortArrow asc";
      arrow.setAttribute("aria-hidden", "true");
      cell.appendChild(arrow);
    }

    if (state.currentPage !== "club" && sortableColumns.has(column)) {
      cell.classList.add("sortable");

      if (isSorted) {
        const arrow = document.createElement("span");
        arrow.className = `sortArrow ${state.sortDirection}`;
        arrow.setAttribute("aria-hidden", "true");
        cell.appendChild(arrow);
      }

      cell.addEventListener("click", () => {
        const defaultDirection = numberColumns.has(column) ? "desc" : "asc";
        const resetDirection = "desc";
        const reverseDirection = defaultDirection === "desc" ? "asc" : "desc";

        if (state.sortKey !== column) {
          state.sortKey = column;
          state.sortDirection = defaultDirection;
        } else if (state.sortDirection === defaultDirection) {
          state.sortDirection = reverseDirection;
        } else if (column === "overall") {
          state.sortDirection = defaultDirection;
        } else {
          state.sortKey = "overall";
          state.sortDirection = resetDirection;
        }

        rememberTableSortState();
        state.page = 1;
        buildHeader();
        applyFilters();
      });
    }

    headerRow.appendChild(cell);
  });

  tableHead.replaceChildren(headerRow);
}

function isMissingSortValue(value) {
  return value === null || value === undefined || value === "" || String(value).toUpperCase() === "NULL";
}

function comparePrimitiveValues(aValue, bValue, direction, numeric = false) {
  const aMissing = isMissingSortValue(aValue);
  const bMissing = isMissingSortValue(bValue);

  if (aMissing || bMissing) {
    if (aMissing && bMissing) {
      return 0;
    }

    return aMissing ? 1 : -1;
  }

  if (numeric) {
    return ((Number(aValue) - Number(bValue)) || 0) * direction;
  }

  return String(aValue).localeCompare(String(bValue)) * direction;
}

function compareRows(a, b) {
  const direction = state.sortDirection === "asc" ? 1 : -1;

  if (state.view === "next" && statColumns.includes(state.sortKey)) {
    return compareNextOverallRows(a, b, state.sortKey, direction);
  }

  const aValue = sortableValue(a, state.sortKey);
  const bValue = sortableValue(b, state.sortKey);

  if (Array.isArray(aValue) && Array.isArray(bValue)) {
    for (let index = 0; index < aValue.length; index += 1) {
      const comparison = comparePrimitiveValues(aValue[index], bValue[index], direction, true);

      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  }

  if (numberColumns.has(state.sortKey)) {
    return comparePrimitiveValues(aValue, bValue, direction, true);
  }

  return comparePrimitiveValues(aValue, bValue, direction, false);
}

function activeFilterCount() {
  let count = 0;

  for (const rule of filterRules.querySelectorAll(".filterRule")) {
    const operator = rule.querySelector("[data-filter-operator]").value;
    const values = readRuleValues(rule);

    if (((operator === "between" || operator === "during") && values.value && values.valueTo) || (operator !== "between" && operator !== "during" && values.value)) {
      count += 1;
    }
  }

  return count;
}

function activeFilterCountFromSavedRules(rules = []) {
  return rules.filter((rule) => {
    const operator = String(rule?.operator || "");
    const value = String(rule?.value || "").trim();
    const valueTo = String(rule?.valueTo || "").trim();
    return operator === "between" || operator === "during"
      ? Boolean(value && valueTo)
      : Boolean(value);
  }).length;
}

function updateFilterSummary(count = activeFilterCount()) {
  const numericCount = Number(count);
  const normalizedCount = Number.isFinite(numericCount) ? Math.max(0, Math.trunc(numericCount)) : 0;
  const active = normalizedCount >= 1;
  filterSummary.textContent = String(normalizedCount);
  filterSummary.classList.toggle("hasActiveFilters", active);
  openFiltersButton?.classList.toggle("hasActiveFilters", active);
}

function selectedFilterColumns(exceptRule = null) {
  return new Set(Array.from(filterRules.querySelectorAll(".filterRule"))
    .filter((rule) => rule !== exceptRule)
    .map((rule) => rule.dataset.filterColumn));
}

function populateAddFilterSelect(pageName = tablePageKey() || state.currentPage || "progression") {
  const selectedColumns = selectedFilterColumns();
  const fragment = document.createDocumentFragment();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Add filter...";
  fragment.appendChild(placeholder);

  availableFilterColumns(pageName)
    .filter((column) => !selectedColumns.has(column))
    .forEach((column) => {
      const option = document.createElement("option");
      option.value = column;
      option.textContent = filterLabel(column);
      fragment.appendChild(option);
    });

  addFilterSelect.replaceChildren(fragment);
}

function tableBuildOperatorSelectOwner(column) {
  const select = document.createElement("select");
  select.dataset.filterOperator = "true";
  let operators;

  if (column === "positions") {
    operators = [
      ["primary_is", "primary is"],
      ["can_play", "can play"],
    ];
  } else if (column === joinedAgencyColumn) {
    operators = [
      ["after", "after"],
      ["before", "before"],
      ["during", "during"],
    ];
  } else if (column === contractStatusFilterColumn || column === "listing_price") {
    operators = [["=", "is"]];
    select.hidden = true;
  } else if (column === "nationality") {
    operators = [["=", "is"]];
    select.hidden = true;
  } else if (column === "name" || column === "wallet_name") {
    operators = [["contains", "contains"]];
    select.hidden = true;
  } else if (isNumericColumn(column)) {
    operators = [
      [">=", "at least"],
      ["<=", "at most"],
      ["between", "is between"],
      ["=", "is"],
    ];
  } else {
    operators = [["contains", "contains"]];
    select.hidden = true;
  }

  operators.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });

  return select;
}

function buildNumberInput(value = "", placeholder = "Value") {
  const input = document.createElement("input");
  input.type = "number";
  input.placeholder = placeholder;
  input.dataset.filterValue = "true";
  input.value = value;
  return input;
}

/** @type {{ input: HTMLInputElement, field: HTMLElement, popup: HTMLElement, viewYear: number, viewMonth: number } | null} */
let activeSiteDatePicker = null;

function parseSiteDateInputValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const candidate = new Date(year, month, day, 12);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month || candidate.getDate() !== day) {
    return null;
  }
  return candidate;
}

function siteDatePickerIsoValue(date) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function closeSiteDatePicker() {
  if (!activeSiteDatePicker) return;
  activeSiteDatePicker.popup.remove();
  activeSiteDatePicker = null;
  document.removeEventListener("pointerdown", handleSiteDatePickerPointerDown);
  document.removeEventListener("keydown", handleSiteDatePickerKeyDown);
  window.removeEventListener("resize", positionSiteDatePicker);
  window.removeEventListener("scroll", positionSiteDatePicker, true);
}

/** @param {PointerEvent} event */
function handleSiteDatePickerPointerDown(event) {
  if (!activeSiteDatePicker || !(event.target instanceof Node)) return;
  if (activeSiteDatePicker.popup.contains(event.target) || activeSiteDatePicker.field.contains(event.target)) return;
  closeSiteDatePicker();
}

/** @param {KeyboardEvent} event */
function handleSiteDatePickerKeyDown(event) {
  if (event.key !== "Escape" || !activeSiteDatePicker) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const input = activeSiteDatePicker.input;
  closeSiteDatePicker();
  input.blur();
}

function positionSiteDatePicker() {
  if (!activeSiteDatePicker) return;
  const { field, popup } = activeSiteDatePicker;
  const rect = field.getBoundingClientRect();
  const gap = 6;
  const viewportPadding = 8;
  const popupWidth = popup.offsetWidth;
  const popupHeight = popup.offsetHeight;
  const maxLeft = Math.max(viewportPadding, window.innerWidth - popupWidth - viewportPadding);
  const left = Math.min(Math.max(rect.right - popupWidth, viewportPadding), maxLeft);
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
  const canFitAbove = rect.top - gap - popupHeight >= viewportPadding;
  const top = spaceBelow < popupHeight && canFitAbove
    ? rect.top - popupHeight - gap
    : rect.bottom + gap;
  popup.style.left = `${Math.round(left)}px`;
  popup.style.top = `${Math.round(Math.max(viewportPadding, top))}px`;
}

function renderSiteDatePicker() {
  if (!activeSiteDatePicker) return;
  const { input, popup } = activeSiteDatePicker;
  const selectedDate = parseSiteDateInputValue(input.value);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  popup.replaceChildren();

  const header = document.createElement("div");
  header.className = "siteDatePickerHeader";

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "siteDatePickerNav";
  previous.setAttribute("aria-label", "Previous month");
  previous.textContent = "‹";
  previous.addEventListener("click", () => {
    if (!activeSiteDatePicker) return;
    const next = new Date(activeSiteDatePicker.viewYear, activeSiteDatePicker.viewMonth - 1, 1, 12);
    activeSiteDatePicker.viewYear = next.getFullYear();
    activeSiteDatePicker.viewMonth = next.getMonth();
    renderSiteDatePicker();
  });

  const title = document.createElement("div");
  title.className = "siteDatePickerTitle";
  title.textContent = new Date(activeSiteDatePicker.viewYear, activeSiteDatePicker.viewMonth, 1, 12)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "siteDatePickerNav";
  next.setAttribute("aria-label", "Next month");
  next.textContent = "›";
  next.addEventListener("click", () => {
    if (!activeSiteDatePicker) return;
    const following = new Date(activeSiteDatePicker.viewYear, activeSiteDatePicker.viewMonth + 1, 1, 12);
    activeSiteDatePicker.viewYear = following.getFullYear();
    activeSiteDatePicker.viewMonth = following.getMonth();
    renderSiteDatePicker();
  });

  header.append(previous, title, next);
  popup.appendChild(header);

  const weekdays = document.createElement("div");
  weekdays.className = "siteDatePickerWeekdays";
  for (const label of ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]) {
    const item = document.createElement("span");
    item.textContent = label;
    weekdays.appendChild(item);
  }
  popup.appendChild(weekdays);

  const grid = document.createElement("div");
  grid.className = "siteDatePickerGrid";
  const firstOfMonth = new Date(activeSiteDatePicker.viewYear, activeSiteDatePicker.viewMonth, 1, 12);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(activeSiteDatePicker.viewYear, activeSiteDatePicker.viewMonth, 1 - mondayOffset, 12);
  const selectedIso = selectedDate ? siteDatePickerIsoValue(selectedDate) : "";
  const todayIso = siteDatePickerIsoValue(today);

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index, 12);
    const iso = siteDatePickerIsoValue(date);
    const day = document.createElement("button");
    day.type = "button";
    day.className = "siteDatePickerDay";
    day.textContent = String(date.getDate());
    day.dataset.date = iso;
    if (date.getMonth() !== activeSiteDatePicker.viewMonth) day.classList.add("is-outside");
    if (iso === selectedIso) day.classList.add("is-selected");
    if (iso === todayIso) day.classList.add("is-today");
    day.addEventListener("click", () => {
      input.value = iso;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closeSiteDatePicker();
      input.blur();
    });
    grid.appendChild(day);
  }
  popup.appendChild(grid);

  const footer = document.createElement("div");
  footer.className = "siteDatePickerFooter";
  const todayButton = document.createElement("button");
  todayButton.type = "button";
  todayButton.className = "siteDatePickerToday";
  todayButton.textContent = "Today";
  todayButton.addEventListener("click", () => {
    input.value = todayIso;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    closeSiteDatePicker();
    input.blur();
  });
  footer.appendChild(todayButton);
  popup.appendChild(footer);
  requestAnimationFrame(positionSiteDatePicker);
}

function openSiteDatePicker(input, field) {
  if (activeSiteDatePicker?.input === input) {
    closeSiteDatePicker();
    return;
  }
  closeSiteDatePicker();
  const selected = parseSiteDateInputValue(input.value) || new Date();
  const popup = document.createElement("div");
  popup.className = "siteDatePicker";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Choose date");
  document.body.appendChild(popup);
  activeSiteDatePicker = {
    input,
    field,
    popup,
    viewYear: selected.getFullYear(),
    viewMonth: selected.getMonth(),
  };
  renderSiteDatePicker();
  document.addEventListener("pointerdown", handleSiteDatePickerPointerDown);
  document.addEventListener("keydown", handleSiteDatePickerKeyDown);
  window.addEventListener("resize", positionSiteDatePicker);
  window.addEventListener("scroll", positionSiteDatePicker, true);
}

function buildDateInput(value = "") {
  const field = document.createElement("div");
  field.className = "siteDateField";
  field.dataset.siteDateField = "true";

  const input = document.createElement("input");
  input.type = "date";
  input.className = "dateValue";
  input.dataset.filterValue = "true";
  input.value = value;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "siteDatePickerButton";
  button.setAttribute("aria-label", "Open calendar");
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v3M17 2v3M3.5 9h17M5.5 4h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openSiteDatePicker(input, field);
  });

  field.append(input, button);
  return field;
}

function buildValueControl(column, savedValue = "", savedValueTo = "", operator = "") {
  if (column === joinedAgencyColumn && operator === "during") {
    const group = document.createElement("div");
    group.className = "betweenValue dateRangeValue";
    group.dataset.filterValueGroup = "true";
    group.appendChild(buildDateInput(savedValue));
    group.appendChild(buildDateInput(savedValueTo));
    return group;
  }

  if (isNumericColumn(column) && operator === "between") {
    const group = document.createElement("div");
    group.className = "betweenValue";
    group.dataset.filterValueGroup = "true";
    group.appendChild(buildNumberInput(savedValue, "From"));
    group.appendChild(buildNumberInput(savedValueTo, "To"));
    return group;
  }

  if (column === joinedAgencyColumn) {
    return buildDateInput(savedValue);
  }

  if (column === "nationality" || column === "positions" || column === contractStatusFilterColumn || column === "listing_price") {
    const select = document.createElement("select");
    select.dataset.filterValue = "true";
    const values = column === "nationality"
      ? uniqueNationalityValues()
      : column === contractStatusFilterColumn
        ? contractStatusOptions
        : column === "listing_price"
          ? listingFilterOptions
          : uniquePositions();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select...";
    select.appendChild(placeholder);

    values.forEach((item) => {
      const value = typeof item === "string" ? item : item.value;
      const label = typeof item === "string" ? item : item.label;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === savedValue;
      select.appendChild(option);
    });

    return select;
  }

  const input = document.createElement("input");
  input.type = isNumericColumn(column) ? "number" : "search";
  input.placeholder = isNumericColumn(column) ? "Value" : "Text";
  input.dataset.filterValue = "true";
  input.value = savedValue;
  return input;
}

function buildColumnSelect(selectedColumn, currentRule = null) {
  const select = document.createElement("select");
  select.dataset.filterColumnSelect = "true";
  const selectedColumns = selectedFilterColumns(currentRule);

  availableFilterColumns().filter((column) => column === selectedColumn || !selectedColumns.has(column)).forEach((column) => {
    const option = document.createElement("option");
    option.value = column;
    option.textContent = filterLabel(column);
    option.selected = column === selectedColumn;
    select.appendChild(option);
  });

  return select;
}

function replaceOperatorSelect(rule, column) {
  const oldOperator = rule.querySelector("[data-filter-operator]");
  const newOperator = buildOperatorSelect(column);
  newOperator.addEventListener("change", () => {
    const values = readRuleValues(rule);
    replaceValueControl(rule, column, values.value, values.valueTo);
  });
  oldOperator.replaceWith(newOperator);
}

function valueControlElement(rule) {
  return rule.querySelector("[data-filter-value-group]")
    || rule.querySelector("[data-site-date-field]")
    || rule.querySelector("[data-filter-value]");
}

function replaceValueControl(rule, column, savedValue = "", savedValueTo = "") {
  const oldValue = valueControlElement(rule);
  const operator = rule.querySelector("[data-filter-operator]").value;
  const newValue = buildValueControl(column, savedValue, savedValueTo, operator);
  oldValue.replaceWith(newValue);
}

function tableAddFilterRuleOwner(column, options = {}) {
  const rule = document.createElement("div");
  rule.className = "filterRule";
  rule.dataset.filterColumn = column;

  const connector = document.createElement("select");
  connector.dataset.filterConnector = "true";
  connector.innerHTML = '<option value="and">And</option><option value="or">Or</option>';
  connector.className = "connectorSelect";
  connector.value = options.connector || "and";

  const columnSelect = buildColumnSelect(column, rule);
  columnSelect.addEventListener("change", () => {
    const nextColumn = columnSelect.value;
    if (selectedFilterColumns(rule).has(nextColumn)) {
      refreshRuleColumnSelects();
      populateAddFilterSelect();
      return;
    }
    rule.dataset.filterColumn = nextColumn;
    replaceOperatorSelect(rule, nextColumn);
    replaceValueControl(rule, nextColumn);
    populateAddFilterSelect();
    refreshRuleColumnSelects();
  });

  const operator = buildOperatorSelect(column);
  if (options.operator) {
    operator.value = options.operator;
  }
  operator.addEventListener("change", () => {
    const values = readRuleValues(rule);
    replaceValueControl(rule, column, values.value, values.valueTo);
  });

  const value = buildValueControl(column, options.value || "", options.valueTo || "", operator.value);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "iconButton popupCloseButton";
  remove.setAttribute("aria-label", `Remove ${filterLabel(column)} filter`);
  remove.addEventListener("click", () => {
    rule.remove();
    refreshRuleConnectors();
    populateAddFilterSelect();
    refreshRuleColumnSelects();
  });

  rule.appendChild(connector);
  rule.appendChild(columnSelect);
  rule.appendChild(operator);
  rule.appendChild(value);
  rule.appendChild(remove);
  filterRules.appendChild(rule);
  refreshRuleConnectors();
  populateAddFilterSelect();
  refreshRuleColumnSelects();

  if (options.focus !== false) {
    (value.querySelector("[data-filter-value]") || value).focus();
  }
}

function refreshRuleConnectors() {
  const rules = Array.from(filterRules.querySelectorAll(".filterRule"));

  rules.forEach((rule, index) => {
    const connector = rule.querySelector("[data-filter-connector]");
    connector.disabled = index === 0;
    connector.style.visibility = index === 0 ? "hidden" : "visible";
  });
}

function removeUnavailableFilterRules(pageName = tablePageKey() || state.currentPage || "progression") {
  const allowedColumns = new Set(availableFilterColumns(pageName));

  for (const rule of filterRules.querySelectorAll(".filterRule")) {
    if (!allowedColumns.has(rule.dataset.filterColumn)) {
      rule.remove();
    }
  }

  refreshRuleConnectors();
}

function refreshRuleColumnSelects(pageName = tablePageKey() || state.currentPage || "progression") {
  for (const rule of filterRules.querySelectorAll(".filterRule")) {
    const oldSelect = rule.querySelector("[data-filter-column-select]");
    const newSelect = buildColumnSelect(rule.dataset.filterColumn, rule);

    newSelect.addEventListener("change", () => {
      const nextColumn = newSelect.value;
      if (selectedFilterColumns(rule).has(nextColumn)) {
        refreshRuleColumnSelects(pageName);
        populateAddFilterSelect(pageName);
        return;
      }
      rule.dataset.filterColumn = nextColumn;
      replaceOperatorSelect(rule, nextColumn);
      replaceValueControl(rule, nextColumn);
      populateAddFilterSelect(pageName);
      refreshRuleColumnSelects(pageName);
    });

    oldSelect.replaceWith(newSelect);
  }
}

function normalizedSavedTableControlState(pageName, savedState) {
  const newMints = Boolean(savedState.newMints);
  const mflPackable = pageName === "mfl"
    ? (newMints ? false : (savedState.mflPackable !== undefined ? Boolean(savedState.mflPackable) : true))
    : false;

  return {
    pageName,
    hideRetired: savedState.hideRetired !== false,
    hideRetiring: Boolean(savedState.hideRetiring),
    hideMflPlayers: pageName === "database"
      ? (savedState.hideMflPlayers !== undefined ? Boolean(savedState.hideMflPlayers) : true)
      : false,
    mflPackable,
    newMints,
    rules: Array.isArray(savedState.rules)
      ? savedState.rules.map((rule) => ({ ...rule }))
      : [],
  };
}

function tableStateWithoutPageFilters(pageName, savedState) {
  const defaults = defaultTablePageState(pageName);
  return {
    ...savedState,
    hideRetired: defaults.hideRetired,
    hideRetiring: defaults.hideRetiring,
    hideMflPlayers: defaults.hideMflPlayers,
    mflPackable: defaults.mflPackable,
    newMints: defaults.newMints,
    rules: [],
    selectedPlayerIds: [],
  };
}

function tableRestoreSavedTableStateOwner(pageName = tablePageKey() || "progression", options = {}) {
  if (pageName === "club") {
    state.view = normalizeViewForPage(options.view || state.view || "attributes", pageName);
    state.page = 1;
    state.selectedPlayerIds = new Set();
    state.pendingTableControlRestore = null;
    return;
  }

  const storedState = state.tablePageStates?.[pageName]
    || defaultTablePageState(pageName);
  const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;
  const savedState = resetFilters ? tableStateWithoutPageFilters(pageName, storedState) : storedState;
  if (resetFilters) state.tablePageStates[pageName] = savedState;

  state.view = normalizeViewForPage(options.view || savedState.view, pageName);

  if (Number(savedState.pageSize)) {
    state.pageSize = Number(savedState.pageSize);
  }

  const viewSortState = tableSortStateForView(
  state.view,
  pageName,
  { sortKey: state.sortKey, sortDirection: state.sortDirection },
);
state.sortKey = viewSortState.sortKey;
state.sortDirection = viewSortState.sortDirection;
  state.selectedPlayerIds = new Set((savedState.selectedPlayerIds || []).map((playerId) => String(playerId)));
  state.pendingTableControlRestore = normalizedSavedTableControlState(pageName, savedState);
}

function syncRestoredTableControls(pageName = tablePageKey() || "progression") {
  if (pageName === "club") {
    state.pendingTableControlRestore = null;
    return false;
  }

  const restored = state.pendingTableControlRestore;
  if (!restored || restored.pageName !== pageName) return false;

  pageSizeSelect.value = String(state.pageSize);
  hideRetiredInput.checked = restored.hideRetired;
  hideRetiringInput.checked = restored.hideRetiring;
  if (hideMflPlayersInput) hideMflPlayersInput.checked = restored.hideMflPlayers;
  if (packablePlayersInput) packablePlayersInput.checked = restored.mflPackable;
  newMintsInput.checked = restored.newMints;

  const preserveOpenFilterDraft = document.body.classList.contains("filtersOpen") && !filtersModal.hidden;
  if (!preserveOpenFilterDraft) {
    const allowedColumns = new Set(availableFilterColumns(pageName));
    filterRules.replaceChildren();
    for (const rule of restored.rules) {
      if (!allowedColumns.has(rule.column)) continue;
      addFilterRule(rule.column, {
        connector: rule.connector,
        operator: rule.operator,
        value: rule.value,
        valueTo: rule.valueTo,
        focus: false,
      });
    }

    populateAddFilterSelect(pageName);
    refreshRuleColumnSelects(pageName);
  }
  updateFilterSummary();
  if (document.documentElement.dataset.mflResetTableFilters === pageName) {
    delete document.documentElement.dataset.mflResetTableFilters;
  }
  state.pendingTableControlRestore = null;
  return true;
}

function readFilterDraftRules() {
  return Array.from(filterRules.querySelectorAll(".filterRule")).map((rule, index) => {
    const values = readRuleValues(rule);

    return {
      column: rule.dataset.filterColumn,
      connector: index === 0 ? "and" : rule.querySelector("[data-filter-connector]").value,
      operator: rule.querySelector("[data-filter-operator]").value,
      value: values.value,
      valueTo: values.valueTo,
    };
  });
}

function restoreFilterDraftRules(rules = []) {
  filterRules.replaceChildren();

  rules.forEach((rule) => {
    addFilterRule(rule.column, {
      connector: rule.connector,
      operator: rule.operator,
      value: rule.value,
      valueTo: rule.valueTo,
      focus: false,
    });
  });

  populateAddFilterSelect();
  refreshRuleColumnSelects();
  updateFilterSummary();
}

function tableOpenFiltersOwner() {
  const pageName = tablePageKey() || state.currentPage || "progression";
  if (!syncRestoredTableControls(pageName)) {
    removeUnavailableFilterRules(pageName);
    populateAddFilterSelect(pageName);
    refreshRuleColumnSelects(pageName);
    updateFilterSummary();
  }
  state.filterDraftRules = readFilterDraftRules();
  document.body.classList.add("filtersOpen");
  showModal(filtersModal);
  const firstInput = filterRules.querySelector("input") || addFilterSelect;

  if (firstInput) {
    firstInput.focus();
  }
}

function tableCloseFiltersOwner(commitChanges = false, restoreTriggerFocus = true) {
  if (!commitChanges && state.filterDraftRules) {
    restoreFilterDraftRules(state.filterDraftRules);
  }

  state.filterDraftRules = null;
  document.body.classList.remove("filtersOpen");
  hideModal(filtersModal, () => {
    if (restoreTriggerFocus) openFiltersButton.focus();
  });
}

function tableClearAdvancedFiltersOwner(applyNow = true) {
  filterRules.replaceChildren();
  populateAddFilterSelect();
  updateFilterSummary();

  if (!applyNow) {
    return;
  }

  state.page = 1;
  applyFilters();
}

function tableApplyAdvancedFiltersOwner() {
  state.page = 1;
  applyFilters();
  closeFilters(true);
}

function readRuleValues(rule) {
  const inputs = Array.from(rule.querySelectorAll("[data-filter-value]"));

  return {
    value: (inputs[0]?.value || "").trim(),
    valueTo: (inputs[1]?.value || "").trim(),
  };
}

function readFilterRules() {
  return Array.from(filterRules.querySelectorAll(".filterRule"))
    .map((rule, index) => {
      const values = readRuleValues(rule);

      return {
        column: rule.dataset.filterColumn,
        connector: index === 0 ? "and" : rule.querySelector("[data-filter-connector]").value,
        operator: rule.querySelector("[data-filter-operator]").value,
        value: values.value,
        valueTo: values.valueTo,
      };
    })
    .filter((rule) => (rule.operator === "between" || rule.operator === "during") ? rule.value && rule.valueTo : rule.value);
}

function tableRuleMatchesOwner(row, rule) {
  const rawValue = rule.column === contractStatusFilterColumn ? contractStatusValue(row) : getValue(row, rule.column);
  const filterValue = rule.value;

  if (rule.column === contractStatusFilterColumn) {
    return rawValue === filterValue;
  }

  if (rule.column === "listing_price") {
    const listed = rawValue !== null && rawValue !== undefined && rawValue !== "" && Number.isFinite(Number(rawValue));
    if (filterValue === "for_sale") return listed;
    if (filterValue === "not_for_sale") return !listed;
    return false;
  }

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return false;
  }

  if (rule.column === joinedAgencyColumn) {
    const rowDay = ownedSinceDay(row);
    const filterDay = parseFilterDateDay(filterValue);

    if (rowDay === null || filterDay === null) {
      return false;
    }

    if (rule.operator === "before") {
      return rowDay < filterDay;
    }

    if (rule.operator === "after") {
      return rowDay >= filterDay;
    }

    if (rule.operator === "during") {
      const filterDayTo = parseFilterDateDay(rule.valueTo);
      if (filterDayTo === null) {
        return false;
      }
      const min = Math.min(filterDay, filterDayTo);
      const max = Math.max(filterDay, filterDayTo);
      return rowDay >= min && rowDay <= max;
    }

    return false;
  }

  if (rule.column === "positions") {
    const positions = String(rawValue || "")
      .split(",")
      .map((position) => position.trim())
      .filter(Boolean);

    if (rule.operator === "primary_is") {
      return positions[0] === filterValue;
    }

    if (rule.operator === "can_play") {
      return positions.includes(filterValue);
    }
  }

  if (rule.column === "nationality") {
    return String(rawValue ?? "") === filterValue;
  }

  if (rule.column === "name" || rule.column === "wallet_name") {
    return normalizeSearchText(rawValue).includes(normalizeSearchText(filterValue));
  }

  if (isNumericColumn(rule.column)) {
    const rowNumber = Number(rawValue);
    const filterNumber = Number(filterValue);

    if (!Number.isFinite(rowNumber)) {
      return false;
    }

    if (rule.operator === "between") {
      const filterNumberTo = Number(rule.valueTo);

      if (!Number.isFinite(filterNumber) || !Number.isFinite(filterNumberTo)) {
        return false;
      }

      const min = Math.min(filterNumber, filterNumberTo);
      const max = Math.max(filterNumber, filterNumberTo);
      return rowNumber >= min && rowNumber <= max;
    }

    if (!Number.isFinite(filterNumber)) {
      return false;
    }

    if (rule.operator === "=") {
      return rowNumber === filterNumber;
    }
    if (rule.operator === "!=") {
      return rowNumber !== filterNumber;
    }
    if (rule.operator === "<") {
      return rowNumber < filterNumber;
    }
    if (rule.operator === "<=") {
      return rowNumber <= filterNumber;
    }
    if (rule.operator === ">") {
      return rowNumber > filterNumber;
    }
    if (rule.operator === ">=") {
      return rowNumber >= filterNumber;
    }
  }

  const rowText = normalizeSearchText(rawValue);
  const filterText = normalizeSearchText(filterValue);

  if (rule.operator === "contains") {
    return rowText.includes(filterText);
  }
  if (rule.operator === "not_contains") {
    return !rowText.includes(filterText);
  }
  if (rule.operator === "=") {
    return rowText === filterText;
  }
  if (rule.operator === "!=") {
    return rowText !== filterText;
  }

  return false;
}

function rowMatchesRules(row, rules) {
  if (!rules.length) {
    return true;
  }

  let result = ruleMatches(row, rules[0]);

  for (let index = 1; index < rules.length; index += 1) {
    const current = ruleMatches(row, rules[index]);

    if (rules[index].connector === "or") {
      result = result || current;
    } else {
      result = result && current;
    }
  }

  return result;
}

function rowIsHiddenFromTableAsMflPlayer(row) {
  if (!rowIsMflWalletPlayer(row)) {
    return false;
  }

  if (rowHasHiddenMflJoinedAgencyDate(row)) {
    return true;
  }

  return state.currentPage === "database" && Boolean(hideMflPlayersInput?.checked);
}

function syncQuickFilterLabels() {
  if (hideMflPlayersFilter) {
    hideMflPlayersFilter.hidden = state.currentPage !== "database";
  }

  if (packablePlayersFilter) {
    packablePlayersFilter.hidden = state.currentPage !== "mfl";
  }

  if (!newMintsLabel) {
    return;
  }

  newMintsLabel.textContent = state.currentPage === "mfl" ? "Only aged players" : "Only new mints";
}

let lastAppliedTableFilterSignature = "";

function appliedTableFilterSignature(rules) {
  return JSON.stringify([
    state.currentPage,
    Boolean(hideRetiredInput?.checked),
    Boolean(hideRetiringInput?.checked),
    Boolean(hideMflPlayersInput?.checked),
    Boolean(packablePlayersInput?.checked),
    Boolean(newMintsInput?.checked),
    rules,
  ]);
}

function tableApplyFiltersOwner(options = {}) {
  if (state.currentPage === "club") {
    state.tableSourceRowsCount = state.rows.length;
    state.filteredRows = [...state.rows];
    state.filteredRows.sort(compareRows);
    state.pendingTableControlRestore = null;
    filterRules.replaceChildren();
    hideRetiredInput.checked = false;
    hideRetiringInput.checked = false;
    if (hideMflPlayersInput) hideMflPlayersInput.checked = false;
    if (packablePlayersInput) packablePlayersInput.checked = false;
    newMintsInput.checked = false;
    if (filterSummary) filterSummary.textContent = "0";
    emptyState.textContent = "No players found for this club.";
    syncActiveWatchlistFromSet();
    renderTable();
    return;
  }

  const rules = readFilterRules();
  const filterSignature = appliedTableFilterSignature(rules);
  if (lastAppliedTableFilterSignature && filterSignature !== lastAppliedTableFilterSignature) {
    state.selectedPlayerIds.clear();
    state.selectionAnchorPlayerId = null;
  }
  lastAppliedTableFilterSignature = filterSignature;
  const retirementIndex = state.columns.indexOf("retirement_years");
  const seasonsIndex = state.columns.indexOf("player_seasons");

  let sourceRows = state.rows.filter((row) => !rowHasHiddenMflJoinedAgencyDate(row));

  if (state.currentPage === "watchlist") {
    sourceRows = state.rows.filter((row) => state.watchlistPlayerIds.has(String(getValue(row, "player_id"))) && !rowHasHiddenMflJoinedAgencyDate(row));
  } else if (state.currentPage === "myplayers") {
    sourceRows = state.rows.filter((row) => rowIsOwnedByLinkedWallet(row) && !rowHasHiddenMflJoinedAgencyDate(row));
  } else if (state.currentPage === "mfl") {
    sourceRows = state.rows.filter((row) => rowIsMflWalletPlayer(row) && !rowHasHiddenMflJoinedAgencyDate(row));
  } else if (state.currentPage === "agents") {
    const agentWalletAddress = normalizeWalletAddress(state.currentAgentWalletAddress).toLowerCase();
    sourceRows = state.rows.filter((row) => normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase() === agentWalletAddress && !rowHasHiddenMflJoinedAgencyDate(row));
  } else if (state.currentPage === "progression") {
    sourceRows = state.rows.filter((row) => !rowIsMflWalletPlayer(row) && !rowHasHiddenMflJoinedAgencyDate(row));
  }

  state.tableSourceRowsCount = sourceRows.length;

  emptyState.textContent = state.currentPage === "watchlist"
    ? (sourceRows.length ? "No watchlist players match the current filters." : "No players in your watchlist yet.")
    : state.currentPage === "myplayers"
      ? (sourceRows.length ? "No owned players match the current filters." : "No players found for this wallet.")
      : state.currentPage === "mfl"
        ? (sourceRows.length ? "No MFL players match the current filters." : "No MFL players found.")
        : state.currentPage === "agents"
          ? (sourceRows.length ? "No agent players match the current filters." : "No players found for this agent.")
          : "No players match the current filters.";

  state.filteredRows = sourceRows.filter((row) => {
    if (rowIsHiddenFromTableAsMflPlayer(row)) {
      return false;
    }

    if (hideRetiredInput.checked && row[retirementIndex] === 0) {
      return false;
    }

    if (hideRetiringInput.checked && [1, 2, 3].includes(row[retirementIndex])) {
      return false;
    }


    const playerSeasons = Number(row[seasonsIndex]);

    if (state.currentPage === "mfl" && packablePlayersInput?.checked) {
      if (playerSeasons !== 1) {
        return false;
      }
    }

    if (newMintsInput.checked) {
      if (state.currentPage === "mfl") {
        if (!Number.isFinite(playerSeasons) || playerSeasons < 2) {
          return false;
        }
      } else if (row[seasonsIndex] !== 1) {
        return false;
      }
    }

    if (!rowMatchesRules(row, rules)) {
      return false;
    }

    return true;
  });

  if (!state.incrementalApplying) {
    state.filteredRows.sort(compareRows);
  }
  updateFilterSummary();
  syncActiveWatchlistFromSet();
  if (options.save !== false) {
    saveTableState();
  }
  renderTable();
}

function currentPageRows() {
  if (state.incrementalMode) {
    return state.filteredRows;
  }

  const totalPages = Math.max(1, Math.ceil(state.filteredRows.length / state.pageSize));
  const currentPage = Math.min(state.page, totalPages);
  const start = (currentPage - 1) * state.pageSize;
  return state.filteredRows.slice(start, start + state.pageSize);
}

function updateSelectionHeader(pageRows = currentPageRows()) {
  const selectVisibleInput = document.querySelector("#selectVisiblePlayersInput");

  if (!selectVisibleInput) {
    return;
  }

  if (document.documentElement.classList.contains("mflDataLoading")) {
  selectVisibleInput.checked = false;
  selectVisibleInput.indeterminate = false;
  selectVisibleInput.disabled = true;
  if (document.activeElement === selectVisibleInput) {
    selectVisibleInput.blur();
  }
  return;
}

  const visibleIds = pageRows.map((row) => String(getValue(row, "player_id")));
  const selectedVisibleCount = visibleIds.filter((playerId) => state.selectedPlayerIds.has(playerId)).length;

  selectVisibleInput.disabled = visibleIds.length === 0;
  selectVisibleInput.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  selectVisibleInput.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
}

function updateSelectionBar() {
  const selectedCount = state.selectedPlayerIds.size;
  const optedIn = hasWalletOptIn();
  selectionBar.classList.toggle("visible", selectedCount > 0);
  selectionCount.textContent = `${selectedCount} selected`;
  addToWatchlistButton.hidden = !optedIn;
  addToWatchlistButton.textContent = state.currentPage === "watchlist" ? "Remove from watchlist" : "Add to watchlist";
  if (moveToWatchlistButton) {
    moveToWatchlistButton.hidden = !optedIn || state.currentPage !== "watchlist" || selectedCount <= 0;
  }
  updateSelectionHeader();
}

function setVisiblePlayersSelected(selected) {
  state.selectionAnchorPlayerId = null;

  currentPageRows().forEach((row) => {
    const playerId = String(getValue(row, "player_id"));

    if (selected) {
      state.selectedPlayerIds.add(playerId);
    } else {
      state.selectedPlayerIds.delete(playerId);
    }
  });

  renderTable();
  saveTableState();
}

function setPlayerSelected(playerId, selected, shiftKey = false) {
  const key = String(playerId);
  const anchorKey = state.selectionAnchorPlayerId;
  const filteredIds = state.filteredRows.map((row) => String(getValue(row, "player_id")));
  const anchorIndex = filteredIds.indexOf(anchorKey);
  const currentIndex = filteredIds.indexOf(key);

  if (shiftKey && anchorKey && anchorIndex >= 0 && currentIndex >= 0) {
    const start = Math.min(anchorIndex, currentIndex);
    const end = Math.max(anchorIndex, currentIndex);

    filteredIds.slice(start, end + 1).forEach((rangePlayerId) => {
      if (selected) {
        state.selectedPlayerIds.add(rangePlayerId);
      } else {
        state.selectedPlayerIds.delete(rangePlayerId);
      }
    });

    renderTable();
    saveTableState();
    return;
  }

  if (selected) {
    state.selectedPlayerIds.add(key);
  } else {
    state.selectedPlayerIds.delete(key);
  }

  state.selectionAnchorPlayerId = key;
  updateSelectionBar();
  saveTableState();
}

function tableClearSelectionOwner() {
  state.selectedPlayerIds.clear();
  state.selectionAnchorPlayerId = null;
  renderTable();
  updateSelectionBar();
  saveTableState();
}

function tableAddSelectedToWatchlistOwner() {
  const selectedCount = state.selectedPlayerIds.size;

  if (!selectedCount) {
    return;
  }

  if (state.currentPage === "watchlist") {
    const removedIds = selectedPlayerIdsArray();
    const removedWatchlist = activeWatchlist();
    removedIds.forEach((playerId) => {
      const key = String(playerId);
      state.watchlistPlayerIds.delete(key);
      trackWatchlistChange(key, false);
    });
    state.selectedPlayerIds.clear();
    state.selectionAnchorPlayerId = null;
    syncActiveWatchlistFromSet();
    renderWatchlistSwitcher();
    saveWatchlistStateAfterAction();
    applyFilters();
    showWatchlistActionToast(removedIds, removedIds.length, "removed from", removedWatchlist?.id);
    return;
  }

  const selectedIds = selectedPlayerIdsArray();
  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  state.watchlists = watchlists;

  if (hasWalletOptIn() && watchlists.length > 1) {
    openWatchlistChoiceModal("add", selectedIds);
    return;
  }

  performWatchlistChoiceAction("add", activeWatchlist()?.id || ensureDefaultWatchlist()?.id || "", selectedIds);
}

function tableMoveSelectedToWatchlistOwner() {
  if (state.currentPage !== "watchlist" || !state.selectedPlayerIds.size) {
    return;
  }

  openWatchlistChoiceModal("move", selectedPlayerIdsArray());
}

function tableOpenSelectedPlayerLinksOwner() {
  if (!state.selectedPlayerIds.size) {
    return;
  }

  const playerUrls = Array.from(state.selectedPlayerIds).map((playerId) => {
    const safePlayerId = encodeURIComponent(playerId);
    return `https://app.playmfl.com/players/${safePlayerId}`;
  });
  const reservedTabs = [];

  for (const playerUrl of playerUrls) {
    const reservedTab = window.open("about:blank", "_blank");

    if (!reservedTab) {
      reservedTabs.forEach((tab) => tab.close());
      showToast("Allow pop-ups for this site, then click Open links again.");
      return;
    }

    reservedTabs.push(reservedTab);
  }

  reservedTabs.forEach((tab, index) => {
    tab.opener = null;
    tab.location.href = playerUrls[index];
  });
}

const PAGER_CURRENT_PAGE_INPUT_ID = "pagerCurrentPageInput";
const PAGER_TOTAL_PAGES_ID = "pagerTotalPages";
let suppressedPagerButtonClick = null;
let pagerEditRevision = 0;
let pagerEscapeCaptureInstalled = false;

function pagerCurrentPageControl() {
  let input = document.getElementById(PAGER_CURRENT_PAGE_INPUT_ID);
  let total = document.getElementById(PAGER_TOTAL_PAGES_ID);
  if (input instanceof HTMLInputElement && total instanceof HTMLElement && pageText.contains(input) && pageText.contains(total)) {
    return { input, total };
  }

  input = document.createElement("input");
  input.id = PAGER_CURRENT_PAGE_INPUT_ID;
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.setAttribute("role", "spinbutton");
  input.setAttribute("aria-label", "Current page");

  total = document.createElement("span");
  total.id = PAGER_TOTAL_PAGES_ID;

  pageText.replaceChildren(document.createTextNode("Page "), input, document.createTextNode(" of "), total);
  return { input, total };
}

function resetPagerCurrentPage(input) {
  const current = input.dataset.currentPage || String(state.page || 1);
  input.value = current;
  input.dataset.dirty = "false";
  input.setAttribute("aria-valuenow", current);
}

function cancelPagerCurrentPageEdit(input) {
  pagerEditRevision += 1;
  input.dataset.cancelCommit = "true";
  resetPagerCurrentPage(input);
  input.blur();
}

function installPagerEscapeCapture() {
  if (pagerEscapeCaptureInstalled) return;
  pagerEscapeCaptureInstalled = true;
  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (event.key !== "Escape" || !(target instanceof HTMLInputElement) || target.id !== PAGER_CURRENT_PAGE_INPUT_ID) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelPagerCurrentPageEdit(target);
  }, true);
}

function syncPagerCurrentPage(currentPage, totalPages) {
  const controls = pagerCurrentPageControl();
  const total = Math.max(1, Number.parseInt(String(totalPages || 1), 10) || 1);
  const current = Math.min(total, Math.max(1, Number.parseInt(String(currentPage || 1), 10) || 1));
  controls.input.dataset.currentPage = String(current);
  controls.input.dataset.totalPages = String(total);
  controls.input.setAttribute("aria-valuemin", "1");
  controls.input.setAttribute("aria-valuemax", String(total));
  controls.input.setAttribute("aria-valuenow", String(current));
  controls.total.textContent = String(total);
  if (document.activeElement !== controls.input) {
    controls.input.value = String(current);
    controls.input.dataset.dirty = "false";
    delete controls.input.dataset.cancelCommit;
  }
}

async function commitPagerCurrentPage(input) {
  const total = Math.max(1, Number.parseInt(input.dataset.totalPages || "1", 10) || 1);
  const current = Math.min(total, Math.max(1, Number.parseInt(input.dataset.currentPage || String(state.page || 1), 10) || 1));
  const raw = input.value.trim();
  const parsed = /^-?\d+$/.test(raw) ? Number.parseInt(raw, 10) : current;
  const target = Math.min(total, Math.max(1, parsed));

  input.value = String(target);
  input.dataset.dirty = "false";
  input.setAttribute("aria-valuenow", String(target));
  if (target === current) return;

  if (state.incrementalMode) {
    input.disabled = true;
    try {
      await reloadIncrementalPage(target, { loadingMode: "blank" });
    } finally {
      input.disabled = false;
    }
    return;
  }

  state.page = target;
  renderTable();
}

function installPagerCurrentPageControl() {
  const controls = pagerCurrentPageControl();
  installPagerEscapeCapture();
  if (controls.input.dataset.pagerCurrentPageBound === "true") return;
  controls.input.dataset.pagerCurrentPageBound = "true";

  controls.input.addEventListener("focus", () => {
    pagerEditRevision += 1;
    delete controls.input.dataset.cancelCommit;
  });

  controls.input.addEventListener("input", () => {
    const raw = controls.input.value;
    const negative = raw.trimStart().startsWith("-");
    const digits = raw.replace(/\D+/g, "");
    const normalized = negative ? "-" + digits : digits;
    if (normalized !== raw) controls.input.value = normalized;
    controls.input.dataset.dirty = "true";
  });

  controls.input.addEventListener("blur", () => {
    const revision = pagerEditRevision;
    queueMicrotask(() => {
      if (revision !== pagerEditRevision || controls.input.dataset.cancelCommit === "true") {
        delete controls.input.dataset.cancelCommit;
        resetPagerCurrentPage(controls.input);
        return;
      }
      void commitPagerCurrentPage(controls.input);
    });
  });

  controls.input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    controls.input.blur();
  });

  [prevButton, nextButton].forEach((button) => {
    button.addEventListener("pointerdown", () => {
      suppressedPagerButtonClick = document.activeElement === controls.input && controls.input.dataset.dirty === "true"
        ? button
        : null;
    }, true);
    button.addEventListener("click", (event) => {
      if (suppressedPagerButtonClick !== button) return;
      suppressedPagerButtonClick = null;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });
}

installPagerCurrentPageControl();
syncPagerCurrentPage(1, 1);


function compactMobilePlayerName(value) {
  const fullName = String(value || "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName;
  const initial = Array.from(parts[0])[0] || "";
  return initial ? `${initial}. ${parts.at(-1)}` : fullName;
}

function compactMobileJoinedAgency(value) {
  return String(value || "").trim().split(/\s+/, 1)[0] || "";
}

function tableCenterCellContents(cell) {
  if (!(cell instanceof HTMLTableCellElement)) return cell;
  const existingHost = cell.childNodes.length === 1
    && cell.firstElementChild instanceof HTMLElement
    && cell.firstElementChild.classList.contains("tableControlCellContent")
    ? cell.firstElementChild
    : null;
  if (existingHost) return cell;

  const contentHost = document.createElement("span");
  contentHost.className = "tableControlCellContent";
  while (cell.firstChild) contentHost.appendChild(cell.firstChild);
  cell.appendChild(contentHost);
  return cell;
}

function tableRenderTableOwner() {
  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;
  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;
  const preservedPlayerTableActionRenderSignature = playerTableActionMenu?.dataset.open === "true"
    && playerTableActionRenderSignature
    && playerTableActionRenderSignature === currentPlayerTableActionRenderSignature()
    ? playerTableActionRenderSignature
    : "";
  if (!preservedPlayerTableActionRenderSignature) closePlayerTableActionMenu();
  const totalRows = state.incrementalMode ? state.incrementalTotalRows : state.filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  if (state.currentPage === "agents" && tablePageTitle) {
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  }

  const pageRows = currentPageRows();
  const fragment = document.createDocumentFragment();

  pageRows.forEach((row) => {
    const tableRow = document.createElement("tr");
    const selectionCell = document.createElement("td");
    const selectionInput = document.createElement("input");
    const playerId = getValue(row, "player_id");
    tableRow.dataset.playerId = String(playerId);
    if (state.hoveredTablePlayerId && String(playerId) === state.hoveredTablePlayerId) {
      tableRow.classList.add("tableRowHovered");
    }

    selectionCell.className = "selectionCell";
    selectionInput.type = "checkbox";
    selectionInput.checked = state.selectedPlayerIds.has(String(playerId));
    selectionInput.setAttribute("aria-label", `Select ${formatCellValue(row, "name") || `player ${playerId}`}`);
    selectionInput.dataset.playerId = String(playerId);
    const selectionContent = document.createElement("span");
    selectionContent.className = "tableControlCellContent tableControlCellContentCentered";
    selectionContent.appendChild(selectionInput);
    selectionCell.appendChild(selectionContent);
    tableRow.appendChild(tableCenterCellContents(selectionCell));

    const actionsCell = document.createElement("td");
    actionsCell.className = "rowActionsCell";
    const actionsContent = document.createElement("span");
    actionsContent.className = "tableControlCellContent tableControlCellContentCentered";
    actionsContent.appendChild(createPlayerTableActionsButton(playerId));
    actionsCell.appendChild(actionsContent);
    tableRow.appendChild(tableCenterCellContents(actionsCell));

    currentViewColumns().forEach((column) => {
      const cell = document.createElement("td");
      const columnClass = tableColumnClass(column);
      if (columnClass) {
        cell.classList.add(...columnClass.split(" "));
      }

      if (column === "name") {
        cell.classList.add("nameCell");
        const nameWrap = document.createElement("div");
        const nameLink = document.createElement("a");
        nameWrap.className = "playerNameCell";
        nameLink.href = playerRoute(playerId);
        nameLink.className = "playerNameLink";
        markTableInteractiveHover(nameLink, "name", playerId);
        const fullPlayerName = formatCellValue(row, column);
        nameLink.textContent = window.matchMedia("(max-width: 900px)").matches
          ? compactMobilePlayerName(fullPlayerName)
          : fullPlayerName;
        if (fullPlayerName) nameLink.setAttribute("aria-label", fullPlayerName);
        nameLink.dataset.playerId = String(playerId);
        nameWrap.appendChild(nameLink);
        const markerWrap = document.createElement("span");
        markerWrap.className = "playerNameMarkers";
        if (playerHasNote(playerId)) {
          const noteIcon = document.createElement("span");
          noteIcon.className = "playerNoteIcon";
          noteIcon.dataset.noteTooltip = playerNote(playerId);
          noteIcon.setAttribute("aria-label", "Player note");
          noteIcon.textContent = "\u{1F4DD}";

          markerWrap.appendChild(noteIcon);
        }
        if (markerWrap.childElementCount) {
          nameWrap.appendChild(markerWrap);
        }
        cell.appendChild(nameWrap);
      } else if (column === flagColumn) {
        cell.classList.add("flagCell");
        cell.innerHTML = countryFlagHtml(getValue(row, "nationality"));
        const flagContent = document.createElement("span");
        flagContent.className = "tableControlCellContent tableControlCellContentCentered";
        while (cell.firstChild) flagContent.appendChild(cell.firstChild);
        cell.appendChild(flagContent);
      } else if (column === "player_id") {
        const idContent = document.createElement("span");
        idContent.className = "tableControlCellContent";
        idContent.appendChild(createCopyPlayerIdButton(playerId, formatCellValue(row, column)));
        cell.appendChild(idContent);
      } else if (column === "listing_price") {
        const listingBadge = listingPriceBadgeHtml(row);
        if (listingBadge) {
          if (!window.matchMedia("(max-width: 900px)").matches) {
            cell.innerHTML = `<span class="listingCellTableHost">${listingBadge}</span>`;
          } else {
            const template = document.createElement("template");
            template.innerHTML = listingBadge.trim();
            const badge = template.content.firstElementChild;
            const price = badge instanceof HTMLElement ? badge.querySelector(".listingCellPrice") : null;
            const priceText = String(price?.textContent || "").trim();
            if (badge instanceof HTMLElement) {
              price?.remove();
              if (priceText) {
                badge.dataset.tooltip = priceText;
                badge.setAttribute("aria-label", priceText);
                badge.tabIndex = 0;
              }
              const host = document.createElement("span");
              host.className = "listingCellTableHost";
              host.appendChild(badge);
              cell.appendChild(host);
            }
          }
        } else {
          cell.setAttribute("aria-label", "Not For Sale");
        }
      } else if (column === "age") {
        const ageContent = document.createElement("span");
        ageContent.className = "tableControlCellContent";
        const ageValue = document.createElement("span");
        ageValue.className = "playerAgeValue";
        ageValue.textContent = formatCellValue(row, column);
        ageContent.appendChild(ageValue);
        const retirement = retirementMarker(row);
        appendNameMarker(
          ageContent,
          retirement || newMintMarker(row),
          retirement ? "retirementMarker" : "newMintMarker",
        );
        cell.appendChild(ageContent);
      } else if (column === joinedAgencyColumn) {
        const joinedAgencyValue = formatCellValue(row, column);
        cell.textContent = window.matchMedia("(max-width: 520px)").matches
          ? compactMobileJoinedAgency(joinedAgencyValue)
          : joinedAgencyValue;
      } else if (column === "active_contract_club_division") {
        const division = rowHasActiveContract(row) ? contractDivisionInfo(getValue(row, column)) : null;
        if (division) {
          const divisionLabel = document.createElement("span");
          divisionLabel.className = "contractDivisionLabel";
          divisionLabel.style.color = division.color;
          divisionLabel.textContent = division.name;
          cell.appendChild(divisionLabel);
        } else {
          cell.textContent = "";
        }
      } else if (column === agentColumn) {
        if (!["myplayers", "agents", "mfl"].includes(state.currentPage)) {
          const walletAddress = getValue(row, "wallet_address");
          const agentLabel = formatCellValue(row, column);
          const link = document.createElement("a");
          link.href = agentRoute(walletAddress);
          link.className = "agentTableLink";
          markTableInteractiveHover(link, "agent", walletAddress);
          link.textContent = agentLabel;
          const tooltip = joinedAgencyTooltip(row);
          link.dataset.walletAddress = String(walletAddress || "");
          link.dataset.agentName = String(agentLabel || "");
          if (tooltip) {
            link.dataset.tooltip = tooltip;
          }
          cell.appendChild(link);
        }
      } else if (column === "active_contract_club_name") {
        const clubId = String(getValue(row, "active_contract_club_id") || "").trim();
        const clubName = formatContractClubName(row);
        if (state.currentPage !== "club" && clubId && rowHasActiveContract(row)) {
          const clubLink = document.createElement("a");
          clubLink.href = `/clubs/${encodeURIComponent(clubId)}/squad`;
          clubLink.className = "agentTableLink";
          markTableInteractiveHover(clubLink, "club", clubId);
          clubLink.textContent = clubName;
          clubLink.dataset.clubId = clubId;
          cell.appendChild(clubLink);
        } else {
          cell.textContent = clubName;
        }
      } else if (column === linkColumn) {
        const link = document.createElement("a");
        link.href = formatCellValue(row, column);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Link";
        cell.appendChild(link);
      } else if (statColumns.includes(column)) {
        appendStatValue(cell, row, column);
      } else {
        cell.textContent = formatCellValue(row, column);
      }

      tableRow.appendChild(tableCenterCellContents(cell));
    });

    fragment.appendChild(tableRow);
  });

  tableBody.replaceChildren(fragment);
  if (preservedPlayerTableActionRenderSignature) {
    restorePlayerTableActionMenuAfterRender(preservedPlayerTableActionRenderSignature);
  }
  emptyState.hidden = pageRows.length > 0;
  updateTablePlayerCount();
  syncPagerCurrentPage(state.page, totalPages);
  prevButton.disabled = state.page <= 1;
  nextButton.disabled = state.page >= totalPages;
  updateSelectionBar();
}

function showTableBusyState() {
  if (window.__mflTableLoadingRuntime?.show?.()) return;
  emptyState.hidden = true;
  emptyState.textContent = "";
  tableBody.replaceChildren();
}

async function tableSetViewOwner(viewName) {
  if (!allowedViewsForPage().includes(viewName)) {
    return;
  }

  const pageKey = tablePageKey();
  if (pageKey) {
    const existingPageState = state.tablePageStates[pageKey] || currentTablePageState();
    state.tablePageStates[pageKey] = {
      ...existingPageState,
      viewSortStates: {
        ...(existingPageState.viewSortStates || {}),
        [state.view]: {
          sortKey: state.sortKey,
          sortDirection: state.sortDirection,
        },
      },
    };
  }

  state.view = viewName;
  state.page = 1;
  if (pageKey) {
    updatePageUrl(pageKey, { updateUrl: true, view: viewName });
  }

  const targetSortState = tableSortStateForView(
  viewName,
  pageKey || state.currentPage,
  { sortKey: state.sortKey, sortDirection: state.sortDirection },
);
state.sortKey = targetSortState.sortKey;
state.sortDirection = targetSortState.sortDirection;

  removeUnavailableFilterRules();
  populateAddFilterSelect();
  refreshRuleColumnSelects();

  updateViewButtons();
  buildHeader();

  applyFilters();
}

__mflTableTitleForPageOwner = tableTitleForPageOwner;
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
__mflTableSetViewOwner = tableSetViewOwner;
