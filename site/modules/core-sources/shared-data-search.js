function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizeSettingsDateFormat(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "MDY" || normalized === "MM/DD/YYYY" ? "MDY" : "DMY";
}

function dateFormatLabel(value = state.settingsDateFormat) {
  return normalizeSettingsDateFormat(value) === "MDY" ? "MM/DD/YYYY" : "DD/MM/YYYY";
}

function normalizeSettingsTimeFormat(value) {
  return String(value || "").trim().toLowerCase() === "12h" ? "12h" : "24h";
}

function formatOwnedSinceTime(date) {
  if (normalizeSettingsTimeFormat(state.settingsTimeFormat) === "12h") {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const suffix = hours >= 12 ? "PM" : "AM";
    hours %= 12;
    if (hours === 0) {
      hours = 12;
    }
    return `${hours}:${minutes} ${suffix}`;
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseEpochMillis(value) {
  if (value === null || value === undefined || value === "" || String(value).toUpperCase() === "NULL") {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return number < 100000000000 ? number * 1000 : number;
}

function formatOwnedSinceDate(row) {
  const timestamp = parseEpochMillis(getValue(row, joinedAgencyColumn));
  if (timestamp === null) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const dateText = normalizeSettingsDateFormat(state.settingsDateFormat) === "MDY"
    ? `${month}/${day}/${year}`
    : `${day}/${month}/${year}`;
  return `${dateText} ${formatOwnedSinceTime(date)}`;
}

function joinedAgencyTooltip(row) {
  const date = formatOwnedSinceDate(row);
  return date ? `Since ${date}` : "";
}


function parseFilterDateDay(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 12);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month
    || date.getDate() !== day
  ) {
    return null;
  }
  return Math.floor(Date.UTC(year, month, day) / 86400000);
}

function filterDateEpochBounds(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const start = new Date(year, month, day, 0, 0, 0, 0);
  if (
    Number.isNaN(start.getTime())
    || start.getFullYear() !== year
    || start.getMonth() !== month
    || start.getDate() !== day
  ) {
    return null;
  }
  const nextDay = new Date(year, month, day + 1, 0, 0, 0, 0);
  return {
    startEpochSeconds: Math.floor(start.getTime() / 1000),
    nextDayStartEpochSeconds: Math.floor(nextDay.getTime() / 1000),
  };
}

function serializeFilterRulesForRequest(rules) {
  return rules.map((rule) => {
    if (rule?.column !== joinedAgencyColumn) {
      return rule;
    }

    const fromBounds = filterDateEpochBounds(rule.value);
    const toBounds = rule.operator === "during"
      ? filterDateEpochBounds(rule.valueTo)
      : null;
    return {
      ...rule,
      ...(fromBounds ? {
        valueDayStartEpochSeconds: fromBounds.startEpochSeconds,
        valueNextDayStartEpochSeconds: fromBounds.nextDayStartEpochSeconds,
      } : {}),
      ...(toBounds ? {
        valueToDayStartEpochSeconds: toBounds.startEpochSeconds,
        valueToNextDayStartEpochSeconds: toBounds.nextDayStartEpochSeconds,
      } : {}),
    };
  });
}

function ownedSinceDay(row) {
  const timestamp = parseEpochMillis(getValue(row, joinedAgencyColumn));
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? null
    : Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}













function rebuildColumnIndexMap() {
  const map = Object.create(null);
  state.columns.forEach((column, index) => {
    map[column] = index;
  });
  state.columnIndexMap = map;
}

function columnIndex(column) {
  if (!state.columnIndexMap) {
    rebuildColumnIndexMap();
  }

  const index = state.columnIndexMap[column];
  return Number.isInteger(index) ? index : -1;
}

function getValue(row, column) {
  const index = columnIndex(column);
  return index >= 0 ? row[index] : null;
}

function getProgressionColumn(statColumn) {
  const suffix = views[state.view].progressionSuffix;
  return suffix ? `${statColumn}_${suffix}` : null;
}

function formatPlainValue(value, column) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  if (column === "player_id") {
    return String(value);
  }

  if (typeof value === "number") {
    return formatCount(value);
  }

  return String(value);
}



