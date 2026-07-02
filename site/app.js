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
  selectionAnchorPlayerId: null,
  filterDraftRules: null,
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
  recentEvaluationPlayerIds: [],
  evaluationPlayerId: null,
  evaluationOverallRows: {},
  evaluationIgnoreDiscountRate: false,
  evaluationIgnoreFirstSeason: false,
  evaluationMflPerUsd: 400,
  evaluationSummaryPositions: {},
  linkedWalletAddress: "",
  linkedWalletProof: null,
  whitelistedWallets: new Set(),
  flowWalletModule: null,
  flowWalletModulePromise: null,
};

const flagColumn = "nationality_flag";
const baseColumns = ["player_id", flagColumn, "name", "nationality", "age", "positions", "player_seasons"];
const statColumns = ["overall", "pace", "shooting", "passing", "dribbling", "defense", "physical"];
const advancedPlayerTableTsv = `OVR	GK	LB	CB	RB	LWB	RWB	CDM	LM	CM	RM	CAM	CF	LW	RW	ST
99	84000	84000	84000	112000	56000	56000	70000	112000	112000	112000	70000	42000	84000	84000	112000
98	78000	78000	78000	104000	52000	52000	65000	104000	104000	104000	65000	39000	78000	78000	104000
97	72000	72000	72000	96000	48000	48000	60000	96000	96000	96000	60000	36000	72000	72000	96000
96	60000	60000	60000	80000	40000	40000	50000	80000	80000	80000	50000	30000	60000	60000	80000
95	48000	48000	48000	64000	32000	32000	40000	64000	64000	64000	40000	24000	48000	48000	64000
94	39000	39000	39000	52000	26000	26000	32500	52000	52000	52000	32500	19500	39000	39000	52000
93	30000	30000	30000	40000	20000	20000	25000	40000	40000	40000	25000	15000	30000	30000	40000
92	24000	24000	24000	32000	16000	16000	20000	32000	32000	32000	20000	12000	24000	24000	32000
91	18000	18000	18000	24000	12000	12000	15000	24000	24000	24000	15000	9000	18000	18000	24000
90	15000	15000	15000	20000	10000	10000	12500	20000	20000	20000	12500	7500	15000	15000	20000
89	12000	12000	12000	16000	8000	8000	10000	16000	16000	16000	10000	6000	12000	12000	16000
88	9000	9000	9000	12000	6000	6000	7500	12000	12000	12000	7500	4500	9000	9000	12000
87	7500	7500	7500	10000	5000	5000	6250	10000	10000	10000	6250	3750	7500	7500	10000
86	6000	6000	6000	8000	4000	4000	5000	8000	8000	8000	5000	3000	6000	6000	8000
85	4500	4500	4500	6000	3000	3000	3750	6000	6000	6000	3750	2250	4500	4500	6000
84	3000	3000	3000	4000	2000	2000	2500	4000	4000	4000	2500	1500	3000	3000	4000
83	2400	2400	2400	3200	1600	1600	2000	3200	3200	3200	2000	1200	2400	2400	3200
82	1800	1800	1800	2400	1200	1200	1500	2400	2400	2400	1500	900	1800	1800	2400
81	1500	1500	1500	2000	1000	1000	1250	2000	2000	2000	1250	750	1500	1500	2000
80	1200	1200	1200	1600	800	800	1000	1600	1600	1600	1000	600	1200	1200	1600
79	1050	1050	1050	1400	700	700	875	1400	1400	1400	875	525	1050	1050	1400
78	900	900	900	1200	600	600	750	1200	1200	1200	750	450	900	900	1200
77	750	750	750	1000	500	500	625	1000	1000	1000	625	375	750	750	1000
76	600	600	600	800	400	400	500	800	800	800	500	300	600	600	800
75	450	450	450	600	300	300	375	600	600	600	375	225	450	450	600
74	360	360	360	480	240	240	300	480	480	480	300	180	360	360	480
73	300	300	300	400	200	200	250	400	400	400	250	150	300	300	400
72	240	240	240	320	160	160	200	320	320	320	200	120	240	240	320
71	210	210	210	280	140	140	175	280	280	280	175	105	210	210	280
70	180	180	180	240	120	120	150	240	240	240	150	90	180	180	240
69	150	150	150	200	100	100	125	200	200	200	125	75	150	150	200
68	135	135	135	180	90	90	112.5	180	180	180	112.5	67.5	135	135	180
67	120	120	120	160	80	80	100	160	160	160	100	60	120	120	160
66	108	108	108	144	72	72	90	144	144	144	90	54	108	108	144
65	96	96	96	128	64	64	80	128	128	128	80	48	96	96	128
64	84	84	84	112	56	56	70	112	112	112	70	42	84	84	112
63	72	72	72	96	48	48	60	96	96	96	60	36	72	72	96
62	60	60	60	80	40	40	50	80	80	80	50	30	60	60	80
61	54	54	54	72	36	36	45	72	72	72	45	27	54	54	72
60	48	48	48	64	32	32	40	64	64	64	40	24	48	48	64
59	42	42	42	56	28	28	35	56	56	56	35	21	42	42	56
58	37.5	37.5	37.5	50	25	25	31.25	50	50	50	31.25	18.75	37.5	37.5	50
57	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
56	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
55	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
54	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
53	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
52	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
51	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
50	33	33	33	44	22	22	27.5	44	44	44	27.5	16.5	33	33	44
49	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
48	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
47	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
46	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
45	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
44	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
43	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
42	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
41	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
40	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
39	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
38	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
37	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
36	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
35	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
34	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
33	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
32	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
31	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
30	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0`;
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
const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
const DATA_CACHE_NAME = "mfl-front-office-data-v1";
const DATA_CACHE_VERSION_KEY = "mfl-data-cache-version";
const DATA_CACHE_MANIFEST_KEY = "mfl-data-cache-manifest";
const FLOW_WALLET_MODULE_URLS = [
  "https://esm.sh/@onflow/fcl@1.21.11?bundle",
];
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

