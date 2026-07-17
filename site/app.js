const state = {
  columns: [],
  columnIndexMap: null,
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
  dataAccessOverride: null,
  dataSnapshots: {},
  selectedPlayerIds: new Set(),
  selectionAnchorPlayerId: null,
  filterDraftRules: null,
  watchlistPlayerIds: new Set(),
  watchlistPlayerIdsAdded: new Set(),
  watchlistPlayerIdsRemoved: new Set(),
  watchlists: [],
  currentWatchlistId: "",
  currentAgentWalletAddress: "",
  pendingWatchlistRouteId: "",
  editingWatchlistId: "",
  pendingDeleteWatchlistId: "",
  pendingWatchlistChoiceAction: "",
  pendingWatchlistChoicePlayerIds: [],
  pendingAddWatchlistContext: "",
  pendingPostLoadingToast: "",
  playerNotes: {},
  settingsReceiveEmailsFor: [],
  settingsDateFormat: "DMY",
  settingsTimeFormat: "24h",
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
  evaluationLateSeasonRewardRates: [80, 80, 60],
  evaluationSummaryPositions: {},
  evaluationShareId: "",
  evaluationShareLoading: false,
  evaluationSavedId: "",
  evaluationSavedLoading: false,
  linkedWalletAddress: "",
  linkedWalletProof: null,
  walletPermissionAllowed: false,
  flowWalletModule: null,
  flowWalletModulePromise: null,
  walletPreferencesSaveTimer: null,
  walletPreferencesSaveSequence: 0,
  walletNotesSaveTimer: null,
  walletPreferencesLoading: false,
  walletPreferencesLoaded: false,
  walletOptInInProgress: false,
  loadingPercent: 0,
  rowSortCache: new WeakMap(),
  walletRows: [],
  walletNamesLoaded: false,
  walletNamesLoadPromise: null,
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
const joinedAgencyColumn = "owned_since";
const linkColumn = "player_link";
const mflWalletAddress = "0xff8d2bbed8164db0";

const tablePages = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers"]);
const pageViewOptions = {
  database: ["attributes"],
  mfl: ["attributes"],
  agents: ["attributes", "next", "current", "all"],
  progression: ["current", "all"],
  watchlist: ["attributes", "next", "current", "all"],
  myplayers: ["attributes", "next", "current", "all"],
};
const defaultPageViews = {
  database: "attributes",
  mfl: "attributes",
  agents: "attributes",
  progression: "current",
  watchlist: "current",
  myplayers: "attributes",
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
  owned_since: "col-agent",
  player_link: "col-link",
};

function joinedAgencyPages() {
  return new Set(["myplayers", "agents", "mfl"]);
}

function displayColumnForPage(column, pageName = state.currentPage) {
  return column === agentColumn && joinedAgencyPages().has(pageName) ? joinedAgencyColumn : column;
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
const columnLabels = {
  player_id: "ID",
  nationality_flag: "",
  wallet_name: "Agent",
  owned_since: "Joined Agency",
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

const numberColumns = new Set(["player_id", "age", "height", "retirement_years", "player_seasons", "goalkeeping", joinedAgencyColumn, ...statColumns]);
const sortableColumns = new Set(["player_id", "name", "age", "player_seasons", joinedAgencyColumn, ...statColumns]);
const baseFilterColumns = ["player_id", "wallet_name", "name", "positions", "age", "player_seasons", "nationality", ...statColumns, "owned_since"];
const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
const GUEST_WATCHLIST_STORAGE_KEY = "mfl-guest-watchlist-v1";
const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
const LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY = "mfl-linked-wallet-display-name-v1";
const WALLET_PERMISSION_CACHE_STORAGE_KEY = "mfl-wallet-permission-cache-v1";
const WALLET_PERMISSION_CACHE_TTL_MS = 60 * 60 * 1000;
const WALLET_WATCHLIST_STORAGE_PREFIX = "mfl-wallet-watchlist-v1:";
const WATCHLIST_ID_LENGTH = 8;
const MAX_WATCHLISTS = 5;
const MAX_WATCHLIST_PLAYERS = 250;
const DEFAULT_WATCHLIST_NAME = "Default";
const WALLET_NOTES_STORAGE_PREFIX = "mfl-wallet-player-notes-v1:";
const WALLET_PENDING_SETTINGS_STORAGE_PREFIX = "mfl-wallet-pending-settings-v1:";
const RECENT_SEARCH_STORAGE_KEY = "mfl-recent-player-searches-v1";
const RECENT_EVALUATION_SEARCH_STORAGE_KEY = "mfl-recent-evaluation-searches-v1";
const PLAYER_NOTE_MAX_LENGTH = 200;
const DATA_CACHE_NAME = "mfl-front-office-data-v1";
const DATA_CACHE_VERSION_KEY = "mfl-data-cache-version";
const DATA_CACHE_MANIFEST_KEY = "mfl-data-cache-manifest";
const DATA_SNAPSHOT_DB_NAME = "mfl-front-office-data-snapshots";
const DATA_SNAPSHOT_DB_VERSION = 1;
const DATA_SNAPSHOT_STORE_NAME = "snapshots";
const FLOW_WALLET_MODULE_URLS = [
  "https://esm.sh/@onflow/fcl@1.21.11?bundle",
];
const FLOW_DISCOVERY_WALLET = "https://fcl-discovery.onflow.org/authn";
const FLOW_DISCOVERY_AUTHN_ENDPOINT = "https://fcl-discovery.onflow.org/api/authn";
const DAPPER_PROVIDER_ADDRESS = normalizeWalletAddress("0xead892083b3e2c6c");
const DAPPER_AUTHN_INCLUDE = ["dapper-wallet", DAPPER_PROVIDER_ADDRESS];
const DAPPER_AUTHN_EXCLUDE = ["flow-wallet", "nufi", "blocto", "ledger"];
const WALLET_ADDRESS_PATTERN = /0x[0-9a-f]{16,64}/gi;
const WALLET_CANCELLED_PATTERNS = ["cancel", "declin", "reject", "closed", "user aborted"];
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
const myPlayersLockedPage = document.querySelector("#myPlayersLockedPage");
const optInLockedTitle = document.querySelector("#optInLockedTitle");
const optInLockedMessage = document.querySelector("#optInLockedMessage");
const myPlayersOptInButton = document.querySelector("#myPlayersOptInButton");
const playerPage = document.querySelector("#playerPage");
const evaluationPage = document.querySelector("#evaluationPage");
const playerDetail = document.querySelector("#playerDetail");
const settingsPage = document.querySelector("#settingsPage");
const settingsAgentName = document.querySelector("#settingsAgentName");
const settingsWalletAddress = document.querySelector("#settingsWalletAddress");
const settingsDateFormatOptions = document.querySelector("#settingsDateFormatOptions");
const settingsTimeFormatOptions = document.querySelector("#settingsTimeFormatOptions");
const settingsEmailOptions = document.querySelector("#settingsEmailOptions");
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
const accountSettingsButton = document.querySelector("#accountSettingsButton");
const linkWalletButton = document.querySelector("#linkWalletButton");
const homeOptInButton = document.querySelector("#homeOptInButton");
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
const packablePlayersFilter = document.querySelector("#packablePlayersFilter");
const packablePlayersInput = document.querySelector("#packablePlayersInput");
const newMintsInput = document.querySelector("#newMintsInput");
const newMintsLabel = document.querySelector("#newMintsLabel");
const pageSizeSelect = document.querySelector("#pageSizeSelect");
const tableHead = document.querySelector("#tableHead");
const tableBody = document.querySelector("#tableBody");
const emptyState = document.querySelector("#emptyState");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const pageText = document.querySelector("#pageText");
const viewButtons = document.querySelectorAll(".viewButton");
const watchlistSwitcher = document.querySelector("#watchlistSwitcher");
const watchlistButton = document.querySelector("#watchlistButton");
const watchlistButtonText = document.querySelector("#watchlistButtonText");
const watchlistDropdown = document.querySelector("#watchlistDropdown");
const watchlistPlayerCount = document.querySelector("#watchlistPlayerCount");
const watchlistChoiceModal = document.querySelector("#watchlistChoiceModal");
const watchlistChoiceTitle = document.querySelector("#watchlistChoiceTitle");
const watchlistChoiceList = document.querySelector("#watchlistChoiceList");
const closeWatchlistChoiceButton = document.querySelector("#closeWatchlistChoiceButton");
const addWatchlistFromChoiceButton = document.querySelector("#addWatchlistFromChoiceButton");
const addWatchlistModal = document.querySelector("#addWatchlistModal");
const addWatchlistTitle = document.querySelector("#addWatchlistTitle");
const addWatchlistNameInput = document.querySelector("#addWatchlistNameInput");
const discardAddWatchlistButton = document.querySelector("#discardAddWatchlistButton");
const confirmAddWatchlistButton = document.querySelector("#confirmAddWatchlistButton");
const addWatchlistError = document.querySelector("#addWatchlistError");
const deleteWatchlistModal = document.querySelector("#deleteWatchlistModal");
const deleteWatchlistName = document.querySelector("#deleteWatchlistName");
const cancelDeleteWatchlistButton = document.querySelector("#cancelDeleteWatchlistButton");
const confirmDeleteWatchlistButton = document.querySelector("#confirmDeleteWatchlistButton");
const closeDeleteWatchlistButton = document.querySelector("#closeDeleteWatchlistButton");
const closeAddWatchlistButton = document.querySelector("#closeAddWatchlistButton");
const tablePageTitle = document.querySelector("#tablePageTitle");
const evaluationSearchInput = document.querySelector("#evaluationSearchInput");
const evaluationSearchResults = document.querySelector("#evaluationSearchResults");
const evaluationButtons = document.querySelector("#evaluationButtons");
const evaluationResetButton = document.querySelector("#evaluationResetButton");
const evaluationLoadButton = document.querySelector("#evaluationLoadButton");
const evaluationPlayerPageButton = document.querySelector("#evaluationPlayerPageButton");
const evaluationSaveButton = document.querySelector("#evaluationSaveButton");
const evaluationShareButton = document.querySelector("#evaluationShareButton");
const evaluationDeleteButton = document.querySelector("#evaluationDeleteButton");
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
const resetAdvancedSettingsButton = document.querySelector("#resetAdvancedSettingsButton");
const discardAdvancedSettingsButton = document.querySelector("#discardAdvancedSettingsButton");
const applyAdvancedSettingsButton = document.querySelector("#applyAdvancedSettingsButton");
const advancedDiscountRateValue = document.querySelector("#advancedDiscountRateValue");
const advancedLateSeasonRewardsSection = document.querySelector(".advancedLateSeasonRewardsSection");
const advancedLateSeasonRewardsToggle = document.querySelector("#advancedLateSeasonRewardsToggle");
const advancedThirdLastRewardInput = document.querySelector("#advancedThirdLastRewardInput");
const advancedSecondLastRewardInput = document.querySelector("#advancedSecondLastRewardInput");
const advancedFinalRewardInput = document.querySelector("#advancedFinalRewardInput");
const advancedThirdLastRewardIncreaseButton = document.querySelector("#advancedThirdLastRewardIncreaseButton");
const advancedThirdLastRewardDecreaseButton = document.querySelector("#advancedThirdLastRewardDecreaseButton");
const advancedThirdLastRewardResetButton = document.querySelector("#advancedThirdLastRewardResetButton");
const advancedSecondLastRewardIncreaseButton = document.querySelector("#advancedSecondLastRewardIncreaseButton");
const advancedSecondLastRewardDecreaseButton = document.querySelector("#advancedSecondLastRewardDecreaseButton");
const advancedSecondLastRewardResetButton = document.querySelector("#advancedSecondLastRewardResetButton");
const advancedFinalRewardIncreaseButton = document.querySelector("#advancedFinalRewardIncreaseButton");
const advancedFinalRewardDecreaseButton = document.querySelector("#advancedFinalRewardDecreaseButton");
const advancedFinalRewardResetButton = document.querySelector("#advancedFinalRewardResetButton");
const advancedPlayerTableHead = document.querySelector("#advancedPlayerTableHead");
const advancedPlayerTableBody = document.querySelector("#advancedPlayerTableBody");
const evaluationSummaryBody = document.querySelector("#evaluationSummaryBody");
const evaluationTableBody = document.querySelector("#evaluationTableBody");
const evaluationLoadModal = document.querySelector("#evaluationLoadModal");
const closeEvaluationLoadButton = document.querySelector("#closeEvaluationLoadButton");
const evaluationLoadList = document.querySelector("#evaluationLoadList");
const selectionBar = document.querySelector("#selectionBar");
const selectionCount = document.querySelector("#selectionCount");
const clearSelectionButton = document.querySelector("#clearSelectionButton");
const addToWatchlistButton = document.querySelector("#addToWatchlistButton");
const moveToWatchlistButton = document.querySelector("#moveToWatchlistButton");
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

function normalizeLoadingMessage(message) {
  const text = String(message || "Loading data").trim();

  if (text === "Loading complete") {
    return text;
  }

  return text.endsWith("...") ? text : `${text.replace(/[.]+$/, "")}...`;
}

function setLoadingPercent(percent, message = "Loading data", options = {}) {
  const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  const allowBackwards = Boolean(options.allowBackwards);
  const nextPercent = allowBackwards ? safePercent : Math.max(state.loadingPercent || 0, safePercent);
  state.loadingPercent = nextPercent;
  loadingBarFill.style.width = `${nextPercent}%`;
  loadingText.textContent = normalizeLoadingMessage(message);
}

function updateLoadingProgress(loadedFiles, totalFiles, message = null, progressRange = null) {
  const percent = totalFiles > 0 ? Math.round((loadedFiles / totalFiles) * 100) : 0;
  const mappedPercent = progressRange
    ? progressRange.start + ((progressRange.end - progressRange.start) * (percent / 100))
    : percent;
  setLoadingPercent(mappedPercent, message || (totalFiles > 0 ? "Loading data" : "Preparing data..."));
}

function loadingRangeProgress(startPercent, endPercent, message = "Loading data") {
  const start = Math.max(0, Math.min(100, startPercent));
  const end = Math.max(start, Math.min(100, endPercent));

  return (fraction) => {
    const safeFraction = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
    setLoadingPercent(start + ((end - start) * safeFraction), message);
  };
}

function paintLoadingProgress() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

function showLoadingError(message) {
  state.loadingPercent = 100;
  loadingBarFill.style.width = "100%";
  loadingScreen.classList.add("failed");
  loadingText.textContent = normalizeLoadingMessage(message);
}

async function showUnauthorizedProgressionRedirect() {
  showLoading();
  await paintLoadingProgress();
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  showLoadingError("Not authorised.");
  showToast("Not authorised.");
  await new Promise((resolve) => window.setTimeout(resolve, 700));
  window.history.replaceState({}, "", "/");
  loadingScreen.hidden = true;
  loadingScreen.classList.remove("failed", "complete", "leaving");
  document.body.classList.remove("loading");
  return setPage("home", false);
}

async function finishLoading() {
  setLoadingPercent(100, "Loading complete");
  await paintLoadingProgress();
  await new Promise((resolve) => window.setTimeout(resolve, 180));
  loadingScreen.classList.add("complete");
  loadingText.textContent = "Loading complete";
  await new Promise((resolve) => window.setTimeout(resolve, 450));
  loadingScreen.classList.add("leaving");
  await new Promise((resolve) => window.setTimeout(resolve, 220));
  loadingScreen.hidden = true;
  loadingScreen.classList.remove("complete", "leaving");
  document.body.classList.remove("loading");
  revealAppShell();
  flushPostLoadingToast();
}

function revealAppShell() {
  document.body.classList.remove("booting");
}

function hasWalletProof() {
  const proof = state.linkedWalletProof;
  return Boolean(
    state.linkedWalletAddress
    && proof?.address === state.linkedWalletAddress
    && proof?.message === walletAccessMessage(state.linkedWalletAddress, proof?.signingAddress)
    && Array.isArray(proof?.signatures)
    && proof.signatures.length
    && (proof.type !== "account-proof" || (proof.appIdentifier && proof.nonce))
  );
}

function hasProgressionAccess() {
  return Boolean(state.linkedWalletAddress && hasWalletProof() && state.walletPermissionAllowed);
}

function progressionAccessMessage() {
  if (!state.linkedWalletAddress) {
    return "Opt in with Dapper to view Progression.";
  }

  if (!hasWalletProof()) {
    return "Verify your Dapper wallet opt-in to view Progression.";
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
  if (homeOptInButton) {
    homeOptInButton.hidden = true;
  }
}

function syncHomeLoginButton() {
  const walletLinked = Boolean(state.linkedWalletAddress && hasWalletProof());

  if (homeOptInButton) {
    homeOptInButton.hidden = walletLinked;
    homeOptInButton.disabled = state.walletOptInInProgress;
  }

  if (myPlayersOptInButton) {
    myPlayersOptInButton.hidden = walletLinked;
    myPlayersOptInButton.disabled = state.walletOptInInProgress;
  }
}

function hasWalletOptIn() {
  return Boolean(state.linkedWalletAddress && hasWalletProof());
}

function pageRequiresData(pageName) {
  if ((pageName === "myplayers" || pageName === "watchlist" || pageName === "settings") && !hasWalletOptIn()) {
    return false;
  }

  return tablePages.has(pageName) || pageName === "player" || pageName === "evaluation";
}

function pageRequiresProgressionPermission(pageName) {
  return pageName === "progression";
}

function pageRequiresFullData(pageName) {
  return currentDataAccess(pageName) !== "public" && pageCanUseProgressionData(pageName);
}

function pageCanUseProgressionData(pageName) {
  return pageName === "progression" || pageName === "player" || pageName === "watchlist" || pageName === "myplayers";
}

async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {
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
  state.loadingPercent = 0;
  setLoadingPercent(3, "Preparing data...", { allowBackwards: true });

  window.setTimeout(() => {
    if (document.body.classList.contains("loading") && state.loadingPercent < 8) {
      setLoadingPercent(8, "Preparing data...");
    }
  }, 0);
}

function appOrigin() {
  return window.location.origin;
}
function normalizeWalletAddress(address) {
  const value = String(address || "").trim();
  return value ? (value.startsWith("0x") ? value : `0x${value}`) : "";
}

function walletPermissionCacheKey(address = state.linkedWalletAddress) {
  const wallet = normalizeWalletAddress(address).toLowerCase();
  return wallet ? `${WALLET_PERMISSION_CACHE_STORAGE_KEY}:${wallet}` : "";
}

function readWalletPermissionCache(address = state.linkedWalletAddress) {
  const key = walletPermissionCacheKey(address);
  if (!key) {
    return null;
  }

  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    return cached && typeof cached === "object" ? cached : null;
  } catch {
    return null;
  }
}

function writeWalletPermissionCache({ allowed, version, updatedAt }) {
  const key = walletPermissionCacheKey();
  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify({
      allowed: Boolean(allowed),
      version: String(version || ""),
      updatedAt: String(updatedAt || ""),
      checkedAt: Date.now(),
    }));
  } catch {
    // Access still works for this page even if storage is blocked.
  }
}

function clearWalletPermissionCache(address = state.linkedWalletAddress) {
  const key = walletPermissionCacheKey(address);
  if (!key) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing else to clear if storage is blocked.
  }
}

async function loadWalletPermissionVersion() {
  const response = await fetch("/api/wallet-permissions-version", { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return {
    version: String(data.version || ""),
    updatedAt: String(data.updated_at || ""),
  };
}

function applyCachedWalletPermission(cacheEntry, previousAllowed) {
  state.walletPermissionAllowed = Boolean(cacheEntry?.allowed);
  return {
    allowed: state.walletPermissionAllowed,
    changed: previousAllowed !== state.walletPermissionAllowed,
  };
}

function applyStoredWalletPermission() {
  const previousAllowed = state.walletPermissionAllowed;

  if (!state.linkedWalletAddress || !hasWalletProof()) {
    state.walletPermissionAllowed = false;
    clearWalletNotesState();
    return {
      allowed: state.walletPermissionAllowed,
      changed: previousAllowed !== state.walletPermissionAllowed,
    };
  }

  return applyCachedWalletPermission(readWalletPermissionCache(), previousAllowed);
}

async function loadWalletPermissions(options = {}) {
  const previousAllowed = state.walletPermissionAllowed;
  state.walletPermissionAllowed = false;

  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return {
      allowed: state.walletPermissionAllowed,
      changed: previousAllowed !== state.walletPermissionAllowed,
    };
  }

  const cached = readWalletPermissionCache();
  const cacheAge = cached?.checkedAt ? Date.now() - Number(cached.checkedAt) : Infinity;
  const cacheIsFresh = cacheAge >= 0 && cacheAge < WALLET_PERMISSION_CACHE_TTL_MS;

  if (!options.force && !options.checkVersion && cached && cacheIsFresh) {
    return applyCachedWalletPermission(cached, previousAllowed);
  }

  let metadata = null;

  try {
    metadata = await loadWalletPermissionVersion();
  } catch {
    metadata = null;
  }

  const cacheMatchesVersion = metadata
    ? cached?.version === metadata.version && cached?.updatedAt === metadata.updatedAt
    : false;

  if (!options.force && cached && cacheMatchesVersion) {
    writeWalletPermissionCache({
      allowed: cached.allowed,
      version: cached.version,
      updatedAt: cached.updatedAt,
    });
    return applyCachedWalletPermission(cached, previousAllowed);
  }

  try {
    const response = await fetch("/api/wallet-access", {
      cache: "no-store",
      headers: walletProofHeaders(true),
    });

    if (response.ok) {
      const data = await response.json();
      state.walletPermissionAllowed = Boolean(data.allowed);
      writeWalletPermissionCache({
        allowed: state.walletPermissionAllowed,
        version: metadata?.version || data.version || "",
        updatedAt: metadata?.updatedAt || data.updated_at || "",
      });
    } else if (cached && cacheIsFresh) {
      return applyCachedWalletPermission(cached, previousAllowed);
    }
  } catch {
    if (cached && cacheIsFresh) {
      return applyCachedWalletPermission(cached, previousAllowed);
    }

    state.walletPermissionAllowed = false;
  }

  return {
    allowed: state.walletPermissionAllowed,
    changed: previousAllowed !== state.walletPermissionAllowed,
  };
}
function currentDataAccess(pageName = state.currentPage) {
  if (arguments.length === 0 && state.dataAccessOverride) {
    return state.dataAccessOverride;
  }

  if (pageRequiresData(pageName)) {
    return "full";
  }

  return "full";
}

function staticDataFileUrl(fileName) {
  return `/data/${encodeURIComponent(fileName)}`;
}

function canUseStaticDataFile(fileName, access = currentDataAccess()) {
  return /^(manifest\.json|players_(public|progression|\d{4})\.json|wallets\.json)$/.test(fileName);
}

function dataFileUrl(fileName, options = {}) {
  const access = currentDataAccess();
  const query = new URLSearchParams({ file: fileName });

  if (access === "public") {
    query.set("access", "public-database");
  } else if (access === "owned") {
    query.set("access", "owned-progression");
  } else if (access === "full") {
    query.set("access", "full-progression");
  }

  if (access !== "public" && Array.isArray(options.columns) && options.columns.length) {
    query.set("columns", options.columns.join(","));
  }

  return `/api/data?${query.toString()}`;
}

function walletProofHeaders(force = false) {
  if ((!force && currentDataAccess() === "public") || !hasWalletProof()) {
    return {};
  }

  return {
    "x-dapper-wallet-address": state.linkedWalletAddress,
    "x-wallet-signing-address": state.linkedWalletProof.signingAddress || state.linkedWalletAddress,
    "x-wallet-message": state.linkedWalletProof.message,
    "x-wallet-proof-type": state.linkedWalletProof.type || "user-signature",
    "x-wallet-app-identifier": state.linkedWalletProof.appIdentifier || walletAccessMessage(),
    "x-wallet-nonce": state.linkedWalletProof.nonce || "",
    "x-wallet-signatures": JSON.stringify(state.linkedWalletProof.signatures),
  };
}

async function recordWalletOptIn() {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return null;
  }

  try {
    const response = await fetch("/api/wallet-opt-ins", {
      method: "POST",
      cache: "no-store",
      headers: walletProofHeaders(true),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.warning) {
      throw new Error(data.warning || data.error || `Wallet opt-in list update failed with ${response.status}.`);
    }

    return data;
  } catch (error) {
    console.warn("Could not record Dapper wallet opt-in.", error);
    return { recorded: false, warning: error.message || "Wallet opt-in list could not be updated." };
  }
}

function dataCacheAccessKey(access = currentDataAccess()) {
  return access === "owned"
    ? `${access}:${normalizeWalletAddress(state.linkedWalletAddress).toLowerCase()}`
    : access;
}

function cacheRequestForDataFile(fileName, accessKey = dataCacheAccessKey()) {
  return new Request(`/data-cache/${accessKey}/${fileName}`);
}

async function readCachedDataFile(fileName, onProgress = null) {
  if (!("caches" in window)) {
    return null;
  }

  const cache = await caches.open(DATA_CACHE_NAME);
  const response = await cache.match(cacheRequestForDataFile(fileName));
  if (!response) {
    return null;
  }

  onProgress?.(0.08);
  const data = await readJsonWithProgress(response, onProgress);
  onProgress?.(1);
  return data;
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
async function readJsonWithProgress(response, onProgress = null) {
  const totalBytes = Number(response.headers.get("content-length")) || 0;

  if (!response.body || !totalBytes) {
    onProgress?.(0.15);
    await paintLoadingProgress();
    const data = await response.json();
    onProgress?.(1);
    return data;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    receivedBytes += value.byteLength;
    chunks.push(decoder.decode(value, { stream: true }));
    onProgress?.(Math.min(0.95, receivedBytes / totalBytes));
  }

  chunks.push(decoder.decode());
  const data = JSON.parse(chunks.join(""));
  onProgress?.(1);
  return data;
}

async function fetchDataFile(fileName, options = {}) {
  const { useCache = false, writeCache = false, columns = null, onProgress = null } = options;

  if (useCache) {
    const cached = await readCachedDataFile(fileName, onProgress);

    if (cached) {
      onProgress?.(1);
      return cached;
    }
  }

  onProgress?.(0.03);
  const requestedUrl = dataFileUrl(fileName, { columns });
  const staticUrl = staticDataFileUrl(fileName);
  const cacheMode = fileName === "manifest.json" || !useCache || writeCache ? "no-store" : "default";
  const preferStatic = !columns && canUseStaticDataFile(fileName);
  const fetchAttempts = preferStatic
    ? [
        { url: staticUrl, options: { cache: cacheMode } },
        { url: requestedUrl, options: { cache: cacheMode, headers: walletProofHeaders() } },
      ]
    : [
        { url: requestedUrl, options: { cache: cacheMode, headers: walletProofHeaders() } },
        ...(requestedUrl !== staticUrl && canUseStaticDataFile(fileName) ? [{ url: staticUrl, options: { cache: cacheMode } }] : []),
      ];
  let response = null;

  for (const attempt of fetchAttempts) {
    response = await fetch(attempt.url, attempt.options);

    if (response.ok) {
      break;
    }
  }

  if (!response || !response.ok) {
    let message = "Could not load exported data. Please refresh or try again in a moment.";

    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Keep the default message if the API did not return JSON.
    }

    throw new Error(message);
  }

  const data = await readJsonWithProgress(response, onProgress);

  if (writeCache) {
    await writeCachedDataFile(fileName, data);
  }

  return data;
}

function normalizedAgentName(value) {
  const name = value === null || value === undefined ? "" : String(value).trim();
  return name && name.toUpperCase() !== "NULL" ? name : "";
}


async function loadWalletNames() {
  if (state.walletNamesLoaded) {
    return true;
  }

  if (!state.walletNamesLoadPromise) {
    state.walletNamesLoadPromise = fetch("/data/wallets.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return false;
        }

        const data = await response.json();
        const walletAddressIndex = data.columns?.indexOf("wallet_address") ?? -1;
        const walletNameIndex = data.columns?.indexOf("wallet_name") ?? -1;

        if (!Array.isArray(data.rows) || walletAddressIndex < 0 || walletNameIndex < 0) {
          return false;
        }

        state.walletRows = data.rows.map((row) => ({
          wallet_address: row[walletAddressIndex],
          wallet_name: row[walletNameIndex],
        }));
        state.walletNamesLoaded = true;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        state.walletNamesLoadPromise = null;
      });
  }

  return state.walletNamesLoadPromise;
}

function savedAgentNameForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) {
    return "";
  }

  try {
    const saved = JSON.parse(localStorage.getItem(LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY) || "null");
    return normalizeWalletAddress(saved?.address).toLowerCase() === normalizedAddress
      ? normalizedAgentName(saved?.name)
      : "";
  } catch {
    return "";
  }
}

function saveAgentNameForWallet(address, name) {
  const normalizedAddress = normalizeWalletAddress(address);
  const agentName = normalizedAgentName(name);
  if (!normalizedAddress || !agentName) {
    return;
  }

  try {
    localStorage.setItem(LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY, JSON.stringify({ address: normalizedAddress, name: agentName }));
  } catch {
    // The account dropdown can still fall back to the live data for this page.
  }
}

async function fetchLiveAgentNameForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) {
    return "";
  }

  try {
    const response = await fetch("https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/leaderboards/users/global", { cache: "no-store" });
    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    const wallet = Array.isArray(data?.users)
      ? data.users.find((user) => normalizeWalletAddress(user?.walletAddress).toLowerCase() === normalizedAddress)
      : null;
    const agentName = normalizedAgentName(wallet?.name);

    if (agentName) {
      saveAgentNameForWallet(address, agentName);
      return agentName;
    }
  } catch {
    // Saved/exported names and the wallet address remain valid fallbacks.
  }

  return "";
}

async function refreshLinkedWalletAgentName() {
  if (!state.linkedWalletAddress || agentNameForWallet(state.linkedWalletAddress) !== normalizeWalletAddress(state.linkedWalletAddress)) {
    return;
  }

  const agentName = await fetchLiveAgentNameForWallet(state.linkedWalletAddress);
  if (agentName) {
    updateAccountState();
  }
}

function agentNameForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) {
    return "";
  }

  const walletNameRow = state.walletRows.find((row) => normalizeWalletAddress(row.wallet_address).toLowerCase() === normalizedAddress);
  const walletName = walletNameRow ? normalizedAgentName(walletNameRow.wallet_name) : "";
  if (walletName) {
    saveAgentNameForWallet(address, walletName);
    return walletName;
  }

  const walletRow = state.rows.find((row) => normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase() === normalizedAddress);
  const agentName = walletRow ? normalizedAgentName(getValue(walletRow, "wallet_name")) : "";
  if (agentName) {
    saveAgentNameForWallet(address, agentName);
    return agentName;
  }

  return savedAgentNameForWallet(address) || normalizeWalletAddress(address);
}

function accountName() {
  return state.linkedWalletAddress ? agentNameForWallet(state.linkedWalletAddress) : "Guest";
}

function updateEvaluationFooterActions() {
  const walletLinked = Boolean(state.linkedWalletAddress && hasWalletProof());
  const savedEvaluationActive = Boolean(state.evaluationSavedId || evaluationSavedIdFromUrl());
  const sharedEvaluationActive = Boolean(state.evaluationShareId || evaluationShareIdFromUrl());
  if (evaluationSaveButton) {
    evaluationSaveButton.hidden = !walletLinked;
  }
  if (evaluationShareButton) {
    evaluationShareButton.hidden = !walletLinked;
  }
  if (evaluationDeleteButton) {
    evaluationDeleteButton.hidden = !walletLinked || !savedEvaluationActive || sharedEvaluationActive;
  }
}

function updateAccountState() {
  const walletLinked = Boolean(state.linkedWalletAddress && hasWalletProof());
  accountEmail.textContent = accountName();
  linkWalletButton.textContent = walletLinked ? "Opt Out" : "Opt In";
  linkWalletButton.disabled = state.walletOptInInProgress;
  linkWalletButton.classList.toggle("walletOptOut", walletLinked);
  linkWalletButton.title = walletLinked ? "Opt out of Dapper wallet access" : "Opt in with Dapper";
  if (accountSettingsButton) {
    accountSettingsButton.hidden = !walletLinked;
  }
  updateEvaluationFooterActions();
  if (evaluationLoadButton) {
    evaluationLoadButton.hidden = Boolean(state.evaluationPlayerId) || !walletLinked;
    evaluationButtons.hidden = Boolean(state.evaluationPlayerId) ? evaluationButtons.hidden : !walletLinked;
  }
  syncHomeLoginButton();
}

function optOutWallet() {
  const previousWalletAddress = state.linkedWalletAddress;
  clearWalletNotesState();
  state.linkedWalletAddress = "";
  state.linkedWalletProof = null;
  state.walletPermissionAllowed = false;

  try {
    localStorage.removeItem(LINKED_WALLET_STORAGE_KEY);
    localStorage.removeItem(LINKED_WALLET_PROOF_STORAGE_KEY);
    localStorage.removeItem(LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY);
    clearWalletPermissionCache();
  } catch {
    // The page state is still cleared even if storage is blocked.
  }

  updateAccountState();
  updateMenuVisibility();
  normalizeCurrentViewsAfterProgressionAccessLoss();
  if (state.currentPage === "player") {
    renderPlayerPage(playerIdFromUrl());
  } else if (tablePageKey()) {
    applyFilters();
  }
  saveTableState();
  showToast("Dapper opt-in removed.");

  if (state.currentPage === "evaluation") {
    redirectSavedEvaluationLinkToBasicEvaluation();
    renderEvaluationPage();
  }

  if (state.currentPage === "watchlist") {
    if (window.location.pathname !== "/watchlist" || window.location.search) {
      window.history.replaceState({}, "", "/watchlist");
    }
    setPage("watchlist", false, { plain: true });
    return;
  }

  if (state.currentPage === "myplayers" || state.currentPage === "settings") {
    setPage(state.currentPage, false);
    return;
  }

  if (pageRequiresProgressionPermission(state.currentPage)) {
    setPage("home");
  }
}
function walletAddressCandidatesFromValue(value, seen = new WeakSet()) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    const matches = value.match(WALLET_ADDRESS_PATTERN) || [];
    return matches
      .map(normalizeWalletAddress)
      .filter((address) => address && address !== DAPPER_PROVIDER_ADDRESS);
  }

  if (typeof value !== "object") {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  return Object.values(value).flatMap((childValue) => walletAddressCandidatesFromValue(childValue, seen));
}

function walletAddressFromUser(user) {
  const directAddress = normalizeWalletAddress(
    user?.addr
    || user?.address
    || user?.account?.addr
    || user?.account?.address
    || user?.authorization?.addr
    || user?.authorization?.address,
  );

  if (directAddress && directAddress !== DAPPER_PROVIDER_ADDRESS) {
    return directAddress;
  }

  return walletAddressCandidatesFromValue(user)[0] || "";
}

async function authenticatedWalletUser(fcl, authenticatedUser) {
  if (walletAddressFromUser(authenticatedUser)) {
    return authenticatedUser;
  }

  const currentUser = typeof fcl.currentUser === "function" ? fcl.currentUser() : fcl.currentUser;
  if (typeof currentUser?.snapshot === "function") {
    const snapshot = await currentUser.snapshot();
    return walletAddressFromUser(snapshot) ? snapshot : authenticatedUser;
  }

  return authenticatedUser;
}
function signatureWalletAddress(signatures) {
  const signature = Array.isArray(signatures) ? signatures.find((item) => item?.addr || item?.address) : null;
  const directAddress = normalizeWalletAddress(signature?.addr || signature?.address);
  if (directAddress && directAddress !== DAPPER_PROVIDER_ADDRESS) {
    return directAddress;
  }

  return walletAddressCandidatesFromValue(signatures)[0] || "";
}
function walletAccessMessage() {
  return "MFL Front Office Dapper Opt-In";
}

function walletAccessNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function walletAccountProofFromUser(user, accountProof) {
  const services = Array.isArray(user?.services) ? user.services : [];
  const accountProofService = services.find((service) => service?.type === "account-proof");
  const proofData = accountProofService?.data || accountProofService;
  const signatures = Array.isArray(proofData?.signatures)
    ? proofData.signatures
    : (proofData?.signature ? [proofData.signature] : []);
  const address = normalizeWalletAddress(
    proofData?.address
    || proofData?.addr
    || signatures[0]?.addr
    || signatures[0]?.address
    || walletAddressFromUser(user),
  );

  if (!address || !Array.isArray(signatures) || !signatures.length || !accountProof?.nonce) {
    return null;
  }

  return {
    type: "account-proof",
    address,
    signingAddress: address,
    message: walletAccessMessage(),
    appIdentifier: accountProof.appIdentifier,
    nonce: accountProof.nonce,
    signatures,
  };
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
        type: proof.type || "user-signature",
        address: normalizeWalletAddress(proof.address),
        message: proof.message,
        appIdentifier: proof.appIdentifier || walletAccessMessage(),
        nonce: proof.nonce || "",
        signingAddress: normalizeWalletAddress(proof.signingAddress || proof.address),
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
    "discovery.wallet": FLOW_DISCOVERY_WALLET,
    "discovery.authn.endpoint": FLOW_DISCOVERY_AUTHN_ENDPOINT,
    "discovery.authn.include": DAPPER_AUTHN_INCLUDE,
    "discovery.authn.exclude": DAPPER_AUTHN_EXCLUDE,
    "discovery.wallet.method.default": "POP/RPC",
    "discovery.authn.method": "POP/RPC",
    "app.detail.title": "MFL Front Office",
    "app.detail.icon": `${appOrigin()}/favicon.ico`,
    "app.detail.url": appOrigin(),
    "app.detail.description": "MFL Front Office player database and club management tools",
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

function authnServicesFromDiscovery(data) {
  const candidates = Array.isArray(data) ? data : [data];
  const services = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (Array.isArray(candidate)) {
      services.push(...authnServicesFromDiscovery(candidate));
      continue;
    }

    if (candidate.type === "authn") {
      services.push(candidate);
    }

    for (const key of ["services", "authn", "results", "data"]) {
      if (candidate[key]) {
        services.push(...authnServicesFromDiscovery(candidate[key]));
      }
    }
  }

  return services;
}

function findDapperAuthnService(data) {
  return authnServicesFromDiscovery(data).find((service) => {
    const providerAddress = normalizeWalletAddress(service?.provider?.address || service?.provider?.addr || service?.addr);
    const searchable = JSON.stringify(service || {}).toLowerCase();
    return providerAddress === DAPPER_PROVIDER_ADDRESS
      || service?.uid === "dapper-wallet"
      || service?.provider?.name?.toLowerCase?.().includes("dapper")
      || searchable.includes("dapper");
  }) || null;
}

function discoveryResponseResults(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data?.results)) {
    return data.data.results;
  }

  return data ? [data] : [];
}

async function waitForDapperAuthnSubscription(fcl) {
  if (!fcl?.discovery?.authn?.subscribe) {
    return null;
  }

  return new Promise((resolve) => {
    let unsubscribe = null;
    const timeout = window.setTimeout(() => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
      resolve(null);
    }, 2500);

    unsubscribe = fcl.discovery.authn.subscribe((data) => {
      const service = findDapperAuthnService(discoveryResponseResults(data));
      if (!service) {
        return;
      }

      window.clearTimeout(timeout);
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
      resolve(service);
    });
  });
}