function formatNationality(value) {
  const text = formatPlainValue(value, "nationality");

  if (text === "NULL") {
    return text;
  }

  return text
    .toLowerCase()
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
const contractDivisionNames = {
  1: "Diamond",
  2: "Platinum",
  3: "Gold",
  4: "Silver",
  5: "Bronze",
  6: "Iron",
  7: "Stone",
  8: "Ice",
  9: "Spark",
  10: "Flint",
};

const contractDivisionColors = {
  1: "#3be9f8",
  2: "#13d389",
  3: "#ffd23e",
  4: "#dbe4eb",
  5: "#fd7a00",
  6: "#865e3f",
  7: "#b7b09c",
  8: "#b0cce1",
  9: "#ffb136",
  10: "#757061",
};

function contractDivisionInfo(value) {
  const division = Number(value);

  if (!Number.isFinite(division) || !contractDivisionNames[division]) {
    return null;
  }

  return {
    name: contractDivisionNames[division],
    color: contractDivisionColors[division],
  };
}

function isBlankValue(value) {
  return value === null || value === undefined || value === "" || String(value).toUpperCase() === "NULL";
}

function isDevelopmentCenterClubName(value) {
  return String(value || "").trim().toLowerCase() === "development center";
}

function rowHasActiveContract(row) {
  const clubName = getValue(row, "active_contract_club_name");
  if (isDevelopmentCenterClubName(clubName)) {
    return false;
  }

  return !isBlankValue(clubName) || !isBlankValue(getValue(row, "active_contract_club_id"));
}

function formatContractRevenueShare(value) {
  if (isBlankValue(value)) {
    return "";
  }

  const percentage = Number(value) / 100;

  if (!Number.isFinite(percentage)) {
    return "";
  }

  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(percentage)}%`;
}



function formatContractClubName(row) {
  const clubName = getValue(row, "active_contract_club_name");
  return isBlankValue(clubName) ? "Free Agent" : String(clubName);
}

function formatContractDivision(value) {
  const division = contractDivisionInfo(value);
  return division ? division.name : "";
}

function contractDivisionSortValue(value) {
  const division = Number(value);
  return Number.isFinite(division) && contractDivisionNames[division] ? division : null;
}

function formatStatValue(row, statColumn) {
  const value = getValue(row, statColumn);
  const progressionColumn = getProgressionColumn(statColumn);

  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  if (!progressionColumn) {
    return String(value);
  }

  const progression = Number(getValue(row, progressionColumn) || 0);

  if (progression === 0) {
    return String(value);
  }

  const sign = progression > 0 ? "+" : "";
  return `${value} (${sign}${progression})`;
}

function hasColumn(column) {
  return columnIndex(column) >= 0;
}



function clearRowSortCache() {
  state.rowSortCache = new WeakMap();
}



function formatCellValue(row, column) {
  if (column === linkColumn) {
    return `https://app.playmfl.com/players/${getValue(row, "player_id")}`;
  }

  if (column === flagColumn) {
    return "";
  }

  if (column === "nationality") {
    return formatNationality(getValue(row, column));
  }

  if (column === "active_contract_revenue_share") {
    return rowHasActiveContract(row) ? formatContractRevenueShare(getValue(row, column)) : "";
  }

  if (column === "active_contract_club_name") {
    return formatContractClubName(row);
  }

  if (column === "active_contract_club_division") {
    return rowHasActiveContract(row) ? formatContractDivision(getValue(row, column)) : "";
  }

  if (statColumns.includes(column)) {
    return formatStatValue(row, column);
  }

  if (column === joinedAgencyColumn) {
    return formatOwnedSinceDate(row) || "NULL";
  }

  if (column === agentColumn) {
    const walletName = getValue(row, agentColumn);

    if (walletName === null || walletName === undefined || walletName === "" || String(walletName).toUpperCase() === "NULL") {
      return formatPlainValue(getValue(row, "wallet_address"), "wallet_address");
    }
  }

  return formatPlainValue(getValue(row, column), column);
}

function retirementMarker(row) {
      const rawRetirementYears = getValue(row, "retirement_years");
      const retirementYears = rawRetirementYears === null
        || rawRetirementYears === undefined
        || String(rawRetirementYears).trim() === ""
        ? null
        : Number(rawRetirementYears);

  if (retirementYears === 0) {
    return {
      icon: "calendar-x-2",
      label: "Retired",
      status: "retired",
    };
  }

  if ([1, 2, 3].includes(retirementYears)) {
    return {
      icon: "calendar-clock",
      label: `${retirementYears} year${retirementYears === 1 ? "" : "s"} left`,
      status: `retiring-${retirementYears}`,
    };
  }

  return null;
}