const loadingScreen = document.querySelector("#loadingScreen");
const loadingText = document.querySelector("#loadingText");
const loadingBarFill = document.querySelector("#loadingBarFill");
const statusText = document.querySelector("#statusText");
const totalPlayers = document.querySelector("#totalPlayers");
const totalWallets = document.querySelector("#totalWallets");
const homePlayers = document.querySelector("#homePlayers");
const homeWallets = document.querySelector("#homeWallets");
const appShell = document.querySelector("#appShell");
const mainContent = document.querySelector("main");
const menuButton = document.querySelector("#menuButton");
const menuRail = document.querySelector("#menuRail");
const sidebar = document.querySelector("#sidebar");
const homePage = document.querySelector("#homePage");
const progressionPage = document.querySelector("#progressionPage");
const playerPage = document.querySelector("#playerPage");
const evaluationPage = document.querySelector("#evaluationPage");
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
const linkWalletButton = document.querySelector("#linkWalletButton");
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
const evaluationSearchInput = document.querySelector("#evaluationSearchInput");
const evaluationSearchResults = document.querySelector("#evaluationSearchResults");
const evaluationButtons = document.querySelector("#evaluationButtons");
const evaluationResetButton = document.querySelector("#evaluationResetButton");
const evaluationPlayerPageButton = document.querySelector("#evaluationPlayerPageButton");
const evaluationOptionFilters = document.querySelector("#evaluationOptionFilters");
const ignoreDiscountRateInput = document.querySelector("#ignoreDiscountRateInput");
const ignoreFirstSeasonInput = document.querySelector("#ignoreFirstSeasonInput");
const evaluationPanel = document.querySelector("#evaluationPanel");
const evaluationDiscountRate = document.querySelector("#evaluationDiscountRate");
const evaluationMflUsd = document.querySelector("#evaluationMflUsd");
const evaluationMflUsdEditor = document.querySelector("#evaluationMflUsdEditor");
const evaluationMflUsdInput = document.querySelector("#evaluationMflUsdInput");
const evaluationMflUsdIncreaseButton = document.querySelector("#evaluationMflUsdIncreaseButton");
const evaluationMflUsdDecreaseButton = document.querySelector("#evaluationMflUsdDecreaseButton");
const evaluationMflUsdEditButton = document.querySelector("#evaluationMflUsdEditButton");
const evaluationMflUsdResetButton = document.querySelector("#evaluationMflUsdResetButton");
const advancedSettingsButton = document.querySelector(".advancedSettingsButton");
const advancedSettingsModal = document.querySelector("#advancedSettingsModal");
const advancedSettingsBody = document.querySelector(".advancedSettingsBody");
const closeAdvancedSettingsButton = document.querySelector("#closeAdvancedSettingsButton");
const advancedMflUsdInput = document.querySelector("#advancedMflUsdInput");
const advancedMflUsdIncreaseButton = document.querySelector("#advancedMflUsdIncreaseButton");
const advancedMflUsdDecreaseButton = document.querySelector("#advancedMflUsdDecreaseButton");
const advancedMflUsdResetButton = document.querySelector("#advancedMflUsdResetButton");
const discardAdvancedSettingsButton = document.querySelector("#discardAdvancedSettingsButton");
const applyAdvancedSettingsButton = document.querySelector("#applyAdvancedSettingsButton");
const advancedDiscountRateValue = document.querySelector("#advancedDiscountRateValue");
const advancedPlayerTableHead = document.querySelector("#advancedPlayerTableHead");
const advancedPlayerTableBody = document.querySelector("#advancedPlayerTableBody");
const evaluationSummaryBody = document.querySelector("#evaluationSummaryBody");
const evaluationTableBody = document.querySelector("#evaluationTableBody");
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
  applyTheme(savedTheme || "dark");
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

function hasWalletProof() {
  return Boolean(
    state.linkedWalletAddress
    && state.linkedWalletProof?.address === state.linkedWalletAddress
    && state.linkedWalletProof?.message === walletAccessMessage(state.linkedWalletAddress)
    && Array.isArray(state.linkedWalletProof?.signatures)
    && state.linkedWalletProof.signatures.length
  );
}

function hasProgressionAccess() {
  return Boolean(state.linkedWalletAddress && hasWalletProof() && state.whitelistedWallets.has(state.linkedWalletAddress.toLowerCase()));
}

function progressionAccessMessage() {
  if (!state.linkedWalletAddress) {
    return "Link your wallet to view Progression.";
  }

  if (!hasWalletProof()) {
    return "Verify your linked wallet to view Progression.";
  }

  return "This wallet does not have Progression access yet.";
}

function updateMenuVisibility() {
  const showMenu = true;
  document.body.classList.toggle("guest", !hasProgressionAccess());
  menuRail.hidden = false;
  menuButton.hidden = false;
  sidebar.hidden = false;
  appShell.classList.toggle("menuClosed", !state.menuOpen);
  statusText.hidden = false;
  menuButton.setAttribute("aria-expanded", String(showMenu && state.menuOpen));
}

function hideHomeLoginButton() {
  // Email login has been removed.
}

function syncHomeLoginButton() {
  hideHomeLoginButton();
}

function pageRequiresData(pageName) {
  return tablePages.has(pageName) || pageName === "player" || pageName === "evaluation";
}

function pageRequiresProgressionPermission(pageName) {
  return pageName === "progression";
}

function pageRequiresFullData(pageName) {
  return hasProgressionAccess() && (pageName === "progression" || pageName === "player" || pageName === "watchlist");
}

async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {
  const needsDataFirst = pageRequiresData(pageName) && !state.dataLoaded;

  if (!needsDataFirst) {
    document.body.classList.remove("loading");
    loadingScreen.hidden = true;
  }

  syncHomeLoginButton();
  updateAccountState();
  const result = await setPage(pageName, updateUrl, options);
  syncHomeLoginButton();
  updateMenuVisibility();
  revealAppShell();
  return result;
}

function showAppShell() {
  syncHomeLoginButton();
  updateAccountState();
  updateMenuVisibility();
}

function showLoading() {
  document.body.classList.add("booting", "loading");
  loadingScreen.hidden = false;
  loadingScreen.classList.remove("failed", "complete", "leaving");
  updateLoadingProgress(0, 0);
}

function normalizeWalletAddress(address) {
  const value = String(address || "").trim();
  return value ? (value.startsWith("0x") ? value : `0x${value}`) : "";
}

async function loadWalletPermissions() {
  try {
    const response = await fetch("/wallet-permissions.json", { cache: "no-store" });
    if (!response.ok) {
      state.whitelistedWallets = new Set();
      return;
    }

    const data = await response.json();
    const wallets = Array.isArray(data.wallets) ? data.wallets : [];
    state.whitelistedWallets = new Set(wallets.map((wallet) => normalizeWalletAddress(wallet).toLowerCase()).filter(Boolean));
  } catch {
    state.whitelistedWallets = new Set();
  }
}

function currentDataAccess() {
  return hasProgressionAccess() ? "full" : "public";
}

function dataFileUrl(fileName, options = {}) {
  const query = new URLSearchParams({ file: fileName });

  if (!hasProgressionAccess()) {
    query.set("access", "public-database");
  } else if (Array.isArray(options.columns) && options.columns.length) {
    query.set("columns", options.columns.join(","));
  }

  return `/api/data?${query.toString()}`;
}

