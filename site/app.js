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
  dataAccess: null,
  selectedPlayerIds: new Set(),
  watchlistPlayerIds: new Set(),
  tablePageStates: {},
  toastTimer: null,
  menuAnimationTimer: null,
  menuOpen: true,
  playerAttributeView: "attributes",
  trainingAdjustments: {},
  searchRenderTimer: null,
  searchIndex: [],
  recentSearchPlayerIds: [],
};

const flagColumn = "nationality_flag";
const baseColumns = ["player_id", flagColumn, "name", "nationality", "age", "positions", "player_seasons"];
const statColumns = ["overall", "pace", "shooting", "passing", "dribbling", "defense", "physical"];
const agentColumn = "wallet_name";
const linkColumn = "player_link";

const tablePages = new Set(["database", "progression", "watchlist"]);
const pageViewOptions = {
  database: ["attributes", "next"],
  progression: ["current", "all"],
  watchlist: ["attributes", "next", "current", "all"],
};
const defaultPageViews = {
  database: "attributes",
  progression: "current",
  watchlist: "current",
};

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
  next: {
    columns: [...baseColumns, ...statColumns, agentColumn, linkColumn],
    progressionSuffix: null,
  },
};

const tableColumnClasses = {
  player_id: "col-id",
  nationality_flag: "col-flag",
  name: "col-name",
  nationality: "col-nationality",
  age: "col-age",
  positions: "col-positions",
  player_seasons: "col-seasons",
  wallet_name: "col-agent",
  player_link: "col-link",
};

function tableColumnClass(column) {
  if (column === "overall") {
    return "col-stat col-overall";
  }

  return statColumns.includes(column) ? "col-stat" : tableColumnClasses[column] || "";
}
const columnLabels = {
  player_id: "ID",
  nationality_flag: "",
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
const GUEST_WATCHLIST_STORAGE_KEY = "mfl-guest-watchlist-v1";
const DATA_CACHE_NAME = "mfl-front-office-data-v1";
const DATA_CACHE_VERSION_KEY = "mfl-data-cache-version";
const DATA_CACHE_MANIFEST_KEY = "mfl-data-cache-manifest";
const POSITION_ORDER = ["GK", "RB", "LB", "CB", "RWB", "LWB", "CDM", "RM", "LM", "CM", "CAM", "RW", "LW", "CF", "ST"];
const PITCH_ROWS = [["ST"], ["LW", "CF", "RW"], ["CAM"], ["LM", "CM", "RM"], ["LWB", "CDM", "RWB"], ["LB", "CB", "RB"], ["GK"]];
const POSITION_GROUP_WEIGHTS = {
  ST: { passing: 10, shooting: 46, defense: 0, dribbling: 29, pace: 10, physical: 5, goalkeeping: 0 },
  CF: { passing: 24, shooting: 23, defense: 0, dribbling: 40, pace: 13, physical: 0, goalkeeping: 0 },
  LW: { passing: 24, shooting: 23, defense: 0, dribbling: 40, pace: 13, physical: 0, goalkeeping: 0 },
  RW: { passing: 24, shooting: 23, defense: 0, dribbling: 40, pace: 13, physical: 0, goalkeeping: 0 },
  CAM: { passing: 34, shooting: 21, defense: 0, dribbling: 38, pace: 7, physical: 0, goalkeeping: 0 },
  CM: { passing: 43, shooting: 12, defense: 10, dribbling: 29, pace: 0, physical: 6, goalkeeping: 0 },
  LM: { passing: 43, shooting: 12, defense: 10, dribbling: 29, pace: 0, physical: 6, goalkeeping: 0 },
  RM: { passing: 43, shooting: 12, defense: 10, dribbling: 29, pace: 0, physical: 6, goalkeeping: 0 },
  CDM: { passing: 28, shooting: 0, defense: 40, dribbling: 17, pace: 0, physical: 15, goalkeeping: 0 },
  LWB: { passing: 19, shooting: 0, defense: 44, dribbling: 17, pace: 10, physical: 10, goalkeeping: 0 },
  RWB: { passing: 19, shooting: 0, defense: 44, dribbling: 17, pace: 10, physical: 10, goalkeeping: 0 },
  LB: { passing: 19, shooting: 0, defense: 44, dribbling: 17, pace: 10, physical: 10, goalkeeping: 0 },
  RB: { passing: 19, shooting: 0, defense: 44, dribbling: 17, pace: 10, physical: 10, goalkeeping: 0 },
  CB: { passing: 5, shooting: 0, defense: 64, dribbling: 9, pace: 2, physical: 20, goalkeeping: 0 },
  GK: { passing: 0, shooting: 0, defense: 0, dribbling: 0, pace: 0, physical: 0, goalkeeping: 100 },
};
const FAMILIARITY_PENALTIES = { primary: 0, secondary: -1, fair: -5, some: -8 };
const POSITION_FAMILIARITY = {
  GK: {},
  CB: { RB: "some", LB: "some", CDM: "some" },
  RB: { CB: "some", LB: "some", RWB: "fair", RM: "some" },
  LB: { CB: "some", RB: "some", LWB: "fair", LM: "some" },
  RWB: { RB: "fair", RM: "some", RW: "some" },
  LWB: { LB: "fair", LM: "some", LW: "some" },
  CDM: { CB: "some", CM: "fair", CAM: "some" },
  CM: { CDM: "fair", CAM: "fair", RM: "some", LM: "some" },
  CAM: { CDM: "some", CM: "fair", CF: "fair" },
  RM: { RB: "some", RWB: "some", CM: "some", LM: "some", RW: "fair" },
  LM: { LB: "some", LWB: "some", CM: "some", RM: "some", LW: "fair" },
  RW: { RWB: "some", RM: "fair", LW: "some" },
  LW: { LWB: "some", LM: "fair", RW: "some" },
  CF: { CAM: "fair", ST: "fair" },
  ST: { CF: "fair" },
};

const auth = {
  required: false,
  client: null,
  session: null,
  savedTableState: null,
  saveTimer: null,
  initialized: false,
};

const loadingScreen = document.querySelector("#loadingScreen");
const loadingText = document.querySelector("#loadingText");
const loadingBarFill = document.querySelector("#loadingBarFill");
const loginScreen = document.querySelector("#loginScreen");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginButton = document.querySelector("#loginButton");
const loginBackButton = document.querySelector("#loginBackButton");
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
const playerPage = document.querySelector("#playerPage");
const playerDetail = document.querySelector("#playerDetail");
const changelogPage = document.querySelector("#changelogPage");
const navButtons = document.querySelectorAll(".navButton");
const brandLinks = document.querySelectorAll(".brandLink");
const openSearchButton = document.querySelector("#openSearchButton");
const searchModal = document.querySelector("#searchModal");
const closeSearchButton = document.querySelector("#closeSearchButton");
const playerSearchInput = document.querySelector("#playerSearchInput");
const playerSearchResults = document.querySelector("#playerSearchResults");
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
  themeButton.textContent = theme === "dark" ? "\u2600\uFE0F" : "\u{1F319}";
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

async function finishLoading() {
  await paintLoadingProgress();
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  loadingScreen.classList.add("complete");
  loadingText.textContent = "Loading complete";
  await new Promise((resolve) => window.setTimeout(resolve, 450));
  loadingScreen.classList.add("leaving");
  await new Promise((resolve) => window.setTimeout(resolve, 220));
  loadingScreen.hidden = true;
  loadingScreen.classList.remove("complete", "leaving");
  document.body.classList.remove("loading");
  revealAppShell();
}

function revealAppShell() {
  document.body.classList.remove("booting");
}

function updateMenuVisibility() {
  const showMenu = !document.body.classList.contains("auth");
  menuRail.hidden = !showMenu;
  menuButton.hidden = !showMenu;
  sidebar.hidden = !showMenu;
  appShell.classList.toggle("menuClosed", !state.menuOpen);
  statusText.hidden = false;
  menuButton.setAttribute("aria-expanded", String(showMenu && state.menuOpen));
}

function setHomeLoginSigningIn() {
  homeLoginButton.hidden = false;
  homeLoginButton.disabled = true;
  homeLoginButton.classList.add("signingIn");
  homeLoginButton.innerHTML = '<span class="buttonGear" aria-hidden="true">&#9881;</span><span class="homeLoginButtonText">Signing in</span>';
}

function hasSavedSupabaseSession() {
  try {
    return Object.keys(localStorage).some((key) => key.startsWith("sb-") && key.endsWith("-auth-token"));
  } catch {
    return false;
  }
}

function setHomeLoginRestoringIfNeeded() {
  if (pageFromUrl() === "changelog") {
    hideHomeLoginButton();
    return;
  }

  if (hasSavedSupabaseSession()) {
    setHomeLoginSigningIn();
  } else {
    setHomeLoginReady();
  }
}

function setHomeLoginReady() {
  homeLoginButton.hidden = false;
  homeLoginButton.disabled = false;
  homeLoginButton.classList.remove("signingIn");
  homeLoginButton.textContent = "Sign In";
}

function hideHomeLoginButton() {
  homeLoginButton.hidden = true;
  homeLoginButton.disabled = false;
  homeLoginButton.classList.remove("signingIn");
  homeLoginButton.textContent = "Sign In";
}

function syncHomeLoginButton() {
  if (pageFromUrl() === "changelog" || state.currentPage === "changelog" || !auth.required || auth.session) {
    hideHomeLoginButton();
    return;
  }

  setHomeLoginReady();
}

function pageRequiresData(pageName) {
  return tablePages.has(pageName) || pageName === "player";
}

function pageRequiresLogin(pageName) {
  return pageName === "progression";
}

function pageRequiresFullData(pageName) {
  return pageName === "progression" || (pageName === "player" && Boolean(auth.session)) || (pageName === "watchlist" && Boolean(auth.session));
}

async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {
  const needsDataFirst = pageRequiresData(pageName) && !state.dataLoaded;

  if (!needsDataFirst) {
    document.body.classList.remove("loading");
    loadingScreen.hidden = true;
  }

  document.body.classList.remove("auth");
  loginScreen.hidden = true;
  accountMenu.hidden = !auth.required;
  syncHomeLoginButton();
  updateAccountState();
  const result = await setPage(pageName, updateUrl, options);
  syncHomeLoginButton();
  updateMenuVisibility();
  revealAppShell();
  return result;
}

function showLogin(returnPage = pageFromUrl()) {
  state.loginReturnPage = returnPage;
  menuRail.hidden = true;
  menuButton.hidden = true;
  sidebar.hidden = true;
  document.body.classList.add("auth");
  document.body.classList.remove("loading");
  revealAppShell();
  loadingScreen.hidden = true;
  loginScreen.hidden = false;
  accountMenu.hidden = !auth.required;
  updateAccountState();
  updateMenuVisibility();
  closeAccountMenu();
  window.setTimeout(() => loginEmail.focus(), 0);
}

function openLoginFromCurrentPage() {
  const returnPage = window.location.pathname || "/";
  window.history.pushState({ login: true }, "", returnPage);
  showLogin(returnPage);
}

function goBackFromLogin() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  const returnTarget = pageTargetFromPath(state.loginReturnPage || "/");
  showHomeShell(returnTarget.pageName, false, returnTarget.options);
}