async function dapperAuthnService(fcl) {
  try {
    if (fcl?.discovery?.authn?.update) {
      await fcl.discovery.authn.update();
    }

    if (typeof fcl?.discovery?.authn === "function") {
      const service = findDapperAuthnService(discoveryResponseResults(await fcl.discovery.authn()));
      if (service) {
        return service;
      }
    }

    if (fcl?.discovery?.authn?.snapshot) {
      const service = findDapperAuthnService(discoveryResponseResults(await fcl.discovery.authn.snapshot()));
      if (service) {
        return service;
      }
    }

    const subscribedService = await waitForDapperAuthnSubscription(fcl);
    if (subscribedService) {
      return subscribedService;
    }

    for (const include of DAPPER_AUTHN_INCLUDE) {
      const query = new URLSearchParams({ include });
      const response = await fetch(`${FLOW_DISCOVERY_AUTHN_ENDPOINT}?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const service = findDapperAuthnService(discoveryResponseResults(await response.json()));
      if (service) {
        return service;
      }
    }
  } catch (error) {
    console.warn("Could not load direct Dapper authn service.", error);
  }

  return null;
}

async function authenticateWithDapper(fcl) {
  const accountProof = {
    appIdentifier: walletAccessMessage(),
    nonce: walletAccessNonce(),
  };

  if (fcl?.config?.put) {
    fcl.config().put("fcl.accountProof.resolver", async () => accountProof);
  }

  const service = await dapperAuthnService(fcl);
  const user = service
    ? await fcl.authenticate({ service, forceReauth: true })
    : await fcl.authenticate({ forceReauth: true });

  return { user, accountProof };
}

function finishWalletOptIn() {
  state.walletOptInInProgress = false;
  document.body.classList.remove("walletOptingIn");
  updateAccountState();
}

function walletLinkErrorMessage(error) {
  const rawMessage = typeof error === "string"
    ? error
    : error?.message || error?.errorMessage || error?.body?.message || String(error || "");
  const message = rawMessage.trim();
  const lowerMessage = message.toLowerCase();

  if (WALLET_CANCELLED_PATTERNS.some((pattern) => lowerMessage.includes(pattern))) {
    return "Wallet link cancelled.";
  }

  if (lowerMessage.includes("popup") || lowerMessage.includes("window")) {
    return "Enable pop-ups for this site to complete Dapper opt-in, then try again.";
  }

  if (lowerMessage.includes("404") || lowerMessage.includes("not found")) {
    return "Dapper opt-in endpoint could not be reached.";
  }

  if (message) {
    return `Dapper opt-in failed: ${message.slice(0, 120)}`;
  }

  return "Dapper opt-in failed. Try again in a moment.";
}

async function linkWallet() {
  closeAccountMenu();

  if (state.walletOptInInProgress) {
    return;
  }

  if (state.linkedWalletAddress && hasWalletProof()) {
    optOutWallet();
    return;
  }

  state.walletOptInInProgress = true;
  document.body.classList.add("walletOptingIn");
  showToast("Opting in...", { sticky: true });
  linkWalletButton.disabled = true;
  linkWalletButton.textContent = "Loading...";

  const fcl = await ensureFlowWallet();
  if (!fcl) {
    finishWalletOptIn();
    showToast("Dapper opt-in could not load. Try again in a moment.");
    return;
  }

  linkWalletButton.textContent = "Linking...";

  try {
    const authenticated = await authenticateWithDapper(fcl);
    const authenticatedUser = await authenticatedWalletUser(fcl, authenticated.user);
    let linkedWalletProof = walletAccountProofFromUser(authenticatedUser, authenticated.accountProof);
    let dapperAddress = linkedWalletProof?.address || walletAddressFromUser(authenticatedUser);

    if (!linkedWalletProof) {
      const message = walletAccessMessage();
      const signatures = await signWalletMessage(fcl, message);
      dapperAddress = signatureWalletAddress(signatures);

      if (dapperAddress) {
        linkedWalletProof = {
          type: "user-signature",
          address: dapperAddress,
          signingAddress: dapperAddress,
          message,
          appIdentifier: walletAccessMessage(),
          nonce: "",
          signatures,
        };
      }
    }

    if (!dapperAddress || !linkedWalletProof) {
      console.warn("Dapper opt-in did not include a wallet address or proof.", { authenticatedUser });
      throw new Error("Dapper did not return a wallet address.");
    }

    state.linkedWalletAddress = dapperAddress;
    state.linkedWalletProof = linkedWalletProof;
    try {
      localStorage.setItem(LINKED_WALLET_STORAGE_KEY, dapperAddress);
      localStorage.setItem(LINKED_WALLET_PROOF_STORAGE_KEY, JSON.stringify(state.linkedWalletProof));
    } catch {
      // The linked state still works for this page if storage is blocked.
    }

    const optInRecord = await recordWalletOptIn();
    await loadWalletPermissions({ force: true });
    await loadWalletNames();
    await refreshLinkedWalletAgentName();
    await loadWalletPreferences();
    mergeGuestWatchlistIntoAccount();
    let upgradedCurrentPage = false;
    if ((state.currentPage === "myplayers" || state.currentPage === "watchlist") && !myPlayersLockedPage.hidden) {
      await setPage(state.currentPage, false);
      upgradedCurrentPage = true;
    } else {
      upgradedCurrentPage = await upgradeCurrentPageAfterWalletOptIn();
    }
    if (!upgradedCurrentPage) {
      refreshWatchlistPageAfterWalletSync();
      refreshPlayerPageAfterWalletSync();
    }
    updateAccountState();
    updateMenuVisibility();
    saveTableState();
    closeAccountMenu();
    showToast(optInRecord?.warning ? "Successful opt-in. Supabase opt-in list was not updated." : "Successful opt-in.");
  } catch (error) {
    console.warn("Could not link Dapper wallet.", error);
    updateAccountState();
    showToast(walletLinkErrorMessage(error));
  } finally {
    finishWalletOptIn();
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

function evaluationShareIdFromUrl() {
  if (window.location.pathname !== "/evaluation") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("share") || "";
}

function evaluationSavedIdFromUrl() {
  if (window.location.pathname !== "/evaluation") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("saved") || "";
}

function isPlainEvaluationUrl() {
  if (window.location.pathname !== "/evaluation") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return !params.get("player") && !params.get("share") && !params.get("saved");
}

function shouldShowEvaluationRecentResults() {
  return isPlainEvaluationUrl() || document.activeElement === evaluationSearchInput;
}

function basicEvaluationPathForPlayer(playerId = "") {
  const id = String(playerId || "").trim();
  return id ? `/evaluation?player=${encodeURIComponent(id)}` : "/evaluation";
}

function replaceEvaluationUrlWithBasicPlayer(playerId = state.evaluationPlayerId) {
  if (window.location.pathname !== "/evaluation") {
    return;
  }

  const targetPath = basicEvaluationPathForPlayer(playerId);
  if (`${window.location.pathname}${window.location.search}` !== targetPath) {
    window.history.replaceState({}, "", targetPath);
  }
}

function resetEvaluationToDefaultForPlayer(playerId = state.evaluationPlayerId) {
  const id = String(playerId || "").trim();

  state.evaluationShareId = "";
  state.evaluationSavedId = "";
  state.evaluationIgnoreDiscountRate = false;
  state.evaluationIgnoreFirstSeason = false;

  if (id) {
    delete state.evaluationOverallRows[id];
    delete state.evaluationSummaryPositions[id];
    state.evaluationPlayerId = id;
    replaceEvaluationUrlWithBasicPlayer(id);
  } else {
    state.evaluationPlayerId = null;
    replaceEvaluationUrlWithBasicPlayer("");
  }

  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
}

function redirectSavedEvaluationLinkToBasicEvaluation() {
  if (window.location.pathname !== "/evaluation" || !evaluationSavedIdFromUrl()) {
    return false;
  }

  const playerId = String(evaluationPlayerIdFromUrl() || state.evaluationPlayerId || "").trim();
  state.evaluationSavedId = "";
  state.evaluationShareId = "";
  state.evaluationPlayerId = playerId || null;
  window.history.replaceState({}, "", basicEvaluationPathForPlayer(playerId));
  return true;
}

function resetInvalidEvaluationLinkToPlainEvaluation() {
  if (window.location.pathname !== "/evaluation") {
    return false;
  }

  if (!evaluationSavedIdFromUrl() && !evaluationShareIdFromUrl()) {
    return false;
  }

  state.evaluationSavedId = "";
  state.evaluationShareId = "";
  state.evaluationPlayerId = null;
  window.history.replaceState({}, "", "/evaluation");
  return true;
}

function normalizeSharedEvaluationPayload(payload) {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const playerId = String(data.playerId || data.player_id || "").trim();
  const mflPerUsd = parseEvaluationMflPerUsd(data.mflPerUsd ?? data.mfl_per_usd);
  const overallValues = Array.isArray(data.overallValues)
    ? data.overallValues.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
  const summaryPosition = String(data.summaryPosition || data.summary_position || "").trim();
  const summaryOverall = Number(data.summaryOverall ?? data.summary_overall);
  const summaryAge = Number(data.summaryAge ?? data.summary_age);

  return {
    playerId,
    mflPerUsd,
    ignoreDiscountRate: Boolean(data.ignoreDiscountRate ?? data.ignore_discount_rate),
    ignoreFirstSeason: Boolean(data.ignoreFirstSeason ?? data.ignore_first_season),
    lateSeasonRewardRates: evaluationLateSeasonRewardRatesFromPayload(data),
    overallValues,
    summaryPosition,
    summaryOverall: Number.isFinite(summaryOverall) ? summaryOverall : null,
    summaryAge: Number.isFinite(summaryAge) ? summaryAge : null,
  };
}

function currentEvaluationSharePayload() {
  const playerId = String(state.evaluationPlayerId || "").trim();
  const row = playerId ? rowByPlayerId(playerId) : null;
  const expectedSeasons = row ? expectedEvaluationSeasons(row) : 0;
  const seasonOffset = state.evaluationIgnoreFirstSeason ? 1 : 0;
  const overallValues = row ? evaluationOverallValues(row, expectedSeasons) : [];
  const currentAge = row ? Number(getValue(row, "age")) : NaN;
  const summaryOverall = overallValues[seasonOffset] ?? overallValues[0];
  const summaryAge = Number.isFinite(currentAge) ? currentAge + seasonOffset : null;

  return {
    playerId,
    mflPerUsd: state.evaluationMflPerUsd,
    ignoreDiscountRate: state.evaluationIgnoreDiscountRate,
    ignoreFirstSeason: state.evaluationIgnoreFirstSeason,
    lateSeasonRewardRates: normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates),
    overallValues,
    summaryPosition: row ? evaluationSummaryPosition(row) : "",
    summaryOverall: Number.isFinite(summaryOverall) ? summaryOverall : null,
    summaryAge,
  };
}

function applySharedEvaluationPayload(payload) {
  const data = normalizeSharedEvaluationPayload(payload);

  if (!data.playerId) {
    showToast("Shared evaluation is not available.");
    return;
  }

  state.evaluationPlayerId = data.playerId;
  state.evaluationMflPerUsd = data.mflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;
  state.evaluationIgnoreDiscountRate = data.ignoreDiscountRate;
  state.evaluationIgnoreFirstSeason = data.ignoreFirstSeason;
  state.evaluationLateSeasonRewardRates = normalizeEvaluationLateSeasonRewardRates(data.lateSeasonRewardRates);

  if (data.overallValues.length) {
    state.evaluationOverallRows[data.playerId] = data.overallValues;
  }

  if (data.summaryPosition) {
    state.evaluationSummaryPositions[data.playerId] = data.summaryPosition;
  }

  evaluationSearchInput.value = "";
  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
}

async function loadSharedEvaluation(shareId) {
  const id = String(shareId || "").trim();
  const playerId = String(evaluationPlayerIdFromUrl() || "").trim();

  if (!id || state.evaluationShareLoading) {
    return;
  }

  state.evaluationShareLoading = true;

  try {
    const requestUrl = new URL("/api/evaluation-share", window.location.origin);
    requestUrl.searchParams.set("id", id);
    if (playerId) {
      requestUrl.searchParams.set("player", playerId);
    }

    const response = await fetch(requestUrl.toString(), { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Share not found.");
    }

    const data = await response.json();
    state.evaluationShareId = id;
    applySharedEvaluationPayload(data.payload);
  } catch {
    showToast("Shared evaluation has expired or could not be loaded.");
    resetInvalidEvaluationLinkToPlainEvaluation();
    renderEmptyEvaluationSelection(true);
  } finally {
    state.evaluationShareLoading = false;
  }
}

async function createSharedEvaluationFromPayload(payload, fallbackPlayerId = "") {
  if (!hasWalletOptIn()) {
    showToast("Opt in to share evaluations.");
    return "";
  }

  const normalizedPayload = normalizeSharedEvaluationPayload(payload);
  const payloadPlayerId = String(normalizedPayload.playerId || fallbackPlayerId || "").trim();

  if (!payloadPlayerId) {
    throw new Error("Select a player to share.");
  }

  const response = await fetch("/api/evaluation-share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...walletProofHeaders(true),
    },
    body: JSON.stringify({
      ...normalizedPayload,
      playerId: payloadPlayerId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not create share link.");
  }

  const data = await response.json();
  const id = String(data.id || "").trim();
  const playerId = String(data.playerId || payloadPlayerId || "").trim();

  if (!id || !playerId) {
    throw new Error("Could not create share link.");
  }

  const url = new URL("/evaluation", window.location.origin);
  url.searchParams.set("player", playerId);
  url.searchParams.set("share", id);
  return url.toString();
}

async function createSharedEvaluation() {
  if (!state.evaluationPlayerId) {
    showToast("Select a player to share.");
    return "";
  }

  return createSharedEvaluationFromPayload(currentEvaluationSharePayload(), state.evaluationPlayerId);
}


async function createSavedEvaluation() {
  if (!hasWalletOptIn()) {
    showToast("Opt in to save evaluations.");
    return "";
  }

  if (!state.evaluationPlayerId) {
    showToast("Select a player to save.");
    return "";
  }

  const currentSavedId = String(state.evaluationSavedId || evaluationSavedIdFromUrl() || "").trim();
  const payload = currentEvaluationSharePayload();

  const response = await fetch("/api/evaluation-save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...walletProofHeaders(true),
    },
    body: JSON.stringify(currentSavedId ? { ...payload, savedId: currentSavedId } : payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not save evaluation.");
  }

  const data = await response.json();
  const id = String(data.id || "").trim();
  const playerId = String(data.playerId || state.evaluationPlayerId || "").trim();

  if (!id || !playerId) {
    throw new Error("Could not save evaluation.");
  }

  state.evaluationSavedId = id;
  state.evaluationShareId = "";
  updateEvaluationFooterActions();
  const url = new URL("/evaluation", window.location.origin);
  url.searchParams.set("player", playerId);
  url.searchParams.set("saved", id);
  return {
    url: url.toString(),
    overwritten: Boolean(data.overwritten || currentSavedId),
  };
}

async function loadSavedEvaluation(savedId, playerId = "") {
  const id = String(savedId || "").trim();

  if (!id || state.evaluationSavedLoading) {
    return;
  }

  state.evaluationSavedLoading = true;

  try {
    const requestUrl = new URL("/api/evaluation-save", window.location.origin);
    requestUrl.searchParams.set("id", id);
    const selectedPlayerId = String(playerId || evaluationPlayerIdFromUrl() || "").trim();
    if (selectedPlayerId) {
      requestUrl.searchParams.set("player", selectedPlayerId);
    }

    const response = await fetch(requestUrl.toString(), {
      cache: "no-store",
      headers: walletProofHeaders(true),
    });

    if (!response.ok) {
      throw new Error("Saved evaluation not found.");
    }

    const data = await response.json();
    state.evaluationSavedId = id;
    state.evaluationShareId = "";
    updateEvaluationFooterActions();
    clearEvaluationSearchFocus();
    applySharedEvaluationPayload(data.payload);
  } catch {
    showToast("Saved evaluation could not be loaded.");
    resetInvalidEvaluationLinkToPlainEvaluation();
    updateEvaluationFooterActions();
    renderEmptyEvaluationSelection(true);
  } finally {
    state.evaluationSavedLoading = false;
  }
}

function evaluationPresentValueTotalFromPayload(payload) {
  const data = normalizeSharedEvaluationPayload(payload);
  const row = data.playerId ? rowByPlayerId(data.playerId) : null;

  if (!row) {
    return null;
  }

  const rawExpectedSeasons = expectedEvaluationSeasons(row);
  const seasonOffset = data.ignoreFirstSeason ? 1 : 0;
  const expectedSeasons = Math.max(0, rawExpectedSeasons - seasonOffset);
  const overallValues = data.overallValues.length ? data.overallValues : evaluationOverallValues(row, rawExpectedSeasons);
  const position = data.summaryPosition || evaluationSummaryPosition(row);
  const discountRate = data.ignoreDiscountRate ? 0 : evaluationDiscountRateValue();
  const mflPerUsd = data.mflPerUsd || state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;
  let total = 0;

  for (let rowIndex = 0; rowIndex < expectedSeasons; rowIndex += 1) {
    const season = rowIndex + 1 + seasonOffset;
    const overall = overallValues[season - 1] ?? overallValues[0];
    const mflValue = evaluationMflValueForOverall(overall, position, rowIndex, expectedSeasons, data.lateSeasonRewardRates);
    const usdValue = Number.isFinite(mflValue) ? mflValue / mflPerUsd : null;
    const discountFactor = evaluationDiscountFactor(discountRate, season);
    const presentValue = Number.isFinite(usdValue) && Number.isFinite(discountFactor) ? usdValue * discountFactor : null;

    if (Number.isFinite(presentValue)) {
      total += presentValue;
    }
  }

  return total;
}

async function deleteSavedEvaluation(savedId) {
  const id = String(savedId || "").trim();

  if (!id) {
    return false;
  }

  const requestUrl = new URL("/api/evaluation-save", window.location.origin);
  requestUrl.searchParams.set("id", id);

  const response = await fetch(requestUrl.toString(), {
    method: "DELETE",
    cache: "no-store",
    headers: walletProofHeaders(true),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not delete saved evaluation.");
  }

  return true;
}


let evaluationLoadFloatingTooltip = null;

function hideEvaluationLoadActionTooltip() {
  if (evaluationLoadFloatingTooltip) {
    evaluationLoadFloatingTooltip.remove();
    evaluationLoadFloatingTooltip = null;
  }
}

function showEvaluationLoadActionTooltip(button) {
  const text = String(button?.dataset?.tooltip || "").trim();

  if (!text) {
    return;
  }

  hideEvaluationLoadActionTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = "floatingActionTooltip";
  tooltip.textContent = text;
  document.body.appendChild(tooltip);
  tooltip.style.maxWidth = `${Math.min(240, Math.max(120, window.innerWidth - 16))}px`;

  const rect = button.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const preferredLeft = button.dataset.tooltipPlacement === "left"
    ? rect.right - tooltipRect.width + 8
    : rect.left + rect.width / 2 - tooltipRect.width / 2;
  const left = Math.min(Math.max(preferredLeft, 8), window.innerWidth - tooltipRect.width - 8);
  const top = Math.max(8, rect.top - tooltipRect.height - 8);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.add("visible");
  evaluationLoadFloatingTooltip = tooltip;
}

function attachEvaluationLoadActionTooltip(button) {
  button.addEventListener("mouseenter", () => showEvaluationLoadActionTooltip(button));
  button.addEventListener("focus", () => showEvaluationLoadActionTooltip(button));
  button.addEventListener("mouseleave", hideEvaluationLoadActionTooltip);
  button.addEventListener("blur", hideEvaluationLoadActionTooltip);
}

function renderSavedEvaluationList(rows) {
  hideEvaluationLoadActionTooltip();
  evaluationLoadList.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "evaluationLoadEmpty";
    empty.textContent = "No saved evaluations yet.";
    evaluationLoadList.appendChild(empty);
    return;
  }

  rows.forEach((entry) => {
    const payload = normalizeSharedEvaluationPayload(entry.payload);
    const row = rowByPlayerId(payload.playerId);
    const playerId = payload.playerId || String(entry.playerId || "");
    const result = document.createElement("div");
    result.className = "evaluationLoadResult";
    result.tabIndex = 0;
    result.role = "button";

    const main = document.createElement("span");
    main.className = "evaluationLoadResultMain";
    const name = document.createElement("strong");
    name.textContent = row ? formatCellValue(row, "name") : `Player ${playerId}`;
    const details = document.createElement("span");
    const summaryOverall = Number(payload.summaryOverall);
    const summaryAge = Number(payload.summaryAge);
    const summaryPosition = String(payload.summaryPosition || "").trim();
    const overallText = Number.isFinite(summaryOverall)
      ? formatPlainValue(summaryOverall, "overall")
      : (row ? formatPlainValue(statDisplayValue(row, "overall"), "overall") : "");
    const ageText = Number.isFinite(summaryAge)
      ? String(summaryAge)
      : (row ? formatCellValue(row, "age") : "");
    details.textContent = [
      overallText ? `OVR ${overallText}` : "",
      `#${playerId}`,
      summaryPosition,
      ageText ? `${ageText} yo` : "",
    ].filter(Boolean).join(" · ");
    main.append(name, details);

    const value = document.createElement("strong");
    value.className = "evaluationLoadPresentValue";
    const presentValue = evaluationPresentValueTotalFromPayload(entry.payload);
    value.textContent = Number.isFinite(presentValue) ? formatEvaluationCurrency(presentValue) : "-";

    const actions = document.createElement("span");
    actions.className = "evaluationLoadActions";

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "evaluationLoadIconButton evaluationLoadShareButton";
    shareButton.setAttribute("aria-label", "Share saved evaluation");
    shareButton.dataset.tooltip = "Share";
    shareButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 10.8 15.4 6.2"></path><path d="M8.6 13.2 15.4 17.8"></path></svg>';

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "evaluationLoadIconButton evaluationLoadDeleteButton";
    deleteButton.setAttribute("aria-label", "Delete saved evaluation");
    deleteButton.dataset.tooltip = "Delete";
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>';

    attachEvaluationLoadActionTooltip(shareButton);

    const loadEvaluation = () => {
      clearEvaluationSearchFocus();
      const savedId = String(entry.id || "").trim();
      const url = new URL("/evaluation", window.location.origin);
      url.searchParams.set("player", playerId);
      url.searchParams.set("saved", savedId);
      window.history.replaceState({}, "", url.toString());
      state.evaluationSavedId = savedId;
      state.evaluationShareId = "";
      hideModal(evaluationLoadModal);
      updateEvaluationFooterActions();
      applySharedEvaluationPayload(entry.payload);
    };

    shareButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      hideEvaluationLoadActionTooltip();
      shareButton.disabled = true;

      try {
        const shareUrl = await createSharedEvaluationFromPayload(entry.payload, playerId);
        await navigator.clipboard.writeText(shareUrl);
        showToast("Evaluation share link copied.");
      } catch (error) {
        showToast(error?.message || "Could not create evaluation share link.");
      } finally {
        shareButton.disabled = false;
      }
    });

    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      hideEvaluationLoadActionTooltip();
      deleteButton.disabled = true;

      try {
        await deleteSavedEvaluation(entry.id);
        result.remove();

        if (!evaluationLoadList.querySelector(".evaluationLoadResult")) {
          renderSavedEvaluationList([]);
        }

        if (state.evaluationSavedId === String(entry.id || "")) {
          state.evaluationSavedId = "";
          updateEvaluationFooterActions();
        }

        showToast("Saved evaluation deleted.");
      } catch (error) {
        deleteButton.disabled = false;
        showToast(error?.message || "Could not delete saved evaluation.");
      }
    });

    actions.append(shareButton, deleteButton);
    result.append(main, value, actions);
    result.addEventListener("click", loadEvaluation);
    result.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        loadEvaluation();
      }
    });
    evaluationLoadList.appendChild(result);
  });
}


async function openSavedEvaluationsModal() {
  hideEvaluationLoadActionTooltip();
  if (!hasWalletOptIn()) {
    showToast("Opt in to load saved evaluations.");
    return;
  }

  showModal(evaluationLoadModal);
  evaluationLoadList.innerHTML = '<p class="evaluationLoadEmpty">Loading saved evaluations...</p>';

  try {
    const response = await fetch("/api/evaluation-save", {
      cache: "no-store",
      headers: walletProofHeaders(true),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Could not load saved evaluations.");
    }

    const data = await response.json();
    renderSavedEvaluationList(Array.isArray(data.evaluations) ? data.evaluations : []);
  } catch (error) {
    evaluationLoadList.innerHTML = "";
    const message = document.createElement("p");
    message.className = "evaluationLoadEmpty";
    message.textContent = error?.message || "Could not load saved evaluations.";
    evaluationLoadList.appendChild(message);
  }
}


function normalizedPageName(pageName) {
  return pageName === "my-players" ? "myplayers" : pageName;
}

function pageFromUrl() {
  return pageTargetFromPath(`${window.location.pathname}${window.location.search}`).pageName;
}

function watchlistIdFromUrl() {
  const match = window.location.pathname.match(/^\/watchlist\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function agentWalletAddressFromUrl() {
  const match = window.location.pathname.match(/^\/agents\/([^/]+)$/);
  return match ? normalizeWalletAddress(decodeURIComponent(match[1])).toLowerCase() : "";
}

function pageTargetFromPath(path) {
  const cleanPath = String(path || "").split("?")[0];
  if (cleanPath === "/players" || cleanPath === "/agents") {
    return {
      pageName: "home",
      options: { replaceUrl: "/" },
    };
  }

  const playerMatch = cleanPath.match(/^\/players\/([^/]+)$/);

  if (playerMatch) {
    return {
      pageName: "player",
      options: { playerId: decodeURIComponent(playerMatch[1]) },
    };
  }

  const watchlistMatch = cleanPath.match(/^\/watchlist\/([^/]+)$/);

  if (watchlistMatch) {
    return {
      pageName: "watchlist",
      options: { watchlistId: decodeURIComponent(watchlistMatch[1]) },
    };
  }

  const agentMatch = cleanPath.match(/^\/agents\/([^/]+)$/);

  if (agentMatch) {
    const walletAddress = normalizeWalletAddress(decodeURIComponent(agentMatch[1])).toLowerCase();
    if (walletAddress === mflWalletAddress) {
      return {
        pageName: "mfl",
        options: { replaceUrl: "/mfl" },
      };
    }

    return {
      pageName: "agents",
      options: { walletAddress },
    };
  }

  const pageName = normalizedPageName(cleanPath.replace(/^\//, "") || "home");
  return {
    pageName: ["home", "database", "mfl", "agents", "progression", "evaluation", "watchlist", "myplayers", "settings", "changelog"].includes(pageName) ? pageName : "home",
    options: {},
  };
}

async function ensureProgressionData() {
  const targetAccess = currentDataAccess();

  if (state.dataLoaded && state.dataAccess === targetAccess) {
    return true;
  }

  const currentManifest = await fetchCurrentManifestForCacheCheck();

  if (currentManifest && (
    restoreDataSnapshot(targetAccess, currentManifest)
    || await restorePersistentDataSnapshot(targetAccess, currentManifest)
    || await restoreCachedDataForAccess(targetAccess, currentManifest)
  )) {
    return true;
  }

  if (!currentManifest && (
    restoreDataSnapshot(targetAccess)
    || await restorePersistentDataSnapshot(targetAccess)
    || await restoreCachedDataForAccess(targetAccess)
  )) {
    return true;
  }

  if (!state.dataLoadPromise) {
    showLoading();
    state.dataLoadPromise = loadData({ message: loadingMessageForAccess(targetAccess) })
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
    if (options.plain) {
      return "/evaluation";
    }

    const playerId = options.playerId || evaluationPlayerIdFromUrl();
    return playerId ? `/evaluation?player=${encodeURIComponent(playerId)}` : "/evaluation";
  }

  if (pageName === "watchlist") {
    const watchlistId = options.watchlistId || state.currentWatchlistId || watchlistIdFromUrl();
    return watchlistId ? `/watchlist/${encodeURIComponent(watchlistId)}` : "/watchlist";
  }

  if (pageName === "agents") {
    const walletAddress = normalizeWalletAddress(options.walletAddress || state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase();
    if (walletAddress === mflWalletAddress) {
      return "/mfl";
    }
    return walletAddress ? `/agents/${encodeURIComponent(walletAddress)}` : "/agents";
  }

  return pageName === "home" ? "/" : pageName === "myplayers" ? "/my-players" : `/${pageName}`;
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

function tableTitleForPage(pageName) {
  if (pageName === "watchlist") {
    return `Watchlist - ${currentWatchlistName()}`;
  }

  if (pageName === "myplayers") {
    return "My Players";
  }

  if (pageName === "database") {
    return "Database";
  }

  if (pageName === "mfl") {
    return "MFL";
  }

  if (pageName === "agents") {
    return agentNameForWallet(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  }

  return "Progression";
}

function renderTableLoadingShell(pageName) {
  state.currentPage = pageName;
  syncQuickFilterLabels();
  const tablePage = tablePages.has(pageName);

  if (!tablePage) {
    return;
  }

  restoreSavedTableState(pageName);
  updateViewButtons();
  tablePageTitle.textContent = tableTitleForPage(pageName);
  emptyState.hidden = false;
  emptyState.textContent = "Loading players...";
  tableBody.replaceChildren();
}
async function setPage(pageName, updateHash = true, options = {}) {
  const previousPage = state.currentPage;
  const shouldResetScroll = previousPage !== pageName;
  if (pageName === "agents") {
    state.currentAgentWalletAddress = normalizeWalletAddress(options.walletAddress || agentWalletAddressFromUrl()).toLowerCase();
  }
  if (options.replaceUrl && `${window.location.pathname}${window.location.search}` !== options.replaceUrl) {
    window.history.replaceState({}, "", options.replaceUrl);
  }
  document.body.dataset.page = pageName;
  updatePageUrl(pageName, { ...options, updateUrl: updateHash && !options.replaceUrl });

  if (pageRequiresProgressionPermission(pageName) && !hasProgressionAccess()) {
    return showUnauthorizedProgressionRedirect();
  }

  if ((pageName === "myplayers" || pageName === "watchlist" || pageName === "settings") && !hasWalletOptIn()) {
    state.currentPage = pageName;
    homePage.hidden = true;
    progressionPage.hidden = true;
    myPlayersLockedPage.hidden = false;
    evaluationPage.hidden = true;
    playerPage.hidden = true;
    settingsPage.hidden = true;
    changelogPage.hidden = true;
    if (optInLockedTitle) {
      optInLockedTitle.textContent = pageName === "watchlist" ? "Watchlist" : pageName === "settings" ? "Settings" : "My Players";
    }
    if (optInLockedMessage) {
      optInLockedMessage.textContent = pageName === "watchlist"
        ? "In order to use the watchlist, you need to opt in."
        : pageName === "settings"
          ? "In order to view settings, you need to opt in."
          : "In order to see your players, you need to opt in.";
    }
    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.page === pageName);
    });
    syncHomeLoginButton();
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }
    if (shouldResetScroll) {
      resetPageScroll();
    }
    return;
  }

  const previousTablePage = tablePageKey();
  if (previousTablePage) {
    state.tablePageStates[previousTablePage] = currentTablePageState();
    saveTableState();
  }

  const tablePage = tablePages.has(pageName);
  const playerPageActive = pageName === "player";
  const evaluationPageActive = pageName === "evaluation";
  const settingsPageActive = pageName === "settings";
  const targetDataAccess = currentDataAccess(pageName);

  if (state.dataLoaded && state.dataAccess && state.dataAccess !== targetDataAccess && pageRequiresData(pageName)) {
    captureCurrentDataSnapshot();
    state.dataLoaded = restoreDataSnapshot(targetDataAccess);
    if (!state.dataLoaded) {
      state.dataLoadPromise = null;
    }
  }

  if (pageRequiresFullData(pageName) && state.dataAccess !== targetDataAccess) {
    captureCurrentDataSnapshot();
    state.dataLoaded = restoreDataSnapshot(targetDataAccess);
  }

  if ((tablePage || playerPageActive || evaluationPageActive) && !state.dataLoaded) {
    state.currentPage = pageName;
    homePage.hidden = true;
    progressionPage.hidden = !tablePage;
    myPlayersLockedPage.hidden = true;
    evaluationPage.hidden = !evaluationPageActive;
    playerPage.hidden = !playerPageActive;
    settingsPage.hidden = true;
    changelogPage.hidden = true;

    if (tablePage) {
      renderTableLoadingShell(pageName);
    }

    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.page === pageName);
    });
    revealAppShell();

    const loaded = await ensureProgressionData();

    if (!loaded) {
      return;
    }
  }

  if (pageName === "watchlist" && hasWalletOptIn()) {
    state.currentPage = pageName;
    state.pendingWatchlistRouteId = options.watchlistId || watchlistIdFromUrl() || "";
    await ensureWatchlistRoute(options);
  }

  state.currentPage = pageName;
  syncQuickFilterLabels();
  homePage.hidden = pageName !== "home";
  progressionPage.hidden = !tablePage;
  myPlayersLockedPage.hidden = true;
  evaluationPage.hidden = !evaluationPageActive;
  playerPage.hidden = !playerPageActive;
  settingsPage.hidden = !settingsPageActive;
  changelogPage.hidden = pageName !== "changelog";
  tablePageTitle.textContent = tableTitleForPage(pageName);
  renderWatchlistSwitcher();
  if (tablePage) {
    restoreSavedTableState(pageName);
    updateViewButtons();
    buildHeader();
  }
  emptyState.textContent = pageName === "watchlist"
    ? "No players in your watchlist yet."
    : pageName === "myplayers"
      ? "No owned players match the current filters."
      : pageName === "mfl"
        ? "No MFL players match the current filters."
        : pageName === "agents"
          ? "No agent players match the current filters."
          : "No players match the current filters.";

  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  if (settingsPageActive) {
    renderSettingsPage();
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }

    syncHomeLoginButton();
    if (shouldResetScroll) {
      resetPageScroll();
    }

    return;
  }

  if (evaluationPageActive) {
    if (options.plain) {
      state.evaluationShareId = "";
      state.evaluationSavedId = "";
      state.evaluationPlayerId = null;
      evaluationSearchInput.value = "";
    }

    await renderEvaluationPage();
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
    applyFilters({ save: false });
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

function normalizeCurrentViewsAfterProgressionAccessLoss() {
  if (state.currentPage === "watchlist") {
    state.view = normalizeViewForPage(state.view, "watchlist");
    state.page = 1;
    removeUnavailableFilterRules("watchlist", state.view);
    populateAddFilterSelect("watchlist");
    refreshRuleColumnSelects("watchlist");
    updateViewButtons();
    buildHeader();
    applyFilters();
    return;
  }

  if (state.currentPage === "player") {
    renderPlayerPage(playerIdFromUrl());
  }
}
function defaultSortStateForView(viewName = defaultViewForPage(tablePageKey() || "progression")) {
  return {
    sortKey: "overall",
    sortDirection: viewName === "next" ? "asc" : "desc",
  };
}

function normalizedViewSortState(sortState, viewName = defaultViewForPage(tablePageKey() || "progression")) {
  const defaultSortState = defaultSortStateForView(viewName);

  return {
    sortKey: sortableColumns.has(sortState?.sortKey) ? sortState.sortKey : defaultSortState.sortKey,
    sortDirection: sortState?.sortDirection === "asc" || sortState?.sortDirection === "desc"
      ? sortState.sortDirection
      : defaultSortState.sortDirection,
  };
}

function defaultTablePageState(pageName = tablePageKey() || "progression") {
  const defaultView = defaultViewForPage(pageName);
  const defaultSortState = defaultSortStateForView(defaultView);

  return {
    hideRetired: true,
    hideRetiring: false,
    mflPackable: pageName === "mfl",
    newMints: false,
    pageSize: 100,
    view: defaultView,
    viewSortStates: {},
    sortKey: defaultSortState.sortKey,
    sortDirection: defaultSortState.sortDirection,
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

function showToast(message, options = {}) {
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
  if (options.sticky) {
    window.clearTimeout(state.toastTimer);
  } else {
    scheduleToastHide(toast);
  }
}

function showWatchlistToast(prefix, watchlistId = state.currentWatchlistId, watchlistName = currentWatchlistName()) {
  const content = document.createElement("span");
  const watchlistLink = document.createElement("button");
  const targetId = String(watchlistId || state.currentWatchlistId || "").trim();

  content.className = "toastWatchlistContent";
  content.append(document.createTextNode(`${prefix} `));
  watchlistLink.type = "button";
  watchlistLink.className = "toastLink";
  watchlistLink.textContent = watchlistName || "watchlist";
  watchlistLink.addEventListener("click", () => {
    hideToast();
    setPage("watchlist", true, targetId ? { watchlistId: targetId } : {});
  });
  content.appendChild(watchlistLink);
  content.append(document.createTextNode("."));
  showToast(content);
}

function watchlistActionSubject(playerIds, count) {
  const ids = normalizeWatchlistIdList(playerIds);
  if (count === 1 && ids.length) {
    const row = rowByPlayerId(ids[0]);
    return row ? formatCellValue(row, "name") : `Player ${ids[0]}`;
  }

  return `${count} player${count === 1 ? "" : "s"}`;
}

function showWatchlistActionToast(playerIds, count, actionText, watchlistId) {
  const watchlist = state.watchlists.find((item) => item.id === watchlistId) || activeWatchlist();
  const subject = watchlistActionSubject(playerIds, count);
  const prefix = `${subject} ${actionText}`.trim();
  if (!watchlist) {
    showGenericToast(prefix);
    return;
  }
  showWatchlistToast(prefix, watchlist.id, watchlist.name);
}
function walletWatchlistStorageKey(address = state.linkedWalletAddress) {
  const wallet = normalizeWalletAddress(address).toLowerCase();
  return wallet ? `${WALLET_WATCHLIST_STORAGE_PREFIX}${wallet}` : "";
}

function walletNotesStorageKey(address = state.linkedWalletAddress) {
  const wallet = normalizeWalletAddress(address).toLowerCase();
  return wallet ? `${WALLET_NOTES_STORAGE_PREFIX}${wallet}` : "";
}

function sanitizePlayerNote(note) {
  return String(note || "").replace(/\r\n/g, "\n").slice(0, PLAYER_NOTE_MAX_LENGTH).trim();
}

function normalizedPlayerNotes(notes) {
  const normalized = {};
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
    return normalized;
  }

  Object.entries(notes).forEach(([playerId, note]) => {
    const key = String(playerId || "").trim();
    const text = sanitizePlayerNote(note);
    if (key && text) {
      normalized[key] = text;
    }
  });

  return normalized;
}

function saveWalletNotesLocally() {
  const key = walletNotesStorageKey();
  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(normalizedPlayerNotes(state.playerNotes)));
  } catch {
    // Wallet notes sync is best-effort when browser storage is blocked.
  }
}

function loadLocalWalletNotes() {
  const key = walletNotesStorageKey();
  if (!key) {
    return {};
  }

  try {
    return normalizedPlayerNotes(JSON.parse(localStorage.getItem(key) || "{}"));
  } catch {
    return {};
  }
}

function clearWalletNotesState() {
  state.playerNotes = {};
  state.walletPreferencesLoaded = false;
  window.clearTimeout(state.walletNotesSaveTimer);
  state.walletNotesSaveTimer = null;
}

function applyWalletPlayerNotes(notes) {
  state.playerNotes = {
    ...state.playerNotes,
    ...normalizedPlayerNotes(notes),
  };
}

function playerNote(playerId) {
  return state.playerNotes[String(playerId || "")] || "";
}

function playerHasNote(playerId) {
  return Boolean(playerNote(playerId).trim());
}

function playerNoteIconHtml(playerId, includeTooltip = false) {
  if (!playerHasNote(playerId)) {
    return "";
  }

  const note = playerNote(playerId);
  const tooltip = includeTooltip ? ` data-tooltip="${escapeHtml(note)}"` : "";
  return `<span class="playerNoteIcon"${tooltip} aria-label="Player note">📝</span>`;
}

function updatePlayerNoteCount(input) {
  const counter = playerDetail.querySelector("#playerNotesCount");
  if (counter) {
    counter.textContent = `${input.value.length}/${PLAYER_NOTE_MAX_LENGTH}`;
  }
}

function hidePlayerNoteTooltip() {
  document.querySelectorAll(".playerNoteFloatingTooltip").forEach((tooltip) => tooltip.remove());
}

function showPlayerNoteTooltip(icon) {
  const note = icon?.dataset?.noteTooltip || icon?.dataset?.tooltip || "";
  if (!note) {
    return;
  }

  hidePlayerNoteTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = "playerNoteFloatingTooltip";
  tooltip.textContent = note;
  document.body.appendChild(tooltip);

  const iconRect = icon.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 8;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  const agentTooltipAnchorWidth = Number.parseFloat(getComputedStyle(icon).fontSize || "14") * 10;
  let left = icon.classList.contains("agentTableLink")
    ? iconRect.left + Math.min(agentTooltipAnchorWidth, iconRect.width) / 2 - tooltipRect.width / 2
    : iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
  left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));

  const anchorHeight = 14;
  const anchorTop = iconRect.top + Math.max(0, (iconRect.height - anchorHeight) / 2);
  const anchorBottom = anchorTop + anchorHeight;

  let top = anchorTop - tooltipRect.height - 10;
  if (top < margin) {
    top = anchorBottom + 10;
  }
  if (top + tooltipRect.height > viewportHeight - margin) {
    top = Math.max(margin, viewportHeight - tooltipRect.height - margin);
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  window.requestAnimationFrame(() => tooltip.classList.add("visible"));
}