function playerRoute(playerId) {
  return `/players/${encodeURIComponent(playerId)}`;
}

function agentRoute(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  if (normalizedWalletAddress === mflWalletAddress) {
    return pagePath("mfl", { view: preferredViewForPage("mfl") });
  }

  return normalizedWalletAddress ? pagePath("agents", { walletAddress: normalizedWalletAddress, view: "attributes" }) : "#";
}

function openAgentPage(walletAddress, agentName = "") {
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
}

const listingPriceFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function listingPriceBadgeHtml(row) {
  const rawValue = getValue(row, "listing_price");
  const numericValue = rawValue === null || rawValue === undefined || rawValue === "" ? NaN : Number(rawValue);
  if (!Number.isFinite(numericValue)) return "";
  const priceText = `$${listingPriceFormatter.format(numericValue)}`;
  return `<span class="listingCellContent" aria-label="For Sale at ${escapeHtml(priceText)}"><img class="listingCellIcon" src="/listing-shopping-bag.svg" width="12" height="12" alt="" aria-hidden="true"><span class="listingCellPrice">${escapeHtml(priceText)}</span></span>`;
}

function rowByPlayerId(playerId) {
  const key = String(playerId);
  return state.rows.find((row) => String(getValue(row, "player_id")) === key) || null;
}

function playerSearchAgeDisplay(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const numericAge = Number(value);
  return Number.isFinite(numericAge) ? formatPlainValue(numericAge, "age") : "";
}

function buildPlayerSearchEntryFromRow(row) {
  const playerId = String(getValue(row, "player_id") ?? "");
  const nameDisplay = formatCellValue(row, "name");
  const nationalityRaw = getValue(row, "nationality");
  const nationalityDisplay = formatCellValue(row, "nationality");
  const positionsDisplay = formatCellValue(row, "positions");

  return {
    type: "player",
    row: [...row],
    columns: [...state.columns],
    playerId,
    id: normalizeSearchText(playerId),
    name: normalizeSearchText(nameDisplay),
    nameDisplay,
    ageDisplay: playerSearchAgeDisplay(getValue(row, "age")),
    nationalityRaw,
    nationalityDisplay,
    positionsDisplay,
    overall: Number(statDisplayValue(row, "overall") || 0),
    retired: getValue(row, "retirement_years") === 0,
  };
}

function compactSearchValue(row, columns, column) {
  const index = columns.indexOf(column);
  return index >= 0 ? row[index] : null;
}

function buildPlayerSearchEntryFromCompactRow(row, columns) {
  const playerId = String(compactSearchValue(row, columns, "player_id") ?? "");
  const nameDisplay = String(compactSearchValue(row, columns, "name") || "NULL");
  const nationalityRaw = compactSearchValue(row, columns, "nationality");
  const nationalityDisplay = formatNationality(nationalityRaw);
  const positionsDisplay = String(compactSearchValue(row, columns, "positions") || "NULL");

  return {
    type: "player",
    row: [...row],
    columns: [...columns],
    playerId,
    id: normalizeSearchText(playerId),
    name: normalizeSearchText(nameDisplay),
    nameDisplay,
    ageDisplay: playerSearchAgeDisplay(compactSearchValue(row, columns, "age")),
    nationalityRaw,
    nationalityDisplay,
    positionsDisplay,
    overall: Number(compactSearchValue(row, columns, "overall") || 0),
    retired: compactSearchValue(row, columns, "retirement_years") !== null
      && Number(compactSearchValue(row, columns, "retirement_years")) === 0,
  };
}

function playerSearchMetadataHtml(entry, playerId) {
  const metadata = [
    `OVR ${formatPlainValue(entry.overall, "overall")}`,
    entry.ageDisplay ? `${entry.ageDisplay} yo` : "",
    `#${playerId}`,
    entry.nationalityDisplay,
    entry.positionsDisplay,
  ].filter((value) => String(value || "").trim());
  return metadata.map((value) => escapeHtml(value)).join(" &middot; ");
}