function showAppShell() {
  document.body.classList.remove("auth");
  loginScreen.hidden = true;
  accountMenu.hidden = !auth.required;
  syncHomeLoginButton();
  updateAccountState();
}

function showLoading() {
  document.body.classList.add("booting", "loading");
  loadingScreen.hidden = false;
  loadingScreen.classList.remove("failed", "complete", "leaving");
  updateLoadingProgress(0, 0);
}

async function setupAuth() {
  setHomeLoginRestoringIfNeeded();
  let configResponse;

  try {
    configResponse = await fetch("/api/config", { cache: "no-store" });
  } catch {
    auth.required = false;
    auth.initialized = true;
    return true;
  }

  if (!configResponse.ok) {
    auth.required = false;
    auth.initialized = true;
    return true;
  }

  const config = await configResponse.json();
  auth.required = true;
  auth.initialized = true;

  if (!window.supabase) {
    showLoadingError("Login library could not be loaded.");
    return false;
  }

  auth.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data } = await auth.client.auth.getSession();
  auth.session = data.session;
  syncHomeLoginButton();

  if (!auth.session) {
    await showHomeShell(pageFromUrl(), false);
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

function currentDataAccess() {
  return auth.required && !auth.session ? "public" : "full";
}

function dataFileUrl(fileName) {
  if (!auth.required) {
    return `/data/${fileName}`;
  }

  const query = new URLSearchParams({ file: fileName });
  if (!auth.session) {
    query.set("access", "public-database");
  }
  return `/api/data?${query.toString()}`;
}

function cacheRequestForDataFile(fileName) {
  return new Request(`/data-cache/${currentDataAccess()}/${fileName}`);
}

async function readCachedDataFile(fileName) {
  if (!("caches" in window)) {
    return null;
  }

  const cache = await caches.open(DATA_CACHE_NAME);
  const response = await cache.match(cacheRequestForDataFile(fileName));
  return response ? response.json() : null;
}

async function writeCachedDataFile(fileName, data) {
  if (!("caches" in window)) {
    return;
  }

  const cache = await caches.open(DATA_CACHE_NAME);
  await cache.put(
    cacheRequestForDataFile(fileName),
    new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } }),
  );
}

async function clearDataCache() {
  if ("caches" in window) {
    await caches.delete(DATA_CACHE_NAME);
  }
}

async function fetchDataFile(fileName, options = {}) {
  const { useCache = false, writeCache = false } = options;

  if (useCache) {
    const cached = await readCachedDataFile(fileName);

    if (cached) {
      return cached;
    }
  }

  const response = await fetch(dataFileUrl(fileName), {
    cache: fileName === "manifest.json" ? "no-store" : "default",
    headers: auth.required && auth.session ? authHeaders() : {},
  });

  if (response.status === 401) {
    auth.session = null;
    showLogin();
    throw new Error("Login required.");
  }

  if (!response.ok) {
    let message = auth.required ? "Protected website data could not be loaded." : "No exported data found yet.";

    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Keep the default message if the API did not return JSON.
    }

    throw new Error(message);
  }

  const data = await response.json();

  if (writeCache) {
    await writeCachedDataFile(fileName, data);
  }

  return data;
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
  syncHomeLoginButton();
  await loadCloudTableState();
  mergeGuestWatchlistIntoAccount();
  loginPassword.value = "";
  const returnTarget = pageTargetFromPath(state.loginReturnPage || window.location.pathname || "/");
  showAppShell();
  await showHomeShell(returnTarget.pageName, false, returnTarget.options);
}