function setPlayerNote(playerId, note) {
  const key = String(playerId || "").trim();
  if (!key) {
    return;
  }

  const text = sanitizePlayerNote(note);
  if (text) {
    state.playerNotes[key] = text;
  } else {
    delete state.playerNotes[key];
  }

  state.walletPreferencesLoaded = true;
  saveWalletNotesLocally();
  queueWalletNotesSave();

  if (state.currentPage === "player") {
    const titleIcon = playerDetail.querySelector("[data-player-note-title-icon]");
    if (titleIcon) {
      titleIcon.innerHTML = playerNoteIconHtml(key);
    }
  }

  if (tablePageKey()) {
    applyFilters();
  }
}

function queueWalletNotesSave() {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  window.clearTimeout(state.walletNotesSaveTimer);
  state.walletNotesSaveTimer = window.setTimeout(() => {
    void saveWalletPreferencesNow();
  }, 500);
}


function saveGuestWatchlist() {
  if (state.linkedWalletAddress && hasWalletProof()) {
    return;
  }

  try {
    localStorage.setItem(GUEST_WATCHLIST_STORAGE_KEY, JSON.stringify(Array.from(state.watchlistPlayerIds)));
  } catch {
    // Watchlist still works for this page even if the browser blocks storage.
  }
}

function saveWalletWatchlistLocally() {
  const key = walletWatchlistStorageKey();
  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(watchlistsPayload()));
  } catch {
    // Wallet watchlist sync is best-effort when browser storage is blocked.
  }
}

function loadLocalWalletWatchlist() {
  const key = walletWatchlistStorageKey();
  if (!key) {
    return [];
  }

  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(value) && value.some((item) => item && typeof item === "object" && !Array.isArray(item))) {
      return normalizeWatchlists(value);
    }
    return Array.isArray(value) ? value.map((playerId) => String(playerId)) : [];
  } catch {
    return [];
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

function normalizeIdList(ids, limit = Infinity) {
  if (!Array.isArray(ids)) {
    return [];
  }

  const normalized = [];
  ids.forEach((playerId) => {
    const key = String(playerId || "").trim();
    if (key && !normalized.includes(key)) {
      normalized.push(key);
    }
  });

  return Number.isFinite(limit) ? normalized.slice(0, limit) : normalized;
}

function normalizeWatchlistIdList(ids) {
  return normalizeIdList(ids, MAX_WATCHLIST_PLAYERS);
}


function createWatchlistId() {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(6);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, WATCHLIST_ID_LENGTH);
  }

  return Math.random().toString(16).slice(2, 10).padEnd(WATCHLIST_ID_LENGTH, "0").slice(0, WATCHLIST_ID_LENGTH);
}

function normalizeWatchlistName(name, fallback = DEFAULT_WATCHLIST_NAME) {
  const value = String(name || "").trim().replace(/\s+/g, " ").slice(0, 20);
  return value || fallback;
}

function normalizeWatchlists(watchlists, legacyIds = []) {
  const normalized = [];
  const source = Array.isArray(watchlists) ? watchlists : [];

  source.forEach((watchlist) => {
    const id = String(watchlist?.id || "").trim().slice(0, WATCHLIST_ID_LENGTH);
    const name = normalizeWatchlistName(watchlist?.name, DEFAULT_WATCHLIST_NAME);
    if (!id || normalized.some((item) => item.id === id) || normalized.length >= MAX_WATCHLISTS) {
      return;
    }

    normalized.push({
      id,
      name,
      playerIds: normalizeWatchlistIdList(watchlist?.playerIds ?? watchlist?.player_ids ?? watchlist?.watchlistPlayerIds),
    });
  });

  if (!normalized.length) {
    normalized.push({
      id: createWatchlistId(),
      name: DEFAULT_WATCHLIST_NAME,
      playerIds: normalizeWatchlistIdList(legacyIds),
    });
  }

  if (normalized[0]) {
    normalized[0].name = normalizeWatchlistName(normalized[0].name, DEFAULT_WATCHLIST_NAME);
  }

  return normalized;
}

function activeWatchlist() {
  return state.watchlists.find((watchlist) => watchlist.id === state.currentWatchlistId) || state.watchlists[0] || null;
}

function setActiveWatchlistIds(ids) {
  const active = activeWatchlist();
  if (active) {
    active.playerIds = normalizeWatchlistIdList(ids);
  }
  state.watchlistPlayerIds = new Set(normalizeWatchlistIdList(ids));
}

function syncActiveWatchlistFromSet() {
  const active = activeWatchlist();
  if (active) {
    active.playerIds = Array.from(state.watchlistPlayerIds);
  }
}

function watchlistsPayload() {
  syncActiveWatchlistFromSet();
  return normalizeWatchlists(state.watchlists).map((watchlist) => ({
    id: watchlist.id,
    name: watchlist.name,
    playerIds: normalizeWatchlistIdList(watchlist.playerIds),
  }));
}

function applyWatchlists(nextWatchlists, currentWatchlistId = "", legacyIds = []) {
  const normalized = normalizeWatchlists(nextWatchlists, legacyIds);
  const requestedId = String(currentWatchlistId || "").trim();
  const nextActive = normalized.find((watchlist) => watchlist.id === requestedId) || normalized[0];
  state.watchlists = normalized;
  state.currentWatchlistId = nextActive?.id || "";
  state.watchlistPlayerIds = new Set(normalizeWatchlistIdList(nextActive?.playerIds));
  renderWatchlistSwitcher();
}

function ensureDefaultWatchlist() {
  if (!state.watchlists.length) {
    applyWatchlists([], "", loadLocalWalletWatchlist());
  }
  return activeWatchlist();
}

function normalizeSettingsReceiveEmailsFor(values) {
  const normalized = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    const key = String(value || "").trim();
    if ((key === "myplayers" || /^watchlist-[a-zA-Z0-9_-]{1,40}$/.test(key)) && !normalized.includes(key)) {
      normalized.push(key);
    }
  });
  return normalized;
}

function applySettingsPayload(settings = {}) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(data.receiveEmailsFor);
  state.settingsDateFormat = normalizeSettingsDateFormat(data.dateFormat || data.date_format);
  state.settingsTimeFormat = normalizeSettingsTimeFormat(data.timeFormat || data.time_format);
  if (state.currentPage === "settings") {
    renderSettingsPage();
  }
}

function currentSettingsPayload() {
  return {
    receiveEmailsFor: normalizeSettingsReceiveEmailsFor(state.settingsReceiveEmailsFor),
    dateFormat: normalizeSettingsDateFormat(state.settingsDateFormat),
    timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),
  };
}

function pendingSettingsStorageKey(walletAddress = state.linkedWalletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress || "").toLowerCase();
  return normalizedWalletAddress ? `${WALLET_PENDING_SETTINGS_STORAGE_PREFIX}${normalizedWalletAddress}` : "";
}

function savePendingSettingsLocally(settings = currentSettingsPayload()) {
  const key = pendingSettingsStorageKey();
  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // Settings still save to Supabase when storage is unavailable.
  }
}

function loadPendingSettingsLocally() {
  const key = pendingSettingsStorageKey();
  if (!key) {
    return null;
  }

  try {
    const settings = JSON.parse(localStorage.getItem(key) || "null");
    return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : null;
  } catch {
    return null;
  }
}

function clearPendingSettingsLocally() {
  const key = pendingSettingsStorageKey();
  if (!key) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

function updateSettingsDateFormat(format) {
  state.settingsDateFormat = normalizeSettingsDateFormat(format);
  savePendingSettingsLocally();
  saveSettingsPreferencesAfterChange();
  if (state.currentPage === "settings") {
    renderSettingsPage();
  } else if (tablePageKey()) {
    renderTable();
  } else if (state.currentPage === "player") {
    const match = window.location.pathname.match(/^\/players\/([^/]+)$/);
    if (match) {
      renderPlayerPage(decodeURIComponent(match[1]));
    }
  }
}

function updateSettingsTimeFormat(format) {
  state.settingsTimeFormat = normalizeSettingsTimeFormat(format);
  savePendingSettingsLocally();
  saveSettingsPreferencesAfterChange();
  if (state.currentPage === "settings") {
    renderSettingsPage();
  } else if (tablePageKey()) {
    renderTable();
  } else if (state.currentPage === "player") {
    const match = window.location.pathname.match(/^\/players\/([^/]+)$/);
    if (match) {
      renderPlayerPage(decodeURIComponent(match[1]));
    }
  }
}

function updateSettingsEmailOption(optionId, checked) {
  const nextOptions = new Set(normalizeSettingsReceiveEmailsFor(state.settingsReceiveEmailsFor));
  if (checked) {
    nextOptions.add(optionId);
  } else {
    nextOptions.delete(optionId);
  }
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(Array.from(nextOptions));
  savePendingSettingsLocally();
  saveSettingsPreferencesAfterChange();
}

function saveSettingsPreferencesAfterChange() {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  window.clearTimeout(state.walletPreferencesSaveTimer);
  state.walletPreferencesSaveTimer = null;
  void saveWalletPreferencesNow({ refreshAfterSave: true });
}
function renderSettingsPage() {
  if (!settingsPage) {
    return;
  }

  const walletAddress = normalizeWalletAddress(state.linkedWalletAddress || "");
  if (settingsAgentName) {
    settingsAgentName.textContent = accountName();
  }
  if (settingsWalletAddress) {
    settingsWalletAddress.textContent = walletAddress || "-";
    settingsWalletAddress.title = walletAddress || "";
  }
  if (settingsDateFormatOptions) {
    settingsDateFormatOptions.replaceChildren();
    [
      ["DMY", "DD/MM/YYYY"],
      ["MDY", "MM/DD/YYYY"],
    ].forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `settingsToggleButton ${normalizeSettingsDateFormat(state.settingsDateFormat) === value ? "active" : ""}`;
      button.textContent = label;
      button.addEventListener("click", () => updateSettingsDateFormat(value));
      settingsDateFormatOptions.appendChild(button);
    });
  }

  if (settingsTimeFormatOptions) {
    settingsTimeFormatOptions.replaceChildren();
    [
      ["24h", "24h"],
      ["12h", "12h"],
    ].forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `settingsToggleButton ${normalizeSettingsTimeFormat(state.settingsTimeFormat) === value ? "active" : ""}`;
      button.textContent = label;
      button.addEventListener("click", () => updateSettingsTimeFormat(value));
      settingsTimeFormatOptions.appendChild(button);
    });
  }

  if (!settingsEmailOptions) {
    return;
  }

  settingsEmailOptions.replaceChildren();
  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  const options = [
    { id: "myplayers", label: "My Players progression" },
    ...watchlists.map((watchlist) => ({
      id: `watchlist-${watchlist.id}`,
      label: `Watchlist ${watchlist.name} progression`,
    })),
  ];

  options.forEach((option) => {
    const label = document.createElement("label");
    label.className = "settingsCheckbox";
    const input = document.createElement("input");
    input.type = "checkbox";
        input.checked = state.settingsReceiveEmailsFor.includes(option.id);
    input.dataset.settingsEmailOption = option.id;
    input.addEventListener("change", () => updateSettingsEmailOption(option.id, input.checked));
    const span = document.createElement("span");
    span.textContent = option.label;
    label.append(input, span);
    settingsEmailOptions.appendChild(label);
  });
}
function currentWatchlistName() {
  return activeWatchlist()?.name || DEFAULT_WATCHLIST_NAME;
}

function updateWatchlistTitle() {
  if (state.currentPage === "watchlist" && tablePageTitle) {
    tablePageTitle.textContent = `Watchlist - ${currentWatchlistName()}`;
  }
}

function updateWatchlistPlayerCount() {
  if (!watchlistPlayerCount) {
    return;
  }

  const visible = state.currentPage === "watchlist" && hasWalletOptIn();
  watchlistPlayerCount.hidden = !visible;
  if (!visible) {
    return;
  }

  const count = normalizeWatchlistIdList(activeWatchlist()?.playerIds || Array.from(state.watchlistPlayerIds)).length;
  watchlistPlayerCount.textContent = `${count} player${count === 1 ? "" : "s"}`;
}

function playerIsInAnyWatchlist(playerId) {
  const key = String(playerId);
  return normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds)).some((watchlist) =>
    normalizeWatchlistIdList(watchlist.playerIds).includes(key)
  );
}

function renderWatchlistSwitcher() {
  if (!watchlistSwitcher || !watchlistButton || !watchlistButtonText || !watchlistDropdown) {
    updateWatchlistTitle();
    return;
  }

  const visible = state.currentPage === "watchlist" && hasWalletOptIn();
  watchlistSwitcher.hidden = !visible;
  if (!visible) {
    closeWatchlistDropdown();
    updateWatchlistTitle();
    updateWatchlistPlayerCount();
    return;
  }

  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  state.watchlists = watchlists;
  if (!watchlists.some((watchlist) => watchlist.id === state.currentWatchlistId)) {
    state.currentWatchlistId = watchlists[0]?.id || "";
    setActiveWatchlistIds(watchlists[0]?.playerIds || []);
  }

  watchlistButtonText.textContent = currentWatchlistName();
  watchlistDropdown.replaceChildren();

  watchlists.forEach((watchlist) => {
    const item = document.createElement("div");
    item.className = "watchlistDropdownItem";
    item.classList.toggle("active", watchlist.id === state.currentWatchlistId);
    item.dataset.watchlistId = watchlist.id;

    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = "watchlistDropdownName";
    const playerCount = normalizeWatchlistIdList(watchlist.playerIds).length;
    nameButton.innerHTML = `<span class="watchlistDropdownNameText">${escapeHtml(watchlist.name)}</span><span class="watchlistDropdownCount">${playerCount} player${playerCount === 1 ? "" : "s"}</span>`;
    nameButton.addEventListener("click", () => {
      closeWatchlistDropdown();
      switchWatchlist(watchlist.id);
    });

    const actions = document.createElement("span");
    actions.className = "watchlistDropdownActions";

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "evaluationLoadIconButton watchlistDropdownAction watchlistDropdownRename";
    renameButton.setAttribute("aria-label", "Rename watchlist");
    renameButton.dataset.tooltip = "Rename";
    renameButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
    renameButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openRenameWatchlistModal(watchlist.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "evaluationLoadIconButton evaluationLoadDeleteButton watchlistDropdownAction watchlistDropdownDelete";
    deleteButton.setAttribute("aria-label", "Delete watchlist");
    deleteButton.dataset.tooltip = watchlists.length <= 1 ? "You need at least one watchlist" : "Delete";
    if (watchlists.length <= 1) {
      deleteButton.dataset.tooltipPlacement = "left";
    }
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>';
    deleteButton.disabled = watchlists.length <= 1;
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (deleteButton.disabled) {
        return;
      }
      openDeleteWatchlistModal(watchlist.id);
    });

    actions.append(renameButton, deleteButton);
    item.append(nameButton, actions);
    watchlistDropdown.appendChild(item);
  });

  if (watchlists.length < MAX_WATCHLISTS) {
    const separator = document.createElement("div");
    separator.className = "watchlistDropdownSeparator";
    watchlistDropdown.appendChild(separator);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "watchlistDropdownItem watchlistDropdownAdd";
    addButton.textContent = "Add Watchlist";
    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openAddWatchlistModal();
    });
    watchlistDropdown.appendChild(addButton);
  }

  updateWatchlistTitle();
  updateWatchlistPlayerCount();
}

function openWatchlistDropdown() {
  if (!watchlistDropdown || !watchlistButton || watchlistSwitcher?.hidden) {
    return;
  }

  renderWatchlistSwitcher();
  watchlistDropdown.hidden = false;
  watchlistButton.setAttribute("aria-expanded", "true");
}

function closeWatchlistDropdown() {
  if (!watchlistDropdown || !watchlistButton) {
    return;
  }

  watchlistDropdown.hidden = true;
  watchlistButton.setAttribute("aria-expanded", "false");
}

function toggleWatchlistDropdown() {
  if (!watchlistDropdown || watchlistDropdown.hidden) {
    openWatchlistDropdown();
  } else {
    closeWatchlistDropdown();
  }
}

function showGenericToast(message) {
  showToast(message);
}

function flushPostLoadingToast() {
  const message = state.pendingPostLoadingToast;
  state.pendingPostLoadingToast = "";
  if (message) {
    showGenericToast(message);
  }
}

function showToastAfterLoading(message) {
  if (document.body.classList.contains("loading") || !loadingScreen.hidden) {
    state.pendingPostLoadingToast = message;
    return;
  }

  showGenericToast(message);
}

function updateWatchlistUrl(replace = false, force = false) {
  if ((!force && state.currentPage !== "watchlist") || !state.currentWatchlistId) {
    return;
  }

  const targetPath = pagePath("watchlist", { watchlistId: state.currentWatchlistId });
  if (`${window.location.pathname}${window.location.search}` === targetPath) {
    return;
  }

  window.history[replace ? "replaceState" : "pushState"]({}, "", targetPath);
}

async function ensureWatchlistRoute(options = {}) {
  if (!hasWalletOptIn()) {
    return;
  }

  ensureDefaultWatchlist();
  await loadWalletPreferences({ force: !state.walletPreferencesLoaded });
  const routeId = String(options.watchlistId || watchlistIdFromUrl() || state.pendingWatchlistRouteId || "").trim();
  state.pendingWatchlistRouteId = "";
  const found = routeId ? state.watchlists.find((watchlist) => watchlist.id === routeId) : null;

  if (routeId && !found) {
    const firstWatchlist = state.watchlists[0] || ensureDefaultWatchlist();
    state.currentWatchlistId = firstWatchlist?.id || "";
    setActiveWatchlistIds(firstWatchlist?.playerIds || []);
    renderWatchlistSwitcher();
    showToastAfterLoading("Watchlist not found.");
    updateWatchlistUrl(true, true);
    return;
  }

  const nextWatchlist = found || state.watchlists[0] || ensureDefaultWatchlist();
  state.currentWatchlistId = nextWatchlist?.id || "";
  setActiveWatchlistIds(nextWatchlist?.playerIds || []);
  renderWatchlistSwitcher();
  updateWatchlistUrl(!routeId, true);
  queueCloudTableStateSave();
}

function switchWatchlist(watchlistId) {
  syncActiveWatchlistFromSet();
  const nextWatchlist = state.watchlists.find((watchlist) => watchlist.id === watchlistId);
  if (!nextWatchlist) {
    renderWatchlistSwitcher();
    return;
  }

  state.currentWatchlistId = nextWatchlist.id;
  state.watchlistPlayerIdsAdded.clear();
  state.watchlistPlayerIdsRemoved.clear();
  setActiveWatchlistIds(nextWatchlist.playerIds);
  state.page = 1;
  renderWatchlistSwitcher();
  updateWatchlistUrl();
  saveTableState();
  applyFilters();
}


function selectedPlayerIdsArray() {
  return Array.from(state.selectedPlayerIds).map((playerId) => String(playerId));
}

function watchlistNameById(watchlistId) {
  return state.watchlists.find((watchlist) => watchlist.id === watchlistId)?.name || DEFAULT_WATCHLIST_NAME;
}

function watchlistNameExists(name, excludeWatchlistId = "") {
  const normalizedName = normalizeSearchText(normalizeWatchlistName(name, ""));
  const excludeId = String(excludeWatchlistId || "").trim();
  return Boolean(normalizedName) && state.watchlists.some((watchlist) =>
    watchlist.id !== excludeId && normalizeSearchText(normalizeWatchlistName(watchlist.name, "")) === normalizedName
  );
}