function buildAgentSearchEntry(walletAddress, name, playerCount = 0) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  if (!normalizedWalletAddress) {
    return null;
  }

  const agentName = normalizedAgentName(name) || normalizedWalletAddress;
  return {
    type: "agent",
    walletAddress: normalizedWalletAddress,
    name: agentName,
    nameText: normalizeSearchText(agentName),
    walletText: normalizeSearchText(normalizedWalletAddress),
    playerCount: Number(playerCount || 0),
  };
}

function buildSearchIndex(options = {}) {
  if (state.searchIndexesLoaded && state.searchIndex.length && !options.force) {
    return;
  }

  state.searchIndex = state.rows.map((row) => buildPlayerSearchEntryFromRow(row));
  if (!state.evaluationSearchIndex.length || options.force) {
    state.evaluationSearchIndex = [...state.searchIndex];
  }

  const agentsByWallet = new Map();
  const addAgent = (walletAddress, name) => {
    const entry = buildAgentSearchEntry(walletAddress, name);
    if (!entry || agentsByWallet.has(entry.walletAddress)) {
      return;
    }

    agentsByWallet.set(entry.walletAddress, entry);
    if (entry.name) saveAgentNameForWallet(entry.walletAddress, entry.name);
  };

  state.walletRows.forEach((wallet) => addAgent(wallet.wallet_address, wallet.wallet_name));
  state.rows.forEach((row) => addAgent(getValue(row, "wallet_address"), getValue(row, "wallet_name")));
  state.agentSearchIndex = Array.from(agentsByWallet.values());
  state.searchIndexesLoaded = true;
  if (state.currentPage === "agents" && tablePageTitle) {
      renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  }
}

const databaseSearchSequences = new Map();
const databaseSearchAbortControllers = new Map();
const databaseSearchResponseCache = new Map();
const DATABASE_SEARCH_RESPONSE_CACHE_LIMIT = 80;

function cacheDatabaseSearchResponse(key, payload) {
  databaseSearchResponseCache.delete(key);
  databaseSearchResponseCache.set(key, payload);
  while (databaseSearchResponseCache.size > DATABASE_SEARCH_RESPONSE_CACHE_LIMIT) {
    databaseSearchResponseCache.delete(databaseSearchResponseCache.keys().next().value);
  }
}

function databaseSearchIdentifiers() {
  const playerIds = new Set();
  const walletAddresses = new Set();
  const clubIds = new Set();
  (Array.isArray(state.recentSearchItems) ? state.recentSearchItems : []).forEach((item) => {
    const value = String(item || "");
    if (value.startsWith("player:")) playerIds.add(value.slice(7));
    else if (value.startsWith("agent:")) walletAddresses.add(value.slice(6));
    else if (value.startsWith("club:")) clubIds.add(value.slice(5));
  });
  (state.recentSearchPlayerIds || []).forEach((value) => playerIds.add(String(value || "")));
  (state.recentSearchAgentWallets || []).forEach((value) => walletAddresses.add(String(value || "")));
  (state.recentEvaluationPlayerIds || []).forEach((value) => playerIds.add(String(value || "")));
  return {
    playerIds: [...playerIds].filter(Boolean).slice(0, 20),
    walletAddresses: [...walletAddresses].filter(Boolean).slice(0, 20),
    clubIds: [...clubIds].filter(Boolean).slice(0, 20),
  };
}