function walletProofHeaders() {
  if (!hasProgressionAccess()) {
    return {};
  }

  return {
    "x-dapper-wallet-address": state.linkedWalletAddress,
    "x-wallet-message": state.linkedWalletProof.message,
    "x-wallet-signatures": JSON.stringify(state.linkedWalletProof.signatures),
  };
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
  const { useCache = false, writeCache = false, columns = null } = options;

  if (useCache) {
    const cached = await readCachedDataFile(fileName);

    if (cached) {
      return cached;
    }
  }

  const response = await fetch(dataFileUrl(fileName, { columns }), {
    cache: fileName === "manifest.json" ? "no-store" : "default",
    headers: walletProofHeaders(),
  });

  if (!response.ok) {
    let message = "No exported data found yet.";

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

function accountName() {
  return state.linkedWalletAddress
    ? `${state.linkedWalletAddress.slice(0, 6)}...${state.linkedWalletAddress.slice(-4)}`
    : "Guest";
}

function updateAccountState() {
  const walletLinked = Boolean(state.linkedWalletAddress && hasWalletProof());
  accountEmail.textContent = accountName();
  linkWalletButton.textContent = walletLinked ? "Linked" : "Link Wallet";
  linkWalletButton.disabled = walletLinked;
  linkWalletButton.title = walletLinked ? state.linkedWalletAddress : "Link Dapper Wallet";
}
function signatureWalletAddress(signatures) {
  const signature = Array.isArray(signatures) ? signatures.find((item) => item?.addr || item?.address) : null;
  return normalizeWalletAddress(signature?.addr || signature?.address);
}
function walletAccessMessage(address) {
  return `MFL Front Office Progression Access\nDapper Wallet: ${normalizeWalletAddress(address)}`;
}

function stringToHex(value) {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signWalletMessage(fcl, message) {
  const currentUser = typeof fcl.currentUser === "function" ? fcl.currentUser() : fcl.currentUser;
  if (!currentUser?.signUserMessage) {
    throw new Error("Wallet message signing is not available.");
  }
  return currentUser.signUserMessage(stringToHex(message));
}

function restoreLinkedWalletProof() {
  try {
    const proof = JSON.parse(localStorage.getItem(LINKED_WALLET_PROOF_STORAGE_KEY) || "null");
    if (proof?.address && proof?.message && Array.isArray(proof?.signatures)) {
      state.linkedWalletProof = {
        address: normalizeWalletAddress(proof.address),
        message: proof.message,
        signatures: proof.signatures,
      };
    }
  } catch {
    state.linkedWalletProof = null;
  }
}
function configureFlowWallet(fcl = state.flowWalletModule || window.onflowFcl || window.fcl) {
  if (!fcl?.config) {
    return null;
  }

  fcl.config({
    "accessNode.api": "https://rest-mainnet.onflow.org",
    "discovery.wallet": "https://fcl-discovery.onflow.org/authn",
    "app.detail.title": "MFL Front Office",
    "app.detail.icon": `${window.location.origin}/favicon.ico`,
  });
  state.flowWalletModule = fcl;
  return fcl;
}

async function importFlowWalletModule(src) {
  const module = await import(src);
  return module?.default || module;
}

async function ensureFlowWallet() {
  const configuredWallet = configureFlowWallet();
  if (configuredWallet) {
    return configuredWallet;
  }

  if (!state.flowWalletModulePromise) {
    state.flowWalletModulePromise = (async () => {
      for (const src of FLOW_WALLET_MODULE_URLS) {
        try {
          const module = await importFlowWalletModule(src);
          const fcl = configureFlowWallet(module);
          if (fcl) {
            return fcl;
          }
        } catch (error) {
          console.warn("Could not load Flow wallet module.", error);
        }
      }
      return null;
    })();
  }

  return state.flowWalletModulePromise;
}

async function linkWallet() {
  closeAccountMenu();

  if (state.linkedWalletAddress && hasWalletProof()) {
    return;
  }

  linkWalletButton.disabled = true;
  linkWalletButton.textContent = "Loading...";

  const fcl = await ensureFlowWallet();
  if (!fcl) {
    updateAccountState();
    showToast("Wallet login could not load. Try again in a moment.");
    return;
  }

  linkWalletButton.textContent = "Linking...";

  try {
    const user = await fcl.authenticate();
    const flowAddress = normalizeWalletAddress(user?.addr);

    if (!flowAddress) {
      throw new Error("No wallet address returned.");
    }

    const initialMessage = walletAccessMessage(flowAddress);
    const initialSignatures = await signWalletMessage(fcl, initialMessage);
    const dapperAddress = signatureWalletAddress(initialSignatures) || flowAddress;
    const message = walletAccessMessage(dapperAddress);
    const signatures = dapperAddress === flowAddress
      ? initialSignatures
      : await signWalletMessage(fcl, message);

    state.linkedWalletAddress = dapperAddress;
    state.linkedWalletProof = { address: dapperAddress, message, signatures };
    try {
      localStorage.setItem(LINKED_WALLET_STORAGE_KEY, dapperAddress);
      localStorage.setItem(LINKED_WALLET_PROOF_STORAGE_KEY, JSON.stringify(state.linkedWalletProof));
    } catch {
      // The linked state still works for this page if storage is blocked.
    }

    updateAccountState();
    saveTableState();
    showToast("Wallet linked.");
  } catch (error) {
    console.warn("Could not link wallet.", error);
    updateAccountState();
    showToast("Wallet link cancelled.");
  }
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

function evaluationPlayerIdFromUrl() {
  if (window.location.pathname !== "/evaluation") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("player");
}

function syncEvaluationPlayerUrl(playerId) {
  if (window.location.pathname !== "/evaluation") {
    return;
  }

  const targetPath = playerId ? pagePath("evaluation", { playerId }) : "/evaluation";
  if (`${window.location.pathname}${window.location.search}` !== targetPath) {
    window.history.replaceState({}, "", targetPath);
  }
}

function pageFromUrl() {
  const pageName = window.location.pathname.replace(/^\//, "");

  if (playerIdFromUrl()) {
    return "player";
  }

  return ["home", "database", "progression", "evaluation", "watchlist", "changelog"].includes(pageName) ? pageName : "home";
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
    pageName: ["home", "database", "progression", "evaluation", "watchlist", "changelog"].includes(pageName) ? pageName : "home",
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

  if (pageName === "evaluation") {
    const playerId = options.playerId || evaluationPlayerIdFromUrl();
    return playerId ? `/evaluation?player=${encodeURIComponent(playerId)}` : "/evaluation";
  }

  return pageName === "home" ? "/" : `/${pageName}`;
}

function updatePageUrl(pageName, options = {}) {
  if (!options.updateUrl) {
    return;
  }

  const targetPath = pagePath(pageName, options);
  if (`${window.location.pathname}${window.location.search}` !== targetPath) {
    window.history.pushState({}, "", targetPath);
  }
}
function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  if (mainContent) {
    mainContent.scrollTop = 0;
  }
}
async function setPage(pageName, updateHash = true, options = {}) {
  const previousPage = state.currentPage;
  const shouldResetScroll = previousPage !== pageName;
  document.body.dataset.page = pageName;
  updatePageUrl(pageName, { ...options, updateUrl: updateHash });

  if (pageRequiresProgressionPermission(pageName) && !hasProgressionAccess()) {
    showToast(progressionAccessMessage());
    return setPage("home", updateHash);
  }


  const previousTablePage = tablePageKey();
  if (previousTablePage) {
    state.tablePageStates[previousTablePage] = currentTablePageState();
    saveTableState();
  }

  const tablePage = tablePages.has(pageName);
  const playerPageActive = pageName === "player";
  const evaluationPageActive = pageName === "evaluation";

  if (pageRequiresFullData(pageName) && state.dataAccess !== "full") {
    state.dataLoaded = false;
  }

  if ((tablePage || playerPageActive || evaluationPageActive) && !state.dataLoaded) {
    state.currentPage = pageName;
    homePage.hidden = true;
    progressionPage.hidden = true;
    evaluationPage.hidden = true;
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
  evaluationPage.hidden = !evaluationPageActive;
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

  if (evaluationPageActive) {
    renderEvaluationPage();
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }

    syncHomeLoginButton();
    if (shouldResetScroll) {
      resetPageScroll();
    }

    return;
  }

  if (playerPageActive) {
    const playerId = options.playerId || playerIdFromUrl();
    renderPlayerPage(playerId);
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }

    syncHomeLoginButton();
    if (shouldResetScroll) {
      resetPageScroll();
    }

    return;
  }
  if (tablePage && state.rows.length) {
    state.page = 1;
    applyFilters();
  }

  if (document.body.classList.contains("loading")) {
    await finishLoading();
  }

  if (shouldResetScroll) {
    resetPageScroll();
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
  if (pageName === "watchlist" && !hasProgressionAccess()) {
    return ["attributes", "next"];
  }

  return pageViewOptions[pageName] || pageViewOptions.progression;
}

function defaultViewForPage(pageName = tablePageKey() || "progression") {
  if (pageName === "watchlist" && !hasProgressionAccess()) {
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
    recentEvaluationPlayerIds: state.recentEvaluationPlayerIds,
    playerAttributeView: state.playerAttributeView,
    linkedWalletAddress: state.linkedWalletAddress,
  };
}

function queueCloudTableStateSave() {
  // Preferences are local until wallet accounts replace the old login system.
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

function restoreRecentEvaluationState(savedState) {
  const ids = Array.isArray(savedState?.recentEvaluationPlayerIds) ? savedState.recentEvaluationPlayerIds : [];
  state.recentEvaluationPlayerIds = ids.map((playerId) => String(playerId)).slice(0, 5);
}

function allowedPlayerAttributeViews() {
  return !hasProgressionAccess()
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

function normalizeWalletAddress(address) {
  const value = String(address || "").trim();
  return value ? (value.startsWith("0x") ? value : `0x${value}`) : "";
}

function restoreLinkedWalletState(savedState) {
  const savedAddress = normalizeWalletAddress(savedState?.linkedWalletAddress);
  if (savedAddress) {
    state.linkedWalletAddress = savedAddress;
    try {
      localStorage.setItem(LINKED_WALLET_STORAGE_KEY, savedAddress);
    } catch {
      // The linked state still works for this page if storage is blocked.
    }
    restoreLinkedWalletProof();
    updateAccountState();
    return;
  }

  try {
    state.linkedWalletAddress = normalizeWalletAddress(localStorage.getItem(LINKED_WALLET_STORAGE_KEY));
    restoreLinkedWalletProof();
  } catch {
    state.linkedWalletAddress = "";
  }
  updateAccountState();
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

  const guestIds = loadGuestWatchlist();
  if (guestIds.length) {
    state.watchlistPlayerIds = new Set(guestIds);
  }
}

function loadSavedTableState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
    restoreTablePageStates(savedState);
    restoreWatchlistState(savedState);
    restoreMenuState(savedState);
    restoreRecentSearchState(savedState);
    restoreRecentEvaluationState(savedState);
    restorePlayerAttributeView(savedState);
    restoreLinkedWalletState(savedState);
    applyGuestWatchlistIfNeeded();
    return savedState;
  } catch {
    restoreLinkedWalletState(null);
    applyGuestWatchlistIfNeeded();
    return null;
  }
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
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

function availableFilterColumns(pageName = tablePageKey() || state.currentPage || "progression", viewName = state.view) {
  const normalizedView = normalizeViewForPage(viewName, pageName);
  const columns = [...baseFilterColumns];

  if (normalizedView === "current") {
    columns.push(...statColumns.map((column) => `${column}_prog_current_season`));
  } else if (normalizedView === "all") {
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

function createCopyPlayerIdButton(playerId, label = String(playerId)) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copyPlayerIdButton";
  button.textContent = label;
  button.dataset.tooltip = "Click to copy";
  button.setAttribute("aria-label", "Click to copy");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyPlayerId(playerId);
    button.blur();
  });
  return button;
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
    retired: getValue(row, "retirement_years") === 0,
  }));
}


const DEFAULT_EVALUATION_MFL_PER_USD = 400;
const EVALUATION_MFL_PER_USD_STORAGE_KEY = "mfl-evaluation-mfl-per-usd";


const evaluationTeamEarningsByOverall = {
  99: 1400000,
  98: 1200000,
  97: 1200000,
  96: 1000000,
  95: 1000000,
  94: 800000,
  93: 500000,
  92: 400000,
  91: 300000,
  90: 250000,
  89: 200000,
  88: 175000,
  87: 150000,
  86: 125000,
  85: 100000,
  84: 80000,
  83: 60000,
  82: 50000,
  81: 40000,
  80: 30000,
  79: 25000,
  78: 20000,
  77: 15000,
  76: 10000,
  75: 7500,
  74: 6000,
  73: 5000,
  72: 4000,
  71: 3000,
  70: 2700,
  69: 2400,
  68: 2200,
  67: 2000,
  66: 1800,
  65: 1600,
  64: 1400,
  63: 1000,
  62: 800,
  61: 650,
  60: 550,
  59: 550,
  58: 550,
  57: 550,
  56: 550,
  55: 550,
  54: 550,
  53: 550,
  52: 550,
  51: 550,
  50: 550,
  49: 0,
  48: 0,
  47: 0,
  46: 0,
  45: 0,
  44: 0,
  43: 0,
  42: 0,
  41: 0,
  40: 0,
  39: 0,
  38: 0,
  37: 0,
  36: 0,
  35: 0,
  34: 0,
  33: 0,
};
const evaluationConversions = {
  1: 300,
  2: 333,
  3: 333,
  4: 300,
  5: 225,
  6: 250,
  7: 333,
  8: 400,
  9: 450,
  10: 500,
  11: 475,
  12: 450,
  13: 450,
  14: 400,
};

function evaluationDiscountRateValue(currentSeason = 15, seasonsToAverage = 5) {
  const lastCompletedSeason = currentSeason - 1;
  const ratios = [];

  for (let season = lastCompletedSeason - seasonsToAverage + 1; season <= lastCompletedSeason; season += 1) {
    const previousConversion = evaluationConversions[season - 1];
    const conversion = evaluationConversions[season];

    if (previousConversion && conversion) {
      ratios.push(conversion / previousConversion);
    }
  }

  if (!ratios.length) {
    return null;
  }

  return Math.pow(ratios.reduce((product, ratio) => product * ratio, 1), 1 / ratios.length) - 1;
}

function formatEvaluationRate(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "-";
}

function evaluationDiscountFactor(rate, season) {
  return Number.isFinite(rate) ? 1 / Math.pow(1 + rate, season) : null;
}

function formatEvaluationNumber(value, decimals = 2) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "";
}

