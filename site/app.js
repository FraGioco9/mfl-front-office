const state = {
  columns: [],
  rows: [],
  filteredRows: [],
  page: 1,
  pageSize: 100,
  view: "current",
  sortKey: "overall",
  sortDirection: "desc",
  currentPage: "home",
  manifest: null,
  dataLoaded: false,
  dataLoadPromise: null,
  selectedPlayerIds: new Set(),
  watchlistPlayerIds: new Set(),
  tablePageStates: {},
  toastTimer: null,
  menuOpen: true,
};

const baseColumns = ["player_id", "name", "nationality", "age", "positions", "player_seasons"];
const statColumns = ["overall", "pace", "shooting", "passing", "dribbling", "defense", "physical"];
const agentColumn = "wallet_name";
const linkColumn = "player_link";

const views = {
  attributes: {
    columns: [...baseColumns, ...statColumns, agentColumn, linkColumn],
    progressionSuffix: null,
  },
  current: {
    columns: [...baseColumns, ...statColumns, agentColumn, linkColumn],
    progressionSuffix: "prog_current_season",
  },
  all: {
    columns: [...baseColumns, ...statColumns, agentColumn, linkColumn],
    progressionSuffix: "prog_all",
  },
};

const columnLabels = {
  player_id: "ID",
  wallet_name: "Agent",
  name: "Name",
  nationality: "Nationality",
  age: "Age",
  positions: "Positions",
  player_seasons: "Seasons",
  overall: "Overall",
  pace: "Pace",
  shooting: "Shooting",
  passing: "Passing",
  dribbling: "Dribbling",
  defense: "Defense",
  physical: "Physical",
  player_link: "",
};

const numberColumns = new Set(["player_id", "age", "height", "retirement_years", "player_seasons", "goalkeeping", ...statColumns]);
const sortableColumns = new Set(["player_id", "name", "age", "player_seasons", ...statColumns]);
const baseFilterColumns = ["player_id", "wallet_name", "name", "positions", "age", "player_seasons", "nationality", ...statColumns];
const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
const POSITION_ORDER = ["GK", "RB", "LB", "CB", "RWB", "LWB", "CDM", "RM", "LM", "CM", "CAM", "RW", "LW", "CF", "ST"];

const auth = {
  required: false,
  client: null,
  session: null,
  savedTableState: null,
  saveTimer: null,
};

const loadingScreen = document.querySelector("#loadingScreen");
const loadingText = document.querySelector("#loadingText");
const loadingBarFill = document.querySelector("#loadingBarFill");
const loginScreen = document.querySelector("#loginScreen");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginButton = document.querySelector("#loginButton");
const loginError = document.querySelector("#loginError");
const statusText = document.querySelector("#statusText");
const totalPlayers = document.querySelector("#totalPlayers");
const totalWallets = document.querySelector("#totalWallets");
const homePlayers = document.querySelector("#homePlayers");
const homeWallets = document.querySelector("#homeWallets");
const homeLoginButton = document.querySelector("#homeLoginButton");
const appShell = document.querySelector("#appShell");
const menuButton = document.querySelector("#menuButton");
const menuRail = document.querySelector("#menuRail");
const sidebar = document.querySelector("#sidebar");
const homePage = document.querySelector("#homePage");
const progressionPage = document.querySelector("#progressionPage");
const navButtons = document.querySelectorAll(".navButton");
const accountMenu = document.querySelector("#accountMenu");
const accountButton = document.querySelector("#accountButton");
const accountDropdown = document.querySelector("#accountDropdown");
const accountEmail = document.querySelector("#accountEmail");
const signOutButton = document.querySelector("#signOutButton");
const themeButton = document.querySelector("#themeButton");
const openFiltersButton = document.querySelector("#openFiltersButton");
const quickClearFiltersButton = document.querySelector("#quickClearFiltersButton");
const filterSummary = document.querySelector("#filterSummary");
const filtersModal = document.querySelector("#filtersModal");
const closeFiltersButton = document.querySelector("#closeFiltersButton");
const applyFiltersButton = document.querySelector("#applyFiltersButton");
const clearFiltersButton = document.querySelector("#clearFiltersButton");
const showAddFilterButton = document.querySelector("#showAddFilterButton");
const addFilterSelect = document.querySelector("#addFilterSelect");
const filterRules = document.querySelector("#filterRules");
const hideRetiredInput = document.querySelector("#hideRetiredInput");
const hideRetiringInput = document.querySelector("#hideRetiringInput");
const newMintsInput = document.querySelector("#newMintsInput");
const pageSizeSelect = document.querySelector("#pageSizeSelect");
const tableHead = document.querySelector("#tableHead");
const tableBody = document.querySelector("#tableBody");
const emptyState = document.querySelector("#emptyState");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const pageText = document.querySelector("#pageText");
const viewButtons = document.querySelectorAll(".viewButton");
const tablePageTitle = document.querySelector("#tablePageTitle");
const selectionBar = document.querySelector("#selectionBar");
const selectionCount = document.querySelector("#selectionCount");
const clearSelectionButton = document.querySelector("#clearSelectionButton");
const addToWatchlistButton = document.querySelector("#addToWatchlistButton");
const openSelectedLinksButton = document.querySelector("#openSelectedLinksButton");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.textContent = theme === "dark" ? "☀️" : "🌙";
  themeButton.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to night mode");
  themeButton.title = theme === "dark" ? "Light mode" : "Night mode";

  try {
    localStorage.setItem("mfl-theme", theme);
  } catch {
    // Theme still changes for this page even if the browser blocks storage.
  }
}