async function signOut() {
  if (auth.client) {
    await auth.client.auth.signOut();
  }

  window.location.href = "/";
}

function accountName() {
  const email = auth.session?.user?.email || "";
  return email.split("@")[0] || "Guest";
}

function updateAccountState() {
  const signedIn = Boolean(auth.session);
  accountEmail.textContent = accountName();
  signOutButton.textContent = signedIn ? "Sign Out" : "Sign In";
  signOutButton.classList.toggle("signInAction", !signedIn);
}

function handleAccountAction() {
  closeAccountMenu();

  if (auth.session) {
    signOut();
    return;
  }

  openLoginFromCurrentPage();
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
  appShell.classList.add("menuAnimating");
  window.clearTimeout(state.menuAnimationTimer);
  state.menuOpen = !state.menuOpen;
  updateMenuVisibility();
  state.menuAnimationTimer = window.setTimeout(() => {
    appShell.classList.remove("menuAnimating");
  }, 220);
  saveTableState();
}

function playerIdFromUrl() {
  const match = window.location.pathname.match(/^\/players\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function pageFromUrl() {
  const pageName = window.location.pathname.replace(/^\//, "");

  if (playerIdFromUrl()) {
    return "player";
  }

  return ["home", "database", "progression", "watchlist", "changelog"].includes(pageName) ? pageName : "home";
}

function pageTargetFromPath(path) {
  const playerMatch = String(path || "").match(/^\/players\/([^/]+)$/);

  if (playerMatch) {
    return {
      pageName: "player",
      options: { playerId: decodeURIComponent(playerMatch[1]) },
    };
  }

  const pageName = String(path || "").replace(/^\//, "") || "home";
  return {
    pageName: ["home", "database", "progression", "watchlist", "changelog"].includes(pageName) ? pageName : "home",
    options: {},
  };
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

function pagePath(pageName, options = {}) {
  if (pageName === "player") {
    const playerId = options.playerId || playerIdFromUrl();
    return playerId ? `/players/${encodeURIComponent(playerId)}` : window.location.pathname;
  }

  return pageName === "home" ? "/" : `/${pageName}`;
}

function updatePageUrl(pageName, options = {}) {
  if (!options.updateUrl) {
    return;
  }

  const targetPath = pagePath(pageName, options);
  if (window.location.pathname !== targetPath) {
    window.history.pushState({}, "", targetPath);
  }
}

async function setPage(pageName, updateHash = true, options = {}) {
  document.body.dataset.page = pageName;
  updatePageUrl(pageName, { ...options, updateUrl: updateHash });

  if (auth.initialized && auth.required && !auth.session && pageRequiresLogin(pageName)) {
    state.currentPage = pageName;
    homePage.hidden = true;
    progressionPage.hidden = true;
    playerPage.hidden = true;
    changelogPage.hidden = true;
    showLogin(pagePath(pageName, options));
    return false;
  }

  const previousTablePage = tablePageKey();
  if (previousTablePage) {
    state.tablePageStates[previousTablePage] = currentTablePageState();
    saveTableState();
  }

  const tablePage = tablePages.has(pageName);
  const playerPageActive = pageName === "player";

  if (pageRequiresFullData(pageName) && state.dataAccess !== "full") {
    state.dataLoaded = false;
    state.rows = [];
    state.filteredRows = [];
  }

  if ((tablePage || playerPageActive) && !state.dataLoaded) {
    state.currentPage = pageName;
    homePage.hidden = true;
    progressionPage.hidden = true;
    playerPage.hidden = true;
    changelogPage.hidden = true;
    const loaded = await ensureProgressionData();

    if (!loaded) {
      return;
    }
  }

  state.currentPage = pageName;
  homePage.hidden = pageName !== "home";
  progressionPage.hidden = !tablePage;
  playerPage.hidden = !playerPageActive;
  changelogPage.hidden = pageName !== "changelog";
  tablePageTitle.textContent = pageName === "watchlist" ? "Watchlist" : pageName === "database" ? "Database" : "Progression";
  if (tablePage) {
    restoreSavedTableState(pageName);
    updateViewButtons();
    buildHeader();
  }
  emptyState.textContent = pageName === "watchlist"
    ? "No players in your watchlist yet."
    : "No players match the current filters.";

  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  if (playerPageActive) {
    const playerId = options.playerId || playerIdFromUrl();
    renderPlayerPage(playerId);
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }

    syncHomeLoginButton();
    return;
  }
  if (tablePage && state.rows.length) {
    state.page = 1;
    applyFilters();
  }

  if (document.body.classList.contains("loading")) {
    await finishLoading();
  }

  syncHomeLoginButton();
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
  return tablePages.has(pageName) ? pageName : null;
}

function allowedViewsForPage(pageName = tablePageKey() || "progression") {
  if (pageName === "watchlist" && auth.required && !auth.session) {
    return ["attributes", "next"];
  }

  return pageViewOptions[pageName] || pageViewOptions.progression;
}

function defaultViewForPage(pageName = tablePageKey() || "progression") {
  if (pageName === "watchlist" && auth.required && !auth.session) {
    return "attributes";
  }

  return defaultPageViews[pageName] || "current";
}

function normalizeViewForPage(viewName, pageName = tablePageKey() || "progression") {
  return allowedViewsForPage(pageName).includes(viewName) ? viewName : defaultViewForPage(pageName);
}

function updateViewButtons() {
  const allowedViews = allowedViewsForPage();

  viewButtons.forEach((button) => {
    const allowed = allowedViews.includes(button.dataset.view);
    button.hidden = !allowed;
    button.classList.toggle("active", allowed && button.dataset.view === state.view);
  });
}

function defaultTablePageState(pageName = tablePageKey() || "progression") {
  return {
    hideRetired: true,
    hideRetiring: false,
    newMints: false,
    pageSize: 100,
    view: defaultViewForPage(pageName),
    sortKey: "overall",
    sortDirection: "desc",
    rules: [],
    selectedPlayerIds: [],
  };
}

function scheduleToastHide(toast) {
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 2200);
}

function hideToast() {
  const toast = document.querySelector("#toastMessage");
  if (!toast) {
    return;
  }

  window.clearTimeout(state.toastTimer);
  toast.classList.remove("visible");
}

function showToast(message) {
  let toast = document.querySelector("#toastMessage");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastMessage";
    toast.className = "toastMessage";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.addEventListener("mouseenter", () => window.clearTimeout(state.toastTimer));
    toast.addEventListener("mouseleave", () => scheduleToastHide(toast));
    document.body.appendChild(toast);
  }

  toast.replaceChildren();
  if (message instanceof Node) {
    toast.appendChild(message);
  } else {
    toast.textContent = message;
  }
  toast.classList.add("visible");
  scheduleToastHide(toast);
}

function showWatchlistToast(prefix) {
  const content = document.createElement("span");
  const watchlistLink = document.createElement("button");

  content.className = "toastWatchlistContent";
  content.append(document.createTextNode(`${prefix} `));
  watchlistLink.type = "button";
  watchlistLink.className = "toastLink";
  watchlistLink.textContent = "watchlist";
  watchlistLink.addEventListener("click", () => {
    hideToast();
    setPage("watchlist");
  });
  content.appendChild(watchlistLink);
  content.append(document.createTextNode("."));
  showToast(content);
}
function saveGuestWatchlist() {
  if (auth.session) {
    return;
  }

  try {
    localStorage.setItem(GUEST_WATCHLIST_STORAGE_KEY, JSON.stringify(Array.from(state.watchlistPlayerIds)));
  } catch {
    // Watchlist still works for this page even if the browser blocks storage.
  }
}

function loadGuestWatchlist() {
  try {
    const ids = JSON.parse(localStorage.getItem(GUEST_WATCHLIST_STORAGE_KEY) || "[]");
    return Array.isArray(ids) ? ids.map((playerId) => String(playerId)) : [];
  } catch {
    return [];
  }
}

function mergeGuestWatchlistIntoAccount() {
  const guestIds = loadGuestWatchlist();

  if (!guestIds.length) {
    return;
  }

  guestIds.forEach((playerId) => state.watchlistPlayerIds.add(String(playerId)));
  localStorage.removeItem(GUEST_WATCHLIST_STORAGE_KEY);
  saveTableState();
}

function saveTableState() {
  const savedState = currentTableState();
  auth.savedTableState = savedState;

  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(savedState));
  } catch {
    // Filtering still works for this page even if the browser blocks storage.
  }

  saveGuestWatchlist();
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
    recentSearchPlayerIds: state.recentSearchPlayerIds,
    playerAttributeView: state.playerAttributeView,
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
  restoreRecentSearchState(auth.savedTableState);
  restorePlayerAttributeView(auth.savedTableState);
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

function restoreRecentSearchState(savedState) {
  const ids = Array.isArray(savedState?.recentSearchPlayerIds) ? savedState.recentSearchPlayerIds : [];
  state.recentSearchPlayerIds = ids.map((playerId) => String(playerId)).slice(0, 5);
}

function allowedPlayerAttributeViews() {
  return auth.required && !auth.session
    ? [["attributes", "Attributes"], ["training", "Training"], ["next", "Next Overall"]]
    : [["attributes", "Attributes"], ["training", "Training"], ["next", "Next Overall"], ["current", "Current Season"], ["all", "All Time"]];
}

function normalizePlayerAttributeView(viewName) {
  const allowedViews = allowedPlayerAttributeViews().map(([view]) => view);
  return allowedViews.includes(viewName) ? viewName : allowedViews[0];
}

function restorePlayerAttributeView(savedState) {
  if (["attributes", "training", "current", "all", "next"].includes(savedState?.playerAttributeView)) {
    state.playerAttributeView = normalizePlayerAttributeView(savedState.playerAttributeView);
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

function applyGuestWatchlistIfNeeded() {
  if (auth.session) {
    return;
  }

  const guestIds = loadGuestWatchlist();
  if (guestIds.length) {
    state.watchlistPlayerIds = new Set(guestIds);
  }
}

function loadSavedTableState() {
  if (auth.savedTableState) {
    restoreTablePageStates(auth.savedTableState);
    restoreWatchlistState(auth.savedTableState);
    restoreMenuState(auth.savedTableState);
    restoreRecentSearchState(auth.savedTableState);
    restorePlayerAttributeView(auth.savedTableState);
    applyGuestWatchlistIfNeeded();
    return auth.savedTableState;
  }

  try {
    const savedState = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
    restoreTablePageStates(savedState);
    restoreWatchlistState(savedState);
    restoreMenuState(savedState);
    restoreRecentSearchState(savedState);
    restorePlayerAttributeView(savedState);
    applyGuestWatchlistIfNeeded();
    return savedState;
  } catch {
    applyGuestWatchlistIfNeeded();
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

function uniqueNationalityValues() {
  return uniqueColumnValues("nationality")
    .map((value) => ({ value, label: formatNationality(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
  const index = state.columns.indexOf(column);
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

function formatFootedness(value) {
  const text = formatPlainValue(value, "preferred_foot");

  if (text === "NULL") {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
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
  return state.columns.includes(column);
}

function precomputedValue(row, column) {
  return hasColumn(column) ? getValue(row, column) : null;
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
      text: `+${formatDecimal(neededStatGain, 1)}`,
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
    text: `+${formatDecimal(neededStatGain, 1)}`,
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

  if (column === flagColumn) {
    return "";
  }

  if (column === "nationality") {
    return formatNationality(getValue(row, column));
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
      emoji: "\u{1F3C1}",
      label: "Retired",
    };
  }

  if ([1, 2, 3].includes(retirementYears)) {
    return {
      emoji: "\u23F3",
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
  markerElement.dataset.tooltip = marker.label;
  markerElement.setAttribute("aria-label", marker.label);
  cell.appendChild(markerElement);
}

function playerRoute(playerId) {
  return `/players/${encodeURIComponent(playerId)}`;
}

function rowByPlayerId(playerId) {
  const key = String(playerId);
  return state.rows.find((row) => String(getValue(row, "player_id")) === key) || null;
}

function buildSearchIndex() {
  state.searchIndex = state.rows.map((row) => ({
    row,
    id: String(getValue(row, "player_id") || "").toLowerCase(),
    name: String(getValue(row, "name") || "").toLowerCase(),
    overall: Number(statDisplayValue(row, "overall") || 0),
  }));
}

function openPlayerPage(playerId) {
  setPage("player", true, { playerId: String(playerId) });
}

function toggleWatchlistPlayer(playerId, rerender = false) {
  const key = String(playerId);
  const playerName = rowByPlayerId(key) ? formatCellValue(rowByPlayerId(key), "name") : `Player ${key}`;
  const added = !state.watchlistPlayerIds.has(key);

  if (added) {
    state.watchlistPlayerIds.add(key);
  } else {
    state.watchlistPlayerIds.delete(key);
  }

  saveTableState();
  showWatchlistToast(`${playerName} ${added ? "added to" : "removed from"}`);

  if (state.currentPage === "watchlist") {
    applyFilters();
  } else if (rerender) {
    renderTable();
  }

  if (state.currentPage === "player") {
    renderPlayerPage(key);
  }
}

function createWatchlistStar(playerId, labelText = "player") {
  const key = String(playerId);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "watchlistStar";
  button.classList.toggle("active", state.watchlistPlayerIds.has(key));
  button.textContent = state.watchlistPlayerIds.has(key) ? "\u2605" : "\u2606";
  button.title = state.watchlistPlayerIds.has(key) ? "Remove from watchlist" : "Add to watchlist";
  button.setAttribute("aria-label", `${button.title}: ${labelText}`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleWatchlistPlayer(key, true);
  });
  return button;
}

function countryCodeForNationality(nationality) {
  const countryCodes = {
    ALBANIA: "AL", ALGERIA: "DZ", ARGENTINA: "AR", AUSTRALIA: "AU", AUSTRIA: "AT",
    BELGIUM: "BE", BOSNIA_AND_HERZEGOVINA: "BA", BRAZIL: "BR", CAMEROON: "CM",
    CANADA: "CA", CAPE_VERDE_ISLANDS: "CV", CHILE: "CL", COLOMBIA: "CO", CONGO_DR: "CD",
    COSTA_RICA: "CR", COTE_D_IVOIRE: "CI", CROATIA: "HR", CURACAO: "CW", CZECH_REPUBLIC: "CZ",
    CZECHIA: "CZ", DENMARK: "DK", ECUADOR: "EC", EGYPT: "EG",
    ENGLAND: "1f3f4-e0067-e0062-e0065-e006e-e0067-e007f", FINLAND: "FI", FRANCE: "FR",
    GEORGIA: "GE", GERMANY: "DE", GHANA: "GH", HAITI: "HT", HUNGARY: "HU", IRAN: "IR",
    IRAQ: "IQ", ITALY: "IT", IVORY_COAST: "CI", JAPAN: "JP", JORDAN: "JO",
    KOREA_REPUBLIC: "KR", MEXICO: "MX", MOROCCO: "MA", NETHERLANDS: "NL", NEW_ZEALAND: "NZ",
    NIGERIA: "NG", NORWAY: "NO", PANAMA: "PA", PARAGUAY: "PY", PERU: "PE", POLAND: "PL",
    PORTUGAL: "PT", QATAR: "QA", REPUBLIC_OF_IRELAND: "IE", ROMANIA: "RO", RUSSIA: "RU",
    SAUDI_ARABIA: "SA", SCOTLAND: "1f3f4-e0067-e0062-e0073-e0063-e0074-e007f", SENEGAL: "SN",
    SERBIA: "RS", SLOVAKIA: "SK", SLOVENIA: "SI", SOUTH_AFRICA: "ZA", SOUTH_KOREA: "KR",
    SPAIN: "ES", SWEDEN: "SE", SWITZERLAND: "CH", TUNISIA: "TN", TURKEY: "TR", UKRAINE: "UA",
    UNITED_KINGDOM: "GB", UNITED_STATES: "US", UNITED_STATES_OF_AMERICA: "US", URUGUAY: "UY",
    USA: "US", UZBEKISTAN: "UZ", WALES: "1f3f4-e0067-e0062-e0077-e006c-e0073-e007f"
  };
  const countryKey = String(nationality || "")
    .toUpperCase()
    .replaceAll("&", "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return countryCodes[countryKey] || null;
}

function countryFlagHtml(nationality) {
  const code = countryCodeForNationality(nationality);

  if (!code) {
    return '<span class="flagText" aria-hidden="true">-</span>';
  }

  const codepoints = code.includes("-")
    ? code
    : code
      .toUpperCase()
      .split("")
      .map((character) => (127397 + character.charCodeAt(0)).toString(16))
      .join("-");
  return `<img class="flagImage" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints}.svg" alt="">`;
}

function rarityColorForOverall(overall) {
  const value = Number(overall || 0);

  if (value >= 95) return "#00ffe9";
  if (value >= 85) return "#fa53ff";
  if (value >= 75) return "#0077ff";
  if (value >= 65) return "#71ff30";
  if (value >= 55) return "#ecd17f";
  return "#bebebe";
}

function playerPositionSet(row) {
  return new Set(playerPositions(row));
}

function familiarityForPosition(row, position) {
  const positions = playerPositions(row);
  const primary = positions[0];

  if (!primary) {
    return null;
  }

  if (position === primary) {
    return "primary";
  }

  if (positions.includes(position)) {
    return "secondary";
  }

  return POSITION_FAMILIARITY[primary]?.[position] || null;
}

function weightedPositionOverall(row, position, familiarity = "primary") {
  const weights = POSITION_GROUP_WEIGHTS[position];

  if (!weights || !familiarity) {
    return null;
  }

  const penalty = FAMILIARITY_PENALTIES[familiarity] || 0;
  const weighted = Object.entries(weights).reduce((total, [attribute, weight]) => {
    const raw = Number(getValue(row, attribute) || 0);
    return total + ((raw + penalty) * weight) / 100;
  }, 0);
  return Math.max(0, weighted);
}

function positionRating(row, position, familiarity) {
  const weighted = weightedPositionOverall(row, position, familiarity);
  return weighted === null ? null : Math.round(weighted);
}

function renderPitch(row) {
  const pitchLines = `<span class="pitchLine pitchBoxTop"></span><span class="pitchLine pitchGoalTop"></span><span class="pitchLine pitchArcTop"></span><span class="pitchLine pitchBoxBottom"></span><span class="pitchLine pitchGoalBottom"></span><span class="pitchLine pitchArcBottom"></span>`;
  return pitchLines + PITCH_ROWS.map((pitchRow) => `
    <div class="pitchRow pitchRow${pitchRow.length}" style="--pitch-columns: ${pitchRow.length}">
      ${pitchRow.map((position) => {
        const familiarity = familiarityForPosition(row, position);
        const rating = positionRating(row, position, familiarity);
        const content = familiarity
          ? `<span class="pitchPositionCircle ${familiarity}" title="${position} ${rating}"><strong>${rating}</strong><small>${position}</small></span>`
          : `<span class="pitchPositionBlank" aria-hidden="true"></span>`;
        return `<div class="pitchPositionSlot">${content}</div>`;
      }).join("")}
    </div>`).join("");
}

function playerPositions(row) {
  return String(getValue(row, "positions") || "")
    .split(",")
    .map((position) => position.trim())
    .filter(Boolean);
}

function playerIsGoalkeeper(row) {
  return playerPositions(row)[0] === "GK";
}

function statDisplayValue(row, statColumn) {
  if (statColumn === "overall" && playerIsGoalkeeper(row)) {
    const goalkeeping = getValue(row, "goalkeeping");
    if (goalkeeping !== null && goalkeeping !== undefined && goalkeeping !== "") {
      return goalkeeping;
    }
  }
  return getValue(row, statColumn);
}

function progressionValue(row, statColumn, suffix) {
  return Number(getValue(row, `${statColumn}_${suffix}`) || 0);
}

function playerTrainingKey(row) {
  return String(getValue(row, "player_id") || "");
}

function trainingStatColumns(row) {
  return playerAttributeColumns(row).filter((column) => column !== "overall");
}

function setRowValue(row, column, value) {
  const index = state.columns.indexOf(column);
  if (index >= 0) {
    row[index] = value;
  }
}

function trainingAdjustmentFor(row, column) {
  const key = playerTrainingKey(row);
  return Number(state.trainingAdjustments[key]?.[column] || 0);
}

function adjustedTrainingValue(row, column) {
  const base = Number(getValue(row, column) || 0);
  return Math.max(0, Math.min(99, base + trainingAdjustmentFor(row, column)));
}

function trainingRow(row) {
  const adjustedRow = [...row];

  trainingStatColumns(row).forEach((column) => {
    setRowValue(adjustedRow, column, adjustedTrainingValue(row, column));
  });

  if (!playerIsGoalkeeper(adjustedRow)) {
    setRowValue(adjustedRow, "overall", Math.round(primaryPreciseOverall(adjustedRow)));
  }

  return adjustedRow;
}

function adjustTrainingStat(playerId, column, delta) {
  const row = rowByPlayerId(playerId);

  if (!row || !trainingStatColumns(row).includes(column)) {
    return;
  }

  const key = playerTrainingKey(row);
  const currentAdjustment = trainingAdjustmentFor(row, column);
  const baseValue = Number(getValue(row, column) || 0);
  const nextValue = Math.max(0, Math.min(99, baseValue + currentAdjustment + delta));
  const nextAdjustment = nextValue - baseValue;

  state.trainingAdjustments[key] = { ...(state.trainingAdjustments[key] || {}) };

  if (nextAdjustment === 0) {
    delete state.trainingAdjustments[key][column];
  } else {
    state.trainingAdjustments[key][column] = nextAdjustment;
  }

  if (!Object.keys(state.trainingAdjustments[key]).length) {
    delete state.trainingAdjustments[key];
  }

  renderPlayerPage(playerId);
}

function resetTrainingStats(playerId) {
  const row = rowByPlayerId(playerId);

  if (!row) {
    return;
  }

  delete state.trainingAdjustments[playerTrainingKey(row)];
  renderPlayerPage(playerId);
}

function playerAttributeColumns(row) {
  if (playerIsGoalkeeper(row)) {
    return ["overall", "goalkeeping"].filter((column) => column === "overall" || state.columns.includes(column));
  }

  return ["overall", "pace", "dribbling", "shooting", "defense", "passing", "physical"];
}

function playerAttributeContributionTooltip(row, column) {
  if (column === "overall") {
    return "";
  }

  const primary = playerPositions(row)[0];
  const weight = POSITION_GROUP_WEIGHTS[primary]?.[column];
  const label = column === "goalkeeping" ? "Goalkeeping" : columnLabels[column];

  if (weight === undefined || !primary || !label) {
    return "";
  }

  return ` data-tooltip="${escapeHtml(`${label} contributes to ${weight}% of the overall for the ${primary} position.`)}"`;
}

function primaryPreciseOverall(row) {
  const primary = playerPositions(row)[0];

  if (!primary) {
    return Number(statDisplayValue(row, "overall") || 0);
  }

  const weighted = weightedPositionOverall(row, primary, "primary");
  return weighted === null ? Number(statDisplayValue(row, "overall") || 0) : weighted;
}

function nextOverallTarget(row) {
  const displayedOverall = Math.floor(Number(statDisplayValue(row, "overall") || 0));
  return displayedOverall + 0.5;
}

function nextOverallGap(row) {
  return Math.max(0, nextOverallTarget(row) - primaryPreciseOverall(row));
}

function formatDecimal(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function shortStatLabel(column) {
  return {
    pace: "PAC",
    shooting: "SHO",
    passing: "PAS",
    dribbling: "DRI",
    defense: "DEF",
    physical: "PHY",
    goalkeeping: "GK",
  }[column] || String(columnLabels[column] || column).toUpperCase();
}

function nextOverallColorClass(neededStatGain) {
  if (neededStatGain <= 1) return "easy";
  if (neededStatGain <= 2) return "medium";
  if (neededStatGain <= 3) return "hard";
  return "veryHard";
}

function nextOverallDetailHtml(row, column) {
  const gap = nextOverallGap(row);
  const primary = playerPositions(row)[0];
  const weight = POSITION_GROUP_WEIGHTS[primary]?.[column] || 0;
  const maxOverall = Number(statDisplayValue(row, "overall") || 0) >= 99;

  if (column === "overall") {
    if (maxOverall) {
      return `<span class="nextOverallValue neutral">MAX</span>`;
    }

    return `<span class="nextOverallValue easy">+1 OVR IF +${formatDecimal(gap)}</span>`;
  }

  if (!weight) {
    return `<span class="nextOverallValue neutral">No OVR impact</span>`;
  }

  if (maxOverall || Number(getValue(row, column) || 0) >= 99) {
    return `<span class="nextOverallValue neutral">MAX</span>`;
  }

  const neededStatGain = gap / (weight / 100);
  const colorClass = nextOverallColorClass(neededStatGain);
  return `<span class="nextOverallValue ${colorClass}">+1 OVR IF +${formatDecimal(neededStatGain, 1)} ${escapeHtml(shortStatLabel(column))}</span>`;
}

function playerAttributeValueHtml(row, column, viewName) {
  if (viewName === "training") {
    if (column === "overall") {
      const value = Math.round(primaryPreciseOverall(row));
      return `${escapeHtml(formatPlainValue(value, column))} ${nextOverallDetailHtml(row, column)}`;
    }

    const value = escapeHtml(formatPlainValue(getValue(row, column), column));
    const adjustment = trainingAdjustmentFor(row, column);

    if (adjustment === 0) {
      return value;
    }

    const className = adjustment > 0 ? "positive" : "negative";
    return `${value} <span class="trainingDelta ${className}">${adjustment > 0 ? "+" : ""}${adjustment}</span>`;
  }

  if (viewName === "next") {
    const value = column === "overall" ? primaryPreciseOverall(row) : getValue(row, column);
    const formattedValue = column === "overall" ? formatDecimal(value) : escapeHtml(formatPlainValue(value, column));
    return `${formattedValue} ${nextOverallDetailHtml(row, column)}`;
  }

  const value = column === "overall" ? statDisplayValue(row, column) : getValue(row, column);
  const formattedValue = escapeHtml(formatPlainValue(value, column));

  if (viewName === "attributes") {
    return formattedValue;
  }

  const suffix = viewName === "current" ? "prog_current_season" : "prog_all";
  const progression = progressionValue(row, column, suffix);

  if (progression === 0) {
    return formattedValue;
  }

  const className = progression > 0 ? "positive" : "negative";
  return `${formattedValue} <span class="progressionValue ${className}">(${progression > 0 ? "+" : ""}${progression})</span>`;
}

function renderPlayerAttributePanel(row) {
  const columns = playerAttributeColumns(row);
  const viewName = normalizePlayerAttributeView(state.playerAttributeView);
  state.playerAttributeView = viewName;
  const isTraining = viewName === "training";

  return columns.map((column) => {
    const label = column === "goalkeeping" ? "Goalkeeping" : columnLabels[column];
    const featured = column === "overall" ? " featured" : "";
    const fullWidth = column === "overall" || (playerIsGoalkeeper(row) && column === "goalkeeping") ? " fullWidth" : "";
    const rarityStyle = ` style="--rarity-color: ${rarityColorForOverall(statDisplayValue(row, "overall"))}"`;
    const contributionTooltip = playerAttributeContributionTooltip(row, column);
    const valueHtml = playerAttributeValueHtml(row, column, viewName);
    const trainingControls = isTraining
      ? (column === "overall"
        ? `<span class="trainingStatControls"><button class="trainingResetButton" type="button" data-training-reset="1">Reset</button></span>`
        : `<span class="trainingStatControls"><button type="button" data-training-stat="${escapeHtml(column)}" data-training-delta="-1" aria-label="Reduce ${escapeHtml(label)}">-</button><button type="button" data-training-stat="${escapeHtml(column)}" data-training-delta="1" aria-label="Increase ${escapeHtml(label)}">+</button></span>`)
      : "";
    return `<div class="playerAttributeCard${featured}${fullWidth}${isTraining ? " trainingCard" : ""}"${rarityStyle}><span>${escapeHtml(label)}</span><strong><span class="attributeValueText"${contributionTooltip}>${valueHtml}</span>${trainingControls}</strong></div>`;
  }).join("");
}

async function copyPlayerId(id) {
  try {
    await navigator.clipboard.writeText(String(id));
    showToast(`Player ID ${id} copied.`);
  } catch {
    showToast("Could not copy player ID.");
  }
}
function renderPlayerPage(playerId) {
  const row = rowByPlayerId(playerId);

  if (!row) {
    playerDetail.innerHTML = `<div class="emptyState">Player ${escapeHtml(playerId || "")} was not found.</div>`;
    return;
  }

  const playerName = formatCellValue(row, "name");
  const id = formatCellValue(row, "player_id");
  const nationality = formatCellValue(row, "nationality");
  const rawNationality = getValue(row, "nationality");
  const positions = playerPositions(row);
  const height = formatCellValue(row, "height");
  const heightLabel = height === "NULL" ? height : `${height} cm`;
  const ageMarker = retirementMarker(row);
  const ageMarkerHtml = ageMarker
    ? ` <span class="retirementMarker playerAgeMarker" data-tooltip="${escapeHtml(ageMarker.label)}" aria-label="${escapeHtml(ageMarker.label)}">${ageMarker.emoji}</span>`
    : "";
  const infoCards = [
    ["Nationality", `${countryFlagHtml(rawNationality)} ${escapeHtml(nationality)}`],
    ["Age", `${escapeHtml(formatCellValue(row, "age"))}${ageMarkerHtml}`],
    ["Height", escapeHtml(heightLabel)],
    ["Foot", escapeHtml(formatFootedness(getValue(row, "preferred_foot")))],
    ["Seasons", escapeHtml(formatCellValue(row, "player_seasons"))],
    ["Agent", escapeHtml(formatCellValue(row, "wallet_name"))],
  ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join("");
  state.playerAttributeView = normalizePlayerAttributeView(state.playerAttributeView);
  const displayRow = state.playerAttributeView === "training" ? trainingRow(row) : row;
  const viewButtons = allowedPlayerAttributeViews()
    .map(([view, label]) => `<button class="playerAttributeViewButton ${state.playerAttributeView === view ? "active" : ""}" type="button" data-player-attribute-view="${view}">${label}</button>`)
    .join("");

  playerDetail.innerHTML = `
    <section class="playerHero">
      <div>
        <button id="copyPlayerIdButton" class="playerEyebrow playerIdText" type="button">ID #${escapeHtml(id)}</button>
        <h2>${escapeHtml(playerName)}</h2>
        <p>${escapeHtml(positions.join(", ") || "No positions")}</p>
      </div>
      <div class="playerHeroActions">
        <button id="playerWatchlistButton" class="playerWatchlistButton" type="button"></button>
        <a id="openPlayerExternalButton" class="playerExternalButton" href="${escapeHtml(formatCellValue(row, linkColumn))}" target="_blank" rel="noopener noreferrer">Open link</a>
      </div>
    </section>
    <section class="playerGrid">
      <div class="playerStack">
        <div class="playerPanel playerInfoPanel"><h3>Profile</h3><div class="detailGrid">${infoCards}</div></div>
        <div class="playerPanel attributesPanel"><div class="playerPanelHeader"><h3>Attributes</h3><div class="playerAttributeViews">${viewButtons}</div></div><div class="attributeGrid">${renderPlayerAttributePanel(displayRow)}</div></div>
      </div>
      <div class="playerPanel pitchPanel"><h3>Positions</h3><div class="pitch">${renderPitch(displayRow)}</div></div>
    </section>`;

  const watchButton = playerDetail.querySelector("#playerWatchlistButton");
  const star = createWatchlistStar(id, playerName);
  watchButton.className = `playerWatchlistButton ${star.classList.contains("active") ? "active" : ""}`;
  watchButton.innerHTML = `<span class="watchlistButtonStar">${star.textContent}</span><span>${star.classList.contains("active") ? "In watchlist" : "Add to watchlist"}</span>`;
  watchButton.addEventListener("click", () => toggleWatchlistPlayer(id, true));
  playerDetail.querySelector("#copyPlayerIdButton").addEventListener("click", () => copyPlayerId(id));
  playerDetail.querySelectorAll("[data-player-attribute-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.playerAttributeView = button.dataset.playerAttributeView;
      saveTableState();
      renderPlayerPage(id);
    });
  });
  playerDetail.querySelectorAll("[data-training-stat]").forEach((button) => {
    button.addEventListener("click", () => {
      adjustTrainingStat(id, button.dataset.trainingStat, Number(button.dataset.trainingDelta || 0));
    });
  });
  playerDetail.querySelectorAll("[data-training-reset]").forEach((button) => {
    button.addEventListener("click", () => resetTrainingStats(id));
  });
}

async function openSearch() {
  const loaded = await ensureProgressionData();
  if (!loaded) {
    return;
  }
  if (document.body.classList.contains("loading")) {
    await finishLoading();
  }
  searchModal.hidden = false;
  playerSearchInput.value = "";
  renderSearchResultsNow();
  window.setTimeout(() => playerSearchInput.focus(), 0);
}

function closeSearch() {
  searchModal.hidden = true;
}

function bestSearchResults(query) {
  const bestRows = [];

  if (!state.searchIndex.length && state.rows.length) {
    buildSearchIndex();
  }

  state.searchIndex.forEach((entry) => {
    if (!entry.id.includes(query) && !entry.name.includes(query)) {
      return;
    }

    const insertAt = bestRows.findIndex((candidate) => entry.overall > candidate.overall);

    if (insertAt === -1) {
      if (bestRows.length < 5) {
        bestRows.push(entry);
      }
      return;
    }

    bestRows.splice(insertAt, 0, entry);

    if (bestRows.length > 5) {
      bestRows.pop();
    }
  });

  return bestRows.map((entry) => entry.row);
}

function recentSearchRows() {
  return state.recentSearchPlayerIds
    .map((playerId) => rowByPlayerId(playerId))
    .filter(Boolean);
}

function rememberSearchResult(playerId) {
  const key = String(playerId);
  state.recentSearchPlayerIds = [key, ...state.recentSearchPlayerIds.filter((id) => id !== key)].slice(0, 5);
  saveTableState();
}

function renderSearchResultsNow() {
  const query = playerSearchInput.value.trim().toLowerCase();
  const results = query ? bestSearchResults(query) : recentSearchRows();
  playerSearchResults.classList.add("filledSearchResults");

  if (!results.length) {
    playerSearchResults.classList.remove("filledSearchResults");
    playerSearchResults.innerHTML = `<div class="searchHint">${query ? "No players found." : "Recent players will appear here."}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  results.forEach((row) => {
    const id = String(getValue(row, "player_id"));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "searchResult";
    const ovr = formatPlainValue(statDisplayValue(row, "overall"), "overall");
    button.innerHTML = `<strong>${escapeHtml(formatCellValue(row, "name"))}</strong><span>OVR ${escapeHtml(ovr)} &middot; #${escapeHtml(id)} &middot; ${escapeHtml(formatCellValue(row, "nationality"))} &middot; ${escapeHtml(formatCellValue(row, "positions"))}</span>`;
    button.addEventListener("click", () => {
      rememberSearchResult(id);
      closeSearch();
      openPlayerPage(id);
    });
    fragment.appendChild(button);
  });
  playerSearchResults.replaceChildren(fragment);
}

function renderSearchResults() {
  window.clearTimeout(state.searchRenderTimer);
  state.searchRenderTimer = window.setTimeout(renderSearchResultsNow, 80);
}

function tableNextOverallSortValue(row, statColumn) {
  if (statColumn === "overall") {
    const precomputedOverall = precomputedValue(row, "next_overall");
    return precomputedOverall === null || precomputedOverall === undefined ? primaryPreciseOverall(row) : precomputedOverall;
  }

  const precomputedColumn = `${statColumn}_to_next_overall`;
  const precomputedNeeded = precomputedValue(row, precomputedColumn);

  if (precomputedNeeded !== null && precomputedNeeded !== undefined && precomputedNeeded !== "") {
    return precomputedNeeded;
  }

  if (hasColumn(precomputedColumn)) {
    return null;
  }

  const gap = nextOverallGap(row);
  const primary = playerPositions(row)[0];
  const weight = POSITION_GROUP_WEIGHTS[primary]?.[statColumn] || 0;
  const maxOverall = Number(statDisplayValue(row, "overall") || 0) >= 99;

  if (!weight || maxOverall || Number(getValue(row, statColumn) || 0) >= 99) {
    return null;
  }

  return gap / (weight / 100);
}

function sortableValue(row, column) {
  if (state.view === "next" && statColumns.includes(column)) {
    return tableNextOverallSortValue(row, column);
  }

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
    const columnClass = tableColumnClass(column);
    if (columnClass) {
      cell.classList.add(...columnClass.split(" "));
    }
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
        const defaultDirection = numberColumns.has(column) ? "desc" : "asc";
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

function selectedFilterColumns(exceptRule = null) {
  return new Set(Array.from(filterRules.querySelectorAll(".filterRule"))
    .filter((rule) => rule !== exceptRule)
    .map((rule) => rule.dataset.filterColumn));
}

function populateAddFilterSelect() {
  const selectedColumns = selectedFilterColumns();
  const fragment = document.createDocumentFragment();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select filter...";
  fragment.appendChild(placeholder);

  availableFilterColumns()
    .filter((column) => !selectedColumns.has(column))
    .forEach((column) => {
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
    const values = column === "nationality" ? uniqueNationalityValues() : uniquePositions();
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
  remove.className = "iconButton";
  remove.textContent = "x";
  remove.setAttribute("aria-label", `Remove ${filterLabel(column)} filter`);
  remove.addEventListener("click", () => {
    rule.remove();
    refreshRuleConnectors();
    updateFilterSummary();
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
    const newSelect = buildColumnSelect(rule.dataset.filterColumn, rule);

    newSelect.addEventListener("change", () => {
      const nextColumn = newSelect.value;
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

    oldSelect.replaceWith(newSelect);
  }
}

function restoreSavedTableState(pageName = tablePageKey() || "progression") {
  const savedRoot = loadSavedTableState();
  const savedState = savedRoot?.pages?.[pageName]
    || (pageName === "progression" && !savedRoot?.pages ? savedRoot : null)
    || defaultTablePageState(pageName);

  state.view = normalizeViewForPage(savedState.view, pageName);
  updateViewButtons();

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
  populateAddFilterSelect();
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
    showWatchlistToast(`${selectedCount} player${selectedCount === 1 ? "" : "s"} removed from`);
    return;
  }

  state.selectedPlayerIds.forEach((playerId) => state.watchlistPlayerIds.add(String(playerId)));
  state.selectedPlayerIds.clear();
  saveTableState();
  renderTable();
  updateSelectionBar();
  showWatchlistToast(`${selectedCount} player${selectedCount === 1 ? "" : "s"} added to`);
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
        nameLink.textContent = formatCellValue(row, column);
        nameLink.addEventListener("click", (event) => {
          event.preventDefault();
          openPlayerPage(playerId);
        });
        nameWrap.appendChild(nameLink);
        cell.appendChild(nameWrap);

        appendNameMarker(cell, retirementMarker(row), "retirementMarker");
        appendNameMarker(cell, newMintMarker(row), "newMintMarker");
      } else if (column === flagColumn) {
        cell.classList.add("flagCell");
        cell.innerHTML = countryFlagHtml(getValue(row, "nationality"));
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
  if (!allowedViewsForPage().includes(viewName)) {
    return;
  }

  state.view = viewName;
  state.page = 1;

  if (viewName === "next") {
    state.sortKey = "overall";
    state.sortDirection = "desc";
  }

  removeUnavailableFilterRules();
  populateAddFilterSelect();
  refreshRuleColumnSelects();

  updateViewButtons();

  buildHeader();
  applyFilters();
}

async function loadData() {
  try {
    state.rows = [];
    state.filteredRows = [];
    state.page = 1;
    state.dataAccess = currentDataAccess();
    updateLoadingProgress(0, 0);
    const manifest = await fetchDataFile("manifest.json");
    const cacheVersion = `${manifest.generated_at || ""}:${manifest.row_count || 0}:${(manifest.chunks || []).map((chunk) => chunk.file).join("|")}`;
    const cachedVersion = localStorage.getItem(DATA_CACHE_VERSION_KEY);
    const useCachedChunks = cachedVersion === cacheVersion;

    if (!useCachedChunks) {
      await clearDataCache();
      localStorage.setItem(DATA_CACHE_VERSION_KEY, cacheVersion);
      localStorage.setItem(DATA_CACHE_MANIFEST_KEY, JSON.stringify(manifest));
    }

    state.manifest = manifest;
    state.columns = manifest.columns;
    updateSummaryCounts(manifest.row_count, manifest.wallet_count);
    await paintLoadingProgress();

    for (let index = 0; index < manifest.chunks.length; index += 1) {
      updateLoadingProgress(index + 1, manifest.chunks.length);
      await paintLoadingProgress();
      const chunkInfo = manifest.chunks[index];
      const chunk = await fetchDataFile(chunkInfo.file, { useCache: useCachedChunks, writeCache: !useCachedChunks });
      state.rows.push(...chunk.rows);
    }

    statusText.textContent = `Updated ${new Date(manifest.generated_at).toLocaleString()}`;
    buildSearchIndex();
    populateAddFilterSelect();
    restoreSavedTableState();
    buildHeader();
    applyFilters();
    state.dataLoaded = true;
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  } else if (event.key === "Escape" && !searchModal.hidden) {
    closeSearch();
  } else if (event.key === "Escape" && !filtersModal.hidden) {
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

searchModal.addEventListener("click", (event) => {
  if (event.target === searchModal) {
    closeSearch();
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

homeLoginButton.addEventListener("click", openLoginFromCurrentPage);
menuButton.addEventListener("click", toggleMenu);
brandLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setPage("home");
  });
});

document.querySelectorAll("a[data-page=\"changelog\"]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setPage("changelog");
  });
});
openSearchButton.addEventListener("click", openSearch);
closeSearchButton.addEventListener("click", closeSearch);
playerSearchInput.addEventListener("input", renderSearchResults);

navButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    setPage(button.dataset.page);
  });
});

window.addEventListener("popstate", () => {
  const targetPage = pageFromUrl();

  if (auth.initialized && auth.required && !auth.session && !pageRequiresLogin(targetPage)) {
    showHomeShell(targetPage, false);
    return;
  }

  setPage(targetPage, false);
});

loginForm.addEventListener("submit", signIn);
loginBackButton.addEventListener("click", goBackFromLogin);
accountButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});
signOutButton.addEventListener("click", handleAccountAction);

async function startApp() {
  loadTheme();
  const initialPage = pageFromUrl();
  loadSavedTableState();
  updateMenuVisibility();

  if (pageRequiresData(initialPage) && hasSavedSupabaseSession()) {
    showLoading();
  }

  if (initialPage === "changelog") {
    await setPage("changelog", false);
  }

  setHomeLoginRestoringIfNeeded();
  await loadSummary();

  if (await setupAuth()) {
    showAppShell();
    await showHomeShell(initialPage, false);
  }
}
startApp();