function formatEvaluationCurrency(value) {
  return Number.isFinite(value) ? "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : "";
}

function parseEvaluationMflPerUsd(value) {
  const parsedValue = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue * 100) / 100 : null;
}

function formatEvaluationMflPerUsd(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function saveEvaluationMflPerUsd(value) {
  state.evaluationMflPerUsd = value;

  try {
    if (value === DEFAULT_EVALUATION_MFL_PER_USD) {
      localStorage.removeItem(EVALUATION_MFL_PER_USD_STORAGE_KEY);
    } else {
      localStorage.setItem(EVALUATION_MFL_PER_USD_STORAGE_KEY, value.toFixed(2));
    }
  } catch {
    // Evaluation still recalculates for this page if the browser blocks storage.
  }
}

function loadEvaluationMflPerUsd() {
  try {
    const savedValue = parseEvaluationMflPerUsd(localStorage.getItem(EVALUATION_MFL_PER_USD_STORAGE_KEY));
    state.evaluationMflPerUsd = savedValue || DEFAULT_EVALUATION_MFL_PER_USD;
  } catch {
    state.evaluationMflPerUsd = DEFAULT_EVALUATION_MFL_PER_USD;
  }
}

function formatAdvancedPlayerTableValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numericValue)
    : value;
}

function renderAdvancedPlayerTable() {
  if (advancedPlayerTableBody.children.length) {
    return;
  }

  const rows = advancedPlayerTableTsv.trim().split("\n").map((line) => line.split("\t"));
  const headers = rows.shift();
  const headerRow = document.createElement("tr");
  const bodyFragment = document.createDocumentFragment();
  const emptyHeader = document.createElement("th");

  emptyHeader.textContent = "";
  headerRow.appendChild(emptyHeader);

  headers.slice(1).forEach((header) => {
    const cell = document.createElement("th");
    cell.textContent = header;
    headerRow.appendChild(cell);
  });

  advancedPlayerTableHead.replaceChildren(headerRow);

  rows.forEach((row) => {
    const tableRow = document.createElement("tr");

    row.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = index === 0 ? value : formatAdvancedPlayerTableValue(value);
      tableRow.appendChild(cell);
    });

    bodyFragment.appendChild(tableRow);
  });

  advancedPlayerTableBody.replaceChildren(bodyFragment);
  window.requestAnimationFrame(updateAdvancedPlayerTableClip);
}
function updateAdvancedPlayerTableClip() {
  if (!advancedPlayerTableHead || !advancedPlayerTableBody || !advancedSettingsBody || advancedSettingsModal.hidden) {
    return;
  }

  const headerRect = advancedPlayerTableHead.getBoundingClientRect();
  const bodyRect = advancedPlayerTableBody.getBoundingClientRect();
  const clipTop = Math.max(0, Math.ceil(headerRect.bottom - bodyRect.top));
  const clipValue = clipTop > 0 ? `inset(${clipTop}px 0 0 0)` : "";

  advancedPlayerTableBody.style.clipPath = clipValue;
  advancedPlayerTableBody.style.webkitClipPath = clipValue;
}
function syncAdvancedSettingsValues() {
  advancedMflUsdInput.value = state.evaluationMflPerUsd.toFixed(2);
  advancedMflUsdResetButton.hidden = state.evaluationMflPerUsd === DEFAULT_EVALUATION_MFL_PER_USD;
  advancedDiscountRateValue.textContent = evaluationDiscountRate.textContent || formatEvaluationRate(evaluationDiscountRateValue());
}