function targetWatchlistsForAction(action) {
  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  return action === "move"
    ? watchlists.filter((watchlist) => watchlist.id !== state.currentWatchlistId)
    : watchlists;
}

function closeWatchlistChoiceModal() {
  state.pendingWatchlistChoiceAction = "";
  state.pendingWatchlistChoicePlayerIds = [];
  hideModal(watchlistChoiceModal);
}

function openWatchlistChoiceModal(action, playerIds) {
  if (!watchlistChoiceModal || !watchlistChoiceList) {
    performWatchlistChoiceAction(action, activeWatchlist()?.id || "", playerIds);
    return;
  }

  const ids = normalizeWatchlistIdList(playerIds);
  if (!ids.length) {
    return;
  }

  const targetWatchlists = targetWatchlistsForAction(action);
  if (action === "move" && !targetWatchlists.length && state.watchlists.length >= MAX_WATCHLISTS) {
    showGenericToast("Create another watchlist first.");
    return;
  }

  state.pendingWatchlistChoiceAction = action;
  state.pendingWatchlistChoicePlayerIds = ids;
  if (watchlistChoiceTitle) {
    watchlistChoiceTitle.textContent = action === "move" ? "Move to watchlist" : "Add to watchlist";
  }
  watchlistChoiceList.replaceChildren();

  targetWatchlists.forEach((watchlist) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "watchlistChoiceItem";
    const count = normalizeWatchlistIdList(watchlist.playerIds).length;
    button.innerHTML = `<span class="watchlistChoiceName">${escapeHtml(watchlist.name)}</span><span class="watchlistChoiceCount">${count} player${count === 1 ? "" : "s"}</span>`;
    button.addEventListener("click", () => {
      const currentAction = state.pendingWatchlistChoiceAction;
      const currentIds = Array.from(state.pendingWatchlistChoicePlayerIds);
      closeWatchlistChoiceModal();
      performWatchlistChoiceAction(currentAction, watchlist.id, currentIds);
    });
    watchlistChoiceList.appendChild(button);
  });

  if (state.watchlists.length < MAX_WATCHLISTS) {
    const separator = document.createElement("div");
    separator.className = "watchlistChoiceSeparator";
    watchlistChoiceList.appendChild(separator);

    const addNewButton = document.createElement("button");
    addNewButton.type = "button";
    addNewButton.className = "watchlistChoiceItem watchlistChoiceAddNew";
    addNewButton.textContent = "Add to new watchlist";
    addNewButton.addEventListener("click", () => {
      const context = state.pendingWatchlistChoiceAction === "move" ? "move-selected" : "add-selected";
      openAddWatchlistModal(context);
    });
    watchlistChoiceList.appendChild(addNewButton);
  }

  showModal(watchlistChoiceModal);
}

function addPlayerIdsToWatchlist(watchlistId, playerIds) {
  const watchlist = state.watchlists.find((item) => item.id === watchlistId);
  if (!watchlist) {
    renderWatchlistSwitcher();
    return { addedCount: 0, skippedCount: 0, addedIds: [] };
  }

  const ids = normalizeWatchlistIdList(playerIds);
  const nextIds = normalizeWatchlistIdList(watchlist.playerIds);
  const addedIds = [];
  let skippedCount = 0;

  ids.forEach((playerId) => {
    const key = String(playerId);
    if (nextIds.includes(key)) {
      return;
    }
    if (nextIds.length >= MAX_WATCHLIST_PLAYERS) {
      skippedCount += 1;
      return;
    }
    nextIds.push(key);
    addedIds.push(key);
  });

  watchlist.playerIds = nextIds;
  if (watchlist.id === state.currentWatchlistId) {
    state.watchlistPlayerIds = new Set(nextIds);
  }

  return { addedCount: addedIds.length, skippedCount, addedIds };
}

function movePlayerIdsToWatchlist(watchlistId, playerIds) {
  const active = activeWatchlist();
  const target = state.watchlists.find((item) => item.id === watchlistId);
  if (!active || !target || active.id === target.id) {
    renderWatchlistSwitcher();
    return { movedCount: 0, addedCount: 0, skippedCount: 0, addedIds: [] };
  }

  const ids = normalizeWatchlistIdList(playerIds);
  const { addedCount, skippedCount, addedIds } = addPlayerIdsToWatchlist(target.id, ids);
  if (addedIds.length) {
    const movedSet = new Set(addedIds.map((playerId) => String(playerId)));
    const sourceIds = normalizeWatchlistIdList(active.playerIds).filter((playerId) => !movedSet.has(String(playerId)));
    active.playerIds = sourceIds;
    state.watchlistPlayerIds = new Set(sourceIds);
  }

  return { movedCount: addedIds.length, addedCount, skippedCount, addedIds };
}

function finishWatchlistSelectionAction() {
  state.selectedPlayerIds.clear();
  state.selectionAnchorPlayerId = null;
  syncActiveWatchlistFromSet();
  saveWatchlistStateAfterAction();
  renderWatchlistSwitcher();
  if (state.currentPage === "watchlist") {
    applyFilters();
  } else {
    renderTable();
  }
  updateSelectionBar();
  if (state.currentPage === "player") {
    renderPlayerPage(playerIdFromUrl());
  }
}

function performWatchlistChoiceAction(action, watchlistId, playerIds) {
  state.pendingWatchlistChoiceAction = "";
  state.pendingWatchlistChoicePlayerIds = [];
  const ids = normalizeWatchlistIdList(playerIds);
  if (!ids.length || !watchlistId) {
    return;
  }

  if (action === "move") {
    const result = movePlayerIdsToWatchlist(watchlistId, ids);
    finishWatchlistSelectionAction();
    if (result.movedCount) {
      showWatchlistActionToast(result.addedIds, result.movedCount, "moved to", watchlistId);
    }
    if (result.skippedCount) {
      showWatchlistFullToast();
    }
    return;
  }

  const result = addPlayerIdsToWatchlist(watchlistId, ids);
  finishWatchlistSelectionAction();
  if (result.addedCount) {
    showWatchlistActionToast(result.addedIds, result.addedCount, "added to", watchlistId);
  }
  if (result.skippedCount) {
    showWatchlistFullToast();
  }
}

function openAddWatchlistModal(context = "standard") {
  hideEvaluationLoadActionTooltip();
  if (!hasWalletOptIn()) {
    renderWatchlistSwitcher();
    return;
  }

  if (state.watchlists.length >= MAX_WATCHLISTS) {
    renderWatchlistSwitcher();
    showGenericToast("You can have up to 5 watchlists.");
    return;
  }

  state.editingWatchlistId = "";
  state.pendingAddWatchlistContext = context;
  if (addWatchlistTitle) {
    addWatchlistTitle.textContent = "Add a watchlist";
  }
  if (confirmAddWatchlistButton) {
    confirmAddWatchlistButton.textContent = "Confirm";
  }
  if (addWatchlistNameInput) {
    addWatchlistNameInput.value = "";
    addWatchlistNameInput.removeAttribute("aria-invalid");
  }
  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  showModal(addWatchlistModal);
  window.setTimeout(() => addWatchlistNameInput?.focus(), 0);
}

function openRenameWatchlistModal(watchlistId) {
  hideEvaluationLoadActionTooltip();
  const watchlist = state.watchlists.find((item) => item.id === watchlistId);
  if (!watchlist) {
    renderWatchlistSwitcher();
    return;
  }

  state.editingWatchlistId = watchlist.id;
  state.pendingAddWatchlistContext = "rename";
  if (addWatchlistTitle) {
    addWatchlistTitle.textContent = "Rename watchlist";
  }
  if (confirmAddWatchlistButton) {
    confirmAddWatchlistButton.textContent = "Confirm";
  }
  if (addWatchlistNameInput) {
    addWatchlistNameInput.value = watchlist.name;
    addWatchlistNameInput.removeAttribute("aria-invalid");
  }
  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  showModal(addWatchlistModal);
  window.setTimeout(() => {
    addWatchlistNameInput?.focus();
    addWatchlistNameInput?.select();
  }, 0);
}

function keepWatchlistDropdownOpenAfterModalClick() {
  suppressWatchlistDropdownCloseOnce = true;
}

function closeAddWatchlistModal() {
  keepWatchlistDropdownOpenAfterModalClick();
  const closingContext = state.pendingAddWatchlistContext;
  state.editingWatchlistId = "";
  state.pendingAddWatchlistContext = "";
  if ((closingContext === "add-selected" || closingContext === "move-selected") && watchlistChoiceModal?.hidden) {
    state.pendingWatchlistChoiceAction = "";
    state.pendingWatchlistChoicePlayerIds = [];
  }
  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  addWatchlistNameInput?.removeAttribute("aria-invalid");
  hideModal(addWatchlistModal, renderWatchlistSwitcher);
}

function confirmAddWatchlist() {
  const name = normalizeWatchlistName(addWatchlistNameInput?.value, "");
  if (!name) {
    if (addWatchlistError) {
      addWatchlistError.textContent = "Watchlist name cannot be blank.";
      addWatchlistError.hidden = false;
    }
    addWatchlistNameInput?.setAttribute("aria-invalid", "true");
    addWatchlistNameInput?.focus();
    return;
  }

  if (watchlistNameExists(name, state.editingWatchlistId)) {
    if (addWatchlistError) {
      addWatchlistError.textContent = "A watchlist with this name already exists.";
      addWatchlistError.hidden = false;
    }
    addWatchlistNameInput?.setAttribute("aria-invalid", "true");
    addWatchlistNameInput?.focus();
    addWatchlistNameInput?.select();
    return;
  }

  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  addWatchlistNameInput?.removeAttribute("aria-invalid");

  if (state.editingWatchlistId) {
    const watchlist = state.watchlists.find((item) => item.id === state.editingWatchlistId);
    if (!watchlist) {
      closeAddWatchlistModal();
      renderWatchlistSwitcher();
      return;
    }

    watchlist.name = name;
    closeAddWatchlistModal();
    renderWatchlistSwitcher();
    saveWatchlistStateAfterAction();
    applyFilters();
    showGenericToast("Watchlist renamed.");
    return;
  }

  if (state.watchlists.length >= MAX_WATCHLISTS) {
    closeAddWatchlistModal();
    showGenericToast("You can have up to 5 watchlists.");
    return;
  }

  syncActiveWatchlistFromSet();
  let id = createWatchlistId();
  while (state.watchlists.some((watchlist) => watchlist.id === id)) {
    id = createWatchlistId();
  }
  const newWatchlist = { id, name, playerIds: [] };
  state.watchlists.push(newWatchlist);

  if (state.pendingAddWatchlistContext === "add-selected" || state.pendingAddWatchlistContext === "move-selected") {
    const action = state.pendingAddWatchlistContext === "move-selected" ? "move" : "add";
    const playerIds = Array.from(state.pendingWatchlistChoicePlayerIds);
    closeAddWatchlistModal();
    performWatchlistChoiceAction(action, id, playerIds);
    hideModal(watchlistChoiceModal);
    return;
  }

  state.currentWatchlistId = id;
  state.watchlistPlayerIds = new Set();
  state.watchlistPlayerIdsAdded.clear();
  state.watchlistPlayerIdsRemoved.clear();
  closeAddWatchlistModal();
  renderWatchlistSwitcher();
  updateWatchlistUrl();
  saveWatchlistStateAfterAction();
  applyFilters();
  showGenericToast("Watchlist created.");
}

function openDeleteWatchlistModal(watchlistId) {
  hideEvaluationLoadActionTooltip();
  const watchlist = state.watchlists.find((item) => item.id === watchlistId);
  if (!watchlist) {
    renderWatchlistSwitcher();
    return;
  }

  if (state.watchlists.length <= 1) {
    renderWatchlistSwitcher();
    showGenericToast("You need at least one watchlist.");
    return;
  }

  state.pendingDeleteWatchlistId = watchlist.id;
  if (deleteWatchlistName) {
    deleteWatchlistName.textContent = watchlist.name;
  }
  showModal(deleteWatchlistModal);
  window.setTimeout(() => cancelDeleteWatchlistButton?.focus(), 0);
}

function closeDeleteWatchlistModal() {
  keepWatchlistDropdownOpenAfterModalClick();
  state.pendingDeleteWatchlistId = "";
  hideModal(deleteWatchlistModal, renderWatchlistSwitcher);
}

function confirmDeleteWatchlist() {
  keepWatchlistDropdownOpenAfterModalClick();
  const watchlistId = state.pendingDeleteWatchlistId;
  state.pendingDeleteWatchlistId = "";
  hideModal(deleteWatchlistModal, renderWatchlistSwitcher);
  deleteWatchlist(watchlistId);
}

function clearSelectionsForDeletedWatchlist(deletedPlayerIds = [], wasActive = false) {
  const deletedIdSet = new Set(normalizeWatchlistIdList(deletedPlayerIds));

  if (wasActive) {
    state.selectedPlayerIds.clear();
    state.selectionAnchorPlayerId = null;
  } else if (deletedIdSet.size) {
    deletedIdSet.forEach((playerId) => state.selectedPlayerIds.delete(String(playerId)));
    if (state.selectionAnchorPlayerId && !state.selectedPlayerIds.has(String(state.selectionAnchorPlayerId))) {
      state.selectionAnchorPlayerId = null;
    }
  }

  const watchlistPageState = state.tablePageStates?.watchlist;
  if (watchlistPageState && typeof watchlistPageState === "object" && !Array.isArray(watchlistPageState)) {
    if (wasActive) {
      watchlistPageState.selectedPlayerIds = [];
    } else if (Array.isArray(watchlistPageState.selectedPlayerIds) && deletedIdSet.size) {
      watchlistPageState.selectedPlayerIds = watchlistPageState.selectedPlayerIds.filter((playerId) => !deletedIdSet.has(String(playerId)));
    }
  }
}

function deleteWatchlist(watchlistId) {
  if (state.watchlists.length <= 1) {
    renderWatchlistSwitcher();
    showGenericToast("You need at least one watchlist.");
    return;
  }

  syncActiveWatchlistFromSet();
  const deleteIndex = state.watchlists.findIndex((watchlist) => watchlist.id === watchlistId);
  if (deleteIndex < 0) {
    renderWatchlistSwitcher();
    return;
  }

  const deletedPlayerIds = normalizeWatchlistIdList(state.watchlists[deleteIndex]?.playerIds);
  const wasActive = state.currentWatchlistId === watchlistId;
  clearSelectionsForDeletedWatchlist(deletedPlayerIds, wasActive);
  state.watchlists.splice(deleteIndex, 1);
  if (wasActive) {
    const nextWatchlist = state.watchlists[Math.max(0, deleteIndex - 1)] || state.watchlists[0] || ensureDefaultWatchlist();
    state.currentWatchlistId = nextWatchlist.id;
    state.watchlistPlayerIdsAdded.clear();
    state.watchlistPlayerIdsRemoved.clear();
    setActiveWatchlistIds(nextWatchlist.playerIds);
    state.page = 1;
    updateWatchlistUrl(true, true);
  }

  renderWatchlistSwitcher();
  saveWatchlistStateAfterAction();
  applyFilters();
  updateSelectionBar();
  showGenericToast("Watchlist deleted.");
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function loadRecentIdsFromStorage(storageKey) {
  try {
    return normalizeIdList(JSON.parse(localStorage.getItem(storageKey) || "[]"), 5);
  } catch {
    return [];
  }
}

function saveRecentIdsToStorage(storageKey, ids) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalizeIdList(ids, 5)));
  } catch {
    // Recent search sync is best-effort when browser storage is blocked.
  }
}

function mergeRecentIdLists(...lists) {
  return normalizeIdList(lists.flat(), 5);
}

function mergeGuestWatchlistIntoAccount() {
  const guestIds = loadGuestWatchlist();

  if (!guestIds.length) {
    return;
  }

  guestIds.forEach((playerId) => state.watchlistPlayerIds.add(String(playerId)));
  syncActiveWatchlistFromSet();
  try {
    localStorage.removeItem(GUEST_WATCHLIST_STORAGE_KEY);
  } catch {
    // Nothing else to do if guest storage is blocked.
  }
  saveTableState();
}

function applyWalletWatchlistIds(ids) {
  if (!Array.isArray(ids)) {
    return;
  }

  if (ids.some((item) => item && typeof item === "object" && !Array.isArray(item))) {
    applyWatchlists(ids, state.currentWatchlistId, Array.from(state.watchlistPlayerIds));
    return;
  }

  ids.forEach((playerId) => state.watchlistPlayerIds.add(String(playerId)));
  syncActiveWatchlistFromSet();
}

function replaceWalletWatchlistIds(ids) {
  if (!Array.isArray(ids)) {
    return;
  }

  setActiveWatchlistIds(ids.map((playerId) => String(playerId)));
}

function clearSyncedWatchlistChanges(addedIds = [], removedIds = []) {
  addedIds.forEach((playerId) => state.watchlistPlayerIdsAdded.delete(String(playerId)));
  removedIds.forEach((playerId) => state.watchlistPlayerIdsRemoved.delete(String(playerId)));
}

function watchlistSetEquals(ids) {
  if (!Array.isArray(ids) || ids.length !== state.watchlistPlayerIds.size) {
    return false;
  }

  return ids.every((playerId) => state.watchlistPlayerIds.has(String(playerId)));
}

function hasPendingWatchlistChanges() {
  return state.watchlistPlayerIdsAdded.size > 0 || state.watchlistPlayerIdsRemoved.size > 0;
}

function mergedWatchlistIdsWithPending(serverIds = []) {
  const mergedIds = new Set(normalizeWatchlistIdList(serverIds));
  state.watchlistPlayerIdsRemoved.forEach((playerId) => mergedIds.delete(String(playerId)));
  state.watchlistPlayerIdsAdded.forEach((playerId) => mergedIds.add(String(playerId)));
  return Array.from(mergedIds);
}

function applySyncedWatchlistIds(ids) {
  if (!Array.isArray(ids)) {
    return false;
  }

  const normalizedIds = normalizeWatchlistIdList(ids);
  if (watchlistSetEquals(normalizedIds)) {
    return false;
  }

  replaceWalletWatchlistIds(normalizedIds);
  syncActiveWatchlistFromSet();
  renderWatchlistSwitcher();
  saveWalletWatchlistLocally();
  return true;
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

function remainingWatchlistCapacity() {
  return Math.max(0, MAX_WATCHLIST_PLAYERS - state.watchlistPlayerIds.size);
}

function showWatchlistFullToast() {
  showGenericToast(`A watchlist can contain up to ${MAX_WATCHLIST_PLAYERS} players.`);
}

function refreshWatchlistPageAfterWalletSync() {
  if (state.currentPage !== "watchlist") {
    return;
  }

  state.view = normalizeViewForPage(state.view, "watchlist");
  updateViewButtons();
  buildHeader();
  applyFilters();
}

function refreshPlayerPageAfterWalletSync() {
  if (state.currentPage !== "player") {
    return;
  }

  renderPlayerPage(playerIdFromUrl());
}

async function upgradeCurrentPageAfterWalletOptIn() {
  const targetAccess = currentDataAccess(state.currentPage);

  if (!pageCanUseProgressionData(state.currentPage) || targetAccess === "public" || state.dataAccess === targetAccess) {
    return false;
  }

  state.dataLoaded = false;
  const options = state.currentPage === "player" ? { playerId: playerIdFromUrl() } : {};
  await setPage(state.currentPage, false, options);
  return true;
}

async function loadWalletPreferences(options = {}) {
  const force = Boolean(options.force);

  if (!state.linkedWalletAddress || !hasWalletProof() || state.walletPreferencesLoading || (state.walletPreferencesLoaded && !force)) {
    return;
  }

  state.walletPreferencesLoading = true;
  const previousNotes = JSON.stringify(normalizedPlayerNotes(state.playerNotes));
  try {
    const localWatchlists = loadLocalWalletWatchlist();
    if (Array.isArray(localWatchlists) && localWatchlists.some((item) => item && typeof item === "object" && !Array.isArray(item))) {
      applyWatchlists(localWatchlists, state.currentWatchlistId, Array.from(state.watchlistPlayerIds));
    } else {
      applyWalletWatchlistIds(localWatchlists);
      ensureDefaultWatchlist();
    }
    state.playerNotes = {};
    applyWalletPlayerNotes(loadLocalWalletNotes());
    const response = await fetch("/api/wallet-preferences", {
      cache: "no-store",
      headers: walletProofHeaders(true),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.watchlists) && data.watchlists.length) {
        const requestedId = String(watchlistIdFromUrl() || state.pendingWatchlistRouteId || "").trim();
        applyWatchlists(data.watchlists, requestedId, []);
        state.watchlistPlayerIdsAdded.clear();
        state.watchlistPlayerIdsRemoved.clear();
      } else {
        ensureDefaultWatchlist();
        state.watchlistPlayerIdsAdded.clear();
        state.watchlistPlayerIdsRemoved.clear();
      }
      const tableStateChanged = applyWalletTableState(data.tableState);
      applyWalletPlayerNotes(data.playerNotes);
      if (data.settings) {
        applySettingsPayload(data.settings);
      }
      const pendingSettings = loadPendingSettingsLocally();
      if (pendingSettings) {
        applySettingsPayload(pendingSettings);
        void saveWalletPreferencesNow({ refreshAfterSave: true });
      }
      if (data.evaluationSettings) {
        applyEvaluationSettingsPayload(data.evaluationSettings);
        saveEvaluationSettingsLocally();
        renderEvaluationMflPerUsdControl(false);
        if (state.currentPage === "evaluation") {
          renderEvaluationPage();
        }
      }
      saveWalletNotesLocally();
      if (tableStateChanged && tablePageKey()) {
        restoreSavedTableState(tablePageKey());
        applyFilters({ save: false });
      }
    }
  } catch {
    // Local wallet watchlist and notes are still available if cloud sync is unavailable.
  } finally {
    state.walletPreferencesLoaded = true;
    state.walletPreferencesLoading = false;
    if (previousNotes !== JSON.stringify(normalizedPlayerNotes(state.playerNotes))) {
      refreshPlayerPageAfterWalletSync();
      if (tablePageKey()) {
        applyFilters({ save: false });
      }
    }
  }
}

async function saveWalletPreferencesNow(options = {}) {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  saveWalletWatchlistLocally();
  saveWalletNotesLocally();

  const saveSequence = ++state.walletPreferencesSaveSequence;

  try {
    const addedIds = Array.from(state.watchlistPlayerIdsAdded);
    const removedIds = Array.from(state.watchlistPlayerIdsRemoved);
    const body = {
      playerNotes: normalizedPlayerNotes(state.playerNotes),
      watchlists: watchlistsPayload(),
      tableState: stripPersistentSortState(currentTableState()),
      evaluationSettings: currentEvaluationSettingsPayload(),
      settings: currentSettingsPayload(),
    };

    const response = await fetch("/api/wallet-preferences", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...walletProofHeaders(true),
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      if (saveSequence !== state.walletPreferencesSaveSequence) {
        return;
      }
      clearSyncedWatchlistChanges(addedIds, removedIds);

      let watchlistChanged = false;
      if (Array.isArray(data.watchlists) && data.watchlists.length) {
        applyWatchlists(data.watchlists, state.currentWatchlistId, []);
        watchlistChanged = true;
      }

      if (data.settings) {
        applySettingsPayload(data.settings);
      }
      clearPendingSettingsLocally();

      if (watchlistChanged) {
        if (state.currentPage === "watchlist") {
          applyFilters();
        } else if (tablePageKey()) {
          renderTable();
        }
        if (state.currentPage === "player") {
          renderPlayerPage(playerIdFromUrl());
        }
      }

      if (options.refreshAfterSave) {
        state.walletPreferencesLoaded = false;
        await loadWalletPreferences({ force: true });
      }
    }
  } catch {
    // Local wallet watchlist and notes remain saved if cloud sync is unavailable.
  }
}

function saveTableState() {
  syncRecentSearchStateFromStorage();
  persistRecentSearchStates();
  const savedState = currentTableState();
  saveTableStateLocally(savedState);

  saveGuestWatchlist();
  queueCloudTableStateSave(savedState);
}

function saveWatchlistStateAfterAction() {
  saveTableState();
  if (state.linkedWalletAddress && hasWalletProof()) {
    window.clearTimeout(state.walletPreferencesSaveTimer);
    state.walletPreferencesSaveTimer = null;
    void saveWalletPreferencesNow();
  }
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

  const pageKey = tablePageKey();
  const existingPageState = pageKey ? state.tablePageStates?.[pageKey] : null;
  const viewSortStates = {
    ...((existingPageState && typeof existingPageState === "object" && existingPageState.viewSortStates) || {}),
    [state.view]: {
      sortKey: state.sortKey,
      sortDirection: state.sortDirection,
    },
  };

  return {
    hideRetired: hideRetiredInput.checked,
    hideRetiring: hideRetiringInput.checked,
    ...(pageKey === "mfl" ? { mflPackable: Boolean(packablePlayersInput?.checked) } : {}),
    newMints: newMintsInput.checked,
    pageSize: state.pageSize,
    view: state.view,
    viewSortStates,
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
    menuOpen: state.menuOpen,
    recentSearchPlayerIds: state.recentSearchPlayerIds,
    recentEvaluationPlayerIds: state.recentEvaluationPlayerIds,
    playerAttributeView: state.playerAttributeView,
    linkedWalletAddress: state.linkedWalletAddress,
  };
}