function loadTheme() {
  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem("mfl-theme");
  } catch {
    savedTheme = null;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

function updateLoadingProgress(loadedFiles, totalFiles) {
  const percent = totalFiles > 0 ? Math.round((loadedFiles / totalFiles) * 100) : 0;
  loadingBarFill.style.width = `${percent}%`;
  loadingText.textContent = totalFiles > 0
    ? `Loading data files ${loadedFiles}/${totalFiles}`
    : "Preparing data...";
}

function paintLoadingProgress() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

function showLoadingError(message) {
  loadingBarFill.style.width = "100%";
  loadingScreen.classList.add("failed");
  loadingText.textContent = message;
}

function finishLoading() {
  document.body.classList.remove("loading");
  loadingScreen.hidden = true;
}

function updateMenuVisibility() {
  const loggedIn = !auth.required || Boolean(auth.session);
  menuRail.hidden = !loggedIn;
  menuButton.hidden = !loggedIn;
  sidebar.hidden = !loggedIn;
  appShell.classList.toggle("menuClosed", !loggedIn || !state.menuOpen);
  statusText.hidden = false;
  menuButton.setAttribute("aria-expanded", String(loggedIn && state.menuOpen));
}

function showHomeShell() {
  document.body.classList.remove("loading", "auth");
  loadingScreen.hidden = true;
  loginScreen.hidden = true;
  updateMenuVisibility();
  accountMenu.hidden = !auth.required || !auth.session;
  homeLoginButton.hidden = !auth.required || Boolean(auth.session);
  if (auth.session) {
    accountEmail.textContent = accountName();
  }
  setPage("home");
}

function showLogin() {
  document.body.classList.remove("loading");
  document.body.classList.add("auth");
  loadingScreen.hidden = true;
  loginScreen.hidden = false;
  accountMenu.hidden = true;
  updateMenuVisibility();
  closeAccountMenu();
  loginEmail.focus();
}

function showAppShell() {
  document.body.classList.remove("auth");
  loginScreen.hidden = true;
  accountMenu.hidden = !auth.required;
  accountEmail.textContent = accountName();
}

function showLoading() {
  document.body.classList.add("loading");
  loadingScreen.hidden = false;
  loadingScreen.classList.remove("failed");
  updateLoadingProgress(0, 0);
}

async function setupAuth() {
  let configResponse;

  try {
    configResponse = await fetch("/api/config", { cache: "no-store" });
  } catch {
    auth.required = false;
    return true;
  }

  if (!configResponse.ok) {
    auth.required = false;
    return true;
  }

  const config = await configResponse.json();
  auth.required = true;

  if (!window.supabase) {
    showLoadingError("Login library could not be loaded.");
    return false;
  }

  auth.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data } = await auth.client.auth.getSession();
  auth.session = data.session;

  if (!auth.session) {
    showHomeShell();
    return false;
  }

  await loadCloudTableState();
  return true;
}