function updateAdvancedMflUsdResetVisibility() {
  const parsedValue = parseEvaluationMflPerUsd(advancedMflUsdInput.value);
  advancedMflUsdResetButton.hidden = !parsedValue || parsedValue === DEFAULT_EVALUATION_MFL_PER_USD;
}

function openAdvancedSettings() {
  renderAdvancedPlayerTable();
  syncAdvancedSettingsValues();
  advancedSettingsModal.hidden = false;
  window.requestAnimationFrame(updateAdvancedPlayerTableClip);
}

function closeAdvancedSettings() {
  advancedSettingsModal.hidden = true;
  advancedPlayerTableBody.style.clipPath = "";
  advancedPlayerTableBody.style.webkitClipPath = "";
}

function applyAdvancedSettings() {
  const parsedValue = parseEvaluationMflPerUsd(advancedMflUsdInput.value);

  if (parsedValue) {
    saveEvaluationMflPerUsd(parsedValue);
  }

  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
  closeAdvancedSettings();
}

function discardAdvancedSettings() {
  syncAdvancedSettingsValues();
  closeAdvancedSettings();
}

function adjustAdvancedMflUsdDraft(delta) {
  const currentValue = parseEvaluationMflPerUsd(advancedMflUsdInput.value) || state.evaluationMflPerUsd;
  const nextValue = Math.max(0.01, Math.round((currentValue + delta) * 100) / 100);
  advancedMflUsdInput.value = nextValue.toFixed(2);
  updateAdvancedMflUsdResetVisibility();
}
function resetAdvancedMflUsd() {
  advancedMflUsdInput.value = DEFAULT_EVALUATION_MFL_PER_USD.toFixed(2);
  updateAdvancedMflUsdResetVisibility();
}

function renderEvaluationMflPerUsdControl(editing = false) {
  const value = state.evaluationMflPerUsd;
  evaluationMflUsd.textContent = formatEvaluationMflPerUsd(value);
  evaluationMflUsdInput.value = value.toFixed(2);
  evaluationMflUsd.hidden = editing;
  evaluationMflUsdEditor.hidden = !editing;
  evaluationMflUsdEditButton.textContent = editing ? "\u2713" : "\u270E";
  evaluationMflUsdEditButton.setAttribute("aria-label", editing ? "Confirm MFL per USD" : "Edit MFL per USD");
  evaluationMflUsdResetButton.hidden = value === DEFAULT_EVALUATION_MFL_PER_USD;

  if (editing) {
    evaluationMflUsdInput.focus();
    evaluationMflUsdInput.select();
  }
}

function commitEvaluationMflPerUsd() {
  if (evaluationMflUsdEditor.hidden) {
    return;
  }

  const parsedValue = parseEvaluationMflPerUsd(evaluationMflUsdInput.value);

  if (parsedValue) {
    saveEvaluationMflPerUsd(parsedValue);
  }

  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
}

function resetEvaluationMflPerUsd() {
  saveEvaluationMflPerUsd(DEFAULT_EVALUATION_MFL_PER_USD);
  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
}
function adjustEvaluationMflPerUsdDraft(delta) {
  const currentValue = parseEvaluationMflPerUsd(evaluationMflUsdInput.value) || state.evaluationMflPerUsd;
  const nextValue = Math.max(0.01, Math.round((currentValue + delta) * 100) / 100);
  evaluationMflUsdInput.value = nextValue.toFixed(2);
}


const evaluationContractsTable = (() => {
  const rows = advancedPlayerTableTsv.trim().split("\n").map((line) => line.split("\t"));
  const headers = rows.shift();
  const table = {};

  rows.forEach((row) => {
    const overall = Number(row[0]);

    if (!Number.isFinite(overall)) {
      return;
    }

    table[overall] = {};
    headers.slice(1).forEach((position, index) => {
      table[overall][position] = Number(row[index + 1]) || 0;
    });
  });

  return table;
})();

function evaluationMflMultiplierForSeason(rowIndex, expectedSeasons) {
  const seasonsFromEnd = expectedSeasons - rowIndex;

  if (seasonsFromEnd === 1) {
    return 0.6;
  }

  if (seasonsFromEnd === 2 || seasonsFromEnd === 3) {
    return 0.8;
  }

  return 1;
}

function evaluationMflValueForOverall(overall, position, rowIndex, expectedSeasons) {
  const roundedOverall = Math.round(Number(overall));
  const positionValues = evaluationContractsTable[roundedOverall] || {};
  const contractValue = positionValues[position] || 0;
  return contractValue * evaluationMflMultiplierForSeason(rowIndex, expectedSeasons);
}

function formatEvaluationMfl(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value) : "";
}

function expectedEvaluationSeasons(row) {
  const playerId = Number(getValue(row, "player_id") || 0);
  const age = Number(getValue(row, "age"));
  const retirementYears = Number(getValue(row, "retirement_years"));

  if (Number.isFinite(retirementYears) && retirementYears > 0) {
    return retirementYears;
  }

  if (!Number.isFinite(age)) {
    return 0;
  }

  const averageRetirementAge = playerId <= 77848 ? 37 : 35;
  const yearsToAverageRetirement = averageRetirementAge - age;

  if (yearsToAverageRetirement <= 3) {
    return 4;
  }

  return Math.max(0, yearsToAverageRetirement);
}

function evaluationSearchMatches(query) {
  if (!query) {
    return [];
  }

  if (!state.searchIndex.length && state.rows.length) {
    buildSearchIndex();
  }

  const results = [];

  state.searchIndex.forEach((entry) => {
    if (entry.retired || (!entry.id.includes(query) && !entry.name.includes(query))) {
      return;
    }

    results.push(entry);
  });

  return results
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 5)
    .map((entry) => entry.row);
}

function recentEvaluationRows() {
  return state.recentEvaluationPlayerIds
    .map((playerId) => rowByPlayerId(playerId))
    .filter((row) => row && getValue(row, "retirement_years") !== 0);
}

function rememberEvaluationResult(playerId) {
  const key = String(playerId);
  state.recentEvaluationPlayerIds = [key, ...state.recentEvaluationPlayerIds.filter((id) => id !== key)].slice(0, 5);
  saveTableState();
}

function renderEmptyEvaluationSelection(showRecentResults = true) {
  evaluationPanel.hidden = true;
  evaluationSummaryBody.replaceChildren();
  evaluationTableBody.replaceChildren();
  evaluationButtons.hidden = true;
  evaluationResetButton.hidden = true;
  evaluationPlayerPageButton.hidden = true;
  evaluationOptionFilters.hidden = true;

  if (showRecentResults) {
    renderEvaluationSearchResults();
  } else {
    evaluationSearchResults.hidden = true;
  }
}

function resetEvaluationSelection() {
  state.evaluationPlayerId = null;
  syncEvaluationPlayerUrl(null);
  renderEmptyEvaluationSelection(true);
}

function clearEvaluationSearchFocus() {
  evaluationSearchInput.blur();
  evaluationSearchResults.hidden = true;
  evaluationSearchResults.replaceChildren();
}