function stripPersistentSortState(savedState) {
  if (!savedState || typeof savedState !== "object" || Array.isArray(savedState)) {
    return savedState;
  }

  const sanitized = { ...savedState };
  delete sanitized.sortKey;
  delete sanitized.sortDirection;
  delete sanitized.viewSortStates;
  delete sanitized.watchlistPlayerIds;
  delete sanitized.watchlists;
  delete sanitized.currentWatchlistId;

  if (sanitized.pages && typeof sanitized.pages === "object") {
    sanitized.pages = Object.fromEntries(Object.entries(sanitized.pages).map(([pageName, pageState]) => {
      if (!pageState || typeof pageState !== "object" || Array.isArray(pageState)) {
        return [pageName, pageState];
      }

      const sanitizedPageState = { ...pageState };
      delete sanitizedPageState.sortKey;
      delete sanitizedPageState.sortDirection;
      delete sanitizedPageState.viewSortStates;
      if (pageName !== "mfl") {
        delete sanitizedPageState.mflPackable;
      }
      return [pageName, sanitizedPageState];
    }));
  }

  return sanitized;
}

function saveTableStateLocally(savedState) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(stripPersistentSortState(savedState)));
  } catch {
    // Filtering still works for this page even if the browser blocks storage.
  }
}

function localTablePageStates() {
  try {
    const savedState = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
    return savedState?.pages && typeof savedState.pages === "object" ? savedState.pages : null;
  } catch {
    return null;
  }
}

function mergeCloudTableStateWithLocalPages(savedState) {
  const localPages = localTablePageStates();

  if (!localPages) {
    return savedState;
  }

  return {
    ...(savedState || {}),
    pages: {
      ...((savedState && typeof savedState === "object" && savedState.pages) || {}),
      ...localPages,
    },
  };
}

function applyWalletTableState(savedState) {
  if (!savedState || typeof savedState !== "object" || Array.isArray(savedState)) {
    return false;
  }

  const mergedState = mergeCloudTableStateWithLocalPages(savedState);

  restoreTablePageStates(mergedState);
  restoreMenuState(mergedState);
  restoreRecentSearchState(mergedState);
  restoreRecentEvaluationState(mergedState);
  persistRecentSearchStates();
  restorePlayerAttributeView(mergedState);
  saveTableStateLocally({
    ...mergedState,
    recentSearchPlayerIds: state.recentSearchPlayerIds,
    recentEvaluationPlayerIds: state.recentEvaluationPlayerIds,
    linkedWalletAddress: state.linkedWalletAddress,
  });
  updateMenuVisibility();
  return true;
}
function queueCloudTableStateSave() {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  window.clearTimeout(state.walletPreferencesSaveTimer);
  state.walletPreferencesSaveTimer = window.setTimeout(() => {
    void saveWalletPreferencesNow();
  }, 500);
}

function restoreWatchlistState() {
  ensureDefaultWatchlist();
}

function restoreMenuState(savedState) {
  if (typeof savedState?.menuOpen === "boolean") {
    state.menuOpen = savedState.menuOpen;
  }
}

function restoreRecentSearchState(savedState) {
  const savedIds = Array.isArray(savedState?.recentSearchPlayerIds) ? savedState.recentSearchPlayerIds : [];
  state.recentSearchPlayerIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_SEARCH_STORAGE_KEY), savedIds);
  saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
}

function restoreRecentEvaluationState(savedState) {
  const savedIds = Array.isArray(savedState?.recentEvaluationPlayerIds) ? savedState.recentEvaluationPlayerIds : [];
  state.recentEvaluationPlayerIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY), savedIds);
  saveRecentIdsToStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY, state.recentEvaluationPlayerIds);
}

function playerCanViewProgression(row = null) {
  return true;
}

function allowedPlayerAttributeViews(row = null) {
  return !playerCanViewProgression(row)
    ? [["attributes", "Attributes"], ["training", "Training"], ["next", "Next Overall"]]
    : [["attributes", "Attributes"], ["training", "Training"], ["next", "Next Overall"], ["current", "Current Season"], ["all", "All Time"]];
}

function normalizePlayerAttributeView(viewName, row = null) {
  const allowedViews = allowedPlayerAttributeViews(row).map(([view]) => view);
  return allowedViews.includes(viewName) ? viewName : allowedViews[0];
}

function restorePlayerAttributeView(savedState) {
  if (["attributes", "training", "current", "all", "next"].includes(savedState?.playerAttributeView)) {
    state.playerAttributeView = savedState.playerAttributeView;
  }
}

function persistRecentSearchStates() {
  saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
  saveRecentIdsToStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY, state.recentEvaluationPlayerIds);
}

function syncRecentSearchStateFromStorage(event = null) {
  if (event && ![RECENT_SEARCH_STORAGE_KEY, RECENT_EVALUATION_SEARCH_STORAGE_KEY].includes(event.key)) {
    return;
  }

  const nextSearchIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_SEARCH_STORAGE_KEY), state.recentSearchPlayerIds);
  const nextEvaluationIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY), state.recentEvaluationPlayerIds);
  const searchChanged = JSON.stringify(nextSearchIds) !== JSON.stringify(state.recentSearchPlayerIds);
  const evaluationChanged = JSON.stringify(nextEvaluationIds) !== JSON.stringify(state.recentEvaluationPlayerIds);

  state.recentSearchPlayerIds = nextSearchIds;
  state.recentEvaluationPlayerIds = nextEvaluationIds;

  if (searchChanged && searchModal && !searchModal.hidden && !playerSearchInput.value.trim()) {
    renderSearchResultsNow();
  }

  if (evaluationChanged && state.currentPage === "evaluation" && !evaluationSearchInput.value.trim()) {
    renderEvaluationSearchResults();
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
  const sanitizedState = stripPersistentSortState(savedState);

  if (sanitizedState?.pages) {
    state.tablePageStates = { ...sanitizedState.pages };
  } else if (sanitizedState) {
    state.tablePageStates = { progression: { ...sanitizedState } };
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
    restoreWatchlistState();
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
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 86400000);
}

function ownedSinceDay(row) {
  const timestamp = parseEpochMillis(getValue(row, joinedAgencyColumn));
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86400000);
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
  const columns = (pageName === "mfl" || pageName === "agents")
    ? baseFilterColumns.filter((column) => column !== agentColumn)
    : [...baseFilterColumns];

  if (normalizedView === "current") {
    columns.push(...statColumns.map((column) => `${column}_prog_current_season`));
  } else if (normalizedView === "all") {
    columns.push(...statColumns.map((column) => `${column}_prog_all`));
  }

  return columns.filter((column) => state.columns.includes(column));
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
  return columnIndex(column) >= 0;
}

function precomputedValue(row, column) {
  return hasColumn(column) ? getValue(row, column) : null;
}

function clearRowSortCache() {
  state.rowSortCache = new WeakMap();
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
  button.addEventListener("mouseenter", () => showPlayerNoteTooltip(button));
  button.addEventListener("focus", () => showPlayerNoteTooltip(button));
  button.addEventListener("mouseleave", hidePlayerNoteTooltip);
  button.addEventListener("blur", hidePlayerNoteTooltip);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hidePlayerNoteTooltip();
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
  markerElement.addEventListener("mouseenter", () => showPlayerNoteTooltip(markerElement));
  markerElement.addEventListener("focus", () => showPlayerNoteTooltip(markerElement));
  markerElement.addEventListener("mouseleave", hidePlayerNoteTooltip);
  markerElement.addEventListener("blur", hidePlayerNoteTooltip);
  cell.appendChild(markerElement);
}

function playerRoute(playerId) {
  return `/players/${encodeURIComponent(playerId)}`;
}

function agentRoute(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  if (normalizedWalletAddress === mflWalletAddress) {
    return "/mfl";
  }

  return normalizedWalletAddress ? `/agents/${encodeURIComponent(normalizedWalletAddress)}` : "#";
}

function openAgentPage(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  if (!normalizedWalletAddress) {
    return;
  }

  if (normalizedWalletAddress === mflWalletAddress) {
    setPage("mfl", true);
    return;
  }

  setPage("agents", true, { walletAddress: normalizedWalletAddress });
}

function rowByPlayerId(playerId) {
  const key = String(playerId);
  return state.rows.find((row) => String(getValue(row, "player_id")) === key) || null;
}

function buildSearchIndex() {
  state.searchIndex = state.rows.map((row) => ({
    row,
    id: normalizeSearchText(getValue(row, "player_id")),
    name: normalizeSearchText(getValue(row, "name")),
    overall: Number(statDisplayValue(row, "overall") || 0),
    retired: getValue(row, "retirement_years") === 0,
  }));
}


const DEFAULT_EVALUATION_MFL_PER_USD = 400;
const EVALUATION_MFL_PER_USD_STORAGE_KEY = "mfl-evaluation-mfl-per-usd";
const DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES = [80, 80, 60];
const EVALUATION_LATE_SEASON_REWARD_RATES_STORAGE_KEY = "mfl-evaluation-late-season-reward-rates";


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

function periodDecimalString(value) {
  return String(value ?? "").replace(/,/g, ".");
}

function parseEvaluationRewardRate(value) {
  const normalizedValue = periodDecimalString(value).trim();
  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 100 ? Math.round(parsedValue * 100) / 100 : null;
}

function clampEvaluationRewardRate(value, fallbackValue = 100) {
  const parsedValue = Number.parseFloat(periodDecimalString(value));
  const fallback = parseEvaluationRewardRate(fallbackValue) ?? 100;

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.round(Math.max(0, Math.min(100, parsedValue)) * 100) / 100;
}

function normalizeEvaluationRewardRateDraft(input) {
  if (!input) {
    return;
  }

  const originalValue = input.value;
  const normalizedValue = periodDecimalString(originalValue).replace(/[^0-9.]/g, "");
  const firstDotIndex = normalizedValue.indexOf(".");
  const singleDecimalValue = firstDotIndex === -1
    ? normalizedValue
    : normalizedValue.slice(0, firstDotIndex + 1) + normalizedValue.slice(firstDotIndex + 1).replace(/\./g, "");
  const [integerPart, decimalPart] = singleDecimalValue.split(".");
  const integerNumber = integerPart === "" ? null : Number.parseInt(integerPart, 10);
  const clampedIntegerPart = integerNumber === null ? "" : String(Math.min(100, integerNumber));
  const clampedDecimalPart = integerNumber !== null && integerNumber >= 100 ? "" : decimalPart?.slice(0, 2);
  const cleanedValue = decimalPart === undefined
    ? clampedIntegerPart
    : `${clampedIntegerPart}.${clampedDecimalPart}`;

  if (originalValue !== cleanedValue) {
    input.value = cleanedValue;
  }
}

function normalizeEvaluationLateSeasonRewardRates(value) {
  const source = Array.isArray(value) ? value : [];
  return DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES.map((defaultRate, index) => {
    const parsedRate = parseEvaluationRewardRate(source[index]);
    return parsedRate === null ? defaultRate : parsedRate;
  });
}

function formatEvaluationRewardRate(value) {
  const parsedRate = parseEvaluationRewardRate(value);
  if (parsedRate === null) {
    return "";
  }
  return parsedRate.toFixed(2);
}

function saveEvaluationLateSeasonRewardRates(rates) {
  const normalizedRates = normalizeEvaluationLateSeasonRewardRates(rates);
  state.evaluationLateSeasonRewardRates = normalizedRates;

  try {
    if (normalizedRates.every((rate, index) => rate === DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[index])) {
      localStorage.removeItem(EVALUATION_LATE_SEASON_REWARD_RATES_STORAGE_KEY);
    } else {
      localStorage.setItem(EVALUATION_LATE_SEASON_REWARD_RATES_STORAGE_KEY, JSON.stringify(normalizedRates));
    }
  } catch {
    // Evaluation still recalculates for this page if the browser blocks storage.
  }
}

function loadEvaluationLateSeasonRewardRates() {
  try {
    const savedRates = JSON.parse(localStorage.getItem(EVALUATION_LATE_SEASON_REWARD_RATES_STORAGE_KEY) || "null");
    state.evaluationLateSeasonRewardRates = normalizeEvaluationLateSeasonRewardRates(savedRates);
  } catch {
    state.evaluationLateSeasonRewardRates = [...DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES];
  }
}

function evaluationLateSeasonRewardRatesFromPayload(data) {
  return normalizeEvaluationLateSeasonRewardRates(
    data.lateSeasonRewardRates
      ?? data.late_season_reward_rates
      ?? data.lateCareerRewardRates
      ?? data.late_career_reward_rates
  );
}

function currentEvaluationSettingsPayload() {
  return {
    mflPerUsd: state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD,
    ignoreDiscountRate: Boolean(state.evaluationIgnoreDiscountRate),
    ignoreFirstSeason: Boolean(state.evaluationIgnoreFirstSeason),
    lateSeasonRewardRates: normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates),
  };
}

function applyEvaluationSettingsPayload(settings = {}) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  const mflPerUsd = parseEvaluationMflPerUsd(data.mflPerUsd ?? data.mfl_per_usd);

  state.evaluationMflPerUsd = mflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD;
  state.evaluationIgnoreDiscountRate = Boolean(data.ignoreDiscountRate ?? data.ignore_discount_rate);
  state.evaluationIgnoreFirstSeason = Boolean(data.ignoreFirstSeason ?? data.ignore_first_season);
  state.evaluationLateSeasonRewardRates = evaluationLateSeasonRewardRatesFromPayload(data);
}

function saveEvaluationSettingsLocally() {
  saveEvaluationMflPerUsd(state.evaluationMflPerUsd || DEFAULT_EVALUATION_MFL_PER_USD);
  saveEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates);
}

function queueEvaluationSettingsSave() {
  saveEvaluationSettingsLocally();
  queueCloudTableStateSave();
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

  headers.forEach((header, index) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headerRow.appendChild(cell);
  });

  advancedPlayerTableHead.replaceChildren(headerRow);

  rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    const rowHeader = document.createElement("th");

    rowHeader.scope = "row";
    rowHeader.textContent = row[0];
    tableRow.appendChild(rowHeader);

    row.slice(1).forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = formatAdvancedPlayerTableValue(value);
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
  const rates = normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates);
  advancedThirdLastRewardInput.value = formatEvaluationRewardRate(rates[0]);
  advancedSecondLastRewardInput.value = formatEvaluationRewardRate(rates[1]);
  advancedFinalRewardInput.value = formatEvaluationRewardRate(rates[2]);
  updateAdvancedRewardRateResetVisibility();
}

function updateAdvancedRewardRateResetVisibility() {
  const inputs = [advancedThirdLastRewardInput, advancedSecondLastRewardInput, advancedFinalRewardInput];
  const buttons = [advancedThirdLastRewardResetButton, advancedSecondLastRewardResetButton, advancedFinalRewardResetButton];

  inputs.forEach((input, index) => {
    const button = buttons[index];
    if (!button) {
      return;
    }

    const parsedValue = parseEvaluationRewardRate(input?.value);
    button.hidden = parsedValue === null || parsedValue === DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[index];
  });
}

function updateAdvancedMflUsdResetVisibility() {
  const parsedValue = parseEvaluationMflPerUsd(advancedMflUsdInput.value);
  advancedMflUsdResetButton.hidden = !parsedValue || parsedValue === DEFAULT_EVALUATION_MFL_PER_USD;
}

function openAdvancedSettings() {
  renderAdvancedPlayerTable();
  syncAdvancedSettingsValues();
  showModal(advancedSettingsModal);
  window.requestAnimationFrame(updateAdvancedPlayerTableClip);
}

function closeAdvancedSettings() {
  hideModal(advancedSettingsModal);
  advancedPlayerTableBody.style.clipPath = "";
  advancedPlayerTableBody.style.webkitClipPath = "";
}

function toggleAdvancedLateSeasonRewards() {
  if (!advancedLateSeasonRewardsSection || !advancedLateSeasonRewardsToggle) {
    return;
  }

  const isExpanded = !advancedLateSeasonRewardsSection.classList.contains("is-expanded");
  advancedLateSeasonRewardsSection.classList.toggle("is-expanded", isExpanded);
  advancedLateSeasonRewardsToggle.setAttribute("aria-expanded", String(isExpanded));
  window.setTimeout(updateAdvancedPlayerTableClip, 220);
}

function syncAdvancedRewardRateDraft(input, fallbackValue) {
  if (!input) {
    return;
  }

  normalizeEvaluationRewardRateDraft(input);
  input.value = clampEvaluationRewardRate(input.value, fallbackValue).toFixed(2);
}

function syncAdvancedRewardRateDrafts() {
  const currentRates = normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates);
  syncAdvancedRewardRateDraft(advancedThirdLastRewardInput, currentRates[0]);
  syncAdvancedRewardRateDraft(advancedSecondLastRewardInput, currentRates[1]);
  syncAdvancedRewardRateDraft(advancedFinalRewardInput, currentRates[2]);
  updateAdvancedRewardRateResetVisibility();
}

function applyAdvancedSettings() {
  const parsedValue = parseEvaluationMflPerUsd(advancedMflUsdInput.value);

  if (parsedValue) {
    saveEvaluationMflPerUsd(parsedValue);
  }

  syncAdvancedRewardRateDrafts();
  saveEvaluationLateSeasonRewardRates([
    advancedThirdLastRewardInput.value,
    advancedSecondLastRewardInput.value,
    advancedFinalRewardInput.value,
  ]);

  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
  queueEvaluationSettingsSave();
  closeAdvancedSettings();
}