function applyDatabaseSearchPayload(payload, type = "all") {
  if (type === "clubs") {
    state.clubSearchIndex = (Array.isArray(payload?.results) ? payload.results : []).map((club) => ({
      clubId: String(club?.clubId || ""),
      name: String(club?.name || ""),
      division: Number.isFinite(Number(club?.division)) ? Number(club.division) : null,
      searchText: normalizeSearchText(`${club?.name || ""} ${club?.clubId || ""}`),
    })).filter((club) => club.clubId && club.name);
    state.searchIndexesLoaded = true;
    return;
  }

  const players = type === "players" ? payload : (payload?.players || { columns: [], rows: [] });
  const agents = type === "players" ? { columns: [], rows: [] } : (payload?.agents || { columns: [], rows: [] });
  const playerColumns = Array.isArray(players?.columns) ? players.columns : [];
  const agentColumns = Array.isArray(agents?.columns) ? agents.columns : [];
  const playerEntries = Array.isArray(players?.rows)
    ? players.rows.map((row) => buildPlayerSearchEntryFromCompactRow(row, playerColumns)).filter(Boolean)
    : [];
  if (type === "players") {
    state.evaluationSearchIndex = playerEntries;
  } else {
    state.searchIndex = playerEntries;
    state.agentSearchIndex = Array.isArray(agents?.rows)
      ? agents.rows.map((row) => buildAgentSearchEntry(
        compactSearchValue(row, agentColumns, "wallet_address"),
        compactSearchValue(row, agentColumns, "wallet_name"),
        compactSearchValue(row, agentColumns, "player_count"),
      )).filter(Boolean)
      : [];
    state.clubSearchIndex = (Array.isArray(payload?.clubs) ? payload.clubs : []).map((club) => ({
      clubId: String(club?.clubId || ""),
      name: String(club?.name || ""),
      division: Number.isFinite(Number(club?.division)) ? Number(club.division) : null,
      searchText: normalizeSearchText(`${club?.name || ""} ${club?.clubId || ""}`),
    })).filter((club) => club.clubId && club.name);
    state.walletRows = state.agentSearchIndex.map((entry) => ({
      wallet_address: entry.walletAddress,
      wallet_name: entry.name,
    }));
    state.walletNamesLoaded = true;
  }
  state.searchIndexesLoaded = true;
}

async function requestDatabaseSearch(rawQuery = "", type = "all", options = {}) {
  const query = String(rawQuery || "").trim();
  const normalizedQuery = normalizeSearchText(query);
  const sequence = (databaseSearchSequences.get(type) || 0) + 1;
  databaseSearchSequences.set(type, sequence);
  const cacheKey = `${type}:${normalizedQuery}`;
  if (options.force) databaseSearchResponseCache.delete(cacheKey);
  const cachedPayload = databaseSearchResponseCache.get(cacheKey);
  const activeInput = typeof options.activeInput === "function"
    ? options.activeInput
    : () => type === "players" ? evaluationSearchInput?.value : playerSearchInput?.value;

  databaseSearchAbortControllers.get(type)?.abort();
  if (cachedPayload) {
    if (normalizeSearchText(activeInput()) !== normalizedQuery) return false;
    applyDatabaseSearchPayload(cachedPayload, type);
    return true;
  }

  const controller = new AbortController();
  databaseSearchAbortControllers.set(type, controller);
  const parameters = new URLSearchParams({ mode: "search", type, limit: "20" });
  if (query) parameters.set("q", query);
  else {
    const recent = databaseSearchIdentifiers();
    parameters.set("type", "recent");
    if (recent.playerIds.length) parameters.set("playerIds", recent.playerIds.join(","));
    if (recent.walletAddresses.length) parameters.set("walletAddresses", recent.walletAddresses.join(","));
    if (recent.clubIds.length) parameters.set("clubIds", recent.clubIds.join(","));
  }

  try {
    const response = await window.__mflDataClient.fetch(`/api/data?${parameters}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not search the database.");
    if (sequence !== databaseSearchSequences.get(type) || normalizeSearchText(activeInput()) !== normalizedQuery) return false;
    const searchPayload = !query && type === "players" ? (payload?.players || {}) : payload;
    cacheDatabaseSearchResponse(cacheKey, searchPayload);
    applyDatabaseSearchPayload(searchPayload, type);
    return true;
  } catch (error) {
    if (error?.name === "AbortError") return false;
    throw error;
  } finally {
    if (databaseSearchAbortControllers.get(type) === controller) {
      databaseSearchAbortControllers.delete(type);
    }
  }
}

let globalSearchPrimePromise = null;

function primeGlobalSearchIndexes() {
  if (globalSearchPrimePromise) return globalSearchPrimePromise;
  databaseSearchResponseCache.delete("all:");
  const promise = requestDatabaseSearch("", "all")
    .then(() => true)
    .catch((error) => {
      console.error(error?.message || "Could not load recent database search results.");
      return false;
    });
  globalSearchPrimePromise = promise;
  window.__mflGlobalSearchReadyPromise = promise;
  void promise.then((loaded) => {
    if (!loaded && globalSearchPrimePromise === promise) globalSearchPrimePromise = null;
  });
  return promise;
}

async function ensureSearchIndexes() {
  return primeGlobalSearchIndexes();
}