function renderEvaluationSearchResults() {
  const query = evaluationSearchInput.value.trim().toLowerCase();
  const rows = query ? evaluationSearchMatches(query) : recentEvaluationRows();

  evaluationSearchResults.replaceChildren();
  evaluationSearchResults.hidden = rows.length === 0;

  rows.forEach((row) => {
    const playerId = String(getValue(row, "player_id"));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evaluationSearchResult";
    button.innerHTML = `<strong>${escapeHtml(formatCellValue(row, "name"))}</strong><span>#${escapeHtml(playerId)} &middot; OVR ${escapeHtml(formatPlainValue(statDisplayValue(row, "overall"), "overall"))} &middot; ${escapeHtml(formatCellValue(row, "age"))} years old</span>`;
    button.addEventListener("click", () => {
      state.evaluationPlayerId = playerId;
      rememberEvaluationResult(playerId);
      evaluationSearchInput.value = formatCellValue(row, "name");
      evaluationSearchResults.hidden = true;
      syncEvaluationPlayerUrl(playerId);
      renderEvaluationTable(row);
    });
    evaluationSearchResults.appendChild(button);
  });
}

function handleEvaluationSearchInput() {
  if (!evaluationSearchInput.value.trim()) {
    resetEvaluationSelection();
  }

  renderEvaluationSearchResults();
}


function evaluationOverallKey(row) {
  return String(getValue(row, "player_id") || "");
}

function currentEvaluationOverall(row) {
  const value = Number(statDisplayValue(row, "overall"));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function evaluationOverallValues(row, expectedSeasons) {
  const key = evaluationOverallKey(row);
  const currentOverall = currentEvaluationOverall(row);
  const savedValues = Array.isArray(state.evaluationOverallRows[key]) ? state.evaluationOverallRows[key] : [];
  const values = Array.from({ length: expectedSeasons }, (_, index) => {
    const savedValue = Number(savedValues[index]);
    return Number.isFinite(savedValue) ? savedValue : currentOverall;
  });

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) {
      values[index] = values[index - 1];
    }
  }

  state.evaluationOverallRows[key] = values;
  return values;
}

function adjustEvaluationOverall(playerId, season, delta) {
  const row = rowByPlayerId(playerId);

  if (!row) {
    return;
  }

  const expectedSeasons = expectedEvaluationSeasons(row);
  const values = evaluationOverallValues(row, expectedSeasons);
  const index = season - 1;
  const nextValue = Math.max(1, Math.min(99, (values[index] || 1) + delta));
  values[index] = nextValue;

  for (let forward = index + 1; forward < values.length; forward += 1) {
    if (values[forward] < nextValue) {
      values[forward] = nextValue;
    }
  }

  for (let backward = index - 1; backward >= 0; backward -= 1) {
    if (values[backward] > nextValue) {
      values[backward] = nextValue;
    }
  }

  state.evaluationOverallRows[String(playerId)] = values;
  renderEvaluationTable(row);
}

function evaluationOverallControl(value, season) {
  const numericValue = Number(value);
  const reduceControl = numericValue <= 1
    ? `<span class="evaluationOverallControlSpacer" aria-hidden="true"></span>`
    : `<button type="button" data-evaluation-overall-season="${season}" data-evaluation-overall-delta="-1" aria-label="Reduce season ${season} overall">-</button>`;
  const increaseControl = numericValue >= 99
    ? `<span class="evaluationOverallControlSpacer" aria-hidden="true"></span>`
    : `<button type="button" data-evaluation-overall-season="${season}" data-evaluation-overall-delta="1" aria-label="Increase season ${season} overall">+</button>`;

  return `<div class="evaluationOverallControl">${reduceControl}<strong>${escapeHtml(value)}</strong>${increaseControl}</div>`;
}
function evaluationSummaryPosition(row) {
  const positions = playerPositions(row);
  const playerId = String(getValue(row, "player_id") || "");
  const savedPosition = state.evaluationSummaryPositions[playerId];
  return positions.includes(savedPosition) ? savedPosition : positions[0] || "";
}

function evaluationSummaryOverall(row, position, currentOverall) {
  const positions = playerPositions(row);
  const primary = positions[0];

  if (!position) {
    return currentOverall;
  }

  if (position === primary) {
    const primaryOverall = Number(getValue(row, "overall"));
    return Number.isFinite(primaryOverall) ? primaryOverall : currentOverall;
  }

  const rating = positionRating(row, position, familiarityForPosition(row, position));
  return rating === null ? currentOverall : rating;
}

function setEvaluationOverallValues(row, overall) {
  const expectedSeasons = expectedEvaluationSeasons(row);
  const value = Math.max(1, Math.min(99, Math.round(Number(overall) || 1)));
  state.evaluationOverallRows[evaluationOverallKey(row)] = Array.from({ length: expectedSeasons }, () => value);
}

function evaluationSummaryPositionControl(row, selectedPosition) {
  const positions = playerPositions(row);

  if (positions.length <= 1) {
    return escapeHtml(selectedPosition || "");
  }

  return `<select class="evaluationSummaryPositionSelect" data-evaluation-summary-position>${positions.map((position) => `<option value="${escapeHtml(position)}"${position === selectedPosition ? " selected" : ""}>${escapeHtml(position)}</option>`).join("")}</select>`;
}