function resetAdvancedSettingsDraft() {
  advancedMflUsdInput.value = DEFAULT_EVALUATION_MFL_PER_USD.toFixed(2);
  advancedThirdLastRewardInput.value = DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[0].toFixed(2);
  advancedSecondLastRewardInput.value = DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[1].toFixed(2);
  advancedFinalRewardInput.value = DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[2].toFixed(2);
  updateAdvancedMflUsdResetVisibility();
  updateAdvancedRewardRateResetVisibility();
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

function adjustAdvancedRewardRateDraft(input, delta) {
  if (!input) {
    return;
  }

  const currentRates = normalizeEvaluationLateSeasonRewardRates(state.evaluationLateSeasonRewardRates);
  const inputIndex = [advancedThirdLastRewardInput, advancedSecondLastRewardInput, advancedFinalRewardInput].indexOf(input);
  const fallbackValue = currentRates[inputIndex] ?? 100;
  const currentValue = clampEvaluationRewardRate(input.value, fallbackValue);
  const nextValue = Math.round(Math.max(0, Math.min(100, currentValue + delta)) * 100) / 100;
  input.value = nextValue.toFixed(2);
  updateAdvancedRewardRateResetVisibility();
}

function resetAdvancedRewardRateDraft(input, index) {
  if (!input) {
    return;
  }

  input.value = DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES[index].toFixed(2);
  updateAdvancedRewardRateResetVisibility();
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
  queueEvaluationSettingsSave();
}

function resetEvaluationMflPerUsd() {
  saveEvaluationMflPerUsd(DEFAULT_EVALUATION_MFL_PER_USD);
  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
  queueEvaluationSettingsSave();
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

function evaluationMflMultiplierForSeason(rowIndex, expectedSeasons, rates = state.evaluationLateSeasonRewardRates) {
  const seasonsFromEnd = expectedSeasons - rowIndex;
  const normalizedRates = normalizeEvaluationLateSeasonRewardRates(rates);

  if (seasonsFromEnd >= 1 && seasonsFromEnd <= 3) {
    return normalizedRates[3 - seasonsFromEnd] / 100;
  }

  return 1;
}

function evaluationMflValueForOverall(overall, position, rowIndex, expectedSeasons, rates = state.evaluationLateSeasonRewardRates) {
  const roundedOverall = Math.round(Number(overall));
  const positionValues = evaluationContractsTable[roundedOverall] || {};
  const contractValue = positionValues[position] || 0;
  return contractValue * evaluationMflMultiplierForSeason(rowIndex, expectedSeasons, rates);
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
  state.recentEvaluationPlayerIds = mergeRecentIdLists([key], state.recentEvaluationPlayerIds);
  persistRecentSearchStates();
  saveTableState();
}

function renderEmptyEvaluationSelection(showRecentResults = true) {
  evaluationPanel.hidden = true;
  evaluationSummaryBody.replaceChildren();
  evaluationTableBody.replaceChildren();
  evaluationButtons.hidden = !hasWalletOptIn();
  evaluationResetButton.hidden = true;
  if (evaluationLoadButton) {
    evaluationLoadButton.hidden = !hasWalletOptIn();
  }
  evaluationPlayerPageButton.hidden = true;
  evaluationOptionFilters.hidden = true;
  updateEvaluationFooterActions();

  if (showRecentResults) {
    renderEvaluationSearchResults();
  } else {
    evaluationSearchResults.hidden = true;
  }
}

function resetEvaluationSelection() {
  state.evaluationShareId = "";
  state.evaluationSavedId = "";
  updateEvaluationFooterActions();
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
  const query = normalizeSearchText(evaluationSearchInput.value.trim());

  if (!query && !shouldShowEvaluationRecentResults()) {
    evaluationSearchResults.hidden = true;
    evaluationSearchResults.replaceChildren();
    return;
  }

  const rows = query ? evaluationSearchMatches(query) : recentEvaluationRows();

  evaluationSearchResults.replaceChildren();
  evaluationSearchResults.hidden = rows.length === 0;

  rows.forEach((row) => {
    const playerId = String(getValue(row, "player_id"));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evaluationSearchResult";
    const ovr = formatPlainValue(statDisplayValue(row, "overall"), "overall");
    button.innerHTML = `<strong>${escapeHtml(formatCellValue(row, "name"))}</strong><span>OVR ${escapeHtml(ovr)} &middot; #${escapeHtml(playerId)} &middot; ${escapeHtml(formatCellValue(row, "nationality"))} &middot; ${escapeHtml(formatCellValue(row, "positions"))}</span>`;
    button.addEventListener("click", () => {
      state.evaluationShareId = "";
      state.evaluationSavedId = "";
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

function evaluationSearchClearZoneHit(event) {
  const rect = evaluationSearchInput.getBoundingClientRect();
  const clearZoneWidth = 40;
  return event.clientX >= rect.right - clearZoneWidth && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function updateEvaluationSearchCursor(event) {
  evaluationSearchInput.style.cursor = evaluationSearchClearZoneHit(event) ? "pointer" : "";
}

function resetEvaluationSearchCursor() {
  evaluationSearchInput.style.cursor = "";
}
function handleEvaluationSearchPointerDown(event) {
  if (!evaluationSearchClearZoneHit(event)) {
    return;
  }

  event.preventDefault();
  evaluationSearchInput.value = "";
  resetEvaluationSelection();
  renderEvaluationSearchResults();
  evaluationSearchInput.focus();
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
  evaluationSearchResults.hidden = true;
  evaluationSearchResults.replaceChildren();
  evaluationButtons.hidden = false;
  evaluationResetButton.hidden = false;
  if (evaluationLoadButton) {
    evaluationLoadButton.hidden = true;
  }
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
  updateEvaluationFooterActions();
  evaluationSummaryBody.querySelectorAll("[data-evaluation-summary-position]").forEach((select) => {
    select.addEventListener("dblclick", (event) => {
      event.preventDefault();
      select.blur();
      window.getSelection()?.removeAllRanges();
    });
    select.addEventListener("change", () => {
      state.evaluationSummaryPositions[String(getValue(row, "player_id") || "")] = select.value;
      renderEvaluationTable(row);
    });
  });
  evaluationTableBody.querySelectorAll("[data-evaluation-overall-season]").forEach((button) => {
    button.addEventListener("click", () => adjustEvaluationOverall(evaluationOverallKey(row), Number(button.dataset.evaluationOverallSeason), Number(button.dataset.evaluationOverallDelta)));
  });
}
async function renderEvaluationPage() {
  const savedId = evaluationSavedIdFromUrl();
  if (savedId && !hasWalletOptIn()) {
    redirectSavedEvaluationLinkToBasicEvaluation();
  } else if (savedId && state.evaluationSavedId !== savedId) {
    if (!document.body.classList.contains("loading")) {
      renderEmptyEvaluationSelection(true);
    }
    await loadSavedEvaluation(savedId);
    return;
  }

  const shareId = evaluationShareIdFromUrl();
  if (shareId && state.evaluationShareId !== shareId) {
    if (!document.body.classList.contains("loading")) {
      renderEmptyEvaluationSelection(true);
    }
    await loadSharedEvaluation(shareId);
    return;
  }

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

function removePlayerIdFromAllWatchlists(playerId) {
  const key = String(playerId);
  const removedFrom = [];

  state.watchlists.forEach((watchlist) => {
    const ids = normalizeWatchlistIdList(watchlist.playerIds);
    if (!ids.includes(key)) {
      return;
    }
    watchlist.playerIds = ids.filter((item) => String(item) !== key);
    removedFrom.push(watchlist);
  });

  if (removedFrom.some((watchlist) => watchlist.id === state.currentWatchlistId)) {
    state.watchlistPlayerIds.delete(key);
    syncActiveWatchlistFromSet();
  }

  return removedFrom;
}

function toggleWatchlistPlayer(playerId, rerender = false) {
  const key = String(playerId);
  const playerName = rowByPlayerId(key) ? formatCellValue(rowByPlayerId(key), "name") : `Player ${key}`;
  const inAnyWatchlist = playerIsInAnyWatchlist(key);

  if (inAnyWatchlist) {
    const removedFrom = removePlayerIdFromAllWatchlists(key);
    state.watchlistPlayerIdsAdded.delete(key);
    state.watchlistPlayerIdsRemoved.add(key);
    saveTableState();
    if (removedFrom.length === 1) {
      showWatchlistToast(`${playerName} removed from`, removedFrom[0].id, removedFrom[0].name);
    } else if (removedFrom.length > 1) {
      showGenericToast(`${playerName} removed from ${removedFrom.length} watchlists.`);
    }
  } else {
    const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
    state.watchlists = watchlists;
    if (hasWalletOptIn() && watchlists.length > 1) {
      openWatchlistChoiceModal("add", [key]);
      return;
    }
    const target = activeWatchlist() || ensureDefaultWatchlist();
    const result = addPlayerIdsToWatchlist(target?.id || "", [key]);
    if (result.addedCount) {
      state.watchlistPlayerIdsAdded.add(key);
      state.watchlistPlayerIdsRemoved.delete(key);
      saveTableState();
      showWatchlistToast(`${playerName} added to`, target.id, target.name);
    }
    if (result.skippedCount) {
      showWatchlistFullToast();
      return;
    }
  }

  syncActiveWatchlistFromSet();

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

function displayedPrimaryOverall(row) {
  const displayed = Number(statDisplayValue(row, "overall") || 0);
  const precise = Math.round(primaryPreciseOverall(row) * 100) / 100;
  const baseTarget = Math.floor(displayed) + 0.5;

  if (Math.floor(displayed) === Math.floor(precise) && Math.abs(precise - baseTarget) < 0.000001) {
    return Math.floor(displayed);
  }

  return Math.round(precise);
}

function positionRating(row, position, familiarity) {
  if (familiarity === "primary" && position === playerPositions(row)[0]) {
    return displayedPrimaryOverall(row);
  }

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
    setRowValue(adjustedRow, "overall", displayedPrimaryOverall(adjustedRow));
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
  const target = displayedOverall + 0.5;
  const preciseOverall = Math.round(primaryPreciseOverall(row) * 100) / 100;

  return displayedOverall === Math.floor(preciseOverall) && Math.abs(preciseOverall - target) < 0.000001
    ? Math.round((target + 0.01) * 100) / 100
    : target;
}

function nextOverallGap(row) {
  return Math.max(0, nextOverallTarget(row) - primaryPreciseOverall(row));
}

function formatDecimal(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function formatRoundedUpDecimal(value, digits = 1) {
  const multiplier = 10 ** digits;
  return (Math.ceil((Number(value || 0) - Number.EPSILON) * multiplier) / multiplier).toFixed(digits);
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
  return `<span class="nextOverallValue ${colorClass}">+1 OVR IF +${formatRoundedUpDecimal(neededStatGain, 1)} ${escapeHtml(shortStatLabel(column))}</span>`;
}

function playerAttributeValueHtml(row, column, viewName) {
  if (viewName === "training") {
    if (column === "overall") {
      const value = displayedPrimaryOverall(row);
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
  const viewName = normalizePlayerAttributeView(state.playerAttributeView, row);
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
  const agentWalletAddress = getValue(row, "wallet_address");
  const agentTooltip = joinedAgencyTooltip(row);
  const agentTooltipHtml = agentTooltip ? ` data-tooltip="${escapeHtml(agentTooltip)}" aria-label="${escapeHtml(agentTooltip)}"` : "";
  const agentLinkHtml = `<a class="agentTableLink playerAgentLink" href="${escapeHtml(agentRoute(agentWalletAddress))}"${agentTooltipHtml}>${escapeHtml(formatCellValue(row, "wallet_name"))}</a>`;
  const infoCards = [
    ["Nationality", `${countryFlagHtml(rawNationality)} ${escapeHtml(nationality)}`],
    ["Age", `${escapeHtml(formatCellValue(row, "age"))}${ageMarkerHtml}`],
    ["Height", escapeHtml(heightLabel)],
    ["Foot", escapeHtml(formatFootedness(getValue(row, "preferred_foot")))],
    ["Seasons", escapeHtml(formatCellValue(row, "player_seasons"))],
    ["Agent", agentLinkHtml],
  ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join("");
  state.playerAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);
  const displayRow = state.playerAttributeView === "training" ? trainingRow(row) : row;
  const viewButtons = allowedPlayerAttributeViews(row)
    .map(([view, label]) => `<button class="playerAttributeViewButton ${state.playerAttributeView === view ? "active" : ""}" type="button" data-player-attribute-view="${view}">${label}</button>`)
    .join("");

  playerDetail.innerHTML = `
    <section class="playerHero">
      <div>
        <button id="copyPlayerIdButton" class="playerEyebrow playerIdText" type="button" data-tooltip="Click to copy" aria-label="Click to copy player ID">ID #${escapeHtml(id)}</button>
        <h2 class="playerTitle"><span class="playerTitleName">${escapeHtml(playerName)}</span><span class="playerTitleNoteIcon" data-player-note-title-icon>${playerNoteIconHtml(id)}</span></h2>
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
        ${hasWalletOptIn() ? `<div class="playerPanel playerNotesPanel"><h3>Notes</h3><div class="playerNotesInputWrap"><textarea id="playerNotesInput" class="playerNotesInput" placeholder="Write private notes for this player..." maxlength="${PLAYER_NOTE_MAX_LENGTH}">${escapeHtml(playerNote(id))}</textarea><span id="playerNotesCount" class="playerNotesCount">${playerNote(id).length}/${PLAYER_NOTE_MAX_LENGTH}</span></div></div>` : ""}
      </div>
      <div class="playerPanel pitchPanel"><h3>Positions</h3><div class="pitch">${renderPitch(displayRow)}</div></div>
    </section>`;

  const watchButton = playerDetail.querySelector("#playerWatchlistButton");
  const inAnyWatchlist = playerIsInAnyWatchlist(id);
  watchButton.className = `playerWatchlistButton ${inAnyWatchlist ? "active" : ""}`;
  watchButton.innerHTML = `<span class="watchlistButtonStar">${inAnyWatchlist ? "★" : "☆"}</span><span>${inAnyWatchlist ? "In watchlist" : "Add to watchlist"}</span>`;
  watchButton.addEventListener("click", () => {
    toggleWatchlistPlayer(id, true);
  });
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
  const playerIdButton = playerDetail.querySelector("#copyPlayerIdButton");
  playerIdButton.addEventListener("mouseenter", () => showPlayerNoteTooltip(playerIdButton));
  playerIdButton.addEventListener("focus", () => showPlayerNoteTooltip(playerIdButton));
  playerIdButton.addEventListener("mouseleave", hidePlayerNoteTooltip);
  playerIdButton.addEventListener("blur", hidePlayerNoteTooltip);
  playerIdButton.addEventListener("click", (event) => {
    copyPlayerId(id);
    event.currentTarget.blur();
  });
  const playerAgentLink = playerDetail.querySelector(".playerAgentLink");
  if (playerAgentLink) {
    if (playerAgentLink.dataset.tooltip) {
      playerAgentLink.addEventListener("mouseenter", () => showPlayerNoteTooltip(playerAgentLink));
      playerAgentLink.addEventListener("focus", () => showPlayerNoteTooltip(playerAgentLink));
      playerAgentLink.addEventListener("mouseleave", hidePlayerNoteTooltip);
      playerAgentLink.addEventListener("blur", hidePlayerNoteTooltip);
    }
    playerAgentLink.addEventListener("click", (event) => {
      event.preventDefault();
      openAgentPage(agentWalletAddress);
    });
  }
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
  const notesInput = playerDetail.querySelector("#playerNotesInput");
  if (notesInput) {
    notesInput.addEventListener("input", () => {
      updatePlayerNoteCount(notesInput);
      setPlayerNote(id, notesInput.value);
    });
  }
}


function showModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("modalClosing");
  modal.hidden = false;
  window.requestAnimationFrame(() => {
    modal.classList.add("modalOpen");
  });
}

function hideModal(modal, afterClose) {
  if (!modal || modal.hidden) {
    if (typeof afterClose === "function") {
      afterClose();
    }
    return;
  }

  modal.classList.remove("modalOpen");
  modal.classList.add("modalClosing");
  window.setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove("modalClosing");
    if (typeof afterClose === "function") {
      afterClose();
    }
  }, 180);
}

function setupBackdropClickClose(modal, closeCallback) {
  if (!modal || typeof closeCallback !== "function") {
    return;
  }

  let pointerStartedOnBackdrop = false;

  modal.addEventListener("pointerdown", (event) => {
    pointerStartedOnBackdrop = event.target === modal;
  });

  modal.addEventListener("click", (event) => {
    if (pointerStartedOnBackdrop && event.target === modal) {
      closeCallback();
    }

    pointerStartedOnBackdrop = false;
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
  showModal(searchModal);
  playerSearchInput.value = "";
  renderSearchResultsNow();
  window.setTimeout(() => playerSearchInput.focus(), 0);
}

function closeSearch() {
  hideModal(searchModal);
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
  state.recentSearchPlayerIds = mergeRecentIdLists([key], state.recentSearchPlayerIds);
  persistRecentSearchStates();
  saveTableState();
}

function renderSearchResultsNow() {
  const query = normalizeSearchText(playerSearchInput.value.trim());
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
  const primaryComparison = comparePrimitiveValues(aNeeded, bNeeded, direction, true);

  if (primaryComparison !== 0) {
    return primaryComparison;
  }

  return comparePrimitiveValues(tableNextOverallPreciseValue(a), tableNextOverallPreciseValue(b), -1, true);
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

  currentViewColumns().forEach((column) => {
    const cell = document.createElement("th");
    const columnClass = tableColumnClass(column);
    if (columnClass) {
      cell.classList.add(...columnClass.split(" "));
    }
    const isSorted = state.sortKey === column;
    const label = document.createElement("span");
    label.textContent = column === agentColumn && state.currentPage === "mfl" ? "" : columnLabels[column];
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
        const defaultDirection = state.view === "next" && statColumns.includes(column) ? "asc" : numberColumns.has(column) ? "desc" : "asc";
        const resetDirection = state.view === "next" ? "asc" : "desc";
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
  } else if (column === joinedAgencyColumn) {
    operators = [
      ["before", "before"],
      ["after", "after"],
      ["during", "during"],
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

function buildDateInput(value = "") {
  const input = document.createElement("input");
  input.type = "date";
  input.className = "dateValue";
  input.dataset.filterValue = "true";
  input.value = value;
  return input;
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
  const savedState = state.tablePageStates?.[pageName]
    || defaultTablePageState(pageName);

  state.view = normalizeViewForPage(savedState.view, pageName);
  updateViewButtons();

  if (Number(savedState.pageSize)) {
    state.pageSize = Number(savedState.pageSize);
    pageSizeSelect.value = String(state.pageSize);
  }

  const viewSortState = normalizedViewSortState(
    savedState.viewSortStates?.[state.view] || savedState,
    state.view,
  );
  state.sortKey = viewSortState.sortKey;
  state.sortDirection = viewSortState.sortDirection;

  hideRetiredInput.checked = savedState.hideRetired !== false;
  hideRetiringInput.checked = Boolean(savedState.hideRetiring);
  if (packablePlayersInput) {
    packablePlayersInput.checked = pageName === "mfl"
      ? (savedState.mflPackable !== undefined ? Boolean(savedState.mflPackable) : true)
      : false;
  }
  newMintsInput.checked = Boolean(savedState.newMints);
  if (pageName === "mfl" && newMintsInput.checked && packablePlayersInput) {
    packablePlayersInput.checked = false;
  }
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
  showModal(filtersModal);
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
  hideModal(filtersModal, () => {
    document.body.classList.remove("filtersOpen");
    openFiltersButton.focus();
  });
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
    .filter((rule) => (rule.operator === "between" || rule.operator === "during") ? rule.value && rule.valueTo : rule.value);
}

function ruleMatches(row, rule) {
  const rawValue = getValue(row, rule.column);
  const filterValue = rule.value;

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
      return rowDay > filterDay;
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


function linkedWalletAddressesForOwnedPlayers() {
  return new Set([state.linkedWalletAddress, state.linkedWalletProof?.signingAddress, state.linkedWalletProof?.address]
    .map((address) => normalizeWalletAddress(address).toLowerCase())
    .filter(Boolean));
}

function rowIsOwnedByLinkedWallet(row) {
  const walletAddress = normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase();
  return Boolean(walletAddress && linkedWalletAddressesForOwnedPlayers().has(walletAddress));
}

function rowIsMflWalletPlayer(row) {
  return normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase() === mflWalletAddress;
}

function syncQuickFilterLabels() {
  if (packablePlayersFilter) {
    packablePlayersFilter.hidden = state.currentPage !== "mfl";
  }

  if (!newMintsLabel) {
    return;
  }

  newMintsLabel.textContent = state.currentPage === "mfl" ? "Only aged players" : "Only new mints";
}

function applyFilters(options = {}) {
  const rules = readFilterRules();
  const retirementIndex = state.columns.indexOf("retirement_years");
  const seasonsIndex = state.columns.indexOf("player_seasons");

  let sourceRows = state.rows;

  if (state.currentPage === "watchlist") {
    sourceRows = state.rows.filter((row) => state.watchlistPlayerIds.has(String(getValue(row, "player_id"))));
  } else if (state.currentPage === "myplayers") {
    sourceRows = state.rows.filter(rowIsOwnedByLinkedWallet);
  } else if (state.currentPage === "mfl") {
    sourceRows = state.rows.filter(rowIsMflWalletPlayer);
  } else if (state.currentPage === "agents") {
    const agentWalletAddress = normalizeWalletAddress(state.currentAgentWalletAddress).toLowerCase();
    sourceRows = state.rows.filter((row) => normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase() === agentWalletAddress);
  } else if (state.currentPage === "progression") {
    sourceRows = state.rows.filter((row) => !rowIsMflWalletPlayer(row));
  }

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

  state.filteredRows.sort(compareRows);
  updateFilterSummary();
  syncActiveWatchlistFromSet();
  if (options.save !== false) {
    saveTableState();
  }
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
  if (moveToWatchlistButton) {
    moveToWatchlistButton.hidden = state.currentPage !== "watchlist" || selectedCount <= 0;
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

function moveSelectedToWatchlist() {
  if (state.currentPage !== "watchlist" || !state.selectedPlayerIds.size) {
    return;
  }

  openWatchlistChoiceModal("move", selectedPlayerIdsArray());
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
        nameLink.textContent = formatCellValue(row, column);
        nameLink.addEventListener("click", (event) => {
          event.preventDefault();
          openPlayerPage(playerId);
        });
        nameWrap.appendChild(nameLink);
        const markerWrap = document.createElement("span");
        markerWrap.className = "playerNameMarkers";
        if (playerHasNote(playerId)) {
          const noteIcon = document.createElement("span");
          noteIcon.className = "playerNoteIcon";
          noteIcon.dataset.noteTooltip = playerNote(playerId);
          noteIcon.setAttribute("aria-label", "Player note");
          noteIcon.textContent = "📝";
          noteIcon.addEventListener("mouseenter", () => showPlayerNoteTooltip(noteIcon));
          noteIcon.addEventListener("focus", () => showPlayerNoteTooltip(noteIcon));
          noteIcon.addEventListener("mouseleave", hidePlayerNoteTooltip);
          noteIcon.addEventListener("blur", hidePlayerNoteTooltip);
          markerWrap.appendChild(noteIcon);
        }
        appendNameMarker(markerWrap, retirementMarker(row), "retirementMarker");
        appendNameMarker(markerWrap, newMintMarker(row), "newMintMarker");
        if (markerWrap.childElementCount) {
          nameWrap.appendChild(markerWrap);
        }
        cell.appendChild(nameWrap);
      } else if (column === flagColumn) {
        cell.classList.add("flagCell");
        cell.innerHTML = countryFlagHtml(getValue(row, "nationality"));
      } else if (column === "player_id") {
        cell.appendChild(createCopyPlayerIdButton(playerId, formatCellValue(row, column)));
      } else if (column === joinedAgencyColumn) {
        cell.textContent = formatCellValue(row, column);
      } else if (column === agentColumn) {
        if (!["myplayers", "agents", "mfl"].includes(state.currentPage)) {
          const walletAddress = getValue(row, "wallet_address");
          const agentLabel = formatCellValue(row, column);
          const link = document.createElement("a");
          link.href = agentRoute(walletAddress);
          link.className = "agentTableLink";
          link.textContent = agentLabel;
          const tooltip = joinedAgencyTooltip(row);
          if (tooltip) {
            link.dataset.tooltip = tooltip;
            link.addEventListener("mouseenter", () => showPlayerNoteTooltip(link));
            link.addEventListener("focus", () => showPlayerNoteTooltip(link));
            link.addEventListener("mouseleave", hidePlayerNoteTooltip);
            link.addEventListener("blur", hidePlayerNoteTooltip);
          }
          link.addEventListener("click", (event) => {
            event.preventDefault();
            openAgentPage(walletAddress);
          });
          cell.appendChild(link);
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


function showTableBusyState(message = "Loading players...") {
  emptyState.hidden = false;
  emptyState.textContent = message;
  tableBody.replaceChildren();
}

async function setView(viewName) {
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

  const targetSortState = normalizedViewSortState(
    pageKey ? state.tablePageStates[pageKey]?.viewSortStates?.[viewName] : null,
    viewName,
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

function publicDataFile(manifest) {
  return manifest?.files?.public?.file || manifest?.chunks?.[0]?.file || "players_public.json";
}

function progressionDataFile(manifest) {
  return manifest?.files?.progression?.file || "players_progression.json";
}

function publicDataColumns(manifest) {
  return manifest?.files?.public?.columns || manifest?.columns || [];
}

function progressionDataColumns(manifest) {
  return manifest?.files?.progression?.columns || [];
}

function fullDataColumns(manifest) {
  const columns = [...publicDataColumns(manifest)];

  progressionDataColumns(manifest).forEach((column) => {
    if (!columns.includes(column)) {
      columns.push(column);
    }
  });

  return columns;
}

function openDataSnapshotDb() {
  if (!("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DATA_SNAPSHOT_DB_NAME, DATA_SNAPSHOT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATA_SNAPSHOT_STORE_NAME)) {
        db.createObjectStore(DATA_SNAPSHOT_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readDataSnapshotRecord(id) {
  return openDataSnapshotDb().then((db) => new Promise((resolve) => {
    if (!db) {
      resolve(null);
      return;
    }

    const transaction = db.transaction(DATA_SNAPSHOT_STORE_NAME, "readonly");
    const store = transaction.objectStore(DATA_SNAPSHOT_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  }));
}

function writeDataSnapshotRecord(record) {
  return openDataSnapshotDb().then((db) => new Promise((resolve) => {
    if (!db) {
      resolve(false);
      return;
    }

    const transaction = db.transaction(DATA_SNAPSHOT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DATA_SNAPSHOT_STORE_NAME);
    store.put(record);

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };
    transaction.onerror = () => {
      db.close();
      resolve(false);
    };
  }));
}

function applyDataSnapshot(snapshot) {
  if (!snapshot?.manifest || !Array.isArray(snapshot.columns) || !Array.isArray(snapshot.rows)) {
    return false;
  }

  state.manifest = snapshot.manifest;
  state.columns = [...snapshot.columns];
  rebuildColumnIndexMap();
  state.rows = snapshot.rows;
  clearRowSortCache();
  state.filteredRows = [];
  state.page = 1;
  state.dataAccess = snapshot.access;
  state.dataLoaded = true;
  state.dataLoadPromise = null;

  state.searchIndex = [];
  updateSummaryCounts(state.manifest.row_count, state.manifest.wallet_count);
  statusText.textContent = `Updated ${new Date(state.manifest.generated_at).toLocaleString()}`;
  buildSearchIndex();
  populateAddFilterSelect();
  restoreSavedTableState();
  buildHeader();
  applyFilters();
  updateAccountState();
  return true;
}

async function restorePersistentDataSnapshot(access = currentDataAccess(), currentManifest = null) {
  const accessKey = dataCacheAccessKey(access);
  const snapshot = await readDataSnapshotRecord(accessKey);

  if (!snapshot) {
    return false;
  }

  const manifest = currentManifest || snapshot.manifest;
  const expectedVersion = dataCacheVersion(manifest, accessKey);

  if (snapshot.version !== expectedVersion) {
    return false;
  }

  localStorage.setItem(dataCacheVersionStorageKey(accessKey), snapshot.version);
  localStorage.setItem(DATA_CACHE_MANIFEST_KEY, JSON.stringify(manifest));
  return applyDataSnapshot({
    ...snapshot,
    manifest,
  });
}

function persistCurrentDataSnapshot() {
  if (!state.dataLoaded || !state.dataAccess || !state.manifest || !state.rows.length) {
    return;
  }

  const accessKey = dataCacheAccessKey(state.dataAccess);
  const snapshot = {
    id: accessKey,
    access: state.dataAccess,
    manifest: state.manifest,
    columns: state.columns,
    rows: state.rows,
    version: dataCacheVersion(state.manifest, accessKey),
    savedAt: Date.now(),
  };

  setTimeout(() => {
    void writeDataSnapshotRecord(snapshot);
  }, 0);
}

function currentDataSnapshotKey(access = currentDataAccess()) {
  return dataCacheAccessKey(access);
}

function captureCurrentDataSnapshot() {
  if (!state.dataLoaded || !state.dataAccess || !state.manifest) {
    return;
  }

  state.dataSnapshots[currentDataSnapshotKey(state.dataAccess)] = {
    access: state.dataAccess,
    manifest: state.manifest,
    columns: [...state.columns],
    rows: state.rows.map((row) => [...row]),
    version: dataCacheVersion(state.manifest, currentDataSnapshotKey(state.dataAccess)),
  };
}

function restoreDataSnapshot(access = currentDataAccess(), currentManifest = null) {
  const accessKey = currentDataSnapshotKey(access);
  const snapshot = state.dataSnapshots[accessKey];

  if (!snapshot) {
    return false;
  }

  if (currentManifest) {
    const expectedVersion = dataCacheVersion(currentManifest, accessKey);

    if (snapshot.version !== expectedVersion) {
      return false;
    }

    return applyDataSnapshot({
      ...snapshot,
      manifest: currentManifest,
    });
  }

  return applyDataSnapshot(snapshot);
}

function dataAccessFromCacheKey(accessKey = dataCacheAccessKey()) {
  const normalizedKey = String(accessKey || "public");
  return normalizedKey.split(":")[0] || "public";
}

function manifestDataFiles(manifest, access = currentDataAccess()) {
  if (manifest?.files?.public?.file) {
    const files = [manifest.files.public.file];

    if (["full", "owned"].includes(access) && manifest?.files?.progression?.file) {
      files.push(manifest.files.progression.file);
    }

    return files;
  }

  return (manifest?.chunks || []).map((chunk) => chunk.file);
}

function dataCacheVersion(manifest, accessKey = dataCacheAccessKey()) {
  const access = dataAccessFromCacheKey(accessKey);
  return `${accessKey}:${manifest.generated_at || ""}:${manifest.row_count || 0}:${manifestDataFiles(manifest, access).join("|")}`;
}

function dataCacheVersionStorageKey(accessKey = dataCacheAccessKey()) {
  return `${DATA_CACHE_VERSION_KEY}:${accessKey}`;
}

function readCachedManifest() {
  try {
    const manifest = JSON.parse(localStorage.getItem(DATA_CACHE_MANIFEST_KEY) || "null");
    return manifest && typeof manifest === "object" ? manifest : null;
  } catch {
    return null;
  }
}

async function fetchCurrentManifestForCacheCheck() {
  try {
    return await fetchDataFile("manifest.json");
  } catch {
    return null;
  }
}

async function restoreCachedDataForAccess(access = currentDataAccess(), currentManifest = null) {
  const manifest = currentManifest || readCachedManifest();

  if (!manifest) {
    return false;
  }

  const previousOverride = state.dataAccessOverride;
  state.dataAccessOverride = access;

  try {
    const accessKey = dataCacheAccessKey(access);
    const cacheVersion = dataCacheVersion(manifest, accessKey);
    const cachedVersion = localStorage.getItem(dataCacheVersionStorageKey(accessKey));

    if (cachedVersion !== cacheVersion) {
      return false;
    }

    state.manifest = manifest;
    state.filteredRows = [];
    state.page = 1;
    state.dataAccess = access;

    if (["full", "owned"].includes(access)) {
      await loadPublicAndProgressionData(manifest, { useCache: true });
    } else {
      const publicChunk = await fetchDataFile(publicDataFile(manifest), { useCache: true });

      if (!publicChunk || !Array.isArray(publicChunk.rows)) {
        return false;
      }

      state.columns = publicDataColumns(manifest);
      rebuildColumnIndexMap();
      state.rows = publicChunk.rows;
      clearRowSortCache();
    }

    statusText.textContent = `Updated ${new Date(manifest.generated_at).toLocaleString()}`;
    updateSummaryCounts(manifest.row_count, manifest.wallet_count);
    buildSearchIndex();
    populateAddFilterSelect();
    restoreSavedTableState();
    buildHeader();
    applyFilters();
    state.dataLoaded = true;
    state.dataLoadPromise = null;
    captureCurrentDataSnapshot();
    persistCurrentDataSnapshot();
    updateAccountState();
    return true;
  } catch {
    return false;
  } finally {
    state.dataAccessOverride = previousOverride;
  }
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

async function loadPublicAndProgressionData(manifest, options = {}) {
  const useCache = Boolean(options.useCache);
  const writeCache = Boolean(options.writeCache);
  const publicProgress = options.publicProgress || (() => {});
  const progressionProgress = options.progressionProgress || (() => {});
  const publicFile = publicDataFile(manifest);
  const progressionFile = progressionDataFile(manifest);
  const shouldLoadProgression = Boolean(manifest?.files?.progression?.file);

  if (!shouldLoadProgression) {
    publicProgress(0);
    const publicChunk = await fetchDataFile(publicFile, {
      useCache,
      writeCache,
      onProgress: publicProgress,
    });
    publicProgress(1);
    state.rows = Array.isArray(publicChunk.rows) ? publicChunk.rows : [];
    state.columns = publicDataColumns(manifest);
    rebuildColumnIndexMap();
    clearRowSortCache();
    return;
  }

  publicProgress(0);
  progressionProgress(0);
  const [publicChunk, progressionChunk] = await Promise.all([
    fetchDataFile(publicFile, {
      useCache,
      writeCache,
      onProgress: publicProgress,
    }),
    fetchDataFile(progressionFile, {
      useCache,
      writeCache,
      onProgress: progressionProgress,
    }),
  ]);

  state.rows = Array.isArray(publicChunk.rows) ? publicChunk.rows : [];
  state.columns = publicDataColumns(manifest);
  rebuildColumnIndexMap();
  clearRowSortCache();

  const targetColumns = fullDataColumns(manifest);
  const columnsToMerge = targetColumns.filter((column) => !state.columns.includes(column));
  mergeDataColumns(progressionChunk, columnsToMerge, rowMapByPlayerId());
  state.columns = targetColumns;
  rebuildColumnIndexMap();
  clearRowSortCache();
  publicProgress(1);
  progressionProgress(1);
}

async function upgradePublicDataToFull(manifest, progressOptions = {}) {
  const targetColumns = fullDataColumns(manifest);
  const message = progressOptions.message || "Loading data";
  const columnsToMerge = missingFullDataColumns(targetColumns);

  if (!columnsToMerge.length) {
    state.manifest = manifest;
    state.dataAccess = currentDataAccess();
    return true;
  }

  const rowMap = rowMapByPlayerId();
  const requestColumns = ["player_id", ...columnsToMerge.filter((column) => column !== "player_id")];

  updateSummaryCounts(manifest.row_count, manifest.wallet_count);
  const progressStart = progressOptions.startPercent ?? 55;
  const progressEnd = progressOptions.endPercent ?? 90;
  const progress = loadingRangeProgress(progressStart, progressEnd, message);
  const useCache = Boolean(progressOptions.useCache);
  const writeCache = Boolean(progressOptions.writeCache);
  await paintLoadingProgress();

  if (manifest?.files?.progression?.file) {
    progress(0);
    await paintLoadingProgress();
    const progression = await fetchDataFile(progressionDataFile(manifest), {
      columns: requestColumns,
      onProgress: progress,
      useCache,
      writeCache,
    });
    mergeDataColumns(progression, columnsToMerge, rowMap);
    progress(1);
    await paintLoadingProgress();
  } else {
    for (let index = 0; index < manifest.chunks.length; index += 1) {
      updateLoadingProgress(index, manifest.chunks.length, message);
      await paintLoadingProgress();
      const chunkInfo = manifest.chunks[index];
      const chunk = await fetchDataFile(chunkInfo.file, {
        columns: requestColumns,
        useCache,
        writeCache,
      });
      mergeDataColumns(chunk, columnsToMerge, rowMap);
      updateLoadingProgress(index + 1, manifest.chunks.length, message);
    }
  }

  state.manifest = manifest;
  state.columns = targetColumns;
  rebuildColumnIndexMap();
  clearRowSortCache();
  state.dataAccess = currentDataAccess();
  return true;
}

function loadingMessageForAccess(access) {
  if (access === "owned") {
    return "Loading your players";
  }

  if (access === "full") {
    return "Loading data";
  }

  return "Loading player data";
}

async function loadDataForAccess(access, message = loadingMessageForAccess(access), progressRange = { start: 0, end: 100 }) {
  const previousOverride = state.dataAccessOverride;
  state.dataAccessOverride = access;
  state.dataLoaded = false;
  state.dataLoadPromise = null;

  try {
    return await loadData({ message, progressStart: progressRange.start, progressEnd: progressRange.end });
  } finally {
    state.dataAccessOverride = previousOverride;
  }
}

function loadingPhaseRange(index, total) {
  return {
    start: (index / total) * 100,
    end: ((index + 1) / total) * 100,
  };
}

async function preloadRefreshData(initialPage) {
  const targetAccess = currentDataAccess(initialPage);
  const needsInitialData = pageRequiresData(initialPage) || initialPage === "home";

  if (!needsInitialData) {
    return;
  }

  const currentManifest = await fetchCurrentManifestForCacheCheck();

  if (currentManifest && (
    restoreDataSnapshot(targetAccess, currentManifest)
    || await restorePersistentDataSnapshot(targetAccess, currentManifest)
    || await restoreCachedDataForAccess(targetAccess, currentManifest)
  )) {
    return;
  }

  if (!currentManifest && (
    restoreDataSnapshot(targetAccess)
    || await restorePersistentDataSnapshot(targetAccess)
    || await restoreCachedDataForAccess(targetAccess)
  )) {
    return;
  }

  showLoading();
  await loadDataForAccess(targetAccess, loadingMessageForAccess(targetAccess));
}

async function loadData(options = {}) {
  try {
    const message = options.message || "Loading data";
    const progressStart = options.progressStart ?? 0;
    const progressEnd = options.progressEnd ?? 100;
    const phaseProgress = (percent) => progressStart + ((progressEnd - progressStart) * (percent / 100));
    const phaseRange = (start, end) => loadingRangeProgress(phaseProgress(start), phaseProgress(end), message);
    const phaseSet = (percent, progressMessage = message) => setLoadingPercent(phaseProgress(percent), progressMessage);
    const phaseUpdate = (loaded, total) => updateLoadingProgress(loaded, total, message, { start: progressStart, end: progressEnd });
    const prepareStep = async (percent, progressMessage) => {
      phaseSet(percent, progressMessage);
      await paintLoadingProgress();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    };
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
    phaseSet(0);
    const manifest = await fetchDataFile("manifest.json", {
      onProgress: phaseRange(2, 10),
    });

    if (upgradeFromPublic) {
      await upgradePublicDataToFull(manifest, { startPercent: phaseProgress(10), endPercent: phaseProgress(90), message });
    } else {
      const accessKey = dataCacheAccessKey(targetAccess);
      const cacheVersion = dataCacheVersion(manifest, accessKey);
      const cacheVersionKey = dataCacheVersionStorageKey(accessKey);
      const cachedVersion = localStorage.getItem(cacheVersionKey);
      const useCachedChunks = cachedVersion === cacheVersion;

      if (!useCachedChunks) {
        localStorage.setItem(cacheVersionKey, cacheVersion);
        localStorage.setItem(DATA_CACHE_MANIFEST_KEY, JSON.stringify(manifest));
      }

      state.manifest = manifest;
      state.columns = ["full", "owned"].includes(targetAccess) ? fullDataColumns(manifest) : publicDataColumns(manifest);
      rebuildColumnIndexMap();
      updateSummaryCounts(manifest.row_count, manifest.wallet_count);
      await paintLoadingProgress();

      if (["full", "owned"].includes(targetAccess)) {
        await loadPublicAndProgressionData(manifest, {
          useCache: useCachedChunks,
          writeCache: !useCachedChunks,
          publicProgress: phaseRange(10, 52),
          progressionProgress: phaseRange(10, 90),
        });
      } else {
        const publicFile = publicDataFile(manifest);
        const publicProgress = phaseRange(10, 90);
        publicProgress(0);
        await paintLoadingProgress();
        const publicChunk = await fetchDataFile(publicFile, {
          useCache: useCachedChunks,
          writeCache: !useCachedChunks,
          onProgress: publicProgress,
        });
        state.rows = Array.isArray(publicChunk.rows) ? publicChunk.rows : [];
        state.columns = publicDataColumns(manifest);
        rebuildColumnIndexMap();
        clearRowSortCache();
        publicProgress(1);
      }
    }

    statusText.textContent = `Updated ${new Date(manifest.generated_at).toLocaleString()}`;
    await prepareStep(92, "Preparing data");
    buildSearchIndex();
    await prepareStep(95, "Preparing data");
    populateAddFilterSelect();
    restoreSavedTableState();
    buildHeader();
    await prepareStep(98, "Preparing data");
    applyFilters();
    await prepareStep(100, "Loading complete");
    state.dataLoaded = true;
    captureCurrentDataSnapshot();
    persistCurrentDataSnapshot();
    updateAccountState();
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

watchlistButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleWatchlistDropdown();
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

packablePlayersInput?.addEventListener("change", () => {
  if (state.currentPage === "mfl" && packablePlayersInput.checked) {
    newMintsInput.checked = false;
  }
  state.page = 1;
  applyFilters();
});

newMintsInput.addEventListener("change", () => {
  if (state.currentPage === "mfl" && newMintsInput.checked && packablePlayersInput) {
    packablePlayersInput.checked = false;
  }
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

setupBackdropClickClose(filtersModal, () => closeFilters());

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  } else if (event.key === "Escape" && !searchModal.hidden) {
    closeSearch();
  } else if (event.key === "Escape" && !filtersModal.hidden) {
    closeFilters();
  } else if (event.key === "Escape" && !watchlistChoiceModal?.hidden) {
    closeWatchlistChoiceModal();
  } else if (event.key === "Escape" && !addWatchlistModal.hidden) {
    closeAddWatchlistModal();
  } else if (event.key === "Escape" && !deleteWatchlistModal.hidden) {
    closeDeleteWatchlistModal();
  } else if (event.key === "Escape" && !advancedSettingsModal.hidden) {
    closeAdvancedSettings();
  } else if (event.key === "Escape" && !watchlistDropdown?.hidden) {
    closeWatchlistDropdown();
  } else if (event.key === "Escape" && !accountDropdown.hidden) {
    closeAccountMenu();
  } else if (event.key === "Enter" && !addWatchlistModal.hidden) {
    event.preventDefault();
    confirmAddWatchlist();
  } else if (event.key === "Enter" && !deleteWatchlistModal.hidden) {
    event.preventDefault();
    confirmDeleteWatchlist();
  } else if (event.key === "Enter" && !filtersModal.hidden) {
    event.preventDefault();
    applyAdvancedFilters();
  } else if (event.key === "Enter" && !advancedSettingsModal.hidden && [advancedMflUsdInput, advancedThirdLastRewardInput, advancedSecondLastRewardInput, advancedFinalRewardInput].includes(document.activeElement)) {
    event.preventDefault();
    applyAdvancedSettings();
  }
});

let accountPointerStartedOutside = false;
let watchlistPointerStartedOutside = false;
let suppressWatchlistDropdownCloseOnce = false;

document.addEventListener("pointerdown", (event) => {
  accountPointerStartedOutside = !accountMenu.contains(event.target);
  watchlistPointerStartedOutside = !watchlistSwitcher?.contains(event.target);
});

document.addEventListener("click", (event) => {
  if (accountPointerStartedOutside && !accountDropdown.hidden && !accountMenu.contains(event.target)) {
    closeAccountMenu();
  }

  const watchlistModalOpen = (addWatchlistModal && !addWatchlistModal.hidden) || (deleteWatchlistModal && !deleteWatchlistModal.hidden);
  if (suppressWatchlistDropdownCloseOnce) {
    suppressWatchlistDropdownCloseOnce = false;
  } else if (!watchlistModalOpen && watchlistPointerStartedOutside && watchlistDropdown && !watchlistDropdown.hidden && !watchlistSwitcher?.contains(event.target)) {
    closeWatchlistDropdown();
  }

  accountPointerStartedOutside = false;
  watchlistPointerStartedOutside = false;
});

setupBackdropClickClose(searchModal, closeSearch);

setupBackdropClickClose(advancedSettingsModal, closeAdvancedSettings);
setupBackdropClickClose(watchlistChoiceModal, closeWatchlistChoiceModal);
setupBackdropClickClose(addWatchlistModal, closeAddWatchlistModal);
setupBackdropClickClose(deleteWatchlistModal, closeDeleteWatchlistModal);

applyFiltersButton.addEventListener("click", applyAdvancedFilters);

clearFiltersButton.addEventListener("click", () => {
  clearAdvancedFilters(false);
});

clearSelectionButton.addEventListener("click", clearSelection);
addToWatchlistButton.addEventListener("click", addSelectedToWatchlist);
moveToWatchlistButton?.addEventListener("click", moveSelectedToWatchlist);
openSelectedLinksButton.addEventListener("click", openSelectedPlayerLinks);
discardAddWatchlistButton?.addEventListener("click", closeAddWatchlistModal);
closeAddWatchlistButton?.addEventListener("click", closeAddWatchlistModal);
confirmAddWatchlistButton?.addEventListener("click", confirmAddWatchlist);
cancelDeleteWatchlistButton?.addEventListener("click", closeDeleteWatchlistModal);
closeDeleteWatchlistButton?.addEventListener("click", closeDeleteWatchlistModal);
confirmDeleteWatchlistButton?.addEventListener("click", confirmDeleteWatchlist);
closeWatchlistChoiceButton?.addEventListener("click", closeWatchlistChoiceModal);
addWatchlistFromChoiceButton?.addEventListener("click", () => openAddWatchlistModal(state.pendingWatchlistChoiceAction === "move" ? "move-selected" : "add-selected"));
addWatchlistNameInput?.addEventListener("input", () => {
  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  addWatchlistNameInput.removeAttribute("aria-invalid");
  if (addWatchlistNameInput.value.length > 20) {
    addWatchlistNameInput.value = addWatchlistNameInput.value.slice(0, 20);
  }
});


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
advancedLateSeasonRewardsToggle?.addEventListener("click", toggleAdvancedLateSeasonRewards);
window.addEventListener("storage", syncRecentSearchStateFromStorage);
window.addEventListener("resize", updateAdvancedPlayerTableClip);
advancedMflUsdInput.addEventListener("input", updateAdvancedMflUsdResetVisibility);
advancedMflUsdIncreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
advancedMflUsdDecreaseButton.addEventListener("mousedown", (event) => event.preventDefault());
advancedMflUsdIncreaseButton.addEventListener("click", () => adjustAdvancedMflUsdDraft(1));
advancedMflUsdDecreaseButton.addEventListener("click", () => adjustAdvancedMflUsdDraft(-1));
advancedMflUsdResetButton.addEventListener("click", resetAdvancedMflUsd);
[
  advancedThirdLastRewardIncreaseButton,
  advancedThirdLastRewardDecreaseButton,
  advancedSecondLastRewardIncreaseButton,
  advancedSecondLastRewardDecreaseButton,
  advancedFinalRewardIncreaseButton,
  advancedFinalRewardDecreaseButton,
].forEach((button) => button?.addEventListener("mousedown", (event) => event.preventDefault()));
advancedThirdLastRewardIncreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedThirdLastRewardInput, 1));
advancedThirdLastRewardDecreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedThirdLastRewardInput, -1));
advancedSecondLastRewardIncreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedSecondLastRewardInput, 1));
advancedSecondLastRewardDecreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedSecondLastRewardInput, -1));
advancedFinalRewardIncreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedFinalRewardInput, 1));
advancedFinalRewardDecreaseButton?.addEventListener("click", () => adjustAdvancedRewardRateDraft(advancedFinalRewardInput, -1));
advancedThirdLastRewardResetButton?.addEventListener("click", () => resetAdvancedRewardRateDraft(advancedThirdLastRewardInput, 0));
advancedSecondLastRewardResetButton?.addEventListener("click", () => resetAdvancedRewardRateDraft(advancedSecondLastRewardInput, 1));
advancedFinalRewardResetButton?.addEventListener("click", () => resetAdvancedRewardRateDraft(advancedFinalRewardInput, 2));
[advancedThirdLastRewardInput, advancedSecondLastRewardInput, advancedFinalRewardInput].forEach((input) => {
  input.addEventListener("input", () => {
    normalizeEvaluationRewardRateDraft(input);
    updateAdvancedRewardRateResetVisibility();
  });
  input.addEventListener("blur", syncAdvancedRewardRateDrafts);
});
resetAdvancedSettingsButton.addEventListener("click", resetAdvancedSettingsDraft);
discardAdvancedSettingsButton.addEventListener("click", discardAdvancedSettings);
applyAdvancedSettingsButton.addEventListener("click", applyAdvancedSettings);
playerSearchInput.addEventListener("input", renderSearchResults);
evaluationSearchInput.addEventListener("input", handleEvaluationSearchInput);
evaluationSearchInput.addEventListener("pointerdown", handleEvaluationSearchPointerDown);
evaluationSearchInput.addEventListener("pointermove", updateEvaluationSearchCursor);
evaluationSearchInput.addEventListener("pointerleave", resetEvaluationSearchCursor);
evaluationSearchInput.addEventListener("focus", renderEvaluationSearchResults);
evaluationSearchInput.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (!isPlainEvaluationUrl() && document.activeElement !== evaluationSearchInput && !evaluationSearchResults.contains(document.activeElement)) {
      evaluationSearchResults.hidden = true;
      evaluationSearchResults.replaceChildren();
    }
  }, 120);
});
ignoreDiscountRateInput.addEventListener("change", () => {
  state.evaluationIgnoreDiscountRate = ignoreDiscountRateInput.checked;
  renderEvaluationPage();
  queueEvaluationSettingsSave();
});
ignoreFirstSeasonInput.addEventListener("change", () => {
  state.evaluationIgnoreFirstSeason = ignoreFirstSeasonInput.checked;
  renderEvaluationPage();
  queueEvaluationSettingsSave();
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
if (evaluationDeleteButton) {
  evaluationDeleteButton.addEventListener("click", async () => {
    const savedId = String(state.evaluationSavedId || evaluationSavedIdFromUrl() || "").trim();
    const playerId = String(state.evaluationPlayerId || evaluationPlayerIdFromUrl() || "").trim();

    if (!savedId) {
      showToast("No saved evaluation to delete.");
      return;
    }

    evaluationDeleteButton.disabled = true;

    try {
      await deleteSavedEvaluation(savedId);
      resetEvaluationToDefaultForPlayer(playerId);
      showToast("Saved evaluation deleted.");
    } catch (error) {
      showToast(error?.message || "Could not delete saved evaluation.");
    } finally {
      evaluationDeleteButton.disabled = false;
    }
  });
}
if (evaluationSaveButton) {
  evaluationSaveButton.addEventListener("click", async () => {
    evaluationSaveButton.disabled = true;
    try {
      const saveResult = await createSavedEvaluation();
      if (saveResult?.url) {
        window.history.replaceState({}, "", saveResult.url);
        updateEvaluationFooterActions();
        showToast(saveResult.overwritten ? "Evaluation overwritten and saved." : "Evaluation saved.");
      }
    } catch (error) {
      showToast(error?.message || "Could not save evaluation.");
    } finally {
      evaluationSaveButton.disabled = false;
    }
  });
}
if (evaluationLoadButton) {
  evaluationLoadButton.addEventListener("click", openSavedEvaluationsModal);
}
if (closeEvaluationLoadButton) {
  closeEvaluationLoadButton.addEventListener("click", () => {
    hideModal(evaluationLoadModal);
  });
}
setupBackdropClickClose(evaluationLoadModal, () => hideModal(evaluationLoadModal));
if (evaluationLoadList) {
  evaluationLoadList.addEventListener("scroll", hideEvaluationLoadActionTooltip, { passive: true });
}
if (evaluationShareButton) {
  evaluationShareButton.addEventListener("click", async () => {
    evaluationShareButton.disabled = true;
    try {
      const shareUrl = await createSharedEvaluation();
      if (shareUrl) {
        const parsedShareUrl = new URL(shareUrl, window.location.origin);
        state.evaluationShareId = parsedShareUrl.searchParams.get("share") || "";
        state.evaluationSavedId = "";
        window.history.replaceState({}, "", shareUrl);
        updateEvaluationFooterActions();
      }
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Evaluation share link copied.");
      } catch {
        showToast("Share link: " + shareUrl);
      }
    } catch (error) {
      showToast(error?.message || "Could not create evaluation share link.");
    } finally {
      evaluationShareButton.disabled = false;
    }
  });
}

evaluationResetButton.addEventListener("click", () => {
  const row = rowByPlayerId(state.evaluationPlayerId);

  if (!row) {
    return;
  }

  resetEvaluationToDefaultForPlayer(getValue(row, "player_id") || state.evaluationPlayerId);
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

    if (button.dataset.page === "evaluation") {
      setPage("evaluation", true, { plain: true });
      return;
    }

    setPage(button.dataset.page);
  });
});

window.addEventListener("scroll", hidePlayerNoteTooltip, true);
window.addEventListener("resize", hidePlayerNoteTooltip);

window.addEventListener("popstate", () => {
  const target = pageTargetFromPath(`${window.location.pathname}${window.location.search}`);
  setPage(target.pageName, false, target.options);
});

accountButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});
linkWalletButton.addEventListener("click", linkWallet);
if (accountSettingsButton) {
  accountSettingsButton.addEventListener("click", () => {
    accountDropdown.hidden = true;
    accountButton.setAttribute("aria-expanded", "false");
    setPage("settings");
  });
}
if (homeOptInButton) {
  homeOptInButton.addEventListener("click", linkWallet);
}
if (myPlayersOptInButton) {
  myPlayersOptInButton.addEventListener("click", linkWallet);
}


function setupChangelogSections() {
  const list = document.querySelector(".changelogList");
  if (!list || list.dataset.sectioned === "true") {
    return;
  }

  const items = Array.from(list.querySelectorAll(":scope > li"));
  if (!items.length) {
    return;
  }

  const groupedItems = [];
  const groupsByMinor = new Map();

  items.forEach((item) => {
    const versionText = item.querySelector("span")?.textContent?.trim() || "Version";
    const versionMatch = versionText.match(/^v(\d+)\.(\d+)(?:\.|$)/i);
    const minorVersion = versionMatch ? `v${versionMatch[1]}.${versionMatch[2]}` : versionText;
    let group = groupsByMinor.get(minorVersion);
    if (!group) {
      group = { minorVersion, items: [] };
      groupsByMinor.set(minorVersion, group);
      groupedItems.push(group);
    }
    group.items.push(item);
  });

  list.textContent = "";
  list.dataset.sectioned = "true";

  groupedItems.forEach((group, index) => {
    const section = document.createElement("li");
    section.className = "changelogMinorSection";

    const toggle = document.createElement("button");
    toggle.className = "changelogMinorToggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", index === 0 ? "true" : "false");

    const title = document.createElement("span");
    title.className = "changelogMinorVersion";
    title.textContent = group.minorVersion;

    const meta = document.createElement("span");
    meta.className = "changelogMinorMeta";
    meta.textContent = `${group.items.length} ${group.items.length === 1 ? "patch" : "patches"}`;

    const chevron = document.createElement("span");
    chevron.className = "changelogMinorChevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "⌄";

    toggle.append(title, meta, chevron);

    const panel = document.createElement("div");
    panel.className = "changelogMinorPanel";

    const panelInner = document.createElement("div");
    panelInner.className = "changelogMinorPanelInner";

    const patchList = document.createElement("ol");
    patchList.className = "changelogPatchList";
    group.items.forEach((item) => patchList.appendChild(item));
    panelInner.appendChild(patchList);
    panel.appendChild(panelInner);

    if (index === 0) {
      section.classList.add("is-expanded");
    }

    toggle.addEventListener("click", () => {
      const isExpanded = section.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    });

    section.append(toggle, panel);
    list.appendChild(section);
  });
}

async function startApp() {
  loadTheme();
  setupChangelogSections();
  const initialTarget = pageTargetFromPath(`${window.location.pathname}${window.location.search}`);
  const initialPage = initialTarget.pageName;
  loadSavedTableState();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
  updateMenuVisibility();

  if (initialPage === "changelog") {
    await setPage("changelog", false);
  }

  void ensureFlowWallet();
  applyStoredWalletPermission();
  await preloadRefreshData(initialPage);
  await loadWalletNames();
  await loadWalletPreferences();
  updateAccountState();
  await loadSummary();
  showAppShell();
  await showHomeShell(initialPage, false, initialTarget.options);
  if (document.body.classList.contains("loading")) {
    await finishLoading();
  }
}
startApp();