function authHeaders() {
  if (!auth.required || !auth.session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${auth.session.access_token}`,
  };
}

async function fetchDataFile(fileName) {
  if (!auth.required) {
    const response = await fetch(`data/${fileName}`, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("No exported data found yet.");
    }

    return response.json();
  }

  const response = await fetch(`/api/data?file=${encodeURIComponent(fileName)}`, {
    cache: "no-store",
    headers: authHeaders(),
  });

  if (response.status === 401) {
    auth.session = null;
    showLogin();
    throw new Error("Login required.");
  }

  if (!response.ok) {
    let message = "Protected website data could not be loaded.";

    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Keep the default message if the API did not return JSON.
    }

    throw new Error(message);
  }

  return response.json();
}

async function signIn(event) {
  event.preventDefault();
  loginError.textContent = "";
  loginButton.disabled = true;

  const { data, error } = await auth.client.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value,
  });

  loginButton.disabled = false;

  if (error) {
    loginError.textContent = error.message;
    return;
  }

  auth.session = data.session;
  await loadCloudTableState();
  loginPassword.value = "";
  showAppShell();
  showHomeShell();
}

async function signOut() {
  if (auth.client) {
    await auth.client.auth.signOut();
  }

  window.location.reload();
}

function accountName() {
  const email = auth.session?.user?.email || "";
  return email.split("@")[0] || "Account";
}

function openAccountMenu() {
  accountDropdown.hidden = false;
  accountButton.setAttribute("aria-expanded", "true");
}

function closeAccountMenu() {
  accountDropdown.hidden = true;
  accountButton.setAttribute("aria-expanded", "false");
}

function toggleAccountMenu() {
  if (accountDropdown.hidden) {
    openAccountMenu();
  } else {
    closeAccountMenu();
  }
}

function toggleMenu() {
  state.menuOpen = !state.menuOpen;
  updateMenuVisibility();
  saveTableState();
}

function pageFromUrl() {
  const pageName = window.location.pathname.replace(/^\//, "");
  return ["home", "progression", "watchlist"].includes(pageName) ? pageName : "home";
}

async function ensureProgressionData() {
  if (state.dataLoaded) {
    return true;
  }

  if (!state.dataLoadPromise) {
    showLoading();
    state.dataLoadPromise = loadData()
      .then((loaded) => {
        state.dataLoaded = Boolean(loaded);
        return state.dataLoaded;
      })
      .catch(() => false)
      .finally(() => {
        state.dataLoadPromise = null;
      });
  }

  return state.dataLoadPromise;
}

async function setPage(pageName, updateHash = true) {
  const previousTablePage = tablePageKey();
  if (previousTablePage) {
    state.tablePageStates[previousTablePage] = currentTablePageState();
    saveTableState();
  }

  const tablePage = pageName === "progression" || pageName === "watchlist";

  if (tablePage && !state.dataLoaded) {
    const loaded = await ensureProgressionData();

    if (!loaded) {
      return;
    }
  }

  state.currentPage = pageName;
  homePage.hidden = pageName !== "home";
  progressionPage.hidden = !tablePage;
  tablePageTitle.textContent = pageName === "watchlist" ? "Watchlist" : "Progression";
  if (tablePage) {
    restoreSavedTableState(pageName);
    buildHeader();
  }
  emptyState.textContent = pageName === "watchlist"
    ? "No players in your watchlist yet."
    : "No players match the current filters.";

  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  if (updateHash && window.location.pathname !== `/${pageName}`) {
    window.history.pushState({}, "", `/${pageName}`);
  }

  if (tablePage && state.rows.length) {
    state.page = 1;
    applyFilters();
  }
}

function updateStatusDate(generatedAt) {
  if (!generatedAt) {
    return;
  }

  statusText.textContent = `Updated ${new Date(generatedAt).toLocaleString()}`;
}

function updateSummaryCounts(playerCount, walletCount) {
  const players = Number(playerCount || 0);
  const wallets = Number(walletCount || 0);
  totalPlayers.textContent = players ? formatCount(players) : "-";
  totalWallets.textContent = wallets ? formatCount(wallets) : "-";
  homePlayers.textContent = players ? formatCount(players) : "-";
  homeWallets.textContent = wallets ? formatCount(wallets) : "-";
}

async function loadSummary() {
  const sources = [
    { url: "/summary.json", type: "summary" },
    { url: "/api/summary", type: "summary" },
    { url: "/data/manifest.json", type: "manifest" },
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { cache: "no-store" });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      updateSummaryCounts(
        source.type === "manifest" ? data.row_count : data.playerCount,
        source.type === "manifest" ? data.wallet_count : data.walletCount,
      );
      updateStatusDate(source.type === "manifest" ? data.generated_at : data.generatedAt);
      return;
    } catch {
      // Try the next public summary source.
    }
  }
}

function tablePageKey(pageName = state.currentPage) {
  return pageName === "progression" || pageName === "watchlist" ? pageName : null;
}

function defaultTablePageState() {
  return {
    hideRetired: true,
    hideRetiring: false,
    newMints: false,
    pageSize: 100,
    view: "current",
    sortKey: "overall",
    sortDirection: "desc",
    rules: [],
    selectedPlayerIds: [],
  };
}

function showToast(message) {
  let toast = document.querySelector("#toastMessage");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastMessage";
    toast.className = "toastMessage";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 2200);
}
function saveTableState() {
  const savedState = currentTableState();
  auth.savedTableState = savedState;

  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(savedState));
  } catch {
    // Filtering still works for this page even if the browser blocks storage.
  }

  queueCloudTableStateSave(savedState);
}

function currentTablePageState() {
  const rules = Array.from(filterRules.querySelectorAll(".filterRule")).map((rule, index) => {
    const values = readRuleValues(rule);

    return {
      column: rule.dataset.filterColumn,
      connector: index === 0 ? "and" : rule.querySelector("[data-filter-connector]").value,
      operator: rule.querySelector("[data-filter-operator]").value,
      value: values.value,
      valueTo: values.valueTo,
    };
  });

  return {
    hideRetired: hideRetiredInput.checked,
    hideRetiring: hideRetiringInput.checked,
    newMints: newMintsInput.checked,
    pageSize: state.pageSize,
    view: state.view,
    sortKey: state.sortKey,
    sortDirection: state.sortDirection,
    rules,
    selectedPlayerIds: Array.from(state.selectedPlayerIds),
  };
}

function currentTableState() {
  const pageKey = tablePageKey();

  if (pageKey) {
    state.tablePageStates[pageKey] = currentTablePageState();
  }

  return {
    pages: state.tablePageStates,
    watchlistPlayerIds: Array.from(state.watchlistPlayerIds),
    menuOpen: state.menuOpen,
  };
}

async function loadCloudTableState() {
  if (!auth.required || !auth.client || !auth.session?.user?.id) {
    auth.savedTableState = null;
    return;
  }

  const { data, error } = await auth.client
    .from("user_preferences")
    .select("table_state")
    .eq("user_id", auth.session.user.id)
    .maybeSingle();

  if (error) {
    console.warn("Could not load Supabase table preferences.", error);
    auth.savedTableState = null;
    return;
  }

  auth.savedTableState = data?.table_state || null;
  restoreWatchlistState(auth.savedTableState);
  restoreMenuState(auth.savedTableState);
}

function queueCloudTableStateSave(savedState) {
  if (!auth.required || !auth.client || !auth.session?.user?.id) {
    return;
  }

  window.clearTimeout(auth.saveTimer);
  auth.saveTimer = window.setTimeout(() => {
    saveCloudTableState(savedState);
  }, 600);
}

async function saveCloudTableState(savedState) {
  const { error } = await auth.client
    .from("user_preferences")
    .upsert({
      user_id: auth.session.user.id,
      table_state: savedState,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.warn("Could not save Supabase table preferences.", error);
  }
}

function restoreWatchlistState(savedState) {
  const ids = Array.isArray(savedState?.watchlistPlayerIds) ? savedState.watchlistPlayerIds : [];
  state.watchlistPlayerIds = new Set(ids.map((playerId) => String(playerId)));
}

function restoreMenuState(savedState) {
  if (typeof savedState?.menuOpen === "boolean") {
    state.menuOpen = savedState.menuOpen;
  }
}

function restoreTablePageStates(savedState) {
  if (savedState?.pages) {
    state.tablePageStates = { ...savedState.pages };
  } else if (savedState) {
    state.tablePageStates = { progression: { ...savedState } };
  } else {
    state.tablePageStates = {};
  }
}

function loadSavedTableState() {
  if (auth.savedTableState) {
    restoreTablePageStates(auth.savedTableState);
    restoreWatchlistState(auth.savedTableState);
    restoreMenuState(auth.savedTableState);
    return auth.savedTableState;
  }

  try {
    const savedState = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
    restoreTablePageStates(savedState);
    restoreWatchlistState(savedState);
    restoreMenuState(savedState);
    return savedState;
  } catch {
    return null;
  }
}

function formatCount(value) {
  return new Intl.NumberFormat().format(value);
}

function filterLabel(column) {
  if (column.endsWith("_prog_current_season")) {
    return `${filterLabel(column.replace("_prog_current_season", ""))} Progression`;
  }

  if (column.endsWith("_prog_all")) {
    return `${filterLabel(column.replace("_prog_all", ""))} Progression`;
  }

  return columnLabels[column] || column.replaceAll("_", " ");
}

function isNumericColumn(column) {
  return numberColumns.has(column) || column.endsWith("_all") || column.endsWith("_current_season");
}

function uniqueColumnValues(column) {
  const values = new Set();
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

function uniquePositions() {
  return POSITION_ORDER;
}

function availableFilterColumns() {
  const columns = [...baseFilterColumns];

  if (state.view === "current") {
    columns.push(...statColumns.map((column) => `${column}_prog_current_season`));
  } else if (state.view === "all") {
    columns.push(...statColumns.map((column) => `${column}_prog_all`));
  }

  return columns.filter((column) => state.columns.includes(column));
}

function getValue(row, column) {
  return row[state.columns.indexOf(column)];
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

function appendStatValue(cell, row, statColumn) {
  const value = getValue(row, statColumn);
  const progressionColumn = getProgressionColumn(statColumn);

  if (value === null || value === undefined || value === "") {
    cell.textContent = "NULL";
    return;
  }

  cell.append(String(value));

  if (!progressionColumn) {
    return;
  }

  const progression = Number(getValue(row, progressionColumn) || 0);

  if (progression === 0) {
    return;
  }

  const progressionElement = document.createElement("span");
  progressionElement.className = progression > 0 ? "progressionValue positive" : "progressionValue negative";
  progressionElement.textContent = ` (${progression > 0 ? "+" : ""}${progression})`;
  cell.appendChild(progressionElement);
}

function formatCellValue(row, column) {
  if (column === linkColumn) {
    return `https://app.playmfl.com/players/${getValue(row, "player_id")}`;
  }

  if (statColumns.includes(column)) {
    return formatStatValue(row, column);
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
  const retirementYears = getValue(row, "retirement_years");

  if (retirementYears === 0) {
    return {
      emoji: "🏁",
      label: "Retired",
    };
  }

  if ([1, 2, 3].includes(retirementYears)) {
    return {
      emoji: "⏳",
      label: `${retirementYears} year${retirementYears === 1 ? "" : "s"} left`,
    };
  }

  return null;
}

function newMintMarker(row) {
  if (getValue(row, "player_seasons") !== 1) {
    return null;
  }

  return {
    emoji: "\u{1F195}",
    label: "New mint",
  };
}

function appendNameMarker(cell, marker, className) {
  if (!marker) {
    return;
  }

  const markerElement = document.createElement("span");
  markerElement.className = className;
  markerElement.textContent = marker.emoji;
  markerElement.title = marker.label;
  markerElement.setAttribute("aria-label", marker.label);
  cell.appendChild(markerElement);
}

function sortableValue(row, column) {
  if (column === "overall" && state.view !== "attributes") {
    return [
      getValue(row, getProgressionColumn("overall")) || 0,
      getValue(row, "overall") || 0,
    ];
  }

  return getValue(row, column);
}

function buildHeader() {
  const headerRow = document.createElement("tr");
  const selectionHeader = document.createElement("th");
  const selectVisibleInput = document.createElement("input");

  selectionHeader.className = "selectionCell";
  selectVisibleInput.id = "selectVisiblePlayersInput";
  selectVisibleInput.type = "checkbox";
  selectVisibleInput.setAttribute("aria-label", "Select visible players");
  selectVisibleInput.addEventListener("change", () => setVisiblePlayersSelected(selectVisibleInput.checked));
  selectionHeader.appendChild(selectVisibleInput);
  headerRow.appendChild(selectionHeader);

  views[state.view].columns.forEach((column) => {
    const cell = document.createElement("th");
    const isSorted = state.sortKey === column;
    const label = document.createElement("span");
    label.textContent = columnLabels[column];
    cell.appendChild(label);

    if (sortableColumns.has(column)) {
      cell.classList.add("sortable");

      if (isSorted) {
        const arrow = document.createElement("span");
        arrow.className = `sortArrow ${state.sortDirection}`;
        arrow.setAttribute("aria-hidden", "true");
        cell.appendChild(arrow);
      }

      cell.addEventListener("click", () => {
        if (state.sortKey !== column) {
          state.sortKey = column;
          state.sortDirection = numberColumns.has(column) ? "desc" : "asc";
        } else if (state.sortDirection === "desc") {
          state.sortDirection = "asc";
        } else if (column === "overall") {
          state.sortDirection = "desc";
        } else {
          state.sortKey = "overall";
          state.sortDirection = "desc";
        }

        state.page = 1;
        buildHeader();
        applyFilters();
      });
    }

    headerRow.appendChild(cell);
  });

  tableHead.replaceChildren(headerRow);
}

function compareRows(a, b) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  const aValue = sortableValue(a, state.sortKey);
  const bValue = sortableValue(b, state.sortKey);

  if (Array.isArray(aValue) && Array.isArray(bValue)) {
    for (let index = 0; index < aValue.length; index += 1) {
      const comparison = ((aValue[index] ?? -Infinity) - (bValue[index] ?? -Infinity)) * direction;

      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  }

  if (numberColumns.has(state.sortKey)) {
    return (((aValue ?? -Infinity) - (bValue ?? -Infinity)) || 0) * direction;
  }

  return String(aValue ?? "").localeCompare(String(bValue ?? "")) * direction;
}

function activeFilterCount() {
  let count = 0;

  for (const rule of filterRules.querySelectorAll(".filterRule")) {
    const operator = rule.querySelector("[data-filter-operator]").value;
    const values = readRuleValues(rule);

    if ((operator === "between" && values.value && values.valueTo) || (operator !== "between" && values.value)) {
      count += 1;
    }
  }

  return count;
}

function updateFilterSummary() {
  const count = activeFilterCount();
  filterSummary.textContent = `${count} active`;
}

function populateAddFilterSelect() {
  const fragment = document.createDocumentFragment();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select filter...";
  fragment.appendChild(placeholder);

  availableFilterColumns().forEach((column) => {
    const option = document.createElement("option");
    option.value = column;
    option.textContent = filterLabel(column);
    fragment.appendChild(option);
  });

  addFilterSelect.replaceChildren(fragment);
}

function buildOperatorSelect(column) {
  const select = document.createElement("select");
  select.dataset.filterOperator = "true";
  let operators;

  if (column === "positions") {
    operators = [
      ["primary_is", "primary is"],
      ["can_play", "can play"],
    ];
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

function buildValueControl(column, savedValue = "", savedValueTo = "", operator = "") {
  if (isNumericColumn(column) && operator === "between") {
    const group = document.createElement("div");
    group.className = "betweenValue";
    group.dataset.filterValueGroup = "true";
    group.appendChild(buildNumberInput(savedValue, "From"));
    group.appendChild(buildNumberInput(savedValueTo, "To"));
    return group;
  }

  if (column === "nationality" || column === "positions") {
    const select = document.createElement("select");
    select.dataset.filterValue = "true";
    const values = column === "nationality" ? uniqueColumnValues("nationality") : uniquePositions();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select...";
    select.appendChild(placeholder);

    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === savedValue;
      select.appendChild(option);
    });

    return select;
  }

  const input = document.createElement("input");
  input.type = isNumericColumn(column) ? "number" : "search";
  input.placeholder = "Value";
  input.dataset.filterValue = "true";
  input.value = savedValue;
  return input;
}

function buildColumnSelect(selectedColumn) {
  const select = document.createElement("select");
  select.dataset.filterColumnSelect = "true";

  availableFilterColumns().forEach((column) => {
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
  return rule.querySelector("[data-filter-value-group]") || rule.querySelector("[data-filter-value]");
}

function replaceValueControl(rule, column, savedValue = "", savedValueTo = "") {
  const oldValue = valueControlElement(rule);
  const operator = rule.querySelector("[data-filter-operator]").value;
  const newValue = buildValueControl(column, savedValue, savedValueTo, operator);
  oldValue.replaceWith(newValue);
}

function addFilterRule(column, options = {}) {
  const rule = document.createElement("div");
  rule.className = "filterRule";
  rule.dataset.filterColumn = column;

  const connector = document.createElement("select");
  connector.dataset.filterConnector = "true";
  connector.innerHTML = '<option value="and">And</option><option value="or">Or</option>';
  connector.className = "connectorSelect";
  connector.value = options.connector || "and";

  const columnSelect = buildColumnSelect(column);
  columnSelect.addEventListener("change", () => {
    rule.dataset.filterColumn = columnSelect.value;
    replaceOperatorSelect(rule, columnSelect.value);
    replaceValueControl(rule, columnSelect.value);
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
  remove.className = "iconButton";
  remove.textContent = "x";
  remove.setAttribute("aria-label", `Remove ${filterLabel(column)} filter`);
  remove.addEventListener("click", () => {
    rule.remove();
    refreshRuleConnectors();
    updateFilterSummary();
  });

  rule.appendChild(connector);
  rule.appendChild(columnSelect);
  rule.appendChild(operator);
  rule.appendChild(value);
  rule.appendChild(remove);
  filterRules.appendChild(rule);
  refreshRuleConnectors();

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

function removeUnavailableFilterRules() {
  const allowedColumns = new Set(availableFilterColumns());

  for (const rule of filterRules.querySelectorAll(".filterRule")) {
    if (!allowedColumns.has(rule.dataset.filterColumn)) {
      rule.remove();
    }
  }

  refreshRuleConnectors();
}

function refreshRuleColumnSelects() {
  for (const rule of filterRules.querySelectorAll(".filterRule")) {
    const oldSelect = rule.querySelector("[data-filter-column-select]");
    const newSelect = buildColumnSelect(rule.dataset.filterColumn);

    newSelect.addEventListener("change", () => {
      rule.dataset.filterColumn = newSelect.value;
      replaceOperatorSelect(rule, newSelect.value);
      replaceValueControl(rule, newSelect.value);
    });

    oldSelect.replaceWith(newSelect);
  }
}

function restoreSavedTableState(pageName = tablePageKey() || "progression") {
  const savedRoot = loadSavedTableState();
  const savedState = savedRoot?.pages?.[pageName]
    || (pageName === "progression" && !savedRoot?.pages ? savedRoot : null)
    || defaultTablePageState();

  if (savedState.view && views[savedState.view]) {
    state.view = savedState.view;
    viewButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === state.view);
    });
  }

  if (Number(savedState.pageSize)) {
    state.pageSize = Number(savedState.pageSize);
    pageSizeSelect.value = String(state.pageSize);
  }

  if (savedState.sortKey && sortableColumns.has(savedState.sortKey)) {
    state.sortKey = savedState.sortKey;
  }

  if (savedState.sortDirection === "asc" || savedState.sortDirection === "desc") {
    state.sortDirection = savedState.sortDirection;
  }

  hideRetiredInput.checked = savedState.hideRetired !== false;
  hideRetiringInput.checked = Boolean(savedState.hideRetiring);
  newMintsInput.checked = Boolean(savedState.newMints);
  state.selectedPlayerIds = new Set((savedState.selectedPlayerIds || []).map((playerId) => String(playerId)));

  const allowedColumns = new Set(availableFilterColumns());
  filterRules.replaceChildren();

  for (const rule of savedState.rules || []) {
    if (allowedColumns.has(rule.column)) {
      addFilterRule(rule.column, {
        connector: rule.connector,
        operator: rule.operator,
        value: rule.value,
        valueTo: rule.valueTo,
        focus: false,
      });
    }
  }
}

function openFilters() {
  filtersModal.hidden = false;
  const firstInput = filterRules.querySelector("input") || addFilterSelect;

  if (firstInput) {
    firstInput.focus();
  }
}

function closeFilters() {
  filtersModal.hidden = true;
  openFiltersButton.focus();
}

function clearAdvancedFilters() {
  filterRules.replaceChildren();
  state.page = 1;
  applyFilters();
}

function applyAdvancedFilters() {
  state.page = 1;
  applyFilters();
  closeFilters();
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
    .filter((rule) => rule.operator === "between" ? rule.value && rule.valueTo : rule.value);
}

function ruleMatches(row, rule) {
  const rawValue = getValue(row, rule.column);
  const filterValue = rule.value;

  if (rawValue === null || rawValue === undefined || rawValue === "") {
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
    return String(rawValue ?? "").toLowerCase().includes(filterValue.toLowerCase());
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

  const rowText = String(rawValue ?? "").toLowerCase();
  const filterText = filterValue.toLowerCase();

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

function applyFilters() {
  const rules = readFilterRules();
  const retirementIndex = state.columns.indexOf("retirement_years");
  const seasonsIndex = state.columns.indexOf("player_seasons");

  const sourceRows = state.currentPage === "watchlist"
    ? state.rows.filter((row) => state.watchlistPlayerIds.has(String(getValue(row, "player_id"))))
    : state.rows;

  emptyState.textContent = state.currentPage === "watchlist"
    ? (sourceRows.length ? "No watchlist players match the current filters." : "No players in your watchlist yet.")
    : "No players match the current filters.";

  state.filteredRows = sourceRows.filter((row) => {
    if (hideRetiredInput.checked && row[retirementIndex] === 0) {
      return false;
    }

    if (hideRetiringInput.checked && [1, 2, 3].includes(row[retirementIndex])) {
      return false;
    }

    if (newMintsInput.checked && row[seasonsIndex] !== 1) {
      return false;
    }

    if (!rowMatchesRules(row, rules)) {
      return false;
    }

    return true;
  });

  state.filteredRows.sort(compareRows);
  updateFilterSummary();
  saveTableState();
  renderTable();
}

function currentPageRows() {
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

  const visibleIds = pageRows.map((row) => String(getValue(row, "player_id")));
  const selectedVisibleCount = visibleIds.filter((playerId) => state.selectedPlayerIds.has(playerId)).length;

  selectVisibleInput.disabled = visibleIds.length === 0;
  selectVisibleInput.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  selectVisibleInput.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
}

function updateSelectionBar() {
  const selectedCount = state.selectedPlayerIds.size;
  selectionBar.classList.toggle("visible", selectedCount > 0);
  selectionCount.textContent = `${selectedCount} selected`;
  addToWatchlistButton.textContent = state.currentPage === "watchlist" ? "Remove from watchlist" : "Add to watchlist";
  updateSelectionHeader();
}

function setVisiblePlayersSelected(selected) {
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

function setPlayerSelected(playerId, selected) {
  const key = String(playerId);

  if (selected) {
    state.selectedPlayerIds.add(key);
  } else {
    state.selectedPlayerIds.delete(key);
  }

  updateSelectionBar();
  saveTableState();
}

function clearSelection() {
  state.selectedPlayerIds.clear();
  renderTable();
  updateSelectionBar();
  saveTableState();
}

function addSelectedToWatchlist() {
  const selectedCount = state.selectedPlayerIds.size;

  if (!selectedCount) {
    return;
  }

  if (state.currentPage === "watchlist") {
    state.selectedPlayerIds.forEach((playerId) => state.watchlistPlayerIds.delete(String(playerId)));
    state.selectedPlayerIds.clear();
    saveTableState();
    applyFilters();
    showToast(`${selectedCount} player${selectedCount === 1 ? "" : "s"} removed from watchlist.`);
    return;
  }

  state.selectedPlayerIds.forEach((playerId) => state.watchlistPlayerIds.add(String(playerId)));
  state.selectedPlayerIds.clear();
  saveTableState();
  renderTable();
  updateSelectionBar();
  showToast(`${selectedCount} player${selectedCount === 1 ? "" : "s"} added to watchlist.`);
}


function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openSelectedPlayerLinks() {
  if (!state.selectedPlayerIds.size) {
    return;
  }

  const popUpCheck = window.open("about:blank", "_blank");

  if (!popUpCheck) {
    showToast("Allow pop-ups for this site, then click Open links again.");
    return;
  }

  popUpCheck.close();

  Array.from(state.selectedPlayerIds).forEach((playerId) => {
    const safePlayerId = encodeURIComponent(playerId);
    window.open(`https://app.playmfl.com/players/${safePlayerId}`, "_blank", "noopener,noreferrer");
  });
}
function renderTable() {
  const totalPages = Math.max(1, Math.ceil(state.filteredRows.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);

  const pageRows = currentPageRows();
  const fragment = document.createDocumentFragment();

  pageRows.forEach((row) => {
    const tableRow = document.createElement("tr");
    const selectionCell = document.createElement("td");
    const selectionInput = document.createElement("input");
    const playerId = getValue(row, "player_id");

    selectionCell.className = "selectionCell";
    selectionInput.type = "checkbox";
    selectionInput.checked = state.selectedPlayerIds.has(String(playerId));
    selectionInput.setAttribute("aria-label", `Select ${formatCellValue(row, "name") || `player ${playerId}`}`);
    selectionInput.addEventListener("change", () => setPlayerSelected(playerId, selectionInput.checked));
    selectionCell.appendChild(selectionInput);
    tableRow.appendChild(selectionCell);

    views[state.view].columns.forEach((column) => {
      const cell = document.createElement("td");

      if (column === "name") {
        const nameText = document.createElement("span");
        nameText.textContent = formatCellValue(row, column);
        cell.appendChild(nameText);

        appendNameMarker(cell, retirementMarker(row), "retirementMarker");
        appendNameMarker(cell, newMintMarker(row), "newMintMarker");
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

      tableRow.appendChild(cell);
    });

    fragment.appendChild(tableRow);
  });

  tableBody.replaceChildren(fragment);
  emptyState.hidden = pageRows.length > 0;
  totalPlayers.textContent = formatCount(state.rows.length);
  pageText.textContent = `Page ${state.page} of ${totalPages}`;
  prevButton.disabled = state.page <= 1;
  nextButton.disabled = state.page >= totalPages;
  updateSelectionBar();
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}


function setView(viewName) {
  state.view = viewName;
  state.page = 1;
  removeUnavailableFilterRules();
  populateAddFilterSelect();
  refreshRuleColumnSelects();

  viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  buildHeader();
  applyFilters();
}

async function loadData() {
  try {
    state.rows = [];
    state.filteredRows = [];
    state.page = 1;
    updateLoadingProgress(0, 0);
    const manifest = await fetchDataFile("manifest.json");
    state.manifest = manifest;
    state.columns = manifest.columns;
    updateSummaryCounts(manifest.row_count, manifest.wallet_count);
    updateLoadingProgress(0, manifest.chunks.length);
    await paintLoadingProgress();

    for (let index = 0; index < manifest.chunks.length; index += 1) {
      const chunkInfo = manifest.chunks[index];
      const chunk = await fetchDataFile(chunkInfo.file);
      state.rows.push(...chunk.rows);
      updateLoadingProgress(index + 1, manifest.chunks.length);
      await paintLoadingProgress();
    }

    statusText.textContent = `Updated ${new Date(manifest.generated_at).toLocaleString()}`;
    populateAddFilterSelect();
    restoreSavedTableState();
    buildHeader();
    applyFilters();
    state.dataLoaded = true;
    finishLoading();
    return true;
  } catch (error) {
    const message = error.message === "Login required."
      ? "Login required."
      : error.message || "No website data found yet. Run the GitHub workflow to publish the table.";
    statusText.textContent = message;
    tableBody.replaceChildren();
    emptyState.hidden = false;
    emptyState.textContent = message;
    showLoadingError(message);

    return false;
  }
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(pageSizeSelect.value);
  state.page = 1;
  renderTable();
});

hideRetiredInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

hideRetiringInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

newMintsInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

openFiltersButton.addEventListener("click", openFilters);
quickClearFiltersButton.addEventListener("click", clearAdvancedFilters);
closeFiltersButton.addEventListener("click", closeFilters);

showAddFilterButton.addEventListener("click", () => {
  addFilterSelect.hidden = !addFilterSelect.hidden;

  if (!addFilterSelect.hidden) {
    addFilterSelect.focus();
  }
});

addFilterSelect.addEventListener("change", () => {
  if (!addFilterSelect.value) {
    return;
  }

  addFilterRule(addFilterSelect.value);
  addFilterSelect.value = "";
  addFilterSelect.hidden = true;
  updateFilterSummary();
});

filtersModal.addEventListener("click", (event) => {
  if (event.target === filtersModal) {
    closeFilters();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !filtersModal.hidden) {
    closeFilters();
  } else if (event.key === "Escape" && !accountDropdown.hidden) {
    closeAccountMenu();
  } else if (event.key === "Enter" && !filtersModal.hidden) {
    event.preventDefault();
    applyAdvancedFilters();
  }
});

document.addEventListener("click", (event) => {
  if (!accountMenu.hidden && !accountMenu.contains(event.target)) {
    closeAccountMenu();
  }
});

applyFiltersButton.addEventListener("click", applyAdvancedFilters);

clearFiltersButton.addEventListener("click", () => {
  clearAdvancedFilters();
});

clearSelectionButton.addEventListener("click", clearSelection);
addToWatchlistButton.addEventListener("click", addSelectedToWatchlist);
openSelectedLinksButton.addEventListener("click", openSelectedPlayerLinks);


prevButton.addEventListener("click", () => {
  state.page -= 1;
  renderTable();
});

nextButton.addEventListener("click", () => {
  state.page += 1;
  renderTable();
});

themeButton.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme || "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

homeLoginButton.addEventListener("click", showLogin);
menuButton.addEventListener("click", toggleMenu);

navButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    setPage(button.dataset.page);
  });
});

window.addEventListener("popstate", () => {
  setPage(pageFromUrl(), false);
});

loginForm.addEventListener("submit", signIn);
accountButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});
signOutButton.addEventListener("click", signOut);

async function startApp() {
  loadTheme();
  await loadSummary();

  if (await setupAuth()) {
    showAppShell();
    showHomeShell();
    await setPage(pageFromUrl(), false);
  }
}
startApp();