function renderEvaluationTable(row) {
  const rawExpectedSeasons = expectedEvaluationSeasons(row);
  const seasonOffset = state.evaluationIgnoreFirstSeason ? 1 : 0;
  const expectedSeasons = Math.max(0, rawExpectedSeasons - seasonOffset);
  const playerName = formatCellValue(row, "name");
  const currentAge = Number(getValue(row, "age"));
  const overallValues = evaluationOverallValues(row, rawExpectedSeasons);
  const currentOverall = overallValues[seasonOffset] ?? overallValues[0];
  const summaryPosition = evaluationSummaryPosition(row);
  const summaryOverall = currentOverall;
  const discountRate = state.evaluationIgnoreDiscountRate ? 0 : evaluationDiscountRateValue();
  const fragment = document.createDocumentFragment();
  const mflValues = [];
  const presentValues = [];

  evaluationPanel.hidden = false;
  evaluationButtons.hidden = false;
  evaluationResetButton.hidden = false;
  evaluationPlayerPageButton.hidden = false;
  evaluationOptionFilters.hidden = false;
  ignoreDiscountRateInput.checked = state.evaluationIgnoreDiscountRate;
  ignoreFirstSeasonInput.checked = state.evaluationIgnoreFirstSeason;

  for (let rowIndex = 0; rowIndex < expectedSeasons; rowIndex += 1) {
    const season = rowIndex + 1 + seasonOffset;
    const overallIndex = season - 1;
    const tableRow = document.createElement("tr");
    const seasonOverall = evaluationOverallControl(overallValues[overallIndex], season);
    const numericMflValue = evaluationMflValueForOverall(overallValues[overallIndex], summaryPosition, rowIndex, expectedSeasons);
    const mflValue = formatEvaluationMfl(numericMflValue);
    const usdValue = Number.isFinite(numericMflValue) ? numericMflValue / state.evaluationMflPerUsd : null;
    const discountFactor = evaluationDiscountFactor(discountRate, season);
    const presentValue = Number.isFinite(usdValue) && Number.isFinite(discountFactor) ? usdValue * discountFactor : null;
    const values = [
      playerName,
      season,
      Number.isFinite(currentAge) ? currentAge + season - 1 : "",
      seasonOverall,
      mflValue,
      formatEvaluationCurrency(usdValue),
      formatEvaluationNumber(discountFactor, 4),
      formatEvaluationCurrency(presentValue),
    ];

    if (Number.isFinite(numericMflValue)) {
      mflValues.push(numericMflValue);
    }

    if (Number.isFinite(presentValue)) {
      presentValues.push(presentValue);
    }

    values.forEach((value) => {
      const cell = document.createElement("td");
      if (typeof value === "string" && value.includes("evaluationOverallControl")) {
        cell.innerHTML = value;
      } else {
        cell.textContent = value;
      }
      tableRow.appendChild(cell);
    });

    fragment.appendChild(tableRow);
  }

  const mflValueTotal = mflValues.length
    ? mflValues.reduce((total, value) => total + value, 0)
    : 0;
  const presentValueTotal = presentValues.length
    ? presentValues.reduce((total, value) => total + value, 0)
    : 0;
  const summaryRow = document.createElement("tr");
  [
    playerName,
    evaluationSummaryPositionControl(row, summaryPosition),
    Number.isFinite(currentAge) ? currentAge + seasonOffset : "",
    summaryOverall,
    expectedSeasons,
    formatEvaluationMfl(mflValueTotal),
    formatEvaluationCurrency(presentValueTotal),
  ].forEach((value) => {
    const cell = document.createElement("td");

    if (typeof value === "string" && value.includes("data-evaluation-summary-position")) {
      cell.innerHTML = value;
    } else {
      cell.textContent = value;
    }

    summaryRow.appendChild(cell);
  });

  evaluationSummaryBody.replaceChildren(summaryRow);
  evaluationTableBody.replaceChildren(fragment);
  evaluationSummaryBody.querySelectorAll("[data-evaluation-summary-position]").forEach((select) => {
    select.addEventListener("dblclick", (event) => {
      event.preventDefault();
      select.blur();
      window.getSelection()?.removeAllRanges();
    });
    select.addEventListener("change", () => {
      state.evaluationSummaryPositions[String(getValue(row, "player_id") || "")] = select.value;
      setEvaluationOverallValues(row, evaluationSummaryOverall(row, select.value, currentOverall));
      renderEvaluationTable(row);
    });
  });
  evaluationTableBody.querySelectorAll("[data-evaluation-overall-season]").forEach((button) => {
    button.addEventListener("click", () => adjustEvaluationOverall(evaluationOverallKey(row), Number(button.dataset.evaluationOverallSeason), Number(button.dataset.evaluationOverallDelta)));
  });
}
function renderEvaluationPage() {
  if (!state.evaluationPlayerId && evaluationPlayerIdFromUrl()) {
    state.evaluationPlayerId = evaluationPlayerIdFromUrl();
  }

  if (!state.evaluationPlayerId) {
    renderEmptyEvaluationSelection(true);
    return;
  }

  const row = rowByPlayerId(state.evaluationPlayerId);

  if (row) {
    evaluationSearchInput.value = formatCellValue(row, "name");
  }

  if (!row || getValue(row, "retirement_years") === 0) {
    state.evaluationPlayerId = null;
    syncEvaluationPlayerUrl(null);
    renderEmptyEvaluationSelection(true);
    return;
  }

  renderEvaluationTable(row);
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
    const content = document.createElement("span");
    content.className = "toastPlayerIdContent";
    content.textContent = `Player ID ${id} copied.`;
    showToast(content);
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
        <button id="copyPlayerIdButton" class="playerEyebrow playerIdText" type="button" data-tooltip="Click to copy" aria-label="Click to copy player ID">ID #${escapeHtml(id)}</button>
        <h2>${escapeHtml(playerName)}</h2>
        <p>${escapeHtml(positions.join(", ") || "No positions")}</p>
      </div>
      <div class="playerHeroActions">
        <button id="playerEvaluateButton" class="playerEvaluateButton" type="button">Evaluate</button>
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
  const evaluateButton = playerDetail.querySelector("#playerEvaluateButton");
  const openEvaluationForPlayer = (event) => {
    const targetPath = pagePath("evaluation", { playerId: id });

    rememberEvaluationResult(id);

    if (event.ctrlKey || event.metaKey || event.button === 1) {
      window.open(targetPath, "_blank", "noopener");
      return;
    }

    state.evaluationPlayerId = id;
    evaluationSearchInput.value = playerName;
    clearEvaluationSearchFocus();
    setPage("evaluation", true, { playerId: id });
  };

  evaluateButton.addEventListener("click", openEvaluationForPlayer);
  evaluateButton.addEventListener("auxclick", (event) => {
    if (event.button === 1) {
      event.preventDefault();
      openEvaluationForPlayer(event);
    }
  });
  playerDetail.querySelector("#copyPlayerIdButton").addEventListener("click", (event) => {
    copyPlayerId(id);
    event.currentTarget.blur();
  });
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

  if ((state.view === "current" || state.view === "all") && statColumns.includes(column)) {
    return [
      getValue(row, getProgressionColumn(column)) || 0,
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

function populateAddFilterSelect(pageName = tablePageKey() || state.currentPage || "progression") {
  const selectedColumns = selectedFilterColumns();
  const fragment = document.createDocumentFragment();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select filter...";
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

  const allowedColumns = new Set(availableFilterColumns(pageName));
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

  populateAddFilterSelect(pageName);
  refreshRuleColumnSelects(pageName);
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
}

function openFilters() {
  state.filterDraftRules = readFilterDraftRules();
  document.body.classList.add("filtersOpen");
  filtersModal.hidden = false;
  const firstInput = filterRules.querySelector("input") || addFilterSelect;

  if (firstInput) {
    firstInput.focus();
  }
}

function closeFilters(commitChanges = false) {
  if (!commitChanges && state.filterDraftRules) {
    restoreFilterDraftRules(state.filterDraftRules);
  }

  state.filterDraftRules = null;
  filtersModal.hidden = true;
  document.body.classList.remove("filtersOpen");
  openFiltersButton.focus();
}

function clearAdvancedFilters(applyNow = true) {
  filterRules.replaceChildren();
  populateAddFilterSelect();

  if (!applyNow) {
    return;
  }

  state.page = 1;
  applyFilters();
}

function applyAdvancedFilters() {
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

function clearSelection() {
  state.selectedPlayerIds.clear();
  state.selectionAnchorPlayerId = null;
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
    state.selectionAnchorPlayerId = null;
    saveTableState();
    applyFilters();
    showWatchlistToast(`${selectedCount} player${selectedCount === 1 ? "" : "s"} removed from`);
    return;
  }

  state.selectedPlayerIds.forEach((playerId) => state.watchlistPlayerIds.add(String(playerId)));
  state.selectedPlayerIds.clear();
  state.selectionAnchorPlayerId = null;
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
    selectionInput.addEventListener("click", (event) => setPlayerSelected(playerId, selectionInput.checked, event.shiftKey));
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
      } else if (column === "player_id") {
        cell.appendChild(createCopyPlayerIdButton(playerId, formatCellValue(row, column)));
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

function dataCacheVersion(manifest) {
  return `${currentDataAccess()}:${manifest.generated_at || ""}:${manifest.row_count || 0}:${(manifest.chunks || []).map((chunk) => chunk.file).join("|")}`;
}

function missingFullDataColumns(fullColumns) {
  return fullColumns.filter((column) => !state.columns.includes(column));
}

function rowMapByPlayerId() {
  const playerIdIndex = state.columns.indexOf("player_id");
  const rowMap = new Map();

  if (playerIdIndex < 0) {
    return rowMap;
  }

  state.rows.forEach((row) => {
    rowMap.set(String(row[playerIdIndex]), row);
  });

  return rowMap;
}

function mergeDataColumns(chunk, columnsToMerge, rowMap) {
  const chunkPlayerIdIndex = chunk.columns.indexOf("player_id");
  const chunkColumnIndexes = columnsToMerge.map((column) => chunk.columns.indexOf(column));

  if (chunkPlayerIdIndex < 0) {
    return;
  }

  chunk.rows.forEach((chunkRow) => {
    const existingRow = rowMap.get(String(chunkRow[chunkPlayerIdIndex]));

    if (!existingRow) {
      return;
    }

    chunkColumnIndexes.forEach((chunkColumnIndex) => {
      existingRow.push(chunkColumnIndex >= 0 ? chunkRow[chunkColumnIndex] : null);
    });
  });
}

async function upgradePublicDataToFull(manifest) {
  const columnsToMerge = missingFullDataColumns(manifest.columns);

  if (!columnsToMerge.length) {
    state.manifest = manifest;
    state.dataAccess = "full";
    return true;
  }

  const rowMap = rowMapByPlayerId();
  const requestColumns = ["player_id", ...columnsToMerge];

  updateSummaryCounts(manifest.row_count, manifest.wallet_count);
  await paintLoadingProgress();

  for (let index = 0; index < manifest.chunks.length; index += 1) {
    updateLoadingProgress(index + 1, manifest.chunks.length);
    await paintLoadingProgress();
    const chunkInfo = manifest.chunks[index];
    const chunk = await fetchDataFile(chunkInfo.file, { columns: requestColumns });
    mergeDataColumns(chunk, columnsToMerge, rowMap);
  }

  state.manifest = manifest;
  state.columns = [...state.columns, ...columnsToMerge];
  state.dataAccess = "full";
  return true;
}

async function loadData() {
  try {
    const targetAccess = currentDataAccess();
    const upgradeFromPublic = targetAccess === "full"
      && state.dataAccess === "public"
      && state.rows.length > 0
      && state.columns.length > 0;

    if (!upgradeFromPublic) {
      state.rows = [];
      state.filteredRows = [];
      state.page = 1;
    }

    state.dataAccess = targetAccess;
    updateLoadingProgress(0, 0);
    const manifest = await fetchDataFile("manifest.json");

    if (upgradeFromPublic) {
      await upgradePublicDataToFull(manifest);
    } else {
      const cacheVersion = dataCacheVersion(manifest);
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
    const message = error.message || "No website data found yet. Run the GitHub workflow to publish the table.";
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
  } else if (event.key === "Escape" && !advancedSettingsModal.hidden) {
    closeAdvancedSettings();
  } else if (event.key === "Escape" && !accountDropdown.hidden) {
    closeAccountMenu();
  } else if (event.key === "Enter" && !filtersModal.hidden) {
    event.preventDefault();
    applyAdvancedFilters();
  } else if (event.key === "Enter" && !advancedSettingsModal.hidden && document.activeElement === advancedMflUsdInput) {
    event.preventDefault();
    applyAdvancedSettings();
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

advancedSettingsModal.addEventListener("click", (event) => {
  if (event.target === advancedSettingsModal) {
    closeAdvancedSettings();
  }
});

applyFiltersButton.addEventListener("click", applyAdvancedFilters);

clearFiltersButton.addEventListener("click", () => {
  clearAdvancedFilters(false);
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
advancedSettingsButton.addEventListener("click", openAdvancedSettings);
closeAdvancedSettingsButton.addEventListener("click", closeAdvancedSettings);
advancedSettingsBody.addEventListener("scroll", updateAdvancedPlayerTableClip, { passive: true });
window.addEventListener("resize", updateAdvancedPlayerTableClip);
advancedMflUsdInput.addEventListener("input", updateAdvancedMflUsdResetVisibility);
advancedMflUsdIncreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
advancedMflUsdDecreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
advancedMflUsdIncreaseButton.addEventListener("click", () => adjustAdvancedMflUsdDraft(1));
advancedMflUsdDecreaseButton.addEventListener("click", () => adjustAdvancedMflUsdDraft(-1));
advancedMflUsdResetButton.addEventListener("click", resetAdvancedMflUsd);
discardAdvancedSettingsButton.addEventListener("click", discardAdvancedSettings);
applyAdvancedSettingsButton.addEventListener("click", applyAdvancedSettings);
playerSearchInput.addEventListener("input", renderSearchResults);
evaluationSearchInput.addEventListener("input", handleEvaluationSearchInput);
evaluationSearchInput.addEventListener("focus", renderEvaluationSearchResults);
ignoreDiscountRateInput.addEventListener("change", () => {
  state.evaluationIgnoreDiscountRate = ignoreDiscountRateInput.checked;
  renderEvaluationPage();
});
ignoreFirstSeasonInput.addEventListener("change", () => {
  state.evaluationIgnoreFirstSeason = ignoreFirstSeasonInput.checked;
  renderEvaluationPage();
});
evaluationMflUsdEditButton.addEventListener("mousedown", (event) => event.preventDefault());
evaluationMflUsdEditButton.addEventListener("click", () => {
  if (evaluationMflUsdEditor.hidden) {
    renderEvaluationMflPerUsdControl(true);
  } else {
    commitEvaluationMflPerUsd();
  }
});
evaluationMflUsdResetButton.addEventListener("click", resetEvaluationMflPerUsd);
evaluationMflUsdIncreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
evaluationMflUsdDecreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
evaluationMflUsdIncreaseButton.addEventListener("click", () => adjustEvaluationMflPerUsdDraft(1));
evaluationMflUsdDecreaseButton.addEventListener("click", () => adjustEvaluationMflPerUsdDraft(-1));
evaluationMflUsdInput.addEventListener("blur", commitEvaluationMflPerUsd);
evaluationMflUsdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitEvaluationMflPerUsd();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    evaluationMflUsdInput.value = state.evaluationMflPerUsd.toFixed(2);
    renderEvaluationMflPerUsdControl(false);
  }
});
evaluationResetButton.addEventListener("click", () => {
  const row = rowByPlayerId(state.evaluationPlayerId);

  if (!row) {
    return;
  }

  delete state.evaluationOverallRows[evaluationOverallKey(row)];
  delete state.evaluationSummaryPositions[String(getValue(row, "player_id") || "")];
  renderEvaluationTable(row);
});

const openEvaluationPlayerPage = (event) => {
  if (event.type === "mouseup" && event.button !== 1) {
    return;
  }

  const row = rowByPlayerId(state.evaluationPlayerId);

  if (!row) {
    return;
  }

  const playerId = String(getValue(row, "player_id"));
  rememberSearchResult(playerId);

  if (event.type === "mouseup" && event.button === 1) {
    event.preventDefault();
    const playerWindow = window.open(pagePath("player", { playerId }), "_blank", "noopener");
    window.focus();
    if (playerWindow) {
      playerWindow.blur();
    }
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    const playerWindow = window.open(pagePath("player", { playerId }), "_blank", "noopener");
    window.focus();
    if (playerWindow) {
      playerWindow.blur();
    }
    return;
  }

  openPlayerPage(playerId);
};

const preventEvaluationPlayerPageAutoscroll = (event) => {
  if (event.button === 1) {
    event.preventDefault();
  }
};

evaluationPlayerPageButton.addEventListener("mousedown", preventEvaluationPlayerPageAutoscroll);
evaluationPlayerPageButton.addEventListener("auxclick", preventEvaluationPlayerPageAutoscroll);
evaluationPlayerPageButton.addEventListener("click", openEvaluationPlayerPage);
evaluationPlayerPageButton.addEventListener("mouseup", openEvaluationPlayerPage);

navButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    setPage(button.dataset.page);
  });
});

window.addEventListener("popstate", () => {
  const targetPage = pageFromUrl();


  setPage(targetPage, false);
});

accountButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});
linkWalletButton.addEventListener("click", linkWallet);

async function startApp() {
  loadTheme();
  const initialPage = pageFromUrl();
  loadSavedTableState();
  loadEvaluationMflPerUsd();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
  updateMenuVisibility();

  if (pageRequiresData(initialPage)) {
    showLoading();
  }

  if (initialPage === "changelog") {
    await setPage("changelog", false);
  }

  await loadWalletPermissions();
  updateAccountState();
  await loadSummary();
  showAppShell();
  await showHomeShell(initialPage, false);
}
startApp();
