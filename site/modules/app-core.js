const state = {
  columns: [],
  columnIndexMap: null,
  rows: [],
  filteredRows: [],
  tableSourceRowsCount: 0,
  page: 1,
  pageSize: 100,
  view: "current",
  sortKey: "overall",
  sortDirection: "desc",
  currentPage: "home",
  manifest: null,
  dataLoaded: false,
  dataAccess: null,
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
  playerNotes: {},
  settingsReceiveEmailsFor: [],
  settingsEmailAddress: "",
  settingsEmailAddressDraft: "",
  settingsDateFormat: "DMY",
  settingsTimeFormat: "24h",
  tablePageStates: {},
  toastTimer: null,
  menuAnimationTimer: null,
  menuOpen: true,
  playerAttributeView: "attributes",
  trainingAdjustments: {},
  searchIndex: [],
  evaluationSearchIndex: [],
  agentSearchIndex: [],
  clubSearchIndex: [],
  searchIndexesLoaded: false,
  incrementalMode: false,
  incrementalApplying: false,
  incrementalRoute: null,
  incrementalTotalRows: 0,
  incrementalSourceRows: 0,
  incrementalLastKey: "",
  incrementalLastLoadedAt: 0,
  incrementalPayloadCache: new Map(),
  incrementalRequestPromises: new Map(),
  recentSearchItems: [],
  recentSearchPlayerIds: [],
  recentSearchAgentWallets: [],
  recentEvaluationPlayerIds: [],
  evaluationPlayerId: null,
  evaluationOverallRows: {},
  evaluationIgnoreDiscountRate: false,
  evaluationIgnoreFirstSeason: false,
  evaluationMflPerUsd: 400,
  evaluationMflPerUsdRevision: 0,
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
  settingsSaveInFlight: false,
  tooltipSuppressedUntil: 0,
  hoveredTablePlayerId: "",
  hoveredTableInteractiveKey: "",
  playerNoteTooltipHideTimer: null,
  playerNoteTooltipText: "",
  walletNotesSaveTimer: null,
  walletPreferencesLoading: false,
  walletPreferencesLoaded: false,
  walletSettingsLoaded: false,
  walletOptInInProgress: false,
  rowSortCache: new WeakMap(),
  walletRows: [],
  walletNamesLoaded: false,
  walletNamesLoadPromise: null,
  mflStatsOverallFilter: "all",
  mflStatsDistributionMode: "overall",
};

function createRenderReuseGuard() {
  let committedSignature = "";
  return Object.freeze({
    matches(nextSignature, structureReady = true) {
      return Boolean(structureReady) && committedSignature === String(nextSignature || "");
    },
    commit(nextSignature) {
      committedSignature = String(nextSignature || "");
    },
    invalidate() {
      committedSignature = "";
    },
  });
}

const canonicalTableConfig = window.__mflAppConfig?.table;
if (!canonicalTableConfig) {
  throw new Error("Application core requires canonical table configuration.");
}
const flagColumn = "nationality_flag";
const baseColumns = canonicalTableConfig.baseColumns;
const statColumns = canonicalTableConfig.statColumns;
const contractColumns = canonicalTableConfig.contractColumns;
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
  database: ["attributes", "contracts", "stats"],
  mfl: ["attributes", "stats"],
  agents: ["attributes", "contracts", "next", "current", "all"],
  progression: ["current", "all"],
  watchlist: ["attributes", "next", "contracts", "current", "all"],
  myplayers: ["attributes", "next", "contracts", "current", "all"],
};
const defaultPageViews = {
  database: "attributes",
  mfl: "attributes",
  agents: "attributes",
  progression: "current",
  watchlist: "current",
  myplayers: "attributes",
};

const viewSlugs = {
  attributes: "attributes",
  next: "next-overall",
  contracts: "contracts",
  current: "current-season",
  all: "all-time",
  stats: "stats",
};
const viewsBySlug = Object.fromEntries(Object.entries(viewSlugs).map(([view, slug]) => [slug, view]));

function viewSlug(viewName) {
  return viewSlugs[viewName] || viewSlugs.current;
}

function viewFromSlug(slug) {
  return viewsBySlug[String(slug || "").trim().toLowerCase()] || "";
}

function defaultViewSlugForPage(pageName) {
  return viewSlug(defaultPageViews[pageName] || "current");
}

const views = {
  attributes: {
    columns: canonicalTableConfig.viewColumns.attributes,
    progressionSuffix: null,
  },
  current: {
    columns: canonicalTableConfig.viewColumns.current,
    progressionSuffix: "prog_current_season",
  },
  all: {
    columns: canonicalTableConfig.viewColumns.all,
    progressionSuffix: "prog_all",
  },
  next: {
    columns: canonicalTableConfig.viewColumns.next,
    progressionSuffix: null,
  },
  contracts: {
    columns: canonicalTableConfig.viewColumns.contracts,
    progressionSuffix: null,
  },
};

const tableColumnClasses = canonicalTableConfig.columnClasses;
const joinedAgencyPageSet = new Set(canonicalTableConfig.joinedAgencyPages);

function joinedAgencyPages() {
  return joinedAgencyPageSet;
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
  listing_price: "Listing",
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
  active_contract_revenue_share: "Rev. Share",
  active_contract_club_name: "Club Name",
  active_contract_club_division: "Division",
  contract_status: "Contract",
  player_link: "",
  ...canonicalTableConfig.columnLabels,
};

const numberColumns = new Set(["player_id", "listing_price", "age", "height", "retirement_years", "player_seasons", "goalkeeping", joinedAgencyColumn, "active_contract_revenue_share", "active_contract_club_division", ...statColumns]);
const sortableColumns = new Set(canonicalTableConfig.sortableColumns);
const contractStatusFilterColumn = "contract_status";
const contractStatusOptions = [
  { value: "under_contract", label: "Under Contract" },
  { value: "free_agent", label: "Free Agent" },
  { value: "development_center", label: "Development Center" },
];
const listingFilterOptions = [
  { value: "for_sale", label: "For Sale" },
  { value: "not_for_sale", label: "Not For Sale" },
];
const baseFilterColumns = ["player_id", "wallet_name", "name", "listing_price", "positions", "age", "player_seasons", "nationality", ...statColumns, contractStatusFilterColumn, "owned_since"];
const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
const GUEST_WATCHLIST_STORAGE_KEY = "mfl-guest-watchlist-v1";
const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
const LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY = "mfl-linked-wallet-display-name-v1";
const AGENT_DISPLAY_NAMES_STORAGE_KEY = "mfl-agent-display-names-v1";
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
const RECENT_AGENT_SEARCH_STORAGE_KEY = "mfl-recent-agent-searches-v1";
const RECENT_MIXED_SEARCH_STORAGE_KEY = "mfl-recent-searches-v1";
const RECENT_EVALUATION_SEARCH_STORAGE_KEY = "mfl-recent-evaluation-searches-v1";
const PLAYER_NOTE_MAX_LENGTH = 100;
const SEARCH_CACHE_VERSION_KEY = "mfl-search-cache-version";
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
const mflStatsPage = document.querySelector("#mflStatsPage");
const mflStatsOverallFilters = document.querySelector("#mflStatsOverallFilters");
const mflStatsTotalPlayers = document.querySelector("#mflStatsTotalPlayers");
const mflStatsPackablePlayers = document.querySelector("#mflStatsPackablePlayers");
const mflStatsAgedPlayers = document.querySelector("#mflStatsAgedPlayers");
const mflStatsOtherPlayers = document.querySelector("#mflStatsOtherPlayers");
const mflStatsDistributionTitle = document.querySelector("#mflStatsDistributionTitle");
const mflStatsDistributionModeButtons = document.querySelector("#mflStatsDistributionModeButtons");
const mflStatsAgeDistribution = document.querySelector("#mflStatsAgeDistribution");
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
const settingsEmailAddressInput = document.querySelector("#settingsEmailAddressInput");
const settingsEmailDiscardButton = document.querySelector("#settingsEmailDiscardButton");
const settingsEmailSaveButton = document.querySelector("#settingsEmailSaveButton");
const settingsEmailOptions = document.querySelector("#settingsEmailOptions");
const changelogPage = document.querySelector("#changelogPage");
const navButtons = document.querySelectorAll(".navButton");
const brandLinks = document.querySelectorAll(".brandLink");
const openSearchButton = document.querySelector("#openSearchButton");
const searchModal = document.querySelector("#searchModal");
const closeSearchButton = document.querySelector("#closeSearchButton");
const playerSearchInput = document.querySelector("#playerSearchInput");
const playerSearchClearButton = document.querySelector("#playerSearchClearButton");
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
const hideMflPlayersFilter = document.querySelector("#hideMflPlayersFilter");
const packablePlayersFilter = document.querySelector("#packablePlayersFilter");
const hideMflPlayersInput = document.querySelector("#hideMflPlayersInput");
const packablePlayersInput = document.querySelector("#packablePlayersInput");
const newMintsInput = document.querySelector("#newMintsInput");
const newMintsLabel = document.querySelector("#newMintsLabel");
const pageSizeSelect = document.querySelector("#pageSizeSelect");
const tableColGroup = document.querySelector("#tableColGroup");
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
const evaluationSearchClearButton = document.querySelector("#evaluationSearchClearButton");
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

function normalizeSettingsTheme(value, fallback = "dark") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "light" || normalized === "dark") return normalized;
  return fallback;
}

function currentMflTheme() {
  return normalizeSettingsTheme(document.documentElement.dataset.theme, "dark");
}

function queueThemePreferenceCloudSync() {
  if (!state.linkedWalletAddress || !hasWalletProof() || !state.walletSettingsLoaded) return;
  window.clearTimeout(state.walletPreferencesSaveTimer);
  state.walletPreferencesSaveTimer = window.setTimeout(() => {
    void saveWalletPreferencesNow();
  }, 0);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.dataset.activeTheme = theme;
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
  applyTheme(savedTheme || document.documentElement.dataset.theme || "dark");
}


async function showUnauthorizedProgressionRedirect() {
  showToast("Not authorised.");
  history.replaceState({}, "", "/");
  return setPage("home", false);
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
  document.body.classList.toggle("guest", state.currentPage === "progression" && !hasProgressionAccess());
  menuRail.hidden = false;
  menuButton.hidden = false;
  sidebar.hidden = false;
  appShell.classList.toggle("menuClosed", !state.menuOpen);
  statusText.hidden = false;
  menuButton.setAttribute("aria-expanded", String(showMenu && state.menuOpen));
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

  return tablePages.has(pageName) || pageName === "mflstats" || pageName === "player" || pageName === "evaluation";
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

  let result;
  if (pageName === "club") {
    const route = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
    const clubId = String(options?.clubId || route?.clubId || "").trim();
    const view = String(options?.view || route?.view || "attributes");
    const navigateClub = window.mflOpenClubPage;
    if (!clubId || typeof navigateClub !== "function") {
      throw new Error("Club navigation gate is unavailable during startup.");
    }
    result = await navigateClub(clubId, view);
  } else {
    result = await setPage(pageName, updateUrl, options);
  }

  syncHomeLoginButton();
  updateMenuVisibility();
  return result;
}

function showAppShell() {
  syncHomeLoginButton();
  updateAccountState();
  updateMenuVisibility();
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
  if (pageName === "mfl" || pageName === "mflstats") {
    return "mfl";
  }

  if (pageName === "progression") {
    return hasProgressionAccess() ? "full" : "public";
  }

  if (pageName === "myplayers") {
    return hasWalletOptIn() ? "owned" : "public";
  }

  if (pageName === "player") {
    return "public";
  }

  if (pageName === "watchlist") {
    return "public";
  }

  return "public";
}

function walletProofHeaders(force = false) {
  if ((!force && ["public", "mfl"].includes(currentDataAccess())) || !hasWalletProof()) {
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

function normalizedAgentName(value) {
  const name = value === null || value === undefined ? "" : String(value).trim();
  return name && name.toUpperCase() !== "NULL" ? name : "";
}


async function loadWalletNames() {
  if (state.walletNamesLoaded) return true;
  if (state.walletNamesLoadPromise) return state.walletNamesLoadPromise;
  const wallet = normalizeWalletAddress(state.linkedWalletAddress).toLowerCase();
  if (!wallet) { state.walletNamesLoaded = true; return true; }
  state.walletNamesLoadPromise = (async () => {
    const q = new URLSearchParams({ mode: "search", type: "recent", walletAddresses: wallet });
    const response = await fetch(`/api/data?${q}`, { cache: "no-store", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return false;
    const agents = payload?.agents || {};
    const columns = Array.isArray(agents.columns) ? agents.columns : [];
    state.walletRows = Array.isArray(agents.rows) ? agents.rows.map((row) => ({
      wallet_address: compactSearchValue(row, columns, "wallet_address"),
      wallet_name: compactSearchValue(row, columns, "wallet_name"),
    })) : [];
    state.walletNamesLoaded = true;
    return true;
  })().catch(() => false).finally(() => { state.walletNamesLoadPromise = null; });
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

  function loadAgentDisplayNames() {
    try {
      const value = JSON.parse(localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function saveAgentDisplayName(address, name) {
    const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
    const agentName = normalizedAgentName(name);
    if (!normalizedAddress || !agentName) return;
    try {
      const next = loadAgentDisplayNames();
      next[normalizedAddress] = agentName;
      localStorage.setItem(AGENT_DISPLAY_NAMES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures; runtime can still resolve names from loaded rows.
    }
    if (state.currentPage === "agents"
      && normalizeWalletAddress(state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase() === normalizedAddress
      && tablePageTitle) {
      tablePageTitle.textContent = `${agentName} - ${normalizedAddress}`;
    }
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

function renderAgentPageTitle(address) {
  if (!tablePageTitle) {
    return;
  }

  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) {
    tablePageTitle.textContent = "";
    return;
  }

  const agentName = savedAgentNameForWallet(normalizedAddress)
    || normalizedAgentName(state.walletRows.find((row) => normalizeWalletAddress(row.wallet_address).toLowerCase() === normalizedAddress)?.wallet_name)
    || normalizedAgentName(state.rows.find((row) => normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase() === normalizedAddress)?.wallet_name);

  const addressButton = document.createElement("button");
  addressButton.type = "button";
  addressButton.className = "agentPageTitleWallet";
  addressButton.dataset.agentWalletCopy = normalizedAddress;
  addressButton.dataset.noteTooltip = "Click to copy wallet address";
  addressButton.setAttribute("aria-label", "Click to copy wallet address");
  addressButton.textContent = normalizedAddress;

  const nameSpan = document.createElement("span");
  nameSpan.className = "agentPageTitleName";
  nameSpan.textContent = agentName || "";

  if (agentName) {
    tablePageTitle.replaceChildren(nameSpan, document.createTextNode(" - "), addressButton);
    return;
  }

  tablePageTitle.replaceChildren(addressButton);
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
  accountEmail.disabled = !walletLinked;
  accountEmail.title = walletLinked ? "Open My Players" : "";
  linkWalletButton.textContent = walletLinked ? "Opt Out" : "Opt In";
  linkWalletButton.disabled = state.walletOptInInProgress;
  linkWalletButton.classList.toggle("walletOptOut", walletLinked);
  linkWalletButton.removeAttribute("title");
  if (accountSettingsButton) {
    accountSettingsButton.hidden = !walletLinked;
  }
  updateEvaluationFooterActions();
  if (evaluationLoadButton) {
    const evaluationRouteSelected = Boolean(
      state.evaluationPlayerId || evaluationPlayerIdFromUrl() || evaluationSavedIdFromUrl() || evaluationShareIdFromUrl()
    );
    evaluationLoadButton.hidden = evaluationRouteSelected || !walletLinked;
    evaluationButtons.hidden = evaluationRouteSelected ? false : !walletLinked;
  }
  syncHomeLoginButton();
}

function optOutWallet() {
  const previousWalletAddress = state.linkedWalletAddress;
  clearWalletNotesState();
  state.linkedWalletAddress = "";
  state.linkedWalletProof = null;
  state.walletPermissionAllowed = false;
  state.walletSettingsLoaded = false;

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
    const targetPath = pagePath("watchlist", { view: defaultViewForPage("watchlist") });
    if (`${window.location.pathname}${window.location.search}` !== targetPath) {
      window.history.replaceState({}, "", targetPath);
    }
    setPage("watchlist", false, { plain: true, view: defaultViewForPage("watchlist") });
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
    state.walletSettingsLoaded = false;
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
    if ((state.currentPage === "myplayers" || state.currentPage === "watchlist" || state.currentPage === "settings") && !myPlayersLockedPage.hidden) {
      const lockedPage = state.currentPage;
      const lockedMyPlayersTarget = lockedPage === "myplayers"
        ? tablePageTarget("myplayers", window.location.pathname, "/my-players")
        : null;
      const lockedView = lockedMyPlayersTarget?.options?.view || "attributes";
      await setPage(lockedPage, false, { view: lockedView });
      if (lockedPage === "myplayers") {
        const targetPath = "/my-players/" + viewSlug(lockedView);
        if (window.location.pathname !== targetPath) {
          window.history.replaceState({}, "", targetPath);
        }
      } else if (lockedPage === "watchlist") {
        const watchlistId = state.currentWatchlistId || activeWatchlist()?.id || "";
        const targetPath = watchlistId
          ? `/watchlist/${encodeURIComponent(watchlistId)}/attributes`
          : "/watchlist/attributes";
        window.history.replaceState({}, "", targetPath);
      }
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

async function recoverInvalidEvaluationLink() {
  if (window.location.pathname !== "/evaluation") {
    return false;
  }

  if (!evaluationSavedIdFromUrl() && !evaluationShareIdFromUrl()) {
    return false;
  }

  const candidatePlayerId = String(evaluationPlayerIdFromUrl() || state.evaluationPlayerId || "").trim();
  let playerRow = candidatePlayerId ? rowByPlayerId(candidatePlayerId) : null;

  if (candidatePlayerId && !playerRow) {
    try {
      await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: candidatePlayerId,
      }, 1, { force: true });
      playerRow = rowByPlayerId(candidatePlayerId);
    } catch {
      playerRow = null;
    }
  }

  const playerId = playerRow ? candidatePlayerId : "";
  state.evaluationSavedId = "";
  state.evaluationShareId = "";
  state.evaluationPlayerId = playerId || null;

  if (playerId) {
    window.history.replaceState({}, "", basicEvaluationPathForPlayer(playerId));
  } else {
    state.evaluationOverallRows = {};
    state.evaluationSummaryPositions = {};
    evaluationSearchInput.value = "";
    window.history.replaceState({}, "", "/evaluation");
    document.documentElement.dataset.initialEvaluationSelection = "false";
    renderEmptyEvaluationSelection(true, true);
    syncEvaluationSearchClearButton();
  }

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

async function applySharedEvaluationPayload(payload, options = {}) {
  const data = normalizeSharedEvaluationPayload(payload);
  const mflPerUsdRevisionAtLoadStart = Number.isInteger(options.mflPerUsdRevisionAtLoadStart)
    ? options.mflPerUsdRevisionAtLoadStart
    : state.evaluationMflPerUsdRevision;
  const latestMflPerUsd = state.evaluationMflPerUsd;

  if (!data.playerId) {
    throw new Error("Evaluation player is not available.");
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

  if (state.evaluationMflPerUsdRevision !== mflPerUsdRevisionAtLoadStart) {
    state.evaluationMflPerUsd = latestMflPerUsd;
  }

  renderEvaluationMflPerUsdControl(false);
  await renderEvaluationPage();
}

async function loadSharedEvaluation(shareId) {
  const id = String(shareId || "").trim();
  const playerId = String(evaluationPlayerIdFromUrl() || "").trim();

  if (!id || state.evaluationShareLoading) {
    return;
  }

  state.evaluationShareLoading = true;
  const evaluationMflPerUsdRevisionAtLoadStart = state.evaluationMflPerUsdRevision;

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
    const payloadPlayerId = String(data?.payload?.playerId || playerId || "").trim();
    if (payloadPlayerId && !rowByPlayerId(payloadPlayerId)) {
      const playerPayload = await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: payloadPlayerId,
      }, 1, { force: true });
      if (!playerPayload) throw new Error("Evaluation player is not available.");
    }
    state.evaluationShareId = id;
    await applySharedEvaluationPayload(data.payload, {
      mflPerUsdRevisionAtLoadStart: evaluationMflPerUsdRevisionAtLoadStart,
    });
  } catch {
    showToast("Shared evaluation has expired or could not be loaded.");
    await recoverInvalidEvaluationLink();
    await renderEvaluationPage();
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


function savedEvaluationCacheWallet() {
  return normalizeWalletAddress(state.linkedWalletAddress).toLowerCase();
}

function ensureSavedEvaluationCacheWallet() {
  const wallet = savedEvaluationCacheWallet();
  if (String(window.__mflSavedEvaluationsSessionCacheWallet || "") !== wallet) {
    window.__mflSavedEvaluationsSessionCacheWallet = wallet;
    window.__mflSavedEvaluationsSessionCache = null;
    window.__mflSavedEvaluationPayloadCache = Object.create(null);
  }
  return wallet;
}

function savedEvaluationPayloadCache() {
  ensureSavedEvaluationCacheWallet();
  const cache = window.__mflSavedEvaluationPayloadCache;
  if (cache && typeof cache === "object" && !Array.isArray(cache)) return cache;
  const nextCache = Object.create(null);
  window.__mflSavedEvaluationPayloadCache = nextCache;
  return nextCache;
}

function rememberSavedEvaluationCacheEntry(entry) {
  const id = String(entry?.id || "").trim();
  if (!id || !entry?.payload) return null;
  const playerId = String(entry?.playerId || entry?.payload?.playerId || "").trim();
  const playerRow = playerId ? rowByPlayerId(playerId) : null;
  const cache = savedEvaluationPayloadCache();
  const cachedEntry = cache[id] || null;
  const computedPresentValue = evaluationPresentValueTotalFromPayload(entry.payload);
  const normalizedEntry = {
    ...entry,
    id,
    playerId,
    playerName: String(entry?.playerName || cachedEntry?.playerName || (playerRow ? formatCellValue(playerRow, "name") : "")).trim(),
    presentValue: Number.isFinite(entry?.presentValue)
      ? entry.presentValue
      : (Number.isFinite(cachedEntry?.presentValue)
        ? cachedEntry.presentValue
        : (Number.isFinite(computedPresentValue) ? computedPresentValue : null)),
  };
  cache[id] = normalizedEntry;
  return normalizedEntry;
}

function cachedSavedEvaluationEntry(savedId) {
  const id = String(savedId || "").trim();
  if (!id) return null;
  ensureSavedEvaluationCacheWallet();
  const list = window.__mflSavedEvaluationsSessionCache;
  if (Array.isArray(list)) {
    const listEntry = list.find((entry) => String(entry?.id || "").trim() === id) || null;
    if (listEntry?.payload) return rememberSavedEvaluationCacheEntry(listEntry);
  }
  return savedEvaluationPayloadCache()[id] || null;
}

function showSavedEvaluationPlayerName(entry, fallbackPlayerId = "") {
  const playerId = String(entry?.playerId || entry?.payload?.playerId || fallbackPlayerId || "").trim();
  const playerRow = playerId ? rowByPlayerId(playerId) : null;
  const playerName = String(entry?.playerName || (playerRow ? formatCellValue(playerRow, "name") : "")).trim();
  if (playerName) evaluationSearchInput.value = playerName;
  return playerName;
}

function rememberSavedEvaluationList(entries) {
  ensureSavedEvaluationCacheWallet();
  const list = Array.isArray(entries)
    ? entries.map((entry) => rememberSavedEvaluationCacheEntry(entry) || entry)
    : [];
  window.__mflSavedEvaluationsSessionCache = list;
  return list;
}

function savedEvaluationListCache() {
  const wallet = ensureSavedEvaluationCacheWallet();
  return wallet && Array.isArray(window.__mflSavedEvaluationsSessionCache)
    ? window.__mflSavedEvaluationsSessionCache
    : null;
}

function invalidateSavedEvaluationCache() {
  ensureSavedEvaluationCacheWallet();
  window.__mflSavedEvaluationsSessionCache = null;
  window.__mflSavedEvaluationPayloadCache = Object.create(null);
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

  invalidateSavedEvaluationCache();
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
  const evaluationMflPerUsdRevisionAtLoadStart = state.evaluationMflPerUsdRevision;

  try {
    const selectedPlayerId = String(playerId || evaluationPlayerIdFromUrl() || "").trim();
    let data = cachedSavedEvaluationEntry(id);
    showSavedEvaluationPlayerName(data, selectedPlayerId);

    if (!data) {
      const requestUrl = new URL("/api/evaluation-save", window.location.origin);
      requestUrl.searchParams.set("id", id);
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

      data = await response.json();
      rememberSavedEvaluationCacheEntry(data);
      showSavedEvaluationPlayerName(data, selectedPlayerId);
    }

    const payloadPlayerId = String(data?.payload?.playerId || selectedPlayerId || "").trim();
    if (payloadPlayerId && !rowByPlayerId(payloadPlayerId)) {
      const playerPayload = await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: payloadPlayerId,
      }, 1, { force: true });
      if (!playerPayload) throw new Error("Evaluation player is not available.");
    }
    data = rememberSavedEvaluationCacheEntry(data) || data;
    state.evaluationSavedId = id;
    state.evaluationShareId = "";
    updateEvaluationFooterActions();
    clearEvaluationSearchFocus();
    await applySharedEvaluationPayload(data.payload, {
      mflPerUsdRevisionAtLoadStart: evaluationMflPerUsdRevisionAtLoadStart,
    });
  } catch {
    showToast("Saved evaluation could not be loaded.");
    await recoverInvalidEvaluationLink();
    updateEvaluationFooterActions();
    await renderEvaluationPage();
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
  if (!Number.isFinite(discountRate)) return null;
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

  invalidateSavedEvaluationCache();
  return true;
}


let evaluationLoadFloatingTooltip = null;
let evaluationLoadTooltipHideTimer = null;

function hideEvaluationLoadActionTooltip() {
  if (evaluationLoadTooltipHideTimer) {
    window.clearTimeout(evaluationLoadTooltipHideTimer);
    evaluationLoadTooltipHideTimer = null;
  }
  if (!evaluationLoadFloatingTooltip) return;
  const tooltip = evaluationLoadFloatingTooltip;
  evaluationLoadFloatingTooltip = null;
  tooltip.classList.remove("visible");
  tooltip.classList.add("tooltipHiding");
  evaluationLoadTooltipHideTimer = window.setTimeout(() => {
    tooltip.remove();
    evaluationLoadTooltipHideTimer = null;
  }, 170);
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
  const tooltipHeight = Number(window.__mflTooltipHeight) || 6;
  const top = Math.max(8, rect.top - tooltipRect.height - tooltipHeight);

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
    name.textContent = row
      ? formatCellValue(row, "name")
      : (String(entry?.playerName || "").trim() || `Player ${playerId}`);
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
    ].filter(Boolean).join(" \u00b7 ");
    main.append(name, details);

    const value = document.createElement("strong");
    value.className = "evaluationLoadPresentValue";
    const presentValue = Number.isFinite(entry?.presentValue)
      ? entry.presentValue
      : evaluationPresentValueTotalFromPayload(entry.payload);
    value.textContent = Number.isFinite(presentValue) ? formatEvaluationCurrency(presentValue) : "-";

    const actions = document.createElement("span");
    actions.className = "evaluationLoadActions";

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.className = "evaluationLoadIconButton evaluationLoadShareButton";
    shareButton.setAttribute("aria-label", "Share saved evaluation");
    shareButton.dataset.tooltip = "Share";
    shareButton.innerHTML = '<svg viewBox="1.8 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 10.8 15.4 6.2"></path><path d="M8.6 13.2 15.4 17.8"></path></svg>';

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "evaluationLoadIconButton evaluationLoadDeleteButton";
    deleteButton.setAttribute("aria-label", "Delete saved evaluation");
    deleteButton.dataset.tooltip = "Delete";
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>';

    attachEvaluationLoadActionTooltip(shareButton);
    attachEvaluationLoadActionTooltip(deleteButton);

    const loadEvaluation = async () => {
      clearEvaluationSearchFocus();
      const savedId = String(entry.id || "").trim();
      showSavedEvaluationPlayerName(entry, playerId);
      const url = new URL("/evaluation", window.location.origin);
      url.searchParams.set("player", playerId);
      url.searchParams.set("saved", savedId);
      window.history.replaceState({}, "", url.toString());
      hideModal(evaluationLoadModal);
      await loadSavedEvaluation(savedId, playerId);
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
  const cachedEvaluations = savedEvaluationListCache();
  if (cachedEvaluations) {
    renderSavedEvaluationList(cachedEvaluations);
    return;
  }

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
    const evaluations = Array.isArray(data.evaluations) ? data.evaluations : [];
    const playerIds = Array.from(new Set(evaluations
      .map((entry) => String(entry?.payload?.playerId || entry?.playerId || entry?.player_id || "").trim())
      .filter(Boolean)));

    if (playerIds.length) {
      await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "players",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerIds,
      }, 1, { force: true });
    }

    const rememberedEvaluations = rememberSavedEvaluationList(evaluations);
    renderSavedEvaluationList(rememberedEvaluations);
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

function watchlistTargetFromUrl(pathName = window.location.pathname) {
  const match = String(pathName || "").match(/^\/watchlist(?:\/([^/]+))?(?:\/([^/]+))?$/);

  if (!match) {
    return { watchlistId: "", view: "" };
  }

  const firstSegment = decodeURIComponent(match[1] || "");
  const secondSegment = decodeURIComponent(match[2] || "");
  const firstView = viewFromSlug(firstSegment);

  if (firstView) {
    return { watchlistId: "", view: firstView };
  }

  return {
    watchlistId: firstSegment,
    view: viewFromSlug(secondSegment),
  };
}

function watchlistIdFromUrl() {
  return watchlistTargetFromUrl().watchlistId;
}

function agentTargetFromUrl(pathName = window.location.pathname) {
  const match = String(pathName || "").match(/^\/agents\/([^/]+)(?:\/([^/]+))?$/);

  if (!match) {
    return { walletAddress: "", view: "" };
  }

  return {
    walletAddress: normalizeWalletAddress(decodeURIComponent(match[1])).toLowerCase(),
    view: viewFromSlug(decodeURIComponent(match[2] || "")),
  };
}

function agentWalletAddressFromUrl() {
  return agentTargetFromUrl().walletAddress;
}

function tablePageTarget(pageName, cleanPath, basePath) {
  const match = cleanPath.match(new RegExp(`^${basePath}(?:/([^/]+))?$`));

  if (!match) {
    return null;
  }

  const view = viewFromSlug(decodeURIComponent(match[1] || ""));
  const normalizedView = normalizeViewForPage(view, pageName);
  const canonicalPath = `${basePath}/${viewSlug(normalizedView)}`;

  return {
    pageName,
    options: {
      view: normalizedView,
      ...(cleanPath !== canonicalPath ? { replaceUrl: canonicalPath } : {}),
    },
  };
}

function pageTargetFromPath(path) {
  const requestedPath = String(path || "");
  const cleanPath = requestedPath.split("?")[0];

  if (cleanPath === "/evaluation") {
    const queryIndex = requestedPath.indexOf("?");
    const search = queryIndex >= 0 ? requestedPath.slice(queryIndex + 1) : "";
    const params = new URLSearchParams(search);
    const playerId = String(params.get("player") || "").trim();
    const savedId = String(params.get("saved") || "").trim();
    const shareId = String(params.get("share") || "").trim();
    const queryKeys = Array.from(params.keys());
    const validQueryKeys = queryKeys.every((key) => key === "player" || key === "saved" || key === "share");
    const hasEvaluationSelection = Boolean(playerId || savedId || shareId);

    if (search && (!validQueryKeys || !hasEvaluationSelection)) {
      return {
        pageName: "evaluation",
        options: {
          plain: true,
          replaceUrl: "/evaluation",
        },
      };
    }

    return {
      pageName: "evaluation",
      options: {
        path: search ? `/evaluation?${search}` : "/evaluation",
        ...(playerId ? { playerId } : {}),
        ...(savedId ? { savedId } : {}),
        ...(shareId ? { shareId } : {}),
      },
    };
  }

  if (!hasWalletOptIn()) {
    if (/^\/my-players(?:\/[^/]+)?$/.test(cleanPath)) {
      const myPlayersTarget = tablePageTarget("myplayers", cleanPath, "/my-players");
      if (myPlayersTarget) return myPlayersTarget;
      return { pageName: "myplayers", options: {} };
    }

    if (/^\/watchlist(?:\/[^/]+)?(?:\/[^/]+)?$/.test(cleanPath)) {
      return {
        pageName: "watchlist",
        options: cleanPath === "/watchlist" ? {} : { replaceUrl: "/watchlist" },
      };
    }
  }
  if (cleanPath === "/players" || cleanPath === "/agents") {
    return {
      pageName: "home",
      options: { replaceUrl: "/" },
    };
  }

  const playerMatch = cleanPath.match(/^\/players\/([^/]+)$/);
  const clubRoute = window.__mflAppConfig?.routes?.clubRoute?.(cleanPath);

  if (clubRoute) {
    return {
      pageName: "club",
      options: {
        clubId: clubRoute.clubId,
        view: clubRoute.view,
        path: clubRoute.path,
      },
    };
  }

  if (cleanPath === "/mfl/stats") {
    return {
      pageName: "mfl",
      options: { view: "stats" },
    };
  }

  if (playerMatch) {
    return {
      pageName: "player",
      options: { playerId: decodeURIComponent(playerMatch[1]) },
    };
  }

  for (const [pageName, basePath] of [["database", "/database"], ["mfl", "/mfl"], ["progression", "/progression"], ["myplayers", "/my-players"]]) {
    const target = tablePageTarget(pageName, cleanPath, basePath);
    if (target) {
      return target;
    }
  }

  const watchlistMatch = cleanPath.match(/^\/watchlist(?:\/[^/]+)?(?:\/[^/]+)?$/);

  if (watchlistMatch) {
    const target = watchlistTargetFromUrl(cleanPath);
    const normalizedView = normalizeViewForPage(target.view, "watchlist");
    const canonicalPath = target.watchlistId
      ? `/watchlist/${encodeURIComponent(target.watchlistId)}/${viewSlug(normalizedView)}`
      : `/watchlist/${viewSlug(normalizedView)}`;
    return {
      pageName: "watchlist",
      options: {
        watchlistId: target.watchlistId,
        view: normalizedView,
        ...(cleanPath !== canonicalPath ? { replaceUrl: canonicalPath } : {}),
      },
    };
  }

  const agentMatch = cleanPath.match(/^\/agents\/([^/]+)(?:\/([^/]+))?$/);

  if (agentMatch) {
    const walletAddress = normalizeWalletAddress(decodeURIComponent(agentMatch[1])).toLowerCase();
    const normalizedView = normalizeViewForPage(viewFromSlug(decodeURIComponent(agentMatch[2] || "")), "agents");
    if (walletAddress === mflWalletAddress) {
      const canonicalPath = `/mfl/${viewSlug(normalizeViewForPage(normalizedView, "mfl"))}`;
      return {
        pageName: "mfl",
        options: { view: normalizeViewForPage(normalizedView, "mfl"), replaceUrl: canonicalPath },
      };
    }

    const canonicalPath = `/agents/${encodeURIComponent(walletAddress)}/${viewSlug(normalizedView)}`;
    return {
      pageName: "agents",
      options: {
        walletAddress,
        view: normalizedView,
        ...(cleanPath !== canonicalPath ? { replaceUrl: canonicalPath } : {}),
      },
    };
  }

  const pageName = normalizedPageName(cleanPath.replace(/^\//, "") || "home");
  return {
    pageName: ["home", "evaluation", "settings", "changelog"].includes(pageName) ? pageName : "home",
    options: {},
  };
}

function pagePath(pageName, options = {}) {
  if (pageName === "club") {
    const routeConfig = window.__mflAppConfig?.routes;
    const currentClubRoute = routeConfig?.clubRoute?.(window.location.pathname);
    const clubId = String(options.clubId || currentClubRoute?.clubId || "").trim();
    const clubView = String(options.view || currentClubRoute?.view || state.view || "attributes").trim().toLowerCase();
    const clubPath = clubId ? routeConfig?.clubPath?.(clubId, clubView) : "";
    return clubPath || window.location.pathname;
  }
  if (pageName === "player") {
    const playerId = options.playerId || playerIdFromUrl();
    return playerId ? `/players/${encodeURIComponent(playerId)}` : window.location.pathname;
  }

  if (pageName === "evaluation") {
    if (options.plain) {
      return "/evaluation";
    }

    const explicitPath = String(options.path || "");
    if (explicitPath === "/evaluation" || explicitPath.startsWith("/evaluation?")) {
      return explicitPath;
    }

    const playerId = options.playerId || evaluationPlayerIdFromUrl();
    return playerId ? `/evaluation?player=${encodeURIComponent(playerId)}` : "/evaluation";
  }

  if (pageName === "mflstats") {
    return "/mfl/stats";
  }

  if (!hasWalletOptIn()) {
    if (pageName === "watchlist") return "/watchlist";
    if (pageName === "myplayers") return "/my-players";
  }

  if (tablePages.has(pageName)) {
    const viewName = normalizeViewForPage(options.view || (pageName === state.currentPage ? state.view : defaultViewForPage(pageName)), pageName);
    const slug = viewSlug(viewName);

    if (pageName === "watchlist") {
      const watchlistId = options.watchlistId || state.currentWatchlistId || watchlistIdFromUrl();
      return watchlistId ? `/watchlist/${encodeURIComponent(watchlistId)}/${slug}` : `/watchlist/${slug}`;
    }

    if (pageName === "agents") {
      const walletAddress = normalizeWalletAddress(options.walletAddress || state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase();
      if (walletAddress === mflWalletAddress) {
        return `/mfl/${viewSlug(normalizeViewForPage(viewName, "mfl"))}`;
      }
      return walletAddress ? `/agents/${encodeURIComponent(walletAddress)}/${slug}` : "/";
    }

    if (pageName === "myplayers") {
      return `/my-players/${slug}`;
    }

    return `/${pageName}/${slug}`;
  }

  return pageName === "home" ? "/" : `/${pageName}`;
}

function updatePageUrl(pageName, options = {}) {
  if (state.currentPage === "club" && pageName !== "club") {
    return;
  }
  if (!options.updateUrl) {
    return;
  }

  const targetPath = pagePath(pageName, options);
  if (`${window.location.pathname}${window.location.search}` !== targetPath) {
    window.history.pushState({}, "", targetPath);
  }
}
let pendingViewTransition = null;
let navigationTransitionSequence = 0;

function currentNavigationPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function commitViewTransition(pageName, viewName, options = {}) {
  const nextView = String(viewName || "");
  if (!nextView) return "";

  const statePageName = String(
    options.statePageName
    || (pageName === "mfl" && nextView === "stats" ? "mflstats" : pageName)
    || state.currentPage
  );

  state.currentPage = statePageName;
  state.view = nextView;
  state.page = 1;

  if (Object.prototype.hasOwnProperty.call(options, "sortKey")) state.sortKey = options.sortKey;
  if (Object.prototype.hasOwnProperty.call(options, "sortDirection")) state.sortDirection = options.sortDirection;

  let targetPath = String(options.path || "");
  if (!targetPath) {
    targetPath = pageName === "mfl" && nextView === "stats"
      ? "/mfl/stats"
      : pagePath(pageName, {
          ...options,
          view: nextView,
          walletAddress: options.walletAddress || state.currentAgentWalletAddress,
          watchlistId: options.watchlistId || state.currentWatchlistId,
        });
  }

  if (targetPath && currentNavigationPath() !== targetPath) {
    window.history[options.replace ? "replaceState" : "pushState"]({}, "", targetPath);
  }

  updateViewButtons();
  window.__mflStaticUiRuntime?.sync?.();
  return nextView;
}

function commitPageTransition(pageName, updateHash = true, options = {}) {
  const requestedPageName = String(pageName || "home");
  const routePageName = requestedPageName === "mflstats" ? "mfl" : requestedPageName;
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredViews = viewConfig && typeof viewConfig === "object" && Array.isArray(viewConfig?.[routePageName]?.order)
    ? viewConfig[routePageName].order
    : null;
  const nextView = requestedPageName === "mflstats"
    ? "stats"
    : configuredViews
      ? normalizeViewForPage(options.view || preferredViewForPage(routePageName), routePageName)
      : "";
  const statePageName = routePageName === "mfl" && nextView === "stats" ? "mflstats" : requestedPageName;

  pendingViewTransition = null;
  state.currentPage = statePageName;
  if (nextView) state.view = nextView;
  state.page = 1;
  if (Object.prototype.hasOwnProperty.call(options, "sortKey")) state.sortKey = options.sortKey;
  if (Object.prototype.hasOwnProperty.call(options, "sortDirection")) state.sortDirection = options.sortDirection;
  document.body.dataset.page = routePageName;

  const targetPath = String(options.path || options.replaceUrl || pagePath(routePageName, {
    ...options,
    ...(nextView ? { view: nextView } : {}),
  }));
  const replaceRoute = Boolean(options.replace || options.replaceUrl);
  const currentPath = currentNavigationPath();
  if (targetPath && currentPath !== targetPath && (updateHash || replaceRoute)) {
    window.history[replaceRoute ? "replaceState" : "pushState"]({}, "", targetPath);
  }

  window.__mflStaticUiRuntime?.sync?.();
  return { pageName: routePageName, viewName: nextView, targetPath };
}

function stageViewTransition(pageName, viewName, options = {}) {
  const nextView = String(viewName || "");
  if (!nextView) return null;

  const transition = {
    kind: "view",
    sequence: ++navigationTransitionSequence,
    pageName: String(pageName || ""),
    viewName: nextView,
    previousCurrentPage: state.currentPage,
    previousView: state.view,
    previousPage: state.page,
    previousSortKey: state.sortKey,
    previousSortDirection: state.sortDirection,
    previousPath: currentNavigationPath(),
    targetPath: "",
  };
  pendingViewTransition = transition;
  commitViewTransition(pageName, nextView, options);
  transition.targetPath = currentNavigationPath();
  return transition;
}

function stagedViewTransitionIsCurrent(transition) {
  return Boolean(
    transition
    && transition.kind === "view"
    && transition.sequence === navigationTransitionSequence
    && pendingViewTransition === transition
    && state.view === transition.viewName
    && currentNavigationPath() === transition.targetPath
  );
}

function pageTransitionIsCurrent(transition) {
  return Boolean(
    transition
    && transition.kind === "page"
    && transition.sequence === navigationTransitionSequence
    && (!transition.targetPath || currentNavigationPath() === transition.targetPath)
  );
}

function navigationTransitionIsCurrent(transition) {
  if (!transition) return true;
  return transition.kind === "view"
    ? stagedViewTransitionIsCurrent(transition)
    : pageTransitionIsCurrent(transition);
}

function pageNavigationIsCurrent(options = {}) {
  const transition = options && typeof options === "object"
    ? options.__mflNavigationTransition
    : null;
  return !transition || navigationTransitionIsCurrent(transition);
}

function takeStagedViewTransition(pageName, viewName) {
  const transition = pendingViewTransition;
  if (
    !transition
    || transition.pageName !== String(pageName || "")
    || transition.viewName !== String(viewName || "")
  ) return null;
  return stagedViewTransitionIsCurrent(transition) ? transition : null;
}

function waitForViewTransitionPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

let evaluationReadinessBusyToken = "";

function releaseEvaluationReadinessBusy() {
  const token = evaluationReadinessBusyToken;
  evaluationReadinessBusyToken = "";
  if (token) window.__mflInteractionBusy?.end?.(token);
  return Boolean(token);
}

async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {
  const navigation = Reflect.get(window, "__mflNavigation");
  const loadingController = Reflect.get(window, "__mflInteractionBusy");
  if (pageName !== "evaluation") {
    releaseEvaluationReadinessBusy();
    document.body.classList.remove("evaluationPageLoading");
  }
  const navigationToken = typeof navigation?.beginLatest === "function"
    ? navigation.beginLatest("page-transition")
    : typeof navigation?.begin === "function"
      ? navigation.begin("page-transition")
      : "";
  let loadingToken = "";
  try {
    const sequence = ++navigationTransitionSequence;
    window.__mflCancelIncrementalRouteRequest?.();
    const transition = {
      ...commitPageTransition(pageName, updateHash, options),
      kind: "page",
      sequence,
    };
    document.documentElement.classList.add("mflInitialRouteSuperseded");
    loadingToken = loadingController?.beginRouteTransition?.(pageName, options) || "";
    await waitForViewTransitionPaint();
    if (!pageTransitionIsCurrent(transition)) return null;
    const result = typeof loader === "function" ? await loader(transition) : transition;
    if (!pageTransitionIsCurrent(transition)) return null;
    if (loadingToken) await waitForViewTransitionPaint();
    return result;
  } finally {
    if (loadingToken) loadingController?.end?.(loadingToken);
    if (navigationToken) navigation?.end?.(navigationToken);
  }
}

async function runViewTransition(pageName, viewName, options = {}, loader = null) {
  const navigation = Reflect.get(window, "__mflNavigation");
  const loadingController = Reflect.get(window, "__mflInteractionBusy");
  const navigationToken = typeof navigation?.beginLatest === "function"
    ? navigation.beginLatest("view-transition")
    : typeof navigation?.begin === "function"
      ? navigation.begin("view-transition")
      : "";
  let loadingToken = "";
  try {
    window.__mflCancelIncrementalRouteRequest?.();
    const transition = stageViewTransition(pageName, viewName, options);
    if (!transition) return null;
    document.documentElement.classList.add("mflInitialRouteSuperseded");
    loadingToken = loadingController?.beginRouteTransition?.(pageName, {
      ...options,
      view: viewName,
    }) || "";
    await waitForViewTransitionPaint();
    if (!stagedViewTransitionIsCurrent(transition)) return null;
    if (typeof loader === "function") {
      try {
        const result = await loader(transition);
        if (!stagedViewTransitionIsCurrent(transition)) return null;
        if (loadingToken) await waitForViewTransitionPaint();
        return result;
      } finally {
        if (pendingViewTransition === transition) pendingViewTransition = null;
      }
    }
    if (loadingToken) await waitForViewTransitionPaint();
    return transition;
  } finally {
    if (loadingToken) loadingController?.end?.(loadingToken);
    if (navigationToken) navigation?.end?.(navigationToken);
  }
}

Reflect.set(window, "__mflCommitViewTransition", commitViewTransition);
Reflect.set(window, "__mflCommitPageTransition", commitPageTransition);
Reflect.set(window, "__mflRunViewTransition", runViewTransition);
Reflect.set(window, "__mflRunPageTransition", runPageTransition);
Reflect.set(window, "__mflNavigationTransitionIsCurrent", navigationTransitionIsCurrent);
Reflect.set(window, "__mflWaitForViewTransitionPaint", waitForViewTransitionPaint);

function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  if (mainContent) {
    mainContent.scrollTop = 0;
  }
}

let evaluationPageCacheReady = false;

function preparePlainEvaluationReentry() {
  const routeParams = new URLSearchParams(window.location.search);
  const hadEvaluationSelection = Boolean(
    state.evaluationPlayerId
    || state.evaluationSavedId
    || state.evaluationShareId
    || (window.location.pathname === "/evaluation" && (
      routeParams.get("player")
      || routeParams.get("saved")
      || routeParams.get("share")
    ))
  );
  const clearSearchInput = evaluationPageCacheReady || hadEvaluationSelection;
  state.evaluationShareId = "";
  state.evaluationSavedId = "";
  state.evaluationPlayerId = null;
  state.evaluationOverallRows = {};
  state.evaluationSummaryPositions = {};
  if (clearSearchInput) {
    evaluationSearchInput.value = "";
  }
  renderEmptyEvaluationSelection(false, true);
  syncEvaluationSearchClearButton();
}

function tableTitleForPage(pageName) {
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
  }

  updateViewButtons();
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
async function setPage(pageName, updateHash = true, options = {}) {
  if (!pageNavigationIsCurrent(options)) return null;
  const plainEvaluationEntry = pageName === "evaluation" && (options.plain || isPlainEvaluationUrl());
  if (plainEvaluationEntry) preparePlainEvaluationReentry();
  if (pageName === "home") void loadSummary();
  if (pageName === "mfl" && normalizeViewForPage(options.view, "mfl") === "stats") {
    await setPage("mflstats", updateHash, { ...options, replaceUrl: options.replaceUrl || "/mfl/stats" });
    return;
  }

  const previousPage = state.currentPage;
  const shouldResetScroll = previousPage !== pageName;
  if (previousPage === "settings" && pageName !== "settings") {
    discardSettingsEmailAddressDraftSilently();
  }
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
    mflStatsPage.hidden = true;
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

  const tablePage = tablePages.has(pageName);
  const mflStatsActive = pageName === "mflstats";
  const playerPageActive = pageName === "player";
  const evaluationPageActive = pageName === "evaluation";
  const settingsPageActive = pageName === "settings";
  if (options.__mflPreviousTableStateSaved !== true) {
    const previousTablePage = tablePageKey();
    if (previousTablePage) {
      state.tablePageStates[previousTablePage] = currentTablePageState();
      saveTableState();
    }
  }


  if ((tablePage || mflStatsActive || playerPageActive || evaluationPageActive) && !state.dataLoaded) {
    state.currentPage = pageName;
    homePage.hidden = true;
    progressionPage.hidden = !tablePage;
    mflStatsPage.hidden = !mflStatsActive;
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

    const loaded = await ensureProgressionData();

    if (!pageNavigationIsCurrent(options)) return null;


    if (!loaded) {
      return;
    }
  }

  if (pageName === "watchlist" && hasWalletOptIn()) {
    state.currentPage = pageName;
    state.pendingWatchlistRouteId = options.watchlistId || watchlistIdFromUrl() || "";
    await ensureWatchlistRoute(options);
    if (!pageNavigationIsCurrent(options)) return null;
  }

  if (!pageNavigationIsCurrent(options)) return null;
  state.currentPage = pageName;
  homePage.hidden = pageName !== "home";
  progressionPage.hidden = !tablePage;
  mflStatsPage.hidden = !mflStatsActive;
  myPlayersLockedPage.hidden = true;
  evaluationPage.hidden = !evaluationPageActive;
  playerPage.hidden = !playerPageActive;
  settingsPage.hidden = !settingsPageActive;
  changelogPage.hidden = pageName !== "changelog";
  tablePageTitle.textContent = tableTitleForPage(pageName);
  renderWatchlistSwitcher();
  if (tablePage) {
    restoreSavedTableState(pageName, { view: options.view });
    syncRestoredTableControls(pageName);
    updateViewButtons();
    buildHeader();
  }
  globalThis.syncQuickFilterLabels?.();
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

  if (mflStatsActive) {
    state.view = "stats";
    rememberMflStatsView();
    updateViewButtons();
    renderMflStatsPage();
    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.page === "mfl");
    });
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }

    syncHomeLoginButton();
    if (shouldResetScroll) {
      resetPageScroll();
    }

    return;
  }

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
    const plainEvaluationRoute = options.plain || isPlainEvaluationUrl();
    const cachedEvaluationReentry = plainEvaluationRoute
      && options.reuseCachedRoute === true
      && evaluationPageCacheReady;
    const evaluationBusyToken = cachedEvaluationReentry
      ? ""
      : window.__mflInteractionBusy?.begin?.("evaluation-loading");
    if (evaluationBusyToken) evaluationReadinessBusyToken = evaluationBusyToken;
    if (!cachedEvaluationReentry) {
      document.documentElement.classList.remove("mflEvaluationReady");
      document.body.classList.add("evaluationPageLoading");
    }
    try {
      await renderEvaluationPage();
      if (!pageNavigationIsCurrent(options)) return null;
      if (!cachedEvaluationReentry) {
        await finishEvaluationReadiness();
      if (!pageNavigationIsCurrent(options)) return null;
      }
      if (document.body.classList.contains("loading")) {
        await finishLoading();
      }

      syncHomeLoginButton();
      if (shouldResetScroll) {
        resetPageScroll();
      }
      evaluationPageCacheReady = true;
      document.documentElement.classList.add("mflEvaluationReady");
      window.dispatchEvent(new CustomEvent("mfl:evaluation-ready"));
      return;
    } finally {
      const evaluationStillCurrent = pageNavigationIsCurrent(options)
        && state.currentPage === "evaluation"
        && window.location.pathname === "/evaluation";
      if (evaluationStillCurrent) {
        document.body.classList.remove("evaluationPageLoading");
        if (!document.documentElement.classList.contains("mflEvaluationReady")) {
          document.documentElement.classList.add("mflEvaluationReady");
        }
      }
      if (evaluationBusyToken && evaluationReadinessBusyToken === evaluationBusyToken) {
        releaseEvaluationReadinessBusy();
      }
    }
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

let summaryLoadPromise = null;
let summaryLoaded = false;
let summarySnapshot = null;

function homeSummaryCacheReady() {
  return summaryLoaded && Boolean(summarySnapshot);
}

Reflect.set(globalThis, "__mflHomeSummaryCache", Object.freeze({
  isReady: homeSummaryCacheReady,
}));

async function loadSummary() {
  if (summaryLoaded && summarySnapshot) {
    updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);
    return true;
  }
  if (summaryLoadPromise) return summaryLoadPromise;

  summaryLoadPromise = (async () => {
    try {
      const response = await fetch("/api/data?mode=bootstrap", { cache: "no-store", headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load the database summary.");
      state.manifest = data.manifest || null;
      const summary = data.summary || {};
      summarySnapshot = Object.freeze({
        playerCount: summary.playerCount,
        walletCount: summary.walletCount,
      });
      updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);
      updateStatusDate(summary.generatedAt);
      summaryLoaded = true;
      return true;
    } catch (error) {
      console.error(error?.message || "Could not load the database summary.");
      updateSummaryCounts(0, 0);
      return false;
    }
  })();

  const result = await summaryLoadPromise;
  summaryLoadPromise = null;
  return result;
}

function tablePageKey(pageName = state.currentPage) {
  return tablePages.has(pageName) ? pageName : null;
}

function allowedViewsForPage(pageName = tablePageKey() || "progression") {
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredOrder = viewConfig && typeof viewConfig === "object" && Array.isArray(viewConfig?.[pageName]?.order)
    ? Array.from(viewConfig[pageName].order)
    : null;
  return configuredOrder || pageViewOptions[pageName] || pageViewOptions.progression;
}

function defaultViewForPage(pageName = tablePageKey() || "progression") {
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredFallback = viewConfig && typeof viewConfig === "object"
    ? String(viewConfig?.[pageName]?.fallback || "")
    : "";
  return configuredFallback || defaultPageViews[pageName] || "current";
}

function normalizeViewForPage(viewName, pageName = tablePageKey() || "progression") {
  return allowedViewsForPage(pageName).includes(viewName) ? viewName : defaultViewForPage(pageName);
}

function pageNameForViewButton(button) {
  const currentPage = state.currentPage === "mflstats"
    ? "mfl"
    : state.currentPage === "club"
      ? "club"
      : tablePageKey();
  return currentPage || button?.dataset?.page || "progression";
}

function preferredViewForPage(pageName) {
  if (!tablePages.has(pageName)) {
    return "";
  }

  if (pageName === "mfl" && state.currentPage === "mflstats") {
    return "stats";
  }

  if (pageName === state.currentPage) {
    return normalizeViewForPage(state.view, pageName);
  }

  return normalizeViewForPage(state.tablePageStates?.[pageName]?.view, pageName);
}

function rememberMflStatsView() {
  const existingPageState = state.tablePageStates?.mfl || defaultTablePageState("mfl");
  state.tablePageStates.mfl = {
    ...existingPageState,
    view: "stats",
  };
  saveTableState();
}

function updateNavigationLinks() {
  navButtons.forEach((button) => {
    const pageName = button.dataset.page;
    if (!pageName || !tablePages.has(pageName)) {
      return;
    }

    button.href = pagePath(pageName, { view: preferredViewForPage(pageName) });
  });
}

function updateViewButtons() {
  const pageName = state.currentPage === "mflstats"
    ? "mfl"
    : state.currentPage === "club"
      ? "club"
      : (tablePageKey() || "progression");
  const activeView = state.currentPage === "mflstats" ? "stats" : state.view;
  window.__mflStaticUiRuntime?.syncTableViews?.(pageName, activeView);
  updateNavigationLinks();
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
    hideMflPlayers: pageName === "database",
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
  return `<span class="playerNoteIcon"${tooltip} aria-label="Player note">\u{1F4DD}</span>`;
}

function updatePlayerNoteCount(input) {
  const counter = playerDetail.querySelector("#playerNotesCount");
  if (counter) {
    counter.textContent = `${input.value.length}/${PLAYER_NOTE_MAX_LENGTH}`;
  }
}

function removePlayerNoteTooltip() {
  if (state.playerNoteTooltipHideTimer) {
    window.clearTimeout(state.playerNoteTooltipHideTimer);
    state.playerNoteTooltipHideTimer = null;
  }
  state.playerNoteTooltipText = "";
  document.querySelectorAll(".playerNoteFloatingTooltip").forEach((tooltip) => tooltip.remove());
}

function hidePlayerNoteTooltip(options = {}) {
  const immediate = Boolean(options.immediate);
  if (state.playerNoteTooltipHideTimer) {
    window.clearTimeout(state.playerNoteTooltipHideTimer);
    state.playerNoteTooltipHideTimer = null;
  }
  const tooltip = document.querySelector(".playerNoteFloatingTooltip");
  if (!tooltip) {
    removePlayerNoteTooltip();
    return;
  }
  tooltip.classList.remove("visible");
  tooltip.classList.add("tooltipHiding");
  state.playerNoteTooltipHideTimer = window.setTimeout(removePlayerNoteTooltip, 170);
}

function measureTooltipAnchorWidth(icon, sample = "0000000000") {
  const style = getComputedStyle(icon);
  const ruler = document.createElement("span");
  ruler.style.position = "fixed";
  ruler.style.left = "-9999px";
  ruler.style.top = "-9999px";
  ruler.style.visibility = "hidden";
  ruler.style.whiteSpace = "nowrap";
  ruler.style.font = style.font;
  ruler.style.letterSpacing = style.letterSpacing;
  ruler.textContent = sample;
  document.body.appendChild(ruler);
  const width = ruler.getBoundingClientRect().width;
  ruler.remove();
  return width;
}

function showPlayerNoteTooltip(icon) {
  if (Date.now() < state.tooltipSuppressedUntil) {
    return;
  }
  const note = icon?.dataset?.noteTooltip || icon?.dataset?.tooltip || "";
  if (!note) {
    return;
  }
  if (state.playerNoteTooltipHideTimer) {
    window.clearTimeout(state.playerNoteTooltipHideTimer);
    state.playerNoteTooltipHideTimer = null;
  }

  let tooltip = document.querySelector(".playerNoteFloatingTooltip");
  if (!tooltip || state.playerNoteTooltipText !== note) {
    removePlayerNoteTooltip();
    tooltip = document.createElement("div");
    tooltip.className = "playerNoteFloatingTooltip";
    tooltip.textContent = note;
    document.body.appendChild(tooltip);
  }
  state.playerNoteTooltipText = note;

  const iconRect = icon.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 8;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  const tableAgentCell = icon.classList.contains("agentTableLink") ? icon.closest("#tableBody td") : null;
  const agentTooltipAnchorWidth = measureTooltipAnchorWidth(icon);
  const tooltipHeight = Number(window.__mflTooltipHeight) || 6;
  let left;
  if (tableAgentCell) {
    const cellRect = tableAgentCell.getBoundingClientRect();
    const cellStyle = getComputedStyle(tableAgentCell);
    const cellPaddingLeft = Number.parseFloat(cellStyle.paddingLeft || "0") || 0;
    const agentAnchorLeft = cellRect.left + cellPaddingLeft;
    const agentAnchorCenter = agentAnchorLeft + agentTooltipAnchorWidth / 2;
    left = agentAnchorCenter - tooltipRect.width / 2;
  } else {
    left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
  }
  left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));

  let top = iconRect.top - tooltipRect.height - tooltipHeight;
  if (top < margin) {
    top = iconRect.bottom + tooltipHeight;
  }
  if (top + tooltipRect.height > viewportHeight - margin) {
    top = Math.max(margin, viewportHeight - tooltipRect.height - margin);
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.remove("tooltipHiding");
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
    const localWatchlist = loadLocalWalletWatchlist();
    const localWatchlists = localWatchlist.some((item) => item && typeof item === "object" && !Array.isArray(item))
      ? localWatchlist
      : [];
    applyWatchlists(localWatchlists, "", localWatchlist);
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

function normalizeSettingsEmailAddress(value) {
  return String(value || "").trim().slice(0, 254);
}

function validSettingsEmailAddress(value) {
  const email = normalizeSettingsEmailAddress(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function settingsEmailDraftIsActive() {
  return state.currentPage === "settings"
    && settingsEmailAddressInput
    && (document.activeElement === settingsEmailAddressInput || state.settingsEmailAddressDraft !== state.settingsEmailAddress);
}

function settingsEmailOptionsDraftIsActive() {
  return state.currentPage === "settings" && state.settingsSaveInFlight;
}

function applySettingsPayload(settings = {}) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  state.walletSettingsLoaded = true;
  const draftIsActive = settingsEmailDraftIsActive();
  const emailOptionsDraftIsActive = settingsEmailOptionsDraftIsActive();
  if (!emailOptionsDraftIsActive) {
    state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(data.receiveEmailsFor);
  }
  state.settingsEmailAddress = normalizeSettingsEmailAddress(data.emailAddress || data.email_address);
  if (!draftIsActive) {
    state.settingsEmailAddressDraft = state.settingsEmailAddress;
  }
  state.settingsDateFormat = normalizeSettingsDateFormat(data.dateFormat || data.date_format);
  state.settingsTimeFormat = normalizeSettingsTimeFormat(data.timeFormat || data.time_format);
  const savedTheme = normalizeSettingsTheme(data.theme, "");
  if (savedTheme !== currentMflTheme()) queueThemePreferenceCloudSync();
  if (state.currentPage === "settings") {
    renderSettingsPage({ preserveEmailDraft: draftIsActive });
  }
}

function currentSettingsPayload() {
  return {
    receiveEmailsFor: normalizeSettingsReceiveEmailsFor(state.settingsReceiveEmailsFor),
    emailAddress: normalizeSettingsEmailAddress(state.settingsEmailAddress),
    dateFormat: normalizeSettingsDateFormat(state.settingsDateFormat),
    timeFormat: normalizeSettingsTimeFormat(state.settingsTimeFormat),
    theme: currentMflTheme(),
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

function setSettingsEmailAddressDraft(value) {
  state.settingsEmailAddressDraft = String(value || "").slice(0, 254);
  updateSettingsEmailDraftActions();
}

function discardSettingsEmailAddressDraft() {
  state.settingsEmailAddressDraft = state.settingsEmailAddress;
  renderSettingsEmailControls();
}

function discardSettingsEmailAddressDraftSilently() {
  if (state.settingsEmailAddressDraft !== state.settingsEmailAddress) {
    state.settingsEmailAddressDraft = state.settingsEmailAddress;
    if (state.currentPage === "settings") {
      renderSettingsEmailControls();
    }
  }
}

function saveSettingsEmailAddressDraft() {
  const email = normalizeSettingsEmailAddress(state.settingsEmailAddressDraft);
  if (email && !validSettingsEmailAddress(email)) {
    showToast("Enter a valid email address.");
    renderSettingsEmailControls();
    return;
  }
  state.settingsEmailAddress = email;
  state.settingsEmailAddressDraft = email;
  if (!validSettingsEmailAddress(email)) {
    state.settingsReceiveEmailsFor = [];
  }
  savePendingSettingsLocally();
  saveSettingsPreferencesAfterChange();
  renderSettingsPage();
  showToast(email ? "Email address saved." : "Email address removed.");
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
  state.walletSettingsLoaded = true;
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  state.settingsSaveInFlight = true;

  window.clearTimeout(state.walletPreferencesSaveTimer);

  state.walletPreferencesSaveTimer = null;

  void saveWalletPreferencesNow();
}
function updateSettingsEmailDraftActions() {
  const draft = normalizeSettingsEmailAddress(state.settingsEmailAddressDraft);
  const saved = normalizeSettingsEmailAddress(state.settingsEmailAddress);
  const changed = draft !== saved;
  const draftIsValid = !draft || validSettingsEmailAddress(draft);

  if (settingsEmailAddressInput) {
    settingsEmailAddressInput.classList.toggle("invalid", Boolean(draft && !draftIsValid));
  }
  if (settingsEmailDiscardButton) {
    settingsEmailDiscardButton.hidden = !changed;
    settingsEmailDiscardButton.disabled = !changed;
    settingsEmailDiscardButton.onclick = discardSettingsEmailAddressDraft;
  }
  if (settingsEmailSaveButton) {
    settingsEmailSaveButton.hidden = !changed;
    settingsEmailSaveButton.disabled = !changed || !draftIsValid;
    settingsEmailSaveButton.onclick = saveSettingsEmailAddressDraft;
  }
}

function renderSettingsEmailControls(syncInput = true) {
  if (!settingsEmailAddressInput) {
    return;
  }

  const draft = normalizeSettingsEmailAddress(state.settingsEmailAddressDraft);
  if (syncInput && document.activeElement !== settingsEmailAddressInput) {
    settingsEmailAddressInput.value = draft;
  }
  settingsEmailAddressInput.oninput = () => setSettingsEmailAddressDraft(settingsEmailAddressInput.value);
  settingsEmailAddressInput.onblur = () => {
    state.settingsEmailAddressDraft = normalizeSettingsEmailAddress(settingsEmailAddressInput.value);
    renderSettingsEmailControls();
  };
  updateSettingsEmailDraftActions();
}

function renderSettingsPage(renderOptions = {}) {
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
    (window.__mflAppConfig?.ui?.settingsDateFormats || []).forEach(({ value, label }) => {
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
    (window.__mflAppConfig?.ui?.settingsTimeFormats || []).forEach(({ value, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `settingsToggleButton ${normalizeSettingsTimeFormat(state.settingsTimeFormat) === value ? "active" : ""}`;
      button.textContent = label;
      button.addEventListener("click", () => updateSettingsTimeFormat(value));
      settingsTimeFormatOptions.appendChild(button);
    });
  }

  renderSettingsEmailControls(!renderOptions.preserveEmailDraft);

  if (!settingsEmailOptions) {
    return;
  }

  settingsEmailOptions.replaceChildren();
  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  const emailOptions = [
    { id: "myplayers", label: "My Players progression" },
    ...watchlists.map((watchlist) => ({
      id: `watchlist-${watchlist.id}`,
      label: `Watchlist ${watchlist.name} progression`,
    })),
  ];

  emailOptions.forEach((option) => {
    const label = document.createElement("label");
    const emailReady = validSettingsEmailAddress(state.settingsEmailAddress);
    label.className = `settingsCheckbox ${emailReady ? "" : "disabled"}`;
    if (!emailReady) {
      label.dataset.tooltip = "You need to set a valid email address";
    }
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = emailReady && state.settingsReceiveEmailsFor.includes(option.id);
    input.disabled = !emailReady;
    input.dataset.settingsEmailOption = option.id;
    input.addEventListener("change", () => updateSettingsEmailOption(option.id, input.checked));
    const span = document.createElement("span");
    span.textContent = option.label;
    label.append(input, span);
    settingsEmailOptions.appendChild(label);
  });
}
function currentWatchlistName() {
  const pinnedName = String(window.__mflWatchlistRouteUiRuntime?.currentName?.() || "").trim();
  return pinnedName || activeWatchlist()?.name || DEFAULT_WATCHLIST_NAME;
}

function updateWatchlistTitle() {
  if (state.currentPage === "watchlist" && tablePageTitle) {
    tablePageTitle.textContent = `Watchlist - ${currentWatchlistName()}`;
  }
}

function updateTablePlayerCount() {
  if (!watchlistPlayerCount) {
    return;
  }

  const visible = tablePages.has(state.currentPage);
  watchlistPlayerCount.hidden = !visible;
  if (!visible) {
    return;
  }

  const visibleCount = state.incrementalMode ? state.incrementalTotalRows : state.filteredRows.length;
  const totalCount = state.incrementalMode ? state.incrementalSourceRows : state.tableSourceRowsCount;
  watchlistPlayerCount.textContent = `Showing ${formatCount(visibleCount)}/${formatCount(totalCount)} players`;
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
    updateTablePlayerCount();
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
  updateTablePlayerCount();
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


function updateWatchlistUrl(replace = false, force = false, view = "") {
  if ((!force && state.currentPage !== "watchlist") || !state.currentWatchlistId) {
    return;
  }

  const targetPath = pagePath("watchlist", {
    watchlistId: state.currentWatchlistId,
    ...(view ? { view } : {}),
  });
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
    showToast("Watchlist not found.");
    updateWatchlistUrl(true, true, options.view);
    return;
  }

  const nextWatchlist = found || state.watchlists[0] || ensureDefaultWatchlist();
  state.currentWatchlistId = nextWatchlist?.id || "";
  setActiveWatchlistIds(nextWatchlist?.playerIds || []);
  renderWatchlistSwitcher();
  updateWatchlistUrl(!routeId, true, options.view);
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
  const walletPreferencesPageAtLoadStart = state.currentPage;
  const walletPreferencesPathAtLoadStart = `${window.location.pathname}${window.location.search}`;
  const evaluationMflPerUsdRevisionAtLoadStart = state.evaluationMflPerUsdRevision;
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
      const watchlistsHaveContent = (value) => {
        if (!Array.isArray(value) || !value.length) return false;
        if (value.some((item) => typeof item === "string" && String(item).trim())) return true;
        const lists = value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
        return lists.length > 1 || lists.some((item) => {
          const ids = item.playerIds ?? item.player_ids ?? item.watchlistPlayerIds;
          return (Array.isArray(ids) && ids.length > 0)
            || String(item.name || DEFAULT_WATCHLIST_NAME).trim() !== DEFAULT_WATCHLIST_NAME;
        });
      };
      const localWatchlistsHaveContent = watchlistsHaveContent(localWatchlists);
      const cloudWatchlistsHaveContent = watchlistsHaveContent(data.watchlists);
      if (cloudWatchlistsHaveContent || !localWatchlistsHaveContent) {
        if (Array.isArray(data.watchlists) && data.watchlists.length) {
          const requestedId = String(watchlistIdFromUrl() || state.pendingWatchlistRouteId || "").trim();
          applyWatchlists(data.watchlists, requestedId, []);
        } else {
          ensureDefaultWatchlist();
        }
      } else {
        // Supabase has been cleared but this browser still has the last usable
        // copy. Keep it active and write it back to the authoritative column.
        void saveWalletPreferencesNow();
      }
      state.watchlistPlayerIdsAdded.clear();
      state.watchlistPlayerIdsRemoved.clear();
      const tableStateChanged = applyWalletTableState(data.tableState);
      applyWalletPlayerNotes(data.playerNotes);
      const pendingSettings = loadPendingSettingsLocally();
      if (pendingSettings || state.settingsSaveInFlight) {
        applySettingsPayload(pendingSettings || currentSettingsPayload());
        void saveWalletPreferencesNow();
      } else if (data.settings) {
        applySettingsPayload(data.settings);
      }
      if (data.evaluationSettings) {
        const latestMflPerUsd = state.evaluationMflPerUsd;
        const preserveLatestMflPerUsd = state.evaluationMflPerUsdRevision !== evaluationMflPerUsdRevisionAtLoadStart;
        applyEvaluationSettingsPayload(data.evaluationSettings);
        if (preserveLatestMflPerUsd) {
          state.evaluationMflPerUsd = latestMflPerUsd;
        }
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
    const walletPreferencesLoadStillOwnsRoute = state.currentPage === walletPreferencesPageAtLoadStart
      && `${window.location.pathname}${window.location.search}` === walletPreferencesPathAtLoadStart;
    if (walletPreferencesLoadStillOwnsRoute
      && previousNotes !== JSON.stringify(normalizedPlayerNotes(state.playerNotes))) {
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
    const pendingSettings = loadPendingSettingsLocally();
    const shouldSaveSettings = state.walletSettingsLoaded || state.settingsSaveInFlight || Boolean(pendingSettings);
    const settingsPayload = pendingSettings || currentSettingsPayload();
    const body = {
      playerNotes: normalizedPlayerNotes(state.playerNotes),
      watchlists: watchlistsPayload(),
      tableState: stripPersistentSortState(currentTableState()),
      evaluationSettings: currentEvaluationSettingsPayload(),
      ...(shouldSaveSettings ? { settings: settingsPayload } : {}),
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

      if (shouldSaveSettings && (state.settingsSaveInFlight || pendingSettings)) {
        applySettingsPayload(settingsPayload);
      } else if (data.settings) {
        applySettingsPayload(data.settings);
      }
      state.settingsSaveInFlight = false;
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
    if (saveSequence === state.walletPreferencesSaveSequence) {
      state.settingsSaveInFlight = false;
    }
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
    ...(pageKey === "database" ? { hideMflPlayers: Boolean(hideMflPlayersInput?.checked) } : {}),
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
    recentSearchItems: state.recentSearchItems,
    recentSearchPlayerIds: state.recentSearchPlayerIds,
    recentSearchAgentWallets: state.recentSearchAgentWallets,
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
    recentSearchItems: state.recentSearchItems,
    recentSearchPlayerIds: state.recentSearchPlayerIds,
    recentSearchAgentWallets: state.recentSearchAgentWallets,
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

function recentPlayerKey(playerId) {
  return `player:${String(playerId).trim()}`;
}

function recentAgentKey(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  return normalizedWalletAddress ? `agent:${normalizedWalletAddress}` : "";
}

function recentClubKey(clubId) {
  const normalizedClubId = String(clubId || "").trim();
  return normalizedClubId ? `club:${normalizedClubId}` : "";
}

function recentSearchItemsFromLegacy(playerIds = [], agentWallets = []) {
  return [
    ...normalizeIdList(playerIds, 5).map(recentPlayerKey),
    ...normalizeIdList(agentWallets, 5).map(recentAgentKey).filter(Boolean),
  ];
}

function restoreRecentSearchState(savedState) {
  const savedPlayerIds = Array.isArray(savedState?.recentSearchPlayerIds) ? savedState.recentSearchPlayerIds : [];
  const savedAgentWallets = Array.isArray(savedState?.recentSearchAgentWallets) ? savedState.recentSearchAgentWallets : [];
  const savedMixedItems = Array.isArray(savedState?.recentSearchItems) ? savedState.recentSearchItems : [];
  state.recentSearchPlayerIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_SEARCH_STORAGE_KEY), savedPlayerIds);
  state.recentSearchAgentWallets = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_AGENT_SEARCH_STORAGE_KEY), savedAgentWallets);
  state.recentSearchItems = mergeRecentIdLists(
    loadRecentIdsFromStorage(RECENT_MIXED_SEARCH_STORAGE_KEY),
    savedMixedItems,
    recentSearchItemsFromLegacy(state.recentSearchPlayerIds, state.recentSearchAgentWallets)
  );
  saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
  saveRecentIdsToStorage(RECENT_AGENT_SEARCH_STORAGE_KEY, state.recentSearchAgentWallets);
  saveRecentIdsToStorage(RECENT_MIXED_SEARCH_STORAGE_KEY, state.recentSearchItems);
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
  saveRecentIdsToStorage(RECENT_MIXED_SEARCH_STORAGE_KEY, state.recentSearchItems);
  saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
  saveRecentIdsToStorage(RECENT_AGENT_SEARCH_STORAGE_KEY, state.recentSearchAgentWallets);
  saveRecentIdsToStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY, state.recentEvaluationPlayerIds);
}

function syncRecentSearchStateFromStorage(event = null) {
  if (event && ![RECENT_MIXED_SEARCH_STORAGE_KEY, RECENT_SEARCH_STORAGE_KEY, RECENT_AGENT_SEARCH_STORAGE_KEY, RECENT_EVALUATION_SEARCH_STORAGE_KEY].includes(event.key)) {
    return;
  }

  const nextSearchIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_SEARCH_STORAGE_KEY), state.recentSearchPlayerIds);
  const nextAgentWallets = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_AGENT_SEARCH_STORAGE_KEY), state.recentSearchAgentWallets);
  const nextSearchItems = mergeRecentIdLists(
    loadRecentIdsFromStorage(RECENT_MIXED_SEARCH_STORAGE_KEY),
    state.recentSearchItems,
    recentSearchItemsFromLegacy(nextSearchIds, nextAgentWallets)
  );
  const nextEvaluationIds = mergeRecentIdLists(loadRecentIdsFromStorage(RECENT_EVALUATION_SEARCH_STORAGE_KEY), state.recentEvaluationPlayerIds);
  const searchChanged = JSON.stringify(nextSearchItems) !== JSON.stringify(state.recentSearchItems);
  const evaluationChanged = JSON.stringify(nextEvaluationIds) !== JSON.stringify(state.recentEvaluationPlayerIds);

  state.recentSearchPlayerIds = nextSearchIds;
  state.recentSearchAgentWallets = nextAgentWallets;
  state.recentSearchItems = nextSearchItems;
  state.recentEvaluationPlayerIds = nextEvaluationIds;

  if (searchChanged && searchModal && !searchModal.hidden && !playerSearchInput.value.trim()) {
    renderSearchResultsNow();
  }

  if (evaluationChanged && state.currentPage === "evaluation" && !evaluationSearchInput.value.trim()) {
    renderEvaluationSearchResults();
  }
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
    restoreLinkedWalletState(savedState);
    restoreWatchlistState();
    restoreMenuState(savedState);
    restoreRecentSearchState(savedState);
    restoreRecentEvaluationState(savedState);
    restorePlayerAttributeView(savedState);
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

  return columns.filter((column) => column === contractStatusFilterColumn || state.columns.includes(column));
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

function contractStatusValue(row) {
  const clubName = getValue(row, "active_contract_club_name");
  if (isDevelopmentCenterClubName(clubName)) {
    return "development_center";
  }

  return rowHasActiveContract(row) ? "under_contract" : "free_agent";
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

function newMintMarker(row) {
  if (getValue(row, "player_seasons") !== 1) {
    return null;
  }

  return {
    svg: "newPlayer",
    label: "New mint",
  };
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

function openAgentPage(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  if (!normalizedWalletAddress) {
    return;
  }

  const result = agentSearchResultByWallet(normalizedWalletAddress);
  if (result?.name) saveAgentDisplayName(normalizedWalletAddress, result.name);

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

  setPage("agents", true, { walletAddress: normalizedWalletAddress, view: "attributes" });
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
    row,
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
    if (entry.name) saveAgentDisplayName(entry.walletAddress, entry.name);
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
  const activeInput = () => type === "players" ? evaluationSearchInput?.value : playerSearchInput?.value;

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
    const response = await fetch(`/api/data?${parameters}`, {
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
function evaluationDiscountRateValue() {
  const liveRate = window.__mflSupabaseDiscountRateFunction?.();
  return Number.isFinite(liveRate) ? liveRate : null;
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

function commitEvaluationMflPerUsdValue(value) {
  const previousMflPerUsd = state.evaluationMflPerUsd;
  saveEvaluationMflPerUsd(value);
  state.evaluationMflPerUsdRevision += 1;
  if (state.currentPage === "evaluation" && state.evaluationMflPerUsd !== previousMflPerUsd) {
    void window.__mflEvaluationDiscountRateRuntime?.refresh?.();
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
    commitEvaluationMflPerUsdValue(parsedValue);
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

function cancelEvaluationMflPerUsd() {
  if (evaluationMflUsdEditor.hidden) {
    return;
  }

  renderEvaluationMflPerUsdControl(false);
}

function commitEvaluationMflPerUsd() {
  if (evaluationMflUsdEditor.hidden) {
    return;
  }

  const parsedValue = parseEvaluationMflPerUsd(evaluationMflUsdInput.value);

  if (parsedValue) {
    commitEvaluationMflPerUsdValue(parsedValue);
  }

  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
  queueEvaluationSettingsSave();
}

function resetEvaluationMflPerUsd() {
  commitEvaluationMflPerUsdValue(DEFAULT_EVALUATION_MFL_PER_USD);
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

  if (!state.evaluationSearchIndex.length && state.rows.length) {
    buildSearchIndex();
  }

  const results = [];

  state.evaluationSearchIndex.forEach((entry) => {
    if (entry.retired || (!entry.id.includes(query) && !entry.name.includes(query))) {
      return;
    }

    results.push(entry);
  });

  return results
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 5);
}

function recentEvaluationRows() {
  return state.recentEvaluationPlayerIds
    .map((playerId) => state.evaluationSearchIndex.find((entry) => String(entry.playerId) === String(playerId)) || null)
    .filter((entry) => entry && !entry.retired);
}

function rememberEvaluationResult(playerId) {
  const key = String(playerId);
  state.recentEvaluationPlayerIds = mergeRecentIdLists([key], state.recentEvaluationPlayerIds);
  persistRecentSearchStates();
  saveTableState();
}

function renderEmptyEvaluationSelection(showRecentResults = true, forcePlain = false) {
  const evaluationRouteParams = new URLSearchParams(window.location.search);
  const pendingEvaluationRoute = !forcePlain && window.location.pathname === "/evaluation" && Boolean(
    evaluationRouteParams.get("player") || evaluationRouteParams.get("saved") || evaluationRouteParams.get("share")
  );

  if (pendingEvaluationRoute) {
    evaluationSearchInput.placeholder = "";
    evaluationButtons.hidden = false;
    evaluationResetButton.hidden = false;
    if (evaluationLoadButton) {
      evaluationLoadButton.hidden = true;
    }
    evaluationPlayerPageButton.hidden = false;
    return;
  }

  evaluationSearchInput.placeholder = "Search ID or player name";
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

function syncEvaluationSearchClearButton() {
  evaluationSearchClearButton.hidden = !evaluationSearchInput.value.trim();
}

function renderEvaluationSearchResults() {
  syncEvaluationSearchClearButton();
  const query = normalizeSearchText(evaluationSearchInput.value.trim());

  if (query && window.__mflEvaluationSearchStateRuntime?.shouldShowTypedResults?.() === false) {
    evaluationSearchResults.hidden = true;
    return;
  }

  if (!query && window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.()) {
    return;
  }

  if (!query && !shouldShowEvaluationRecentResults()) {
    evaluationSearchResults.hidden = true;
    evaluationSearchResults.replaceChildren();
    return;
  }

  const results = query ? evaluationSearchMatches(query) : recentEvaluationRows();

  evaluationSearchResults.replaceChildren();
  evaluationSearchResults.hidden = results.length === 0;

  results.forEach((entry) => {
    const playerId = String(entry.playerId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evaluationSearchResult";
    button.innerHTML = `<strong>${escapeHtml(entry.nameDisplay)}</strong><span>${playerSearchMetadataHtml(entry, playerId)}</span>`;
    button.addEventListener("click", async () => {
      state.evaluationShareId = "";
      state.evaluationSavedId = "";
      state.evaluationPlayerId = playerId;
      rememberEvaluationResult(playerId);
      evaluationSearchInput.value = entry.nameDisplay;
      try {
        sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${playerId}`, entry.nameDisplay);
      } catch {
        // Session storage is an optional first-paint cache only.
      }
      evaluationSearchResults.hidden = true;
      syncEvaluationPlayerUrl(playerId);
      try {
        const route = incrementalRouteTarget("evaluation", { playerId });
        const loadAndRender = async () => {
          const payload = await requestIncrementalRoute(route, 1);
          if (!payload) return false;
          const row = rowByPlayerId(playerId);
          if (row) {
            renderEvaluationTable(row);
          }
        };
        if (incrementalRouteIsCached(route, 1)) {
          await loadAndRender();
        } else {
          await withInteractionBusy(loadAndRender);
        }
      } catch (error) {
        showToast(error?.message || "Could not load this player.");
      }
    });
    evaluationSearchResults.appendChild(button);
  });
}

function clearEvaluationSearch() {
  evaluationSearchInput.value = "";
  resetEvaluationSelection();
  renderEvaluationSearchResults();
  window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();
}
function handleEvaluationSearchInput() {
  if (!evaluationSearchInput.value.trim()) resetEvaluationSelection();
  const query = String(evaluationSearchInput.value || "").trim();
  renderEvaluationSearchResults();
  void (async () => {
    try {
      if (await requestDatabaseSearch(query, "players")) renderEvaluationSearchResults();
    } catch (error) {
      console.error(error?.message || "Could not search players.");
      renderEvaluationSearchResults();
    }
  })();
}

let evaluationEmptySearchFocusScheduled = false;

function focusEmptyEvaluationSearchWhenReady() {
  if (evaluationEmptySearchFocusScheduled) return;
  evaluationEmptySearchFocusScheduled = true;

  const focusSearch = () => {
    evaluationEmptySearchFocusScheduled = false;
    requestAnimationFrame(() => {
      if (!isPlainEvaluationUrl() || state.evaluationPlayerId || evaluationSearchInput.value.trim()) return;
      evaluationSearchInput.focus({ preventScroll: true });
      renderEvaluationSearchResults();
    });
  };

  if (document.documentElement.dataset.mflReady === "true") focusSearch();
  else window.addEventListener("mfl:ready", focusSearch, { once: true });
}

function primeEmptyEvaluationSearch() {
  focusEmptyEvaluationSearchWhenReady();
  const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
  return typeof prime === "function" ? prime(false, true) : Promise.resolve(false);
}

function waitForEvaluationDiscountRate() {
  if (document.documentElement.dataset.mflEvaluationRateSettled === "true") {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let timeout = 0;
    const finish = () => {
      window.removeEventListener("mfl:evaluation-rate-settled", finish);
      if (timeout) window.clearTimeout(timeout);
      resolve(document.documentElement.dataset.mflEvaluationRateSettled === "true");
    };
    window.addEventListener("mfl:evaluation-rate-settled", finish, { once: true });
    timeout = window.setTimeout(finish, 15_000);
  });
}

function waitForEvaluationLayout() {
  const fontsReady = document.fonts?.ready || Promise.resolve();
  return Promise.resolve(fontsReady).then(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function finishEvaluationReadiness() {
  const dependencies = [primeGlobalSearchIndexes(), waitForEvaluationDiscountRate()];
  if (!state.evaluationPlayerId) dependencies.push(primeEmptyEvaluationSearch());
  await Promise.allSettled(dependencies);
  await waitForEvaluationLayout();
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
    : `<button class="popupMinusButton" type="button" data-evaluation-overall-season="${season}" data-evaluation-overall-delta="-1" aria-label="Reduce season ${season} overall"></button>`;
  const increaseControl = numericValue >= 99
    ? `<span class="evaluationOverallControlSpacer" aria-hidden="true"></span>`
    : `<button class="popupAddButton" type="button" data-evaluation-overall-season="${season}" data-evaluation-overall-delta="1" aria-label="Increase season ${season} overall"></button>`;

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

const evaluationTableRenderReuse = createRenderReuseGuard();

function evaluationTableRenderSignature(row) {
  const playerId = String(getValue(row, "player_id") || "");
  const discountRate = state.evaluationIgnoreDiscountRate ? 0 : evaluationDiscountRateValue();
  return JSON.stringify([
    state.columns,
    row,
    state.evaluationIgnoreDiscountRate,
    state.evaluationIgnoreFirstSeason,
    state.evaluationMflPerUsd,
    discountRate,
    state.evaluationLateSeasonRewardRates,
    state.evaluationOverallRows[playerId] || null,
    state.evaluationSummaryPositions[playerId] || "",
    state.settingsDateFormat,
    state.settingsTimeFormat,
  ]);
}

function renderEvaluationTable(row) {
  const rawExpectedSeasons = expectedEvaluationSeasons(row);
  const seasonOffset = state.evaluationIgnoreFirstSeason ? 1 : 0;
  const expectedSeasons = Math.max(0, rawExpectedSeasons - seasonOffset);
  const renderSignature = evaluationTableRenderSignature(row);
  const reusableTable = evaluationPanel
    && !evaluationPanel.hidden
    && Boolean(evaluationSummaryBody?.firstElementChild)
    && evaluationTableBody?.children.length === expectedSeasons;
  if (evaluationTableRenderReuse.matches(renderSignature, reusableTable)) {
    updateEvaluationFooterActions();
    return;
  }
  const playerName = formatCellValue(row, "name");
  const currentAge = Number(getValue(row, "age"));
  const overallValues = evaluationOverallValues(row, rawExpectedSeasons);
  const currentOverall = overallValues[seasonOffset] ?? overallValues[0];
  const summaryPosition = evaluationSummaryPosition(row);
  const summaryOverall = currentOverall;
  const discountRate = state.evaluationIgnoreDiscountRate ? 0 : evaluationDiscountRateValue();
  const discountDerivedValuesReady = Number.isFinite(discountRate);
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
  const presentValueTotal = discountDerivedValuesReady
    ? (presentValues.length ? presentValues.reduce((total, value) => total + value, 0) : 0)
    : null;
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
  evaluationTableRenderReuse.commit(renderSignature);
}
async function renderEvaluationPage() {
  syncEvaluationSearchClearButton();
  const savedId = evaluationSavedIdFromUrl();
  if (savedId && window.__mflRestoringSavedEvaluation && state.evaluationSavedId !== savedId) {
    renderEmptyEvaluationSelection(false);
    return;
  }
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
    void primeEmptyEvaluationSearch();
    return;
  }

  let row = rowByPlayerId(state.evaluationPlayerId);
  const pendingEvaluationRoute = Boolean(
    evaluationPlayerIdFromUrl() || evaluationSavedIdFromUrl() || evaluationShareIdFromUrl()
  );
  const firstPaintEvaluationPlayerName = String(evaluationSearchInput.value || "").trim();

  if (pendingEvaluationRoute) {
    evaluationSearchInput.placeholder = "";
    evaluationButtons.hidden = false;
    evaluationResetButton.hidden = false;
    if (evaluationLoadButton) {
      evaluationLoadButton.hidden = true;
    }
    evaluationPlayerPageButton.hidden = false;
  }

  if (!row) {
    const routePlayerId = String(evaluationPlayerIdFromUrl() || state.evaluationPlayerId || "").trim();
    if (routePlayerId) {
      await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: routePlayerId,
      }, 1, { force: true });
      state.evaluationPlayerId = routePlayerId;
      row = rowByPlayerId(routePlayerId);
    }
  }

  if (row) {
    const evaluationPlayerName = formatCellValue(row, "name");
    evaluationSearchInput.value = evaluationPlayerName;
    try {
      const evaluationRoute = new URL(window.location.href);
      const evaluationIdentities = [
        ["player", String(evaluationRoute.searchParams.get("player") || state.evaluationPlayerId || "").trim()],
        ["saved", String(evaluationRoute.searchParams.get("saved") || state.evaluationSavedId || "").trim()],
        ["share", String(evaluationRoute.searchParams.get("share") || state.evaluationShareId || "").trim()],
      ];
      evaluationIdentities.forEach(([kind, id]) => {
        if (id) sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:${kind}:${id}`, evaluationPlayerName);
      });
    } catch {
      // Session storage is an optional first-paint cache only.
    }
    syncEvaluationSearchClearButton();
  }

  if (!row) {
    if (pendingEvaluationRoute) {
      if (firstPaintEvaluationPlayerName) {
        evaluationSearchInput.value = firstPaintEvaluationPlayerName;
        syncEvaluationSearchClearButton();
      }
      return;
    }
    renderEmptyEvaluationSelection(false);
    return;
  }

  if (getValue(row, "retirement_years") === 0) {
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
  } else if (rerender && tablePageKey()) {
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
  const label = escapeHtml(formatNationality(nationality));

  if (!code) {
    return `<span class="flagText" data-tooltip="${label}" aria-label="${label}">-</span>`;
  }

  const codepoints = code.includes("-")
    ? code
    : code
      .toUpperCase()
      .split("")
      .map((character) => (127397 + character.charCodeAt(0)).toString(16))
      .join("-");
  return `<img class="flagImage" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints}.svg" alt="" data-tooltip="${label}" aria-label="${label}">`;
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

function replayTrainingControlHover(control) {
  if (!control) {
    return;
  }

  control.classList.add("trainingHoverReset");
  void control.offsetWidth;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => control.classList.remove("trainingHoverReset"));
  });
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
        : `<span class="trainingStatControls"><button class="popupMinusButton" type="button" data-training-stat="${escapeHtml(column)}" data-training-delta="-1" aria-label="Reduce ${escapeHtml(label)}"></button><button class="popupAddButton" type="button" data-training-stat="${escapeHtml(column)}" data-training-delta="1" aria-label="Increase ${escapeHtml(label)}"></button></span>`)
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
const playerDetailRenderReuse = createRenderReuseGuard();

function playerDetailRenderSignature(row, playerId, attributeView) {
  const key = String(playerId || "").trim();
  return JSON.stringify([
    key,
    state.columns,
    row,
    attributeView,
    Boolean(hasWalletOptIn()),
    normalizeWalletAddress(state.linkedWalletAddress).toLowerCase(),
    Boolean(state.walletPermissionAllowed),
    Boolean(state.watchlistPlayerIds.has(key)),
    playerNote(key),
    state.settingsDateFormat,
    state.settingsTimeFormat,
    state.trainingAdjustments[key] || null,
  ]);
}

function renderPlayerPage(playerId) {
  const row = rowByPlayerId(playerId);

  if (!row) {
    playerDetailRenderReuse.invalidate();
    window.__mflStaticUiRuntime?.showNotFound?.("Player");
    return;
  }
  const normalizedAttributeView = normalizePlayerAttributeView(state.playerAttributeView, row);
  const renderSignature = playerDetailRenderSignature(row, playerId, normalizedAttributeView);
  if (playerDetailRenderReuse.matches(
    renderSignature,
    playerDetail.firstElementChild?.classList.contains("playerHero"),
  )) {
    document.documentElement.dataset.initialEntityVerified = "player";
    return;
  }
  document.documentElement.dataset.initialEntityVerified = "player";

  const playerName = formatCellValue(row, "name");
  const id = formatCellValue(row, "player_id");
  const nationality = formatCellValue(row, "nationality");
  const rawNationality = getValue(row, "nationality");
  const positions = playerPositions(row);
  const height = formatCellValue(row, "height");
  const heightLabel = height === "NULL" ? height : `${height} cm`;
  const ageMarker = retirementMarker(row);
  const ageMarkerHtml = ageMarker
    ? ` <span class="retirementMarker playerAgeMarker retirementMarker--${escapeHtml(ageMarker.status || "default")}" data-tooltip="${escapeHtml(ageMarker.label)}" aria-label="${escapeHtml(ageMarker.label)}"><img src="/retirement-${escapeHtml(ageMarker.icon)}.svg" width="16" height="16" alt="" aria-hidden="true"></span>`
    : "";
  const agentWalletAddress = getValue(row, "wallet_address");
  const agentTooltip = joinedAgencyTooltip(row);
  const agentTooltipHtml = agentTooltip ? ` data-tooltip="${escapeHtml(agentTooltip)}" aria-label="${escapeHtml(agentTooltip)}"` : "";
  const agentLinkHtml = `<a class="agentTableLink playerAgentLink" href="${escapeHtml(agentRoute(agentWalletAddress))}"${agentTooltipHtml}>${escapeHtml(formatCellValue(row, "wallet_name"))}</a>`;
  const contractDivision = rowHasActiveContract(row) ? contractDivisionInfo(getValue(row, "active_contract_club_division")) : null;
  const contractDivisionHtml = contractDivision ? `<span class="playerContractDivision" style="color: ${escapeHtml(contractDivision.color)}">${escapeHtml(contractDivision.name)}</span>` : "";
  const contractTeamName = formatContractClubName(row);
  const contractClubId = String(getValue(row, "active_contract_club_id") || "").trim();
  const contractTeamHtml = contractClubId
    ? `<a class="playerContractTeam playerContractTeamLink clubPageLink" href="/clubs/${encodeURIComponent(contractClubId)}/squad" data-club-id="${escapeHtml(contractClubId)}">${escapeHtml(contractTeamName)}</a>`
    : `<span class="playerContractTeam">${escapeHtml(contractTeamName)}</span>`;
  const contractLabel = `<span class="playerContractLine">${contractTeamHtml}${contractDivisionHtml}</span>`;
  const revenueShare = rowHasActiveContract(row) ? formatContractRevenueShare(getValue(row, "active_contract_revenue_share")) : "";
  const infoCardsData = [
    ["Nationality", `${countryFlagHtml(rawNationality)} ${escapeHtml(nationality)}`],
    ["Age", `${escapeHtml(formatCellValue(row, "age"))}${ageMarkerHtml}`],
    ["Height", escapeHtml(heightLabel)],
    ["Foot", escapeHtml(formatFootedness(getValue(row, "preferred_foot")))],
    ["Seasons", escapeHtml(formatCellValue(row, "player_seasons"))],
    ["Agent", agentLinkHtml],
    ["Contract", contractLabel],
  ];
  if (revenueShare) {
    infoCardsData.push(["Rev Share", escapeHtml(revenueShare)]);
  }
  const infoCards = infoCardsData.map(([label, value]) => `<div${label === "Contract" ? " class=\"contractDetailCard\"" : ""}><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join("");
  state.playerAttributeView = normalizedAttributeView;
  const displayRow = state.playerAttributeView === "training" ? trainingRow(row) : row;
  const viewButtons = allowedPlayerAttributeViews(row)
    .map(([view, label]) => `<button class="playerAttributeViewButton ${state.playerAttributeView === view ? "active" : ""}" type="button" data-player-attribute-view="${view}">${label}</button>`)
    .join("");

  playerDetail.innerHTML = `
    <section class="playerHero">
      <div>
        <button id="copyPlayerIdButton" class="playerEyebrow playerIdText" type="button" data-tooltip="Click to copy" aria-label="Click to copy player ID">ID #${escapeHtml(id)}</button>
        <h2 class="playerTitle"><span class="playerTitleName">${escapeHtml(playerName)}</span>${listingPriceBadgeHtml(row)}<span class="playerTitleNoteIcon" data-player-note-title-icon>${playerNoteIconHtml(id)}</span></h2>
        <p>${escapeHtml(positions.join(", ") || "No positions")}</p>
      </div>
      <div class="playerHeroActions">
        <button id="playerEvaluateButton" class="playerEvaluateButton" type="button">Evaluate</button>
        ${hasWalletOptIn() ? '<button id="playerWatchlistButton" class="playerWatchlistButton" type="button"></button>' : ""}
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
  if (watchButton) {
    const inAnyWatchlist = playerIsInAnyWatchlist(id);
    watchButton.className = `playerWatchlistButton ${inAnyWatchlist ? "active" : ""}`;
    watchButton.innerHTML = `<span class="watchlistButtonStar" aria-hidden="true">${inAnyWatchlist ? "\u2605" : "\u2606"}</span><span>${inAnyWatchlist ? "In watchlist" : "Add to watchlist"}</span>`;
    watchButton.addEventListener("click", () => {
      toggleWatchlistPlayer(id, true);
    });
  }
  const evaluateButton = playerDetail.querySelector("#playerEvaluateButton");
  const openEvaluationForPlayer = (event) => {
    const targetPath = pagePath("evaluation", { playerId: id });

    rememberEvaluationResult(id);
    try {
      sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${id}`, playerName);
    } catch {
      // Session storage is an optional first-paint cache only.
    }

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
      const nextView = button.dataset.playerAttributeView;
      if (!nextView || nextView === state.playerAttributeView) return;
      state.playerAttributeView = nextView;
      saveTableState();
      renderPlayerPage(id);
    });
  });
  playerDetail.querySelectorAll("[data-training-stat]").forEach((button) => {
    button.addEventListener("click", () => {
      const stat = button.dataset.trainingStat;
      const delta = Number(button.dataset.trainingDelta || 0);
      adjustTrainingStat(id, stat, delta);
      const replacement = Array.from(playerDetail.querySelectorAll("[data-training-stat]")).find((candidate) =>
        candidate.dataset.trainingStat === stat && Number(candidate.dataset.trainingDelta || 0) === delta,
      );
      replayTrainingControlHover(replacement);
    });
  });
  playerDetail.querySelectorAll("[data-training-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      resetTrainingStats(id);
      replayTrainingControlHover(playerDetail.querySelector("[data-training-reset]"));
    });
  });
  const notesInput = playerDetail.querySelector("#playerNotesInput");
  if (notesInput) {
    notesInput.addEventListener("input", () => {
      updatePlayerNoteCount(notesInput);
      setPlayerNote(id, notesInput.value);
    });
  }
  playerDetailRenderReuse.commit(renderSignature);
}


function showModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("modalClosing", "modalOpen");
  modal.hidden = false;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      modal.classList.add("modalOpen");
    });
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
  showModal(searchModal);
  playerSearchInput.value = "";

  const renderAuthoritativeRecentSearches = async () => {
    const renderRecent = window.__mflGlobalSearchRuntime?.recent;
    if (typeof renderRecent !== "function") return false;
    return Boolean(await renderRecent());
  };

  void renderAuthoritativeRecentSearches().then((rendered) => {
    if (!rendered && !playerSearchInput.value.trim()) renderSearchResultsNow();
  });
  window.setTimeout(() => playerSearchInput.focus(), 0);
  await ensureSearchIndexes();
  if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();
}

function closeSearch() {
  hideModal(searchModal);
}

function playerSearchResult(row) {
  return { type: "player", row };
}

function searchMatchScore(query, primaryText, secondaryText = "") {
  if (primaryText === query || secondaryText === query) {
    return 100;
  }

  if (primaryText.startsWith(query)) {
    return 80;
  }

  if (secondaryText.startsWith(query)) {
    return 70;
  }

  if (primaryText.includes(query)) {
    return 50;
  }

  if (secondaryText.includes(query)) {
    return 40;
  }

  return 0;
}

function bestSearchResults(query) {
  if ((!state.searchIndex.length && state.rows.length) || (!state.agentSearchIndex.length && (state.rows.length || state.walletRows.length))) {
    buildSearchIndex();
  }

  const relevanceSort = (a, b) => (
    b.score - a.score
    || b.overall - a.overall
    || String(a.label).localeCompare(String(b.label))
  );

  const playerResults = state.searchIndex
    .map((entry) => ({
      type: "player",
      entry,
      row: entry.row || null,
      score: Math.max(searchMatchScore(query, entry.name, entry.id), searchMatchScore(query, entry.id, entry.name)),
      overall: entry.overall,
      label: entry.nameDisplay,
    }))
    .filter((result) => result.score > 0)
    .sort(relevanceSort);

  const agentPlayerCounts = new Map();
  state.rows.forEach((row) => {
    const walletAddress = normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase();
    if (!walletAddress) return;
    agentPlayerCounts.set(walletAddress, (agentPlayerCounts.get(walletAddress) || 0) + 1);
  });

  const agentResults = state.agentSearchIndex
    .map((entry) => ({
      ...entry,
      score: Math.max(searchMatchScore(query, entry.nameText, entry.walletText), searchMatchScore(query, entry.walletText, entry.nameText)),
      playerCount: agentPlayerCounts.get(entry.walletAddress) || entry.playerCount || 0,
      overall: -1,
      label: entry.name,
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => (
      b.score - a.score
      || b.playerCount - a.playerCount
      || String(a.label).localeCompare(String(b.label))
    ));

  // Keep category priority while giving typed Global Search one shared ten-result budget.
  // The club-search enhancer will insert clubs between players and agents before applying
  // the same overall cap.
  return [...playerResults, ...agentResults].slice(0, 10);
}

function agentSearchResultByWallet(walletAddress) {
  if (!state.agentSearchIndex.length && (state.rows.length || state.walletRows.length)) {
    buildSearchIndex();
  }

  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  return state.agentSearchIndex.find((entry) => entry.walletAddress === normalizedWalletAddress) || null;
}

function recentSearchRows() {
  const items = state.recentSearchItems.length
    ? state.recentSearchItems
    : recentSearchItemsFromLegacy(state.recentSearchPlayerIds, state.recentSearchAgentWallets);

  return items.map((item) => {
    if (item.startsWith("club:")) {
      return null;
    }

    if (item.startsWith("agent:")) {
      return agentSearchResultByWallet(item.slice(6));
    }

    const playerId = item.startsWith("player:") ? item.slice(7) : item;
    const entry = state.searchIndex.find((searchEntry) => String(searchEntry.playerId) === String(playerId));
    if (entry) {
      return { type: "player", entry, row: entry.row || null };
    }
    const row = rowByPlayerId(playerId);
    return row ? playerSearchResult(row) : null;
  }).filter(Boolean);
}

function rememberSearchResult(playerId) {
  const key = String(playerId);
  state.recentSearchPlayerIds = mergeRecentIdLists([key], state.recentSearchPlayerIds);
  state.recentSearchItems = mergeRecentIdLists([recentPlayerKey(key)], state.recentSearchItems);
  persistRecentSearchStates();
  saveTableState();
}

function rememberAgentSearchResult(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  if (!normalizedWalletAddress) {
    return;
  }

  state.recentSearchAgentWallets = mergeRecentIdLists([normalizedWalletAddress], state.recentSearchAgentWallets);
  state.recentSearchItems = mergeRecentIdLists([recentAgentKey(normalizedWalletAddress)], state.recentSearchItems);
  const result = agentSearchResultByWallet(normalizedWalletAddress);
  if (result?.name) saveAgentDisplayName(normalizedWalletAddress, result.name);
  persistRecentSearchStates();
  saveTableState();
}

function navigateFromSearch(callback) {
  closeSearch();
  window.requestAnimationFrame(() => callback());
}

function syncPlayerSearchClearButton() {
  playerSearchClearButton.hidden = !playerSearchInput.value.trim();
}

function clearPlayerSearch() {
  playerSearchInput.value = "";
  renderSearchResultsNow();
  playerSearchInput.focus();
}

function renderSearchResultsNow() {
  syncPlayerSearchClearButton();
  const query = normalizeSearchText(playerSearchInput.value.trim());
  const results = query ? bestSearchResults(query) : recentSearchRows();
  playerSearchResults.classList.add("filledSearchResults");

  if (!results.length) {
    playerSearchResults.classList.remove("filledSearchResults");
    playerSearchResults.innerHTML = `<div class="searchHint">${query ? "No players, clubs, or agents found." : "Recent searches will appear here."}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  results.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "searchResult";

    if (result.type === "agent") {
      button.dataset.searchKey = recentAgentKey(result.walletAddress);
      button.innerHTML = `<strong>${escapeHtml(result.name)}</strong><span>${escapeHtml(result.walletAddress)}</span>`;
      button.addEventListener("click", () => {
        rememberAgentSearchResult(result.walletAddress);
        navigateFromSearch(() => openAgentPage(result.walletAddress));
      });
      fragment.appendChild(button);
      return;
    }

    const row = result.row;
    const entry = result.entry || (row ? buildPlayerSearchEntryFromRow(row) : null);
    if (!entry) {
      return;
    }
    const id = String(entry.playerId);
    button.dataset.searchKey = recentPlayerKey(id);
    button.innerHTML = `<strong>${escapeHtml(entry.nameDisplay)}</strong><span>${playerSearchMetadataHtml(entry, id)}</span>`;
    button.addEventListener("click", () => {
      rememberSearchResult(id);
      navigateFromSearch(() => openPlayerPage(id));
    });
    fragment.appendChild(button);
  });
  playerSearchResults.replaceChildren(fragment);
}

function renderSearchResults() {
  syncPlayerSearchClearButton();
  const query = String(playerSearchInput.value || "").trim();
  renderSearchResultsNow();
  void (async () => {
    try {
      if (await requestDatabaseSearch(query, "all", { force: Boolean(query) })) renderSearchResultsNow();
    } catch (error) {
      console.error(error?.message || "Could not search the database.");
      renderSearchResultsNow();
    }
  })();
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
  if (column === "active_contract_club_division") {
    const divisionRank = contractDivisionSortValue(getValue(row, column));
    return divisionRank === null ? null : -divisionRank;
  }

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

function buildTableColGroup() {
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
function buildHeader() {
  buildTableColGroup();
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

  const actionsHeader = document.createElement("th");
  actionsHeader.className = "rowActionsCell";
  actionsHeader.setAttribute("aria-label", "Player actions");
  headerRow.appendChild(actionsHeader);

  currentViewColumns().forEach((column) => {
    const cell = document.createElement("th");
    const columnClass = tableColumnClass(column);
    if (columnClass) {
      cell.classList.add(...columnClass.split(" "));
    }
    const clubPositionSort = state.currentPage === "club" && column === "positions";
    const isSorted = state.currentPage !== "club" && state.sortKey === column;
    const label = document.createElement("span");
    label.textContent = column === agentColumn && state.currentPage === "mfl" ? "" : columnLabels[column];
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
  filterSummary.textContent = String(count);
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

function restoreSavedTableState(pageName = tablePageKey() || "progression", options = {}) {
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

  const viewSortState = normalizedViewSortState(
    savedState.viewSortStates?.[state.view] || savedState,
    state.view,
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
  document.body.classList.remove("filtersOpen");
  hideModal(filtersModal, () => {
    openFiltersButton.focus();
  });
}

function clearAdvancedFilters(applyNow = true) {
  filterRules.replaceChildren();
  populateAddFilterSelect();
  updateFilterSummary();

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
  const walletAddress = normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase();
  const walletName = normalizedAgentName(getValue(row, "wallet_name")).toLowerCase();
  return walletAddress === mflWalletAddress || walletName === "mfl";
}

const mflStatsOverallFilterOptions = window.__mflAppConfig?.ui?.mflStatsOverallFilters || [];

function mflStatsFilterById(filterId = state.mflStatsOverallFilter) {
  return mflStatsOverallFilterOptions.find((filter) => filter.id === filterId) || mflStatsOverallFilterOptions[0];
}

function rowMatchesMflStatsOverallFilter(row, filter = mflStatsFilterById()) {
  const overall = Number(statDisplayValue(row, "overall"));
  if (!Number.isFinite(overall)) {
    return false;
  }

  return (filter.min === null || overall >= filter.min) && (filter.max === null || overall <= filter.max);
}

function mflStatsCategory(row) {
  if (rowHasHiddenMflJoinedAgencyDate(row)) {
    return "other";
  }

  const seasons = Number(getValue(row, "player_seasons"));
  if (seasons === 1) {
    return "packable";
  }

  if (Number.isFinite(seasons) && seasons >= 2) {
    return "aged";
  }

  return "other";
}

function mflStatsRows() {
  const filter = mflStatsFilterById();
  return state.rows
    .filter((row) => rowIsMflWalletPlayer(row))
    .filter((row) => rowMatchesMflStatsOverallFilter(row, filter));
}

function renderMflStatsFilterButtons() {
  if (!mflStatsOverallFilters) {
    return;
  }

  const fragment = document.createDocumentFragment();
  mflStatsOverallFilterOptions.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mflStatsFilterButton";
    button.classList.toggle("active", filter.id === state.mflStatsOverallFilter);
    button.textContent = filter.label;
    button.addEventListener("click", () => {
      state.mflStatsOverallFilter = filter.id;
      renderMflStatsPage();
    });
    fragment.appendChild(button);
  });

  mflStatsOverallFilters.replaceChildren(fragment);
}

function mflStatsDistributionValue(row) {
  if (state.mflStatsDistributionMode === "age") {
    const age = Number(getValue(row, "age"));
    return Number.isFinite(age) ? age : null;
  }

  const overall = Number(statDisplayValue(row, "overall"));
  return Number.isFinite(overall) ? Math.trunc(overall) : null;
}

function renderMflStatsDistributionModeButtons() {
  if (!mflStatsDistributionModeButtons) {
    return;
  }

  mflStatsDistributionModeButtons.querySelectorAll("button").forEach((button) => {
    const active = button.dataset.distribution === state.mflStatsDistributionMode;
    button.classList.toggle("active", active);
  });
}

function renderMflStatsDistribution(packableRows) {
  if (!mflStatsAgeDistribution) {
    return;
  }

  renderMflStatsDistributionModeButtons();
  if (mflStatsDistributionTitle) {
    mflStatsDistributionTitle.textContent = state.mflStatsDistributionMode === "age"
      ? "Packable Age Distribution"
      : "Packable Overall Distribution";
  }

  const counts = new Map();
  packableRows.forEach((row) => {
    const value = mflStatsDistributionValue(row);
    if (value !== null) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  });

  if (!counts.size) {
    mflStatsAgeDistribution.innerHTML = '<p class="mflStatsEmpty">No packable players match this filter.</p>';
    return;
  }

  const maxCount = Math.max(...counts.values());
  const rows = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  const totalPackable = packableRows.length;
  const fragment = document.createDocumentFragment();
  const histogram = document.createElement("div");
  histogram.className = "mflStatsHistogram";
  histogram.style.setProperty("--mfl-stats-bars", String(rows.length));
  const barWidth = rows.length <= 4 ? 260 : rows.length <= 6 ? 210 : rows.length <= 8 ? 170 : rows.length <= 12 ? 125 : rows.length <= 18 ? 86 : rows.length <= 28 ? 56 : 34;
  histogram.style.setProperty("--mfl-stats-bar-width", `${barWidth}px`);

  rows.forEach(([value, count]) => {
    const barHeight = maxCount > 0 ? Math.max(6, (count / maxCount) * 100) : 0;
    const totalPercent = totalPackable > 0 ? ((count / totalPackable) * 100).toFixed(1) : "0.0";
    const item = document.createElement("div");
    item.className = "mflStatsHistogramItem";
    item.innerHTML = `<div class="mflStatsHistogramBar"><div class="mflStatsHistogramFill" data-tooltip="${escapeHtml(formatCount(count))} (${escapeHtml(totalPercent)}%)" style="--bar-height:${barHeight}%"></div></div><span class="mflStatsHistogramLabel">${escapeHtml(value)}</span>`;
    histogram.appendChild(item);
  });

  fragment.appendChild(histogram);
  mflStatsAgeDistribution.replaceChildren(fragment);
}

function renderMflStatsPage() {
  renderMflStatsFilterButtons();
  const rows = mflStatsRows();
  const packableRows = rows.filter((row) => mflStatsCategory(row) === "packable");
  const agedRows = rows.filter((row) => mflStatsCategory(row) === "aged");
  const otherRows = rows.filter((row) => mflStatsCategory(row) === "other");

  if (mflStatsTotalPlayers) {
    mflStatsTotalPlayers.textContent = formatCount(rows.length);
  }
  if (mflStatsPackablePlayers) {
    mflStatsPackablePlayers.textContent = formatCount(packableRows.length);
  }
  if (mflStatsAgedPlayers) {
    mflStatsAgedPlayers.textContent = formatCount(agedRows.length);
  }
  if (mflStatsOtherPlayers) {
    mflStatsOtherPlayers.textContent = formatCount(otherRows.length);
  }

  renderMflStatsDistribution(packableRows);
}

function rowHasHiddenMflJoinedAgencyDate(row) {
  if (state?.currentPage === "club" || /^\/(?:clubs|club)\/[^/]+(?:\/|$)/i.test(window.location.pathname)) return false;
  if (!rowIsMflWalletPlayer(row)) {
    return false;
  }

  const joinedDay = ownedSinceDay(row);
  return joinedDay !== null && [parseFilterDateDay("2025-10-09"), parseFilterDateDay("2025-10-10")].includes(joinedDay);
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

function applyFilters(options = {}) {
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

  state.filteredRows.sort(compareRows);
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
  selectVisibleInput.disabled = false;
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


function renderTable() {
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
    tableRow.appendChild(selectionCell);

    const actionsCell = document.createElement("td");
    actionsCell.className = "rowActionsCell";
    const actionsContent = document.createElement("span");
    actionsContent.className = "tableControlCellContent tableControlCellContentCentered";
    actionsContent.appendChild(createPlayerTableActionsButton(playerId));
    actionsCell.appendChild(actionsContent);
    tableRow.appendChild(actionsCell);

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
        nameLink.textContent = formatCellValue(row, column);
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
          cell.innerHTML = listingBadge ? `<span class="listingCellTableHost">${listingBadge}</span>` : "";
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
        cell.textContent = formatCellValue(row, column);
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

      tableRow.appendChild(cell);
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

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}


function showTableBusyState() {
  if (window.__mflTableLoadingRuntime?.show?.()) return;
  emptyState.hidden = true;
  emptyState.textContent = "";
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
  if (pageKey) {
    updatePageUrl(pageKey, { updateUrl: true, view: viewName });
  }

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

function mflChunkFromPublicData(chunk) {
  const columns = Array.isArray(chunk?.columns) ? chunk.columns : [];
  const rows = Array.isArray(chunk?.rows) ? chunk.rows : [];
  const walletAddressIndex = columns.indexOf("wallet_address");
  const walletNameIndex = columns.indexOf("wallet_name");
  if (walletAddressIndex < 0 && walletNameIndex < 0) {
    return { columns, rows: [] };
  }

  return {
    columns,
    rows: rows.filter((row) => {
      const walletAddress = walletAddressIndex >= 0 ? normalizeWalletAddress(row[walletAddressIndex]).toLowerCase() : "";
      const walletName = walletNameIndex >= 0 ? normalizedAgentName(row[walletNameIndex]).toLowerCase() : "";
      return walletAddress === mflWalletAddress || walletName === "mfl";
    }),
  };
}

function progressionDataColumns(manifest) {
  return manifest?.files?.progression?.columns || [];
}

function clubRouteTargetFromPath() {
  const match = window.location.pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/(squad|contracts|attributes|current-season|all-time))?\/?$/i);
  if (!match) {
    return null;
  }
  const routeView = String(match[2] || "attributes").toLowerCase();
  return {
    scope: "club",
    clubId: decodeURIComponent(match[1]),
    view: routeView === "current-season" ? "current" : routeView === "all-time" ? "all" : routeView,
  };
}

function incrementalWatchlistPlayerIds(options = {}) {
  const watchlistId = String(options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "");
  const watchlist = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds))
    .find((candidate) => candidate.id === watchlistId);
  return normalizeWatchlistIdList(watchlist?.playerIds || Array.from(state.watchlistPlayerIds));
}

function incrementalRouteTarget(pageName, options = {}) {
  const clubTarget = options.ignoreCurrentClubRoute ? null : clubRouteTargetFromPath();
  if (clubTarget && ["club", "database", "progression"].includes(pageName)) {
    return {
      ...clubTarget,
      pageName,
      access: "public",
    };
  }

  const view = normalizeViewForPage(options.view || state.view || defaultViewForPage(pageName), pageName);
  const base = {
    pageName,
    view,
    access: currentDataAccess(pageName),
  };

  if (pageName === "database") return { ...base, scope: "database" };
  if (pageName === "progression") return { ...base, scope: "progression" };
  if (pageName === "mfl") return { ...base, scope: view === "stats" ? "mflstats" : "mfl" };
  if (pageName === "agents") {
    return {
      ...base,
      scope: "agent",
      walletAddress: normalizeWalletAddress(options.walletAddress || state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase(),
    };
  }
  if (pageName === "watchlist" && hasWalletOptIn()) {
    return {
      ...base,
      scope: "watchlist",
      watchlistId: options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "",
      playerIds: incrementalWatchlistPlayerIds(options),
    };
  }
  if (pageName === "myplayers" && hasWalletOptIn()) return { ...base, scope: "myplayers" };
  if (pageName === "player") {
    return {
      ...base,
      scope: "player",
      playerId: String(options.playerId || playerIdFromUrl() || ""),
      view: "attributes",
    };
  }
  if (pageName === "evaluation") {
    const playerId = String(options.playerId || state.evaluationPlayerId || evaluationPlayerIdFromUrl() || "");
    return playerId
      ? { ...base, scope: "evaluation", playerId, view: "attributes" }
      : { ...base, scope: "empty", view: "attributes" };
  }
  return null;
}

function incrementalDataQuery(route, page = 1) {
  const query = new URLSearchParams({
    mode: "page",
    scope: route.scope,
    view: route.view || "attributes",
    page: String(page),
    pageSize: String(["player", "evaluation"].includes(route.scope)
      ? 1
      : ["club", "mflstats"].includes(route.scope)
        ? 5000
        : state.pageSize),
    sortKey: route.scope === "club" ? "positions" : state.sortKey,
    sortDirection: route.scope === "club" ? "asc" : state.sortDirection,
  });

  if (route.access === "owned") query.set("access", "owned-progression");
  else if (route.access === "full") query.set("access", "full-progression");
  else query.set("access", "public-database");

  if (["current", "all"].includes(route.view)) query.set("includeProgression", "1");
  if (route.playerId) query.set("playerId", route.playerId);
  if (route.clubId) query.set("clubId", route.clubId);
  if (route.walletAddress) query.set("walletAddress", route.walletAddress);
  if (route.playerIds?.length) query.set("playerIds", route.playerIds.join(","));

  const tableRoute = ["database", "progression", "mfl", "agent", "watchlist", "myplayers"].includes(route.scope);
  if (tableRoute) {
    if (hideRetiredInput.checked) query.set("hideRetired", "1");
    if (hideRetiringInput.checked) query.set("hideRetiring", "1");
    if (hideMflPlayersInput?.checked) query.set("hideMfl", "1");
    if (packablePlayersInput?.checked) query.set("packableOnly", "1");
    if (newMintsInput.checked) query.set("newMintsOnly", "1");
    const rules = Array.isArray(route.filterRules) ? route.filterRules : readFilterRules();
    if (rules.length) query.set("filters", JSON.stringify(rules));
  }

  return query;
}

function incrementalRequestDetails(route, page = 1) {
  const query = incrementalDataQuery(route, page);
  const requestKey = query.toString();
  const walletKey = normalizeWalletAddress(state.linkedWalletAddress).toLowerCase() || "guest";
  return {
    query,
    requestKey,
    cacheKey: `${walletKey}:${requestKey}`,
  };
}

const clubViewPayloadCache = new Map();

function clubViewPayloadCacheKey(route) {
  if (!route || route.scope !== "club" || !route.clubId || !route.view) return "";
  return String(route.clubId) + ":" + String(route.view);
}

function rememberClubViewPayload(route, payload) {
  const key = clubViewPayloadCacheKey(route);
  if (!key || !payload || !Array.isArray(payload.rows)) return;
  clubViewPayloadCache.set(key, {
    ...payload,
    columns: Array.isArray(payload.columns) ? [...payload.columns] : [],
    rows: [...payload.rows],
  });
}

function cachedClubViewPayload(route) {
  const key = clubViewPayloadCacheKey(route);
  return key ? clubViewPayloadCache.get(key) || null : null;
}

function cachedIncrementalPayload(route, page = 1) {
  if (!route || route.scope === "empty") {
    return null;
  }
  if (route.scope === "club") {
    const clubPayload = cachedClubViewPayload(route);
    if (clubPayload) return clubPayload;
  }
  return state.incrementalPayloadCache.get(incrementalRequestDetails(route, page).cacheKey) || null;
}

function incrementalRouteIsCached(route, page = 1) {
  return Boolean(cachedIncrementalPayload(route, page));
}

function databaseStatsDataCacheReady() {
  const total = document.getElementById("databaseStatsTotalPlayers");
  if (!(total instanceof HTMLElement)) return false;
  const value = String(total.textContent || "").trim();
  return Boolean(value) && value !== "-";
}

function settingsDataCacheReady() {
  if (typeof hasWalletOptIn !== "function" || !hasWalletOptIn()) return true;
  return state.walletPreferencesLoaded === true && state.walletSettingsLoaded === true;
}

function routeDataCacheReady(pageName, options = {}) {
  const page = String(pageName || "home");
  const routeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};

  if (page === "home") return homeSummaryCacheReady();
  if (page === "notfound" || page === "changelog") return true;
  if (page === "settings") return settingsDataCacheReady();
  if (page === "database" && normalizeViewForPage(routeOptions.view, "database") === "stats") {
    return databaseStatsDataCacheReady();
  }

  const route = incrementalRouteTarget(page, routeOptions);
  if (!route) return false;
  return route.scope === "empty" || incrementalRouteIsCached(route, 1);
}

function currentRouteDataCacheReady() {
  if (!document.documentElement.classList.contains("mflInitialRouteResolved")) return false;
  const target = pageTargetFromPath(window.location.pathname + window.location.search);
  if (!target?.pageName) return false;
  return routeDataCacheReady(target.pageName, target.options || {});
}

Reflect.set(globalThis, "__mflRouteDataCache", Object.freeze({
  isReady: routeDataCacheReady,
  isCurrentRouteReady: currentRouteDataCacheReady,
}));

function applyIncrementalPayload(route, payload) {
  rememberClubViewPayload(route, payload);
  const tableRoute = ["database", "progression", "mfl", "agent", "watchlist", "myplayers", "club"].includes(route.scope);
  state.columns = Array.isArray(payload.columns) ? payload.columns : [];
  rebuildColumnIndexMap();
  state.rows = Array.isArray(payload.rows) ? payload.rows : [];
  state.filteredRows = [...state.rows];
  state.page = Number(payload.page || 1);
  if (tableRoute && !["club"].includes(route.scope)) {
    state.pageSize = Number(payload.pageSize || state.pageSize);
    pageSizeSelect.value = String(state.pageSize);
  }
  state.incrementalMode = tableRoute;
  state.incrementalRoute = { ...route };
  state.incrementalTotalRows = Number(payload.totalRows || 0);
  state.incrementalSourceRows = Number(payload.sourceRows || 0);
  state.tableSourceRowsCount = state.incrementalSourceRows;
  state.dataAccess = route.access;
  state.dataLoaded = true;
  clearRowSortCache();
  if (payload.generatedAt) {
    updateStatusDate(payload.generatedAt);
  }
}

const ROUTE_REQUEST_TIMEOUT_MS = 60_000;
let incrementalRouteRequestGeneration = 0;
let activeIncrementalNetworkRequest = null;

function stopActiveIncrementalNetworkRequest() {
  const active = activeIncrementalNetworkRequest;
  if (!active) return;
  activeIncrementalNetworkRequest = null;
  if (!active.controller.signal.aborted) active.controller.abort();
  if (state.incrementalRequestPromises.get(active.cacheKey) === active.promise) {
    state.incrementalRequestPromises.delete(active.cacheKey);
  }
}

function invalidateIncrementalRouteRequest() {
  incrementalRouteRequestGeneration += 1;
  stopActiveIncrementalNetworkRequest();
  return incrementalRouteRequestGeneration;
}

function beginIncrementalRouteRequest(cacheKey, force = false) {
  const generation = ++incrementalRouteRequestGeneration;
  const active = activeIncrementalNetworkRequest;
  if (active && (force || active.cacheKey !== cacheKey)) {
    stopActiveIncrementalNetworkRequest();
  }
  return generation;
}

function incrementalRouteRequestIsCurrent(generation) {
  return generation === incrementalRouteRequestGeneration;
}

window.__mflCancelIncrementalRouteRequest = invalidateIncrementalRouteRequest;

async function requestIncrementalRoute(route, page = 1, options = {}) {
  const force = Boolean(options.force);

  if (route.scope === "empty") {
    const generation = beginIncrementalRouteRequest("empty", force);
    const payload = {
      columns: state.manifest?.files?.public?.columns || state.columns || [],
      rows: [],
      page: 1,
      pageSize: 1,
      totalRows: 0,
      sourceRows: 0,
      generatedAt: state.manifest?.generated_at || null,
    };
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    applyIncrementalPayload(route, payload);
    state.incrementalMode = false;
    return payload;
  }

  const { requestKey, cacheKey } = incrementalRequestDetails(route, page);
  const generation = beginIncrementalRouteRequest(cacheKey, force);
  if (force) state.incrementalPayloadCache.delete(cacheKey);

  const cachedPayload = !force ? state.incrementalPayloadCache.get(cacheKey) : null;
  if (cachedPayload) {
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    applyIncrementalPayload(route, cachedPayload);
    state.incrementalLastKey = requestKey;
    state.incrementalLastLoadedAt = Date.now();
    return cachedPayload;
  }

  const inheritedTableLoadingRequestToken = Number(options.tableLoadingRequestToken || 0);
  const tableLoadingRequestToken = inheritedTableLoadingRequestToken
    || window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode })
    || 0;

  let requestPromise = force ? null : state.incrementalRequestPromises.get(cacheKey);
  if (!requestPromise) {
    const controller = new AbortController();
    let timedOut = false;
    let timeout = 0;
    let requestRecord = null;
    const networkPromise = (async () => {
      timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, ROUTE_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch("/api/data?" + requestKey, {
          cache: "no-store",
          headers: walletProofHeaders(true),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Could not load this page.");
        }
        if (controller.signal.aborted) return null;
        state.incrementalPayloadCache.set(cacheKey, payload);
        return payload;
      } catch (error) {
        if (error?.name === "AbortError" && !timedOut) return null;
        if (timedOut) throw new Error("Could not load this page.");
        throw error;
      } finally {
        if (timeout) window.clearTimeout(timeout);
      }
    })();

    requestPromise = networkPromise.finally(() => {
      if (state.incrementalRequestPromises.get(cacheKey) === requestPromise) {
        state.incrementalRequestPromises.delete(cacheKey);
      }
      if (activeIncrementalNetworkRequest === requestRecord) {
        activeIncrementalNetworkRequest = null;
      }
    });
    requestRecord = { cacheKey, controller, promise: requestPromise };
    activeIncrementalNetworkRequest = requestRecord;
    state.incrementalRequestPromises.set(cacheKey, requestPromise);
  }

  let payload;
  try {
    payload = await requestPromise;
  } catch (error) {
    window.__mflTableLoadingRuntime?.finishRequest?.(tableLoadingRequestToken);
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    throw error;
  }
  if (!payload || !incrementalRouteRequestIsCurrent(generation)) {
    window.__mflTableLoadingRuntime?.finishRequest?.(tableLoadingRequestToken);
  }
  if (!payload || !incrementalRouteRequestIsCurrent(generation)) return null;
  try {
    applyIncrementalPayload(route, payload);
    state.incrementalLastKey = requestKey;
    state.incrementalLastLoadedAt = Date.now();
    return payload;
  } finally {
    window.__mflTableLoadingRuntime?.finishRequest?.(tableLoadingRequestToken);
  }
}

async function withInteractionBusy(callback) { return callback(); }

async function reloadIncrementalPage(page = state.page, options = {}) {
  const route = incrementalRouteTarget(state.currentPage, {
    view: state.view,
    walletAddress: state.currentAgentWalletAddress,
    watchlistId: state.currentWatchlistId,
  }) || state.incrementalRoute;
  if (!route) {
    return false;
  }

  state.page = page;

  const loadAndRender = async () => {
    try {
      const payload = await requestIncrementalRoute(route, page, { loadingMode: options.loadingMode });
      if (!payload) return false;
      state.incrementalApplying = true;
      try {
        buildHeader();
        applyFilters({ save: options.save !== false });
      } finally {
        state.incrementalApplying = false;
      }
      return true;
    } catch (error) {
      showToast(error?.message || "Could not load this page.");
      return false;
    }
  };

  if (incrementalRouteIsCached(route, page)) {
    return loadAndRender();
  }

  return withInteractionBusy(loadAndRender, options.loadingReason);
}

window.mflReloadIncrementalPage = reloadIncrementalPage;

mflStatsDistributionModeButtons?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-distribution]");
  if (!button) {
    return;
  }

  state.mflStatsDistributionMode = button.dataset.distribution === "age" ? "age" : "overall";
  renderMflStatsPage();
});

let pendingViewButtonPointer = null;
let pointerCommittedViewButton = null;
let pointerCommittedViewButtonTimer = 0;

function activateViewButton(button) {
  if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;
  const pageName = pageNameForViewButton(button);
  const viewName = button.dataset.view;
  if (!viewName) return;

  const activePageName = state.currentPage === "mflstats" ? "mfl" : state.currentPage;
  const activeViewName = state.currentPage === "mflstats" ? "stats" : state.view;
  if (pageName === activePageName && viewName === activeViewName) return;

  if (pageName === activePageName && tablePages.has(pageName)) {
    saveTableStateLocally(currentTableState());
  }

  if (pageName === "club") return;

  if (pageName === "mfl" && viewName === "stats") {
    void runViewTransition("mfl", "stats", { statePageName: "mflstats" }, async () => {
      await setPage("mfl", false, { view: "stats", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (state.currentPage === "mflstats" && pageName === "mfl" && viewName === "attributes") {
    void runViewTransition("mfl", "attributes", { statePageName: "mfl" }, async () => {
      await setPage("mfl", false, { view: "attributes", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (pageName === "database" && viewName === "stats") {
    void runViewTransition("database", "stats", {}, async () => {
      await setPage("database", false, { view: "stats", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (state.currentPage === "database"
      && state.view === "stats"
      && pageName === "database"
      && (viewName === "attributes" || viewName === "contracts")) {
    void runViewTransition("database", viewName, { statePageName: "database" }, async () => {
      await setPage("database", false, {
        view: viewName,
        skipNavigationTransition: true,
        skipNavigationLoading: true,
      });
    });
    return;
  }
  if (pageName !== state.currentPage && tablePages.has(pageName)) {
    state.currentPage = pageName;
    document.body.dataset.page = pageName;
  }
  void runViewTransition(pageName, viewName, {
    walletAddress: state.currentAgentWalletAddress,
    watchlistId: state.currentWatchlistId,
  }, async () => {
    await setView(viewName);
  });
}

function clearPointerCommittedViewButton() {
  pointerCommittedViewButton = null;
  if (pointerCommittedViewButtonTimer) window.clearTimeout(pointerCommittedViewButtonTimer);
  pointerCommittedViewButtonTimer = 0;
}

function commitViewButtonOnPointerRelease(button, event) {
  const pending = pendingViewButtonPointer;
  pendingViewButtonPointer = null;
  if (!pending || pending.button !== button || pending.pointerId !== event.pointerId) return;
  if (event.isPrimary === false || event.button !== 0) return;

  // Commit on the button's own pointerup. This restores the real-pointer path
  // without bringing back the former document-wide table-loading interceptor,
  // synthetic popstate, or click swallowing that could freeze the site.
  pointerCommittedViewButton = button;
  if (pointerCommittedViewButtonTimer) window.clearTimeout(pointerCommittedViewButtonTimer);
  pointerCommittedViewButtonTimer = window.setTimeout(clearPointerCommittedViewButton, 0);
  activateViewButton(button);
}

viewButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    if (event.isPrimary === false || event.button !== 0 || button.disabled || button.hidden) {
      pendingViewButtonPointer = null;
      return;
    }
    pendingViewButtonPointer = { button, pointerId: event.pointerId };
  });
  button.addEventListener("pointerup", (event) => commitViewButtonOnPointerRelease(button, event));
  button.addEventListener("pointercancel", () => {
    if (pendingViewButtonPointer?.button === button) pendingViewButtonPointer = null;
  });
  button.addEventListener("click", (event) => {
    if (pointerCommittedViewButton === button) {
      // A normal mouse click follows pointerup in the same task. The view has
      // already been committed once, so suppress only the duplicate default
      // activation; keyboard-generated clicks still use this handler.
      event.preventDefault();
      clearPointerCommittedViewButton();
      return;
    }
    activateViewButton(button);
  });
});

watchlistButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleWatchlistDropdown();
});

pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(pageSizeSelect.value);
  state.page = 1;
  if (state.incrementalMode) {
    void reloadIncrementalPage(1);
    return;
  }
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


hideMflPlayersInput?.addEventListener("change", () => {
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
  applyAdvancedFilters();
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
  if (state.incrementalMode) {
    void reloadIncrementalPage(Math.max(1, state.page - 1), { loadingMode: "blank" });
    return;
  }
  state.page -= 1;
  renderTable();
});

nextButton.addEventListener("click", () => {
  if (state.incrementalMode) {
    void reloadIncrementalPage(state.page + 1, { loadingMode: "blank" });
    return;
  }
  state.page += 1;
  renderTable();
});

themeButton.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme || "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
  queueThemePreferenceCloudSync();
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
playerSearchClearButton.addEventListener("click", clearPlayerSearch);
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
evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());
evaluationSearchClearButton.addEventListener("click", clearEvaluationSearch);
evaluationSearchInput.addEventListener("focus", renderEvaluationSearchResults);
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
evaluationMflUsdInput.addEventListener("blur", cancelEvaluationMflPerUsd);
evaluationMflUsdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitEvaluationMflPerUsd();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelEvaluationMflPerUsd();
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
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !evaluationLoadModal || evaluationLoadModal.hidden) return;
  event.preventDefault();
  hideEvaluationLoadActionTooltip();
  hideModal(evaluationLoadModal);
});
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

const setPageWithoutRouteLoading = setPage;

navButtons.forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    const pageName = button.dataset.page;
    const reuseCachedEvaluationRoute = pageName === "evaluation" && evaluationPageCacheReady;
    const options = tablePages.has(pageName)
      ? { view: preferredViewForPage(pageName) }
      : pageName === "evaluation"
        ? { plain: true, reuseCachedRoute: reuseCachedEvaluationRoute }
        : {};
    const target = pagePath(pageName, options);
    if (button.classList.contains("active") && target === `${location.pathname}${location.search}`) return;
    if (pageName === "evaluation") preparePlainEvaluationReentry();
    if (reuseCachedEvaluationRoute) {
      await setPageWithoutRouteLoading(pageName, true, options);
      return;
    }
    await setPage(pageName, true, options);
  });
});


function copyDelegatedPlayerId(button, event) {
  const playerId = String(button.dataset.playerId || "").trim();
  if (!playerId) return;
  event.preventDefault();
  event.stopPropagation();
  state.tooltipSuppressedUntil = Date.now() + 350;
  button.blur();
  copyPlayerId(playerId);
}

tableBody?.addEventListener("pointerdown", (event) => {
  if (event.isPrimary === false || event.button !== 0 || !(event.target instanceof Element)) return;
  const button = event.target.closest(".copyPlayerIdButton[data-player-id]");
  if (!(button instanceof HTMLButtonElement) || !tableBody.contains(button)) return;
  copyDelegatedPlayerId(button, event);
});

tableBody?.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const copyButton = event.target.closest(".copyPlayerIdButton[data-player-id]");
  if (copyButton instanceof HTMLButtonElement && tableBody.contains(copyButton)) {
    if (Date.now() < state.tooltipSuppressedUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    copyDelegatedPlayerId(copyButton, event);
    return;
  }

  const selectionInput = event.target.closest('.selectionCell input[type="checkbox"][data-player-id]');
  if (selectionInput instanceof HTMLInputElement && tableBody.contains(selectionInput)) {
    setPlayerSelected(selectionInput.dataset.playerId || "", selectionInput.checked, event.shiftKey);
    return;
  }

  const playerLink = event.target.closest(".playerNameLink[data-player-id]");
  if (playerLink instanceof HTMLAnchorElement && tableBody.contains(playerLink)) {
    event.preventDefault();
    openPlayerPage(playerLink.dataset.playerId || "");
    return;
  }

  const agentLink = event.target.closest(".agentTableLink[data-wallet-address]");
  if (agentLink instanceof HTMLAnchorElement && tableBody.contains(agentLink)) {
    event.preventDefault();
    openAgentPage(agentLink.dataset.walletAddress || "");
    return;
  }

  const clubLink = event.target.closest(".agentTableLink[data-club-id]");
  if (clubLink instanceof HTMLAnchorElement && tableBody.contains(clubLink) && typeof window.mflOpenClubPage === "function") {
    event.preventDefault();
    window.mflOpenClubPage(clubLink.dataset.clubId || "", "attributes");
  }
});

tableBody?.addEventListener("pointermove", (event) => {
  const row = event.target?.closest?.("#tableBody tr");
  const nextId = String(row?.dataset?.playerId || "").trim();
  const interactive = event.target?.closest?.("[data-table-interactive-key]");
  const interactiveKey = String(interactive?.dataset?.tableInteractiveKey || "");

  if (row && nextId && state.hoveredTablePlayerId !== nextId) {
    state.hoveredTablePlayerId = nextId;
    tableBody.querySelectorAll("tr.tableRowHovered").forEach((tableRow) => tableRow.classList.remove("tableRowHovered"));
    row.classList.add("tableRowHovered");
  }

  if (state.hoveredTableInteractiveKey !== interactiveKey) {
    state.hoveredTableInteractiveKey = interactiveKey;
    tableBody.querySelectorAll(".tableInteractiveHovered").forEach((element) => element.classList.remove("tableInteractiveHovered"));
    if (interactive) {
      interactive.classList.add("tableInteractiveHovered");
    }
  }
});

tableBody?.addEventListener("pointerleave", () => {
  state.hoveredTablePlayerId = "";
  state.hoveredTableInteractiveKey = "";
  tableBody.querySelectorAll("tr.tableRowHovered").forEach((tableRow) => tableRow.classList.remove("tableRowHovered"));
  tableBody.querySelectorAll(".tableInteractiveHovered").forEach((element) => element.classList.remove("tableInteractiveHovered"));
});
window.addEventListener("scroll", () => hidePlayerNoteTooltip({ immediate: true }), true);
window.addEventListener("resize", () => hidePlayerNoteTooltip({ immediate: true }));

window.addEventListener("popstate", () => {
  const target = pageTargetFromPath(`${window.location.pathname}${window.location.search}`);
  setPage(target.pageName, false, target.options);
});

accountButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAccountMenu();
});
accountEmail.addEventListener("click", () => {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }
  closeAccountMenu();
  setPage("myplayers");
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
    chevron.textContent = ">";

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
  loadSavedTableState();
  const initialTarget = pageTargetFromPath(`${location.pathname}${location.search}`);
  commitPageTransition(initialTarget.pageName, false, initialTarget.options);
  const startupNavigationSequence = navigationTransitionSequence;
  const earlyGlobalSearch = primeGlobalSearchIndexes();
  const startupSummaryPromise = loadSummary();
  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);
  const startupProgressionPermissionPromise = (
    pageRequiresProgressionPermission(initialTarget.pageName)
    && hasWalletOptIn()
  )
    ? loadWalletPermissions({ force: true })
    : null;
  applyStoredWalletPermission();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
  updateMenuVisibility();
  showAppShell();

  const startupDependencies = [earlyGlobalSearch];
  if (startupProgressionPermissionPromise) startupDependencies.push(startupProgressionPermissionPromise);
  if (initialTarget.pageName === "home") startupDependencies.push(startupSummaryPromise);
  if (["watchlist", "myplayers", "settings", "player", "evaluation"].includes(initialTarget.pageName)) {
    startupDependencies.push(startupWalletPreferencesPromise);
  }
  await Promise.allSettled(startupDependencies);
  applyStoredWalletPermission();
  updateAccountState();
  updateMenuVisibility();

  const initialRouteRuntimeReadyPromise = Reflect.get(window, "__mflInitialRouteRuntimeReadyPromise");
  if (!initialRouteRuntimeReadyPromise || typeof initialRouteRuntimeReadyPromise.then !== "function") {
    throw new Error("Initial route runtime readiness gate is unavailable.");
  }
  await initialRouteRuntimeReadyPromise;

  if (navigationTransitionSequence === startupNavigationSequence) {
    const authoritativeTarget = pageTargetFromPath(`${location.pathname}${location.search}`);
    await showHomeShell(authoritativeTarget.pageName, false, authoritativeTarget.options);
  }

  void Promise.allSettled([startupSummaryPromise, startupWalletPreferencesPromise]).then(() => {
    applyStoredWalletPermission();
    updateAccountState();
  });
}

(() => {
  const maxNoteLength = 100;
  const watchlistViewsKey = "watchlistViews";
  const watchlistViews = {};

  if (typeof sanitizePlayerNote === "function") {
    sanitizePlayerNote = function sanitizePlayerNote100(note) {
      return String(note || "").replace(/\r\n/g, "\n").slice(0, maxNoteLength).trim();
    };
  }

  if (typeof updatePlayerNoteCount === "function") {
    updatePlayerNoteCount = function updatePlayerNoteCount100(input) {
      if (input && input.value.length > maxNoteLength) input.value = input.value.slice(0, maxNoteLength);
      const counter = playerDetail?.querySelector("#playerNotesCount");
      if (counter) counter.textContent = `${input?.value?.length || 0}/${maxNoteLength}`;
    };
  }

  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    renderPlayerPage = function renderPlayerPageWithNoteLimit(playerId) {
      const result = originalRenderPlayerPage.apply(this, arguments);
      const input = playerDetail?.querySelector("#playerNotesInput");
      if (input) {
        input.maxLength = maxNoteLength;
        input.value = input.value.slice(0, maxNoteLength);
        updatePlayerNoteCount(input);
      }
      return result;
    };
  }

  function rememberCurrentWatchlistView() {
    if (state.currentPage === "watchlist" && state.currentWatchlistId && state.view) {
      watchlistViews[state.currentWatchlistId] = state.view;
    }
  }

  if (typeof currentTableState === "function") {
    const originalCurrentTableState = currentTableState;
    currentTableState = function currentTableStateWithWatchlistViews(...args) {
      rememberCurrentWatchlistView();
      return { ...originalCurrentTableState.apply(this, args), [watchlistViewsKey]: { ...watchlistViews } };
    };
  }

  if (typeof stripPersistentSortState === "function") {
    const originalStripPersistentSortState = stripPersistentSortState;
    stripPersistentSortState = function stripPersistentSortStateWithWatchlistViews(tableState) {
      return {
        ...originalStripPersistentSortState.call(this, tableState),
        [watchlistViewsKey]: { ...(tableState?.[watchlistViewsKey] || watchlistViews) },
      };
    };
  }

  if (typeof applyWalletTableState === "function") {
    const originalApplyWalletTableState = applyWalletTableState;
    applyWalletTableState = function applyWalletTableStateWithWatchlistViews(tableState) {
      const incoming = tableState?.[watchlistViewsKey];
      if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
        Object.entries(incoming).forEach(([watchlistId, view]) => {
          if (watchlistId && typeof view === "string") watchlistViews[watchlistId] = view;
        });
      }
      return originalApplyWalletTableState.call(this, tableState);
    };
  }

  if (typeof setView === "function") {
    const originalSetView = setView;
    setView = function setViewWithWatchlistSync(viewName) {
      const result = originalSetView.apply(this, arguments);
      rememberCurrentWatchlistView();
      if (state.currentPage === "watchlist" && typeof saveTableState === "function") saveTableState();
      return result;
    };
  }

  if (typeof switchWatchlist === "function") {
    const originalSwitchWatchlist = switchWatchlist;
    switchWatchlist = function switchWatchlistWithSavedView(watchlistId) {
      rememberCurrentWatchlistView();
      const result = originalSwitchWatchlist.apply(this, arguments);
      const savedView = watchlistViews[String(watchlistId || "")];
      if (savedView && typeof normalizeViewForPage === "function") {
        state.view = normalizeViewForPage(savedView, "watchlist");
        state.page = 1;
        if (typeof updateViewButtons === "function") updateViewButtons();
        if (typeof buildHeader === "function") buildHeader();
        if (typeof applyFilters === "function") applyFilters();
        if (typeof saveTableState === "function") saveTableState();
      }
      return result;
    };
  }
})();

/* Keep MFL Wallet search navigation anchored to Attributes. */

(() => {
  const mflWalletAddress = "0xff8d2bbed8164db0";

  function elementContext(element) {
    if (!element) return "";

    const text = String(element.textContent || "").trim().toLowerCase();
    const attributes = Array.from(element.attributes || [])
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .join(" ")
      .toLowerCase();

    return `${text} ${attributes}`;
  }

  function clickedMflWallet(event) {
    const target = event?.target;
    if (!target?.closest) return false;

    // Inspect only the element that performs the navigation. Do not inspect the
    // whole composed path, because a page ancestor may contain "MFL Wallet"
    // even when an unrelated navigation control was clicked.
    const interactiveElement = target.closest(
      "a,button,[role='button'],[data-wallet-address],[data-agent-wallet],[data-wallet]",
    );

    if (interactiveElement) {
      const context = elementContext(interactiveElement);
      if (context.includes("mfl wallet") || context.includes(mflWalletAddress)) return true;
    }

    // Search results may use a non-interactive row as their click target.
    const searchContainer = target.closest(
      "#searchModal,.searchResults,#playerSearchResults,[class*='searchResult']",
    );
    if (!searchContainer) return false;

    const searchResult = target.closest(
      "li,[role='option'],[data-wallet-address],[data-agent-wallet],[data-wallet],.searchResult,[class*='searchResultItem']",
    );
    if (!searchResult || !searchContainer.contains(searchResult)) return false;

    const context = elementContext(searchResult);
    return context.includes("mfl wallet") || context.includes(mflWalletAddress);
  }

  document.addEventListener("click", (event) => {
    if (!clickedMflWallet(event)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (typeof closeSearch === "function") closeSearch();

    // Always open the MFL Wallet profile on Attributes. This intentionally
    // ignores the last saved MFL view, which may have been Stats.
    window.location.assign("/mfl/attributes");
  }, true);
})();


(() => {
  const mflWalletAddress = "0xff8d2bbed8164db0";

  function keepSidebarExpanded() {
    if (typeof state === "object" && state) state.menuOpen = true;

    [document.body, typeof appShell !== "undefined" ? appShell : null, typeof sidebar !== "undefined" ? sidebar : null, typeof menuRail !== "undefined" ? menuRail : null]
      .filter(Boolean)
      .forEach((element) => {
        element.classList.remove("menuClosed", "sidebarClosed", "sidebarCollapsed", "collapsed");
        element.classList.add("menuOpen");
      });

    if (typeof menuButton !== "undefined" && menuButton) {
      menuButton.disabled = true;
      menuButton.tabIndex = -1;
      menuButton.setAttribute("aria-disabled", "true");
      menuButton.setAttribute("aria-expanded", "true");
      menuButton.style.pointerEvents = "none";
      menuButton.style.cursor = "default";
    }
  }

  if (typeof toggleMenu === "function") {
    toggleMenu = function permanentlyExpandedMenu() {
      keepSidebarExpanded();
    };
  }

  function routeViewFromPath() {
    const match = window.location.pathname.match(/^\/watchlist\/[^/]+\/(attributes|next-overall|contracts|current-season|all-time)\/?$/i);
    if (!match) return "";
    return {
      attributes: "attributes",
      "next-overall": "next",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[match[1].toLowerCase()] || "";
  }

  function enforceWatchlistRouteView(render = true) {
    const routeView = routeViewFromPath();
    if (!routeView || state.currentPage !== "watchlist") return false;

    const normalizedView = typeof normalizeViewForPage === "function"
      ? normalizeViewForPage(routeView, "watchlist")
      : routeView;

    if (state.view === normalizedView) return true;

    state.view = normalizedView;
    state.page = 1;

    if (render) {
      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
    }

    return true;
  }

  if (typeof restoreSavedTableState === "function") {
    const originalRestoreSavedTableState = restoreSavedTableState;
    restoreSavedTableState = function restoreSavedTableStateWithRoute(pageName, options = {}) {
      const routeView = pageName === "watchlist" && !options.view ? routeViewFromPath() : "";
      const result = originalRestoreSavedTableState.call(
        this,
        pageName,
        routeView ? { ...options, view: routeView } : options,
      );
      if (routeView) {
        state.view = typeof normalizeViewForPage === "function"
          ? normalizeViewForPage(routeView, "watchlist")
          : routeView;
      }
      return result;
    };
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = async function setPageWithWatchlistRoute(pageName, updateHash = true, options = {}) {
      const requestedView = pageName === "watchlist" ? String(options?.view || "") : "";
      const routeView = pageName === "watchlist" && !requestedView ? routeViewFromPath() : "";
      const nextOptions = routeView ? { ...options, view: routeView } : options;
      const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);
      if (result === null || !pageNavigationIsCurrent(nextOptions)) return result;
      keepSidebarExpanded();
      if (pageName === "watchlist" && routeView) enforceWatchlistRouteView(true);
      return result;
    };
  }


  document.addEventListener("click", (event) => {
    if (typeof menuButton !== "undefined" && menuButton && (event.target === menuButton || menuButton.contains(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      keepSidebarExpanded();
      return;
    }

  }, true);

  keepSidebarExpanded();
  document.addEventListener("DOMContentLoaded", () => {
    keepSidebarExpanded();
      }, { once: true });
})();

/* Public progression table views */
(() => {
  const PUBLIC_PROGRESSION_VIEWS = ["current", "all"];
  const PUBLIC_TABLE_PAGES = new Set(["watchlist", "club"]);

  tablePages.add("club");
  pageViewOptions.watchlist = Array.from(new Set([
    ...(pageViewOptions.watchlist || []),
    ...PUBLIC_PROGRESSION_VIEWS,
  ]));
  pageViewOptions.club = ["attributes", "contracts", ...PUBLIC_PROGRESSION_VIEWS];
  defaultPageViews.club = "attributes";

  if (typeof allowedViewsForPage === "function") {
    const originalAllowedViewsForPage = allowedViewsForPage;
    allowedViewsForPage = function allowedViewsForPublicTables(pageName = state.currentPage) {
      const allowed = originalAllowedViewsForPage.apply(this, arguments) || [];
      if (!PUBLIC_TABLE_PAGES.has(pageName)) return allowed;
      return Array.from(new Set([...allowed, ...PUBLIC_PROGRESSION_VIEWS]));
    };
  }

  if (typeof normalizeViewForPage === "function") {
    const originalNormalizeViewForPage = normalizeViewForPage;
    normalizeViewForPage = function normalizePublicProgressionView(viewName, pageName = state.currentPage) {
      if (PUBLIC_TABLE_PAGES.has(pageName) && PUBLIC_PROGRESSION_VIEWS.includes(String(viewName || ""))) {
        return String(viewName);
      }
      return originalNormalizeViewForPage.apply(this, arguments);
    };
  }

  if (typeof currentDataAccess === "function") {
    const originalCurrentDataAccess = currentDataAccess;
    currentDataAccess = function currentPublicProgressionDataAccess(pageName = state.currentPage) {
      if (PUBLIC_TABLE_PAGES.has(pageName) && PUBLIC_PROGRESSION_VIEWS.includes(state.view)) {
        return "public";
      }
      return originalCurrentDataAccess.apply(this, arguments);
    };
  }
})();

(() => {
  const CLUB_PAGE = "club";
  const CLUB_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];
  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);
  const POSITION_ORDER = [
    "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "RM", "CM", "LM", "CAM", "RW", "CF", "LW", "ST",
  ];
  const POSITION_RANK = new Map(POSITION_ORDER.map((position, index) => [position, index]));

  let activeClubId = "";
  let openingClub = false;
  const initialClubRoute = clubRoute();
  if (initialClubRoute) setClubSwitching(true);

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function clubRoute(pathname = normalizedPath()) {
    const match = pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/(squad|contracts|attributes|current-season|all-time))?$/i);
    if (!match) return null;
    const routeView = String(match[2] || "").toLowerCase();
    const view = routeView === "current-season"
      ? "current"
      : routeView === "all-time"
        ? "all"
        : routeView;
    return {
      clubId: decodeURIComponent(match[1]),
      view: CLUB_VIEWS.has(view) ? view : "attributes",
    };
  }

  function canonicalClubRoute(clubId = activeClubId, view = state.view) {
    const safeView = view === "current"
      ? "current-season"
      : view === "all"
        ? "all-time"
        : view === "contracts"
          ? "contracts"
          : "squad";
    return `/clubs/${encodeURIComponent(clubId)}/${safeView}`;
  }

  function clubIdColumn() {
    return CLUB_ID_COLUMNS.find((column) => typeof hasColumn === "function" ? hasColumn(column) : state.columns.includes(column)) || "";
  }

  function clubRows(clubId = activeClubId) {
    const idColumn = clubIdColumn();
    if (!clubId || !idColumn || !Array.isArray(state.rows)) return [];
    return state.rows.filter((row) => String(getValue(row, idColumn)) === String(clubId));
  }

  function clubName(clubId = activeClubId) {
    const row = clubRows(clubId)[0];
    return row ? String(getValue(row, "active_contract_club_name") || `Club ${clubId}`) : `Club ${clubId}`;
  }

  function clubDivision(clubId = activeClubId) {
    const row = clubRows(clubId)[0];
    return row && typeof contractDivisionInfo === "function"
      ? contractDivisionInfo(getValue(row, "active_contract_club_division"))
      : null;
  }

  function renderClubTitle() {
    if (typeof tablePageTitle === "undefined" || !tablePageTitle) return;
    const division = clubDivision();
    if (!division) {
      tablePageTitle.textContent = clubName();
      return;
    }

    const divisionLabel = document.createElement("span");
    divisionLabel.className = "clubPageTitleDivision";
    divisionLabel.style.color = division.color;
    divisionLabel.textContent = division.name;
    tablePageTitle.replaceChildren(
      document.createTextNode(`${clubName()} - `),
      divisionLabel,
    );
  }

  function primaryPosition(row) {
    if (typeof playerPositions === "function") {
      return String(playerPositions(row)?.[0] || "").trim().toUpperCase();
    }
    return String(getValue(row, "positions") || "").split(",")[0].trim().toUpperCase();
  }

  function compareClubRows(a, b) {
    const aPosition = primaryPosition(a);
    const bPosition = primaryPosition(b);
    const aRank = POSITION_RANK.has(aPosition) ? POSITION_RANK.get(aPosition) : POSITION_ORDER.length;
    const bRank = POSITION_RANK.has(bPosition) ? POSITION_RANK.get(bPosition) : POSITION_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;

    const aOverall = Number(getValue(a, "overall"));
    const bOverall = Number(getValue(b, "overall"));
    if (Number.isFinite(aOverall) && Number.isFinite(bOverall) && aOverall !== bOverall) return bOverall - aOverall;
    return String(getValue(a, "name") || "").localeCompare(String(getValue(b, "name") || ""));
  }

  function setClubSwitching(active) {
    document.body.classList.toggle("clubViewSwitching", active);
    if (active) {
      document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
    }
  }

  function finishClubSwitch() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
        setClubSwitching(false);
        resolve();
      });
    });
  }


  function hideClubPageControls() {
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = true;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      pager.hidden = true;
    });
  }




  function applyClubPresentation() {
    if (state.currentPage !== CLUB_PAGE || !activeClubId) return;
    document.body.dataset.page = CLUB_PAGE;
    document.querySelectorAll(".navButton").forEach((link) => link.classList.remove("active"));
    renderClubTitle();
    hideClubPageControls();
  }

  function openClubImmediately(clubId, view = "attributes") {
    void openClubPage(clubId, view, true);
  }
  window.mflOpenClubPage = openClubImmediately;

  function clubSearchEntries(query) {
    const idColumn = clubIdColumn();
    if (!query || !idColumn || !Array.isArray(state.rows)) return [];
    const normalizedQuery = typeof normalizeSearchText === "function" ? normalizeSearchText(query) : String(query).toLowerCase();
    const clubs = new Map();

    state.rows.forEach((row) => {
      const clubId = String(getValue(row, idColumn) || "").trim();
      const name = String(getValue(row, "active_contract_club_name") || "").trim();
      if (!clubId || !name || clubs.has(clubId)) return;
      const searchable = typeof normalizeSearchText === "function"
        ? normalizeSearchText(`${name} ${clubId}`)
        : `${name} ${clubId}`.toLowerCase();
      if (searchable.includes(normalizedQuery)) {
        const divisionRank = typeof contractDivisionSortValue === "function"
          ? contractDivisionSortValue(getValue(row, "active_contract_club_division"))
          : null;
        clubs.set(clubId, {
          clubId,
          name,
          divisionRank: divisionRank ?? Number.POSITIVE_INFINITY,
        });
      }
    });

    return Array.from(clubs.values())
      .sort((a, b) => a.divisionRank - b.divisionRank || a.name.localeCompare(b.name))
      .slice(0, 5);
  }

  function addClubSearchResults() {
    if (typeof playerSearchInput === "undefined" || typeof playerSearchResults === "undefined") return;
    const query = String(playerSearchInput.value || "").trim();
    const entries = clubSearchEntries(query);
    if (!entries.length) return;

    const fragment = document.createDocumentFragment();
    entries.forEach(({ clubId, name }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "searchResult clubSearchResult";
      button.dataset.clubId = clubId;
      button.dataset.searchKey = recentClubKey(clubId);
      const safeName = typeof escapeHtml === "function" ? escapeHtml(name) : name;
      const safeId = typeof escapeHtml === "function" ? escapeHtml(clubId) : clubId;
      button.innerHTML = `<strong>${safeName}</strong><span>Club &middot; #${safeId}</span>`;
      button.addEventListener("click", () => {
        if (typeof closeSearch === "function") closeSearch();
        openClubImmediately(clubId, "attributes");
      });
      fragment.appendChild(button);
    });
    playerSearchResults.prepend(fragment);
    playerSearchResults.classList.add("filledSearchResults");
  }

  async function openClubPage(clubId, view = "attributes", updateHistory = true) {
    if (!clubId || openingClub) return;
    openingClub = true;
    try {
      activeClubId = String(clubId);
      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";
      const route = canonicalClubRoute(activeClubId, nextView);
      const routeAlreadyCommitted = state.currentPage === CLUB_PAGE && normalizedPath() === route;
      if (!routeAlreadyCommitted) {
        const transition = await runPageTransition(CLUB_PAGE, updateHistory, {
          view: nextView,
          clubId: activeClubId,
          path: route,
          replace: !updateHistory,
        });
        if (!transition) return;
      }
      setClubSwitching(true);

      const dataRoute = typeof incrementalRouteTarget === "function"
        ? incrementalRouteTarget(CLUB_PAGE, { view: nextView })
        : null;
      let dataPayload = true;
      const loadClubData = async () => {
        if (dataRoute && typeof requestIncrementalRoute === "function") {
          if (!incrementalRouteIsCached(dataRoute, 1)) {
            renderIncrementalLoadingState(CLUB_PAGE, dataRoute);
          }
          dataPayload = await requestIncrementalRoute(dataRoute, 1);
        }
      };
      if (!dataRoute || incrementalRouteIsCached(dataRoute, 1)) {
        await loadClubData();
      } else {
        await withInteractionBusy(loadClubData, Reflect.get(window, "__mflInteractionBusy")?.reason);
      }
      if (!dataPayload) return;

      state.currentPage = CLUB_PAGE;
      state.view = nextView;
      state.dataAccess = typeof currentDataAccess === "function" ? currentDataAccess(CLUB_PAGE) : "public";
      document.body.dataset.page = CLUB_PAGE;
      homePage.hidden = true;
      progressionPage.hidden = false;
      mflStatsPage.hidden = true;
      myPlayersLockedPage.hidden = true;
      evaluationPage.hidden = true;
      playerPage.hidden = true;
      settingsPage.hidden = true;
      changelogPage.hidden = true;
      state.page = 1;
      state.pageSize = Math.max(100, clubRows().length || 100);
      if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) pageSizeSelect.value = String(state.pageSize);
      if (typeof filterRules !== "undefined" && filterRules) filterRules.replaceChildren();
      if (typeof hideRetiredInput !== "undefined" && hideRetiredInput) hideRetiredInput.checked = false;
      if (typeof hideRetiringInput !== "undefined" && hideRetiringInput) hideRetiringInput.checked = false;
      if (typeof hideMflPlayersInput !== "undefined" && hideMflPlayersInput) hideMflPlayersInput.checked = false;
      if (typeof newMintsInput !== "undefined" && newMintsInput) newMintsInput.checked = false;

      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
      applyClubPresentation();
    } finally {
      openingClub = false;
      await finishClubSwitch();
    }
  }

  if (typeof compareRows === "function") {
    const originalCompareRows = compareRows;
    compareRows = function compareRowsWithClubPositionOrder(a, b) {
      if (state.currentPage === CLUB_PAGE) return compareClubRows(a, b);
      return originalCompareRows(a, b);
    };
  }




  if (typeof renderSearchResultsNow === "function") {
    const originalRenderSearchResultsNow = renderSearchResultsNow;
    renderSearchResultsNow = function renderSearchResultsNowWithClubs() {
      const result = originalRenderSearchResultsNow.apply(this, arguments);
      addClubSearchResults();
      return result;
    };
  }



  document.addEventListener("click", (event) => {
    if (state.currentPage !== CLUB_PAGE) return;
    const viewButton = event.target.closest?.(".viewButton[data-view]");
    if (!viewButton || !CLUB_VIEWS.has(viewButton.dataset.view)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const nextView = viewButton.dataset.view;
    if (nextView === state.view) return;
    if (nextView === state.view) return;
    void runViewTransition(CLUB_PAGE, nextView, {
      statePageName: CLUB_PAGE,
      path: canonicalClubRoute(activeClubId, nextView),
      replace: true,
      sortKey: "positions",
      sortDirection: "asc",
    }, async () => {
      setClubSwitching(true);
      try {
        if (typeof window.mflLoadIncrementalRoutePage === "function") {
          await window.mflLoadIncrementalRoutePage("club", { view: nextView });
        } else {
          if (typeof buildHeader === "function") buildHeader();
          if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
        }
      } finally {
        await finishClubSwitch();
      }
    });
  }, true);

  window.addEventListener("popstate", () => {
    const route = clubRoute();
    if (route) void openClubPage(route.clubId, route.view, false);
  });

  function bootClubRoute() {
    const path = normalizedPath();
    if (/^\/(?:clubs|club)$/i.test(path)) {
      window.location.replace("/");
      return;
    }
    const route = clubRoute(path);
    if (!route || initialClubRoute) return;
    const canonicalRoute = canonicalClubRoute(route.clubId, route.view);
    if (path !== canonicalRoute) window.history.replaceState({}, "", canonicalRoute);
    void openClubPage(route.clubId, route.view, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootClubRoute, { once: true });
  } else {
    bootClubRoute();
  }
})();

(() => {
  const VERSION = String(window.__mflReleaseVersion || "");
  const MAX_SEARCH_RESULTS = 5;
  const MAX_TYPED_SEARCH_RESULTS = 15;
  const RECENT_CLUBS_STORAGE_KEY = "mfl-recent-search-clubs";
  const CLUB_ID_COLUMNS = ["active_contract_club_id", "club_id", "current_club_id", "active_club_id"];

  function clubIdColumn() {
    if (!Array.isArray(state?.columns)) return "";
    return CLUB_ID_COLUMNS.find((column) => state.columns.includes(column)) || "";
  }

  function clubRowById(clubId) {
    const idColumn = clubIdColumn();
    if (!idColumn || !Array.isArray(state?.rows)) return null;
    return state.rows.find((row) => String(getValue(row, idColumn) || "").trim() === String(clubId).trim()) || null;
  }

  function clubIdFromResult(button) {
    if (button.dataset.clubId) return button.dataset.clubId;
    const info = String(button.querySelector(":scope > span")?.textContent || "");
    const match = info.match(/#([^\s·]+)/);
    const clubId = match ? match[1].trim() : "";
    if (clubId) button.dataset.clubId = clubId;
    return clubId;
  }

  function normalizedClubSearchData(clubId) {
    const row = clubRowById(clubId);
    if (!row) return null;
    const name = String(getValue(row, "active_contract_club_name") || "").trim();
    const division = typeof contractDivisionInfo === "function"
      ? contractDivisionInfo(getValue(row, "active_contract_club_division"))
      : null;
    return name ? { clubId: String(clubId), name, division } : null;
  }

  function normalizeClubResult(button) {
    const clubId = clubIdFromResult(button);
    const data = normalizedClubSearchData(clubId);
    const title = button.querySelector(":scope > strong");
    const info = button.querySelector(":scope > span");
    if (!data || !title || !info) {
      button.remove();
      return;
    }

    button.dataset.clubId = data.clubId;
    title.textContent = data.name;
    info.replaceChildren(document.createTextNode(`Club · #${data.clubId}`));
    if (data.division) {
      info.append(document.createTextNode(" · "));
      const label = document.createElement("span");
      label.className = "clubSearchDivision";
      label.textContent = data.division.name;
      label.style.color = data.division.color;
      info.appendChild(label);
    }
  }

  function readRecentClubs() {
    try {
      const value = JSON.parse(localStorage.getItem(RECENT_CLUBS_STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, MAX_SEARCH_RESULTS) : [];
    } catch {
      return [];
    }
  }

  function rememberClub(clubId) {
    const key = String(clubId || "").trim();
    if (!key) return;
    const recent = [key, ...readRecentClubs().filter((id) => id !== key)].slice(0, MAX_SEARCH_RESULTS);
    try {
      localStorage.setItem(RECENT_CLUBS_STORAGE_KEY, JSON.stringify(recent));
    } catch {
      // Combined recent search state still works for this session.
    }

    const searchKey = recentClubKey(key);
    state.recentSearchItems = mergeRecentIdLists([searchKey], state.recentSearchItems);
    persistRecentSearchStates();
    saveTableState();
  }

  function createRecentClubResult(clubId) {
    const data = normalizedClubSearchData(clubId);
    if (!data) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "searchResult clubSearchResult recentClubSearchResult";
    button.dataset.clubId = data.clubId;
    button.dataset.searchKey = recentClubKey(data.clubId);
    const title = document.createElement("strong");
    title.textContent = data.name;
    const info = document.createElement("span");
    button.append(title, info);
    normalizeClubResult(button);
    button.addEventListener("click", () => {
      rememberClub(data.clubId);
      if (typeof closeSearch === "function") closeSearch();
      if (typeof window.mflOpenClubPage === "function") {
        window.mflOpenClubPage(data.clubId, "contracts");
      }
    });
    return button;
  }

  function prependRecentClubs() {
    if (typeof playerSearchInput === "undefined" || typeof playerSearchResults === "undefined") return;
    if (String(playerSearchInput.value || "").trim()) return;
    const fragment = document.createDocumentFragment();
    readRecentClubs().forEach((clubId) => {
      const result = createRecentClubResult(clubId);
      if (result) fragment.appendChild(result);
    });
    if (fragment.childElementCount) playerSearchResults.prepend(fragment);
  }

  function finalizeSearchResults() {
    if (typeof playerSearchResults === "undefined" || !playerSearchResults) return;
    playerSearchResults.querySelectorAll(".clubSearchResult").forEach(normalizeClubResult);

    const query = String(playerSearchInput?.value || "").trim();
    const directResults = Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"));
    const seen = new Set();
    directResults.forEach((result) => {
      const key = result.dataset.searchKey
        || (result.classList.contains("clubSearchResult") ? recentClubKey(clubIdFromResult(result)) : "");
      if (key) result.dataset.searchKey = key;
      if (key && seen.has(key)) result.remove();
      else if (key) seen.add(key);
    });

    if (!query) {
      const existingByKey = new Map(
        Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"))
          .filter((result) => result.dataset.searchKey)
          .map((result) => [result.dataset.searchKey, result]),
      );
      const ordered = [];
      state.recentSearchItems.slice(0, MAX_SEARCH_RESULTS).forEach((key) => {
        let result = existingByKey.get(key) || null;
        if (!result && key.startsWith("club:")) {
          result = createRecentClubResult(key.slice(5));
        }
        if (result && !ordered.includes(result)) ordered.push(result);
      });

      if (ordered.length) {
        playerSearchResults.replaceChildren(...ordered.slice(0, MAX_SEARCH_RESULTS));
        playerSearchResults.classList.add("filledSearchResults");
      } else {
        playerSearchResults.innerHTML = '<div class="searchHint">Recent searches will appear here.</div>';
        playerSearchResults.classList.remove("filledSearchResults");
      }
      return;
    }

    const resultPriority = (result) => {
      if (result.classList.contains("clubSearchResult")) return 1;
      return result.dataset.searchKey?.startsWith("agent:") ? 2 : 0;
    };
    const results = Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"))
      .sort((a, b) => resultPriority(a) - resultPriority(b));
    results.forEach((result) => playerSearchResults.appendChild(result));
    results.slice(MAX_TYPED_SEARCH_RESULTS).forEach((result) => result.remove());
    const visibleResults = playerSearchResults.querySelectorAll(":scope > .searchResult");
    playerSearchResults.querySelectorAll(":scope > .searchHint").forEach((hint) => {
      if (visibleResults.length) hint.remove();
    });
    playerSearchResults.classList.toggle("filledSearchResults", visibleResults.length > 0);
  }

  if (typeof renderSearchResultsNow === "function") {
    const originalRenderSearchResultsNow = renderSearchResultsNow;
    renderSearchResultsNow = function renderSearchResultsNowV1500() {
      const result = originalRenderSearchResultsNow.apply(this, arguments);
      finalizeSearchResults();
      return result;
    };
  }

  document.addEventListener("click", (event) => {
    const result = event.target.closest?.(".clubSearchResult");
    if (result) rememberClub(clubIdFromResult(result));
  }, true);

  function setFooterVersion() {
    window.__mflStaticUiRuntime?.sync?.();
  }

  function createChangelogItem() {
    const item = document.createElement("li");
    item.dataset.version = VERSION;
    const version = document.createElement("span");
    version.textContent = `v${VERSION}`;
    const description = document.createElement("p");
    description.textContent = "Prioritize Search results and hide Evaluation scrollbars";
    item.append(version, description);
    return item;
  }

  function collapseOlderChangelogSections(list) {
    Array.from(list.querySelectorAll(":scope > .changelogMinorSection")).forEach((section, index) => {
      const expanded = index === 0;
      section.classList.toggle("is-expanded", expanded);
      section.querySelector(":scope > .changelogMinorToggle")?.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  function addChangelogSection() {
    const list = document.querySelector(".changelogList");
    if (!list) return;
    const minorVersion = `v${VERSION.split(".").slice(0, 2).join(".")}`;
    const looseMinorEntries = Array.from(list.children).filter((child) =>
      !child.classList.contains("changelogMinorSection")
      && child.querySelector(":scope > span")?.textContent?.startsWith(`${minorVersion}.`),
    );
    let section = Array.from(list.querySelectorAll(":scope > .changelogMinorSection")).find((candidate) =>
      candidate.querySelector(".changelogMinorVersion")?.textContent === minorVersion,
    );
    if (!section) {
      section = document.createElement("li");
      section.className = "changelogMinorSection";
      const toggle = document.createElement("button");
      toggle.className = "changelogMinorToggle";
      toggle.type = "button";
      const title = document.createElement("span");
      title.className = "changelogMinorVersion";
      title.textContent = minorVersion;
      const meta = document.createElement("span");
      meta.className = "changelogMinorMeta";
      meta.textContent = "1 patch";
      const chevron = document.createElement("span");
      chevron.className = "changelogMinorChevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = ">";
      toggle.append(title, meta, chevron);
      const panel = document.createElement("div");
      panel.className = "changelogMinorPanel";
      const inner = document.createElement("div");
      inner.className = "changelogMinorPanelInner";
      const patchList = document.createElement("ol");
      patchList.className = "changelogPatchList";
      looseMinorEntries.forEach((entry) => patchList.appendChild(entry));
      if (!Array.from(patchList.children).some((item) =>
        item.querySelector("span")?.textContent?.trim() === `v${VERSION}`,
      )) {
        patchList.prepend(createChangelogItem());
      }
      inner.appendChild(patchList);
      panel.appendChild(inner);
      section.append(toggle, panel);
      toggle.addEventListener("click", () => {
        const expanded = section.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      list.prepend(section);
    } else {
      const patchList = section.querySelector(".changelogPatchList");
      looseMinorEntries.forEach((entry) => patchList?.appendChild(entry));
      if (!Array.from(section.querySelectorAll(".changelogPatchList > li")).some((item) =>
        item.querySelector("span")?.textContent?.trim() === `v${VERSION}`,
      )) {
        patchList?.prepend(createChangelogItem());
      }
    }
    const patchList = section.querySelector(".changelogPatchList");
    Array.from(patchList?.children || [])
      .sort((a, b) => String(b.querySelector("span")?.textContent || "").localeCompare(
        String(a.querySelector("span")?.textContent || ""),
        undefined,
        { numeric: true },
      ))
      .forEach((entry) => patchList.appendChild(entry));
    const patchCount = section.querySelectorAll(".changelogPatchList > li").length;
    const meta = section.querySelector(".changelogMinorMeta");
    if (meta) meta.textContent = `${patchCount} ${patchCount === 1 ? "patch" : "patches"}`;
    collapseOlderChangelogSections(list);
  }


  function initialize() {
    setFooterVersion();
    finalizeSearchResults();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();

/* Layout-centered feedback and transition-free shared views */
(() => {
  function syncLayoutCenter() {
    const selection = document.querySelector("#selectionBar");
    const pageLayout = document.querySelector("main");
    if (!pageLayout) return;
    const bounds = pageLayout.getBoundingClientRect();
    const center = `${bounds.left + (bounds.width / 2)}px`;
    window.__mflToastPosition?.sync?.();
    selection?.style.setProperty("--selection-center-x", center);
  }

  if (typeof showToast === "function") {
    const originalShowToast = showToast;
    showToast = function showLayoutCenteredToast() {
      const result = originalShowToast.apply(this, arguments);
      syncLayoutCenter();
      return result;
    };
  }

  window.addEventListener("resize", syncLayoutCenter, { passive: true });
  new MutationObserver(syncLayoutCenter).observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "data-page"],
  });
  syncLayoutCenter();
})();

/* Session-cached incremental route data and destination-first loading */
(() => {
  const originalApplyFilters = applyFilters;
  const originalSetPage = setPage;
  const originalSetView = setView;
  const originalRenderSearchResultsNow = renderSearchResultsNow;

  function filterRulesForLoading(pageName, savedState, viewName) {
    const normalizedView = normalizeViewForPage(viewName || savedState?.view, pageName);
    const columns = (pageName === "mfl" || pageName === "agents")
      ? baseFilterColumns.filter((column) => column !== agentColumn && (pageName !== "mfl" || column !== contractStatusFilterColumn))
      : [...baseFilterColumns];

    if (normalizedView === "current") {
      columns.push(...statColumns.map((column) => `${column}_prog_current_season`));
    } else if (normalizedView === "all") {
      columns.push(...statColumns.map((column) => `${column}_prog_all`));
    }

    const allowedColumns = new Set(columns);
    return (savedState?.rules || [])
      .filter((rule) => allowedColumns.has(rule.column))
      .filter((rule) => (rule.operator === "between" || rule.operator === "during")
        ? String(rule.value || "").trim() && String(rule.valueTo || "").trim()
        : String(rule.value || "").trim())
      .map((rule) => ({ ...rule }));
  }

  function prepareIncrementalRoute(pageName, options = {}) {
    const clubTarget = options.ignoreCurrentClubRoute ? null : clubRouteTargetFromPath();
    const storedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)
      ? state.tablePageStates?.[pageName] || defaultTablePageState(pageName)
      : null;
    const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;
    const savedPageState = resetFilters && storedPageState
      ? tableStateWithoutPageFilters(pageName, storedPageState)
      : storedPageState;
    if (resetFilters && savedPageState) state.tablePageStates[pageName] = savedPageState;
    if (savedPageState) {
      restoreSavedTableState(pageName, { view: options.view, deferRules: true });
    } else if (clubTarget) {
      state.view = clubTarget.view;
      state.page = 1;
    }

    if (pageName === "agents") {
      state.currentAgentWalletAddress = normalizeWalletAddress(options.walletAddress || agentWalletAddressFromUrl()).toLowerCase();
    }

    if (pageName === "watchlist" && hasWalletOptIn()) {
      const requestedWatchlistId = String(options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "");
      const watchlist = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds))
        .find((candidate) => candidate.id === requestedWatchlistId);
      if (watchlist) {
        state.currentWatchlistId = watchlist.id;
        setActiveWatchlistIds(watchlist.playerIds);
      }
    }

    const route = incrementalRouteTarget(pageName, options);
    if (route && savedPageState) {
      route.filterRules = filterRulesForLoading(pageName, savedPageState, route.view);
    }
    return route;
  }

  function commitIncrementalLocation(pageName, updateHash, options = {}) {
    if (options.replaceUrl && `${window.location.pathname}${window.location.search}` !== options.replaceUrl) {
      window.history.replaceState({}, "", options.replaceUrl);
      return;
    }
    updatePageUrl(pageName, {
      ...options,
      updateUrl: updateHash,
    });
  }

  function incrementalLoadingPageName(pageName, route) {
    if (route.scope === "club") return "club";
    if (route.scope === "agent") return "agents";
    return pageName;
  }

  const shellFirstTablePages = new Set();

  function renderTableDestinationShell(pageName, route = null) {
    if (!shellFirstTablePages.has(pageName)) {
      return;
    }

    state.currentPage = pageName;
    document.body.dataset.page = pageName;
    homePage.hidden = true;
    progressionPage.hidden = false;
    mflStatsPage.hidden = true;
    myPlayersLockedPage.hidden = true;
    evaluationPage.hidden = true;
    playerPage.hidden = true;
    settingsPage.hidden = true;
    changelogPage.hidden = true;
    tablePageTitle.textContent = tableTitleForPage(pageName);
    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.page === pageName);
    });
    if (route && route.scope !== "empty" && !incrementalRouteIsCached(route, 1)) {
      showTableBusyState();
    }
    syncHomeLoginButton();
  }

  function renderIncrementalLoadingState(pageName, route) {
    const loadingPageName = incrementalLoadingPageName(pageName, route);
    const tableRoute = ["database", "progression", "mfl", "agent", "watchlist", "myplayers", "club"].includes(route.scope);
    const mflStatsActive = route.scope === "mflstats";
    const playerPageActive = route.scope === "player";
    const evaluationPageActive = route.scope === "evaluation";

    state.currentPage = loadingPageName;
    state.view = route.view || state.view;
    document.body.dataset.page = loadingPageName;
    homePage.hidden = true;
    progressionPage.hidden = !tableRoute;
    mflStatsPage.hidden = !mflStatsActive;
    myPlayersLockedPage.hidden = true;
    evaluationPage.hidden = !evaluationPageActive;
    playerPage.hidden = !playerPageActive;
    settingsPage.hidden = true;
    changelogPage.hidden = true;

    navButtons.forEach((button) => {
      button.classList.toggle("active", route.scope !== "club" && button.dataset.page === pageName);
    });

    if (tableRoute) {
      if (route.scope !== "club") globalThis.syncQuickFilterLabels?.();
      if (route.scope === "club") {
        const club = state.clubSearchIndex.find((entry) => entry.clubId === String(route.clubId || ""));
        tablePageTitle.textContent = club?.name || "Club";
      } else {
        tablePageTitle.textContent = tableTitleForPage(pageName);
      }
      updateViewButtons();
      showTableBusyState();
    } else if (mflStatsActive) {
      state.view = "stats";
      updateViewButtons();
      if (mflStatsTotalPlayers) mflStatsTotalPlayers.textContent = "-";
      if (mflStatsPackablePlayers) mflStatsPackablePlayers.textContent = "-";
      if (mflStatsAgedPlayers) mflStatsAgedPlayers.textContent = "-";
      if (mflStatsOtherPlayers) mflStatsOtherPlayers.textContent = "-";
      if (mflStatsAgeDistribution) {
        mflStatsAgeDistribution.replaceChildren();
      }
    } else if (playerPageActive && playerDetail) {
      const playerId = String(route.playerId || "").trim();
      const pendingContext = window.__mflPlayerFirstPaintPendingContext;
      const matchingContext = String(pendingContext?.playerId || "").trim() === playerId
        ? pendingContext
        : { playerId };
      window.__mflPlayerFirstPaintPendingContext = matchingContext;
      window.__mflPlayerFirstPaintRuntime?.beginDetailNavigation?.(matchingContext);
      window.__mflPlayerFirstPaintRuntime?.renderPending?.(matchingContext);
    } else if (evaluationPageActive) {
      evaluationPanel.hidden = true;
      evaluationSearchResults.hidden = true;
    }

    syncHomeLoginButton();
  }

  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route, requestOptions = {}) {
    const payload = await requestIncrementalRoute(route, 1, requestOptions);
    if (!payload) return false;
    if (tablePages.has(pageName)) {
      restoreSavedTableState(pageName, { view: route.view || options.view });
    }
    state.dataAccess = currentDataAccess(pageName);
    state.incrementalApplying = true;
    try {
      return await originalSetPage.call(this, pageName, false, {
        ...options,
        replaceUrl: "",
        skipNavigationLoading: true,
      });
    } finally {
      state.incrementalApplying = false;
    }
  }

  applyFilters = function applyFiltersWithIncrementalData(options = {}) {
    if (!state.incrementalMode || state.incrementalApplying || options.localOnly) {
      return originalApplyFilters.apply(this, arguments);
    }

    state.page = 1;
    void reloadIncrementalPage(1, { save: options.save !== false, loadingMode: "blank" });
    return undefined;
  };

  setView = async function setIncrementalView(viewName) {
    const pageName = state.currentPage;
    if (!tablePages.has(pageName)) {
      return originalSetView.apply(this, arguments);
    }
    const nextView = normalizeViewForPage(viewName, pageName);
    if (!allowedViewsForPage(pageName).includes(nextView)) return;

    const routeOptions = {
      view: nextView,
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
    };
    const route = incrementalRouteTarget(pageName, routeOptions);
    if (!route) return originalSetView.call(this, nextView);

    const stagedTransition = takeStagedViewTransition(pageName, nextView);
    const pageKey = tablePageKey();
    const previousCurrentPage = stagedTransition?.previousCurrentPage || state.currentPage;
    const previousView = stagedTransition?.previousView || state.view;
    const previousPage = stagedTransition?.previousPage ?? state.page;
    const previousSortKey = stagedTransition?.previousSortKey || state.sortKey;
    const previousSortDirection = stagedTransition?.previousSortDirection || state.sortDirection;
    const previousPath = stagedTransition?.previousPath || currentNavigationPath();

    if (pageKey) {
      const existingPageState = state.tablePageStates[pageKey] || currentTablePageState();
      state.tablePageStates[pageKey] = {
        ...existingPageState,
        viewSortStates: {
          ...(existingPageState.viewSortStates || {}),
          [previousView]: {
            sortKey: previousSortKey,
            sortDirection: previousSortDirection,
          },
        },
      };
    }

    const targetSortState = normalizedViewSortState(
      pageKey ? state.tablePageStates[pageKey]?.viewSortStates?.[nextView] : null,
      nextView,
    );
    if (stagedTransition) {
      state.sortKey = targetSortState.sortKey;
      state.sortDirection = targetSortState.sortDirection;
    } else {
      const transition = await runViewTransition(pageName, nextView, {
        ...routeOptions,
        sortKey: targetSortState.sortKey,
        sortDirection: targetSortState.sortDirection,
      });
      if (!transition) return;
    }

    const loadAndRender = async () => {
      try {
        const payload = await requestIncrementalRoute(route, 1);
        if (!payload) return;
        state.incrementalApplying = true;
        try {
          return await originalSetView.call(this, nextView);
        } finally {
          state.incrementalApplying = false;
        }
      } catch (error) {
        state.currentPage = previousCurrentPage;
        state.view = previousView;
        state.page = previousPage;
        state.sortKey = previousSortKey;
        state.sortDirection = previousSortDirection;
        if (`${window.location.pathname}${window.location.search}` !== previousPath) {
          window.history.replaceState({}, "", previousPath);
        }
        updateViewButtons();
        showToast(error?.message || "Could not load this view.");
      }
    };

    if (incrementalRouteIsCached(route, 1)) return loadAndRender();
    return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);
  };

  setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {
    const progressionLoadingRequestToken = pageName === "progression" && !routeDataCacheReady(pageName, options)
      ? window.__mflTableLoadingRuntime?.beginRequest?.("progression") || 0
      : 0;
    const navigationUpdatesHistory = updateHash;
    if (!options.skipNavigationTransition) {
      const navigationTransition = await runPageTransition(pageName, navigationUpdatesHistory, options);
      if (!navigationTransition) {
        window.__mflTableLoadingRuntime?.finishRequest?.(progressionLoadingRequestToken);
        return;
      }
    }
    updateHash = false;

    const requestedMflView = pageName === "mfl"
      ? normalizeViewForPage(options.view, "mfl")
      : "";
    if (pageName === "mfl" && requestedMflView === "stats") {
      const route = prepareIncrementalRoute(pageName, {
        ...options,
        view: "stats",
        ignoreCurrentClubRoute: navigationUpdatesHistory,
      });
      if (!route) {
        state.incrementalMode = false;
        return originalSetPage.call(this, "mflstats", false, {
          ...options,
          replaceUrl: "",
          view: "stats",
          skipNavigationLoading: true,
        });
      }
      const payload = await requestIncrementalRoute(route, 1);
      if (!payload) return false;
      state.dataAccess = currentDataAccess(pageName);
      state.incrementalApplying = true;
      try {
        return await originalSetPage.call(this, "mflstats", false, {
          ...options,
          replaceUrl: "",
          view: "stats",
          skipNavigationLoading: true,
        });
      } finally {
        state.incrementalApplying = false;
      }
    }

    const requestedDatabaseView = pageName === "database"
      ? normalizeViewForPage(options.view, "database")
      : "";
    if (pageName === "database" && requestedDatabaseView === "stats") {
      state.incrementalMode = false;
      if (typeof window.__mflEnsureRouteRuntime === "function") {
        await window.__mflEnsureRouteRuntime("database", { view: "stats" });
      }
      const statsOwner = window.__mflDatabaseStatsStateRuntime;
      if (typeof statsOwner?.render === "function") return statsOwner.render();
      if (typeof window.renderDatabaseStatsPage === "function") return window.renderDatabaseStatsPage(false);
      return;
    }

    const previousPage = state.currentPage;
    if (options.__mflPreviousTableStateSaved !== true) {
      const previousTablePage = tablePageKey();
      if (previousTablePage) {
        state.tablePageStates[previousTablePage] = currentTablePageState();
        saveTableState();
      }
    }

    const route = prepareIncrementalRoute(pageName, {
      ...options,
      ignoreCurrentClubRoute: navigationUpdatesHistory,
    });
    const shellFirst = shellFirstTablePages.has(pageName);
    if (shellFirst) {
      commitIncrementalLocation(pageName, updateHash, options);
      renderTableDestinationShell(pageName, route);
    }
    if (!route) {
      window.__mflTableLoadingRuntime?.finishRequest?.(progressionLoadingRequestToken);
      state.incrementalMode = false;
      return originalSetPage.call(this, pageName, updateHash, options);
    }

    if (!shellFirst) {
      commitIncrementalLocation(pageName, updateHash, options);
    } else {
      globalThis.syncQuickFilterLabels?.();
      updateViewButtons();
      buildHeader();
    }
    const loadAndRender = async () => {
      try {
        const result = await renderLoadedIncrementalRoute.call(this, pageName, updateHash, options, route, {
          tableLoadingRequestToken: progressionLoadingRequestToken,
        });
        if (result === false) return false;
        if (previousPage !== incrementalLoadingPageName(pageName, route)) {
          resetPageScroll();
        }
        return result;
      } catch (error) {
        showToast(error?.message || "Could not load this page.");
        return;
      } finally {
        window.__mflTableLoadingRuntime?.finishRequest?.(progressionLoadingRequestToken);
      }
    };

    if (route.scope === "empty" || incrementalRouteIsCached(route, 1)) {
      return loadAndRender();
    }

    return withInteractionBusy(loadAndRender);
  };

  function divisionInfo(divisionValue) {
    return typeof contractDivisionInfo === "function"
      ? contractDivisionInfo(divisionValue)
      : null;
  }

  function clubSearchResult(entry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "searchResult clubSearchResult";
    button.dataset.clubId = entry.clubId;
    button.dataset.searchKey = recentClubKey(entry.clubId);
    const division = divisionInfo(entry.division);
    const divisionHtml = division
      ? ` &middot; <span class="clubSearchDivision" style="color:${escapeHtml(division.color)}">${escapeHtml(division.name)}</span>`
      : "";
    button.innerHTML = `<strong>${escapeHtml(entry.name)}</strong><span>Club &middot; #${escapeHtml(entry.clubId)}${divisionHtml}</span>`;
    button.addEventListener("click", () => {
      closeSearch();
      if (typeof window.mflOpenClubPage === "function") {
        window.mflOpenClubPage(entry.clubId, "attributes");
      }
    });
    return button;
  }

  function injectBootstrapClubResults() {
    if (!playerSearchResults || !state.clubSearchIndex.length) {
      return;
    }

    playerSearchResults.querySelectorAll(":scope > .clubSearchResult").forEach((result) => result.remove());
    const query = normalizeSearchText(playerSearchInput.value.trim());
    const recentClubIds = state.recentSearchItems
      .filter((item) => item.startsWith("club:"))
      .map((item) => item.slice(5));
    const clubs = query
      ? state.clubSearchIndex
          .filter((club) => club.searchText.includes(query))
          .sort((a, b) => (
            (a.division ?? Number.POSITIVE_INFINITY) - (b.division ?? Number.POSITIVE_INFINITY)
            || a.name.localeCompare(b.name)
          ))
      : recentClubIds
          .map((clubId) => state.clubSearchIndex.find((club) => club.clubId === clubId))
          .filter(Boolean);

    const existingResults = Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"));
    const clubResults = clubs.slice(0, query ? 10 : 5).map(clubSearchResult);

    if (!query) {
      const resultsByKey = new Map(
        [...existingResults, ...clubResults]
          .filter((result) => result.dataset.searchKey)
          .map((result) => [result.dataset.searchKey, result]),
      );
      const chronologicalResults = state.recentSearchItems
        .slice(0, 5)
        .map((key) => resultsByKey.get(key))
        .filter(Boolean);

      if (chronologicalResults.length) {
        playerSearchResults.replaceChildren(...chronologicalResults);
        playerSearchResults.classList.add("filledSearchResults");
      } else {
        playerSearchResults.innerHTML = '<div class="searchHint">Recent searches will appear here.</div>';
        playerSearchResults.classList.remove("filledSearchResults");
      }
      return;
    }

    const playerResults = existingResults.filter((result) => !result.dataset.searchKey?.startsWith("agent:"));
    const agentResults = existingResults.filter((result) => result.dataset.searchKey?.startsWith("agent:"));
    const mergedResults = [
      ...playerResults,
      ...clubResults,
      ...agentResults,
    ].slice(0, 10);

    if (mergedResults.length) {
      playerSearchResults.replaceChildren(...mergedResults);
      playerSearchResults.classList.add("filledSearchResults");
    }
  }

  function prioritizeTypedSearchResults() {
    if (!playerSearchResults || !normalizeSearchText(playerSearchInput.value.trim())) {
      return;
    }

    const resultPriority = (result) => {
      const searchKey = String(result.dataset.searchKey || "");
      if (result.classList.contains("clubSearchResult") || searchKey.startsWith("club:")) {
        return 1;
      }
      if (searchKey.startsWith("agent:")) {
        return 2;
      }
      return 0;
    };
    const results = Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"))
      .sort((a, b) => resultPriority(a) - resultPriority(b))
      .slice(0, 15);

    if (!results.length) {
      return;
    }

    playerSearchResults.replaceChildren(...results);
    playerSearchResults.classList.add("filledSearchResults");
  }

  renderSearchResultsNow = function renderSearchResultsFromBootstrap() {
    const result = originalRenderSearchResultsNow.apply(this, arguments);
    injectBootstrapClubResults();
    prioritizeTypedSearchResults();
    return result;
  };

  window.mflLoadIncrementalRoutePage = async function loadIncrementalRoutePage(pageName, options = {}) {
    const route = prepareIncrementalRoute(pageName, options);
    if (!route) {
      return false;
    }
    const loadAndRender = async () => {
      const payload = await requestIncrementalRoute(route, 1);
      if (!payload) return false;
      const clubPage = pageName === "club";
      if (tablePages.has(pageName) && !clubPage) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
        syncRestoredTableControls(pageName);
      }
      if (clubPage) {
        state.currentPage = "club";
      }
      state.incrementalApplying = true;
      try {
        updateViewButtons();
        buildHeader();
        if (!clubPage) originalApplyFilters.call(this, { save: false });
      } finally {
        state.incrementalApplying = false;
      }
      return true;
    };

    if (incrementalRouteIsCached(route, 1)) {
      return loadAndRender();
    }

    return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);
  };
})();

;(() => {
  function tableHeaderContext() {
    if (typeof buildHeader !== "function") return null;
    const head = document.getElementById("tableHead");
    if (!(head instanceof HTMLTableSectionElement)) return null;
    const page = typeof tablePageKey === "function"
      ? (tablePageKey() || state.currentPage || "")
      : (state.currentPage || "");
    const signature = [page, state.view, state.sortKey, state.sortDirection].join("|");
    return { head, page, signature };
  }

  function ensureCanonicalTableHeader() {
    const context = tableHeaderContext();
    if (!context) return false;
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
    if (staticRoutePending) return true;
    if (staticHeader && staticSignature && staticSignature !== signature) return true;
    const needsCanonicalBuild = !head.rows[0] || staticHeader || staticSignature !== signature;
    if (needsCanonicalBuild) buildHeader();
    if (!head.rows[0]) return false;
    if (needsCanonicalBuild) {
      head.dataset.mflHeaderSignature = signature;
      delete head.dataset.mflStaticHeader;
    }
    return head.dataset.mflStaticHeader === "true" || head.dataset.mflHeaderSignature === signature;
  }

  function installTableLoadingOwners() {
    if (typeof buildHeader !== "function") return false;

    if (!buildHeader.__mflSingleRenderOwner) {
      const originalBuildHeader = buildHeader;
      const stableBuildHeader = function() {
        const context = tableHeaderContext();
        if (!context) return originalBuildHeader.apply(this, arguments);
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
        const result = originalBuildHeader.apply(this, arguments);
        head.dataset.mflHeaderSignature = signature;
        delete head.dataset.mflStaticHeader;
        return result;
      };
      Object.defineProperty(stableBuildHeader, "__mflSingleRenderOwner", { value: true });
      buildHeader = stableBuildHeader;
    }
    return true;
  }

  const searchTokens = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const orderedTokensMatch = (text, query) => {
    const haystack = searchTokens(text).join(" ");
    const tokens = searchTokens(query);
    if (!tokens.length) return false;
    let cursor = 0;
    for (const token of tokens) {
      const index = haystack.indexOf(token, cursor);
      if (index < 0) return false;
      cursor = index + token.length;
    }
    return true;
  };

  function installSearchMatching() {
    if (typeof normalizeSearchText !== "function") return false;

    if (!normalizeSearchText.__mflWhitespaceAware) {
      const originalNormalizeSearchText = normalizeSearchText;
      const whitespaceAwareNormalizeSearchText = function(value) {
        return originalNormalizeSearchText(value).replace(/\s+/g, " ").trim();
      };
      Object.defineProperty(whitespaceAwareNormalizeSearchText, "__mflWhitespaceAware", { value: true });
      normalizeSearchText = whitespaceAwareNormalizeSearchText;
    }

    if (typeof searchMatchScore === "function" && !searchMatchScore.__mflSurnameFirst) {
      const surnameFirstSearchMatchScore = function(query, primaryText, secondaryText = "") {
        const normalizedQuery = normalizeSearchText(query);
        const primary = normalizeSearchText(primaryText);
        const secondary = normalizeSearchText(secondaryText);
        const primaryIsPlayerName = /^\d+$/.test(secondary) && primary && !/^\d+$/.test(primary);

        if (primaryIsPlayerName) {
          const surname = searchTokens(primary).at(-1) || "";
          if (secondary === normalizedQuery) return 120;
          if (surname === normalizedQuery) return 110;
          if (surname.startsWith(normalizedQuery)) return 95;
          if (primary === normalizedQuery) return 90;
          if (secondary.startsWith(normalizedQuery)) return 85;
          if (primary.startsWith(normalizedQuery)) return 75;
          if (surname.includes(normalizedQuery)) return 65;
          if (primary.includes(normalizedQuery)) return 50;
          if (orderedTokensMatch(primary, normalizedQuery)) return 45;
          if (secondary.includes(normalizedQuery)) return 40;
          return 0;
        }

        if (primary === normalizedQuery || secondary === normalizedQuery) return 100;
        if (primary.startsWith(normalizedQuery)) return 80;
        if (secondary.startsWith(normalizedQuery)) return 70;
        if (primary.includes(normalizedQuery)) return 50;
        if (secondary.includes(normalizedQuery)) return 40;
        if (orderedTokensMatch(primary, normalizedQuery)) return 45;
        if (orderedTokensMatch(secondary, normalizedQuery)) return 35;
        return 0;
      };
      Object.defineProperty(surnameFirstSearchMatchScore, "__mflSurnameFirst", { value: true });
      searchMatchScore = surnameFirstSearchMatchScore;
    }

    if (typeof evaluationSearchMatches === "function" && !evaluationSearchMatches.__mflSurnameFirst) {
      const surnameFirstEvaluationSearchMatches = function(query) {
        if (!state.evaluationSearchIndex.length && state.rows.length) buildSearchIndex();
        const results = [];
        state.evaluationSearchIndex.forEach((entry) => {
          if (entry.retired) return;
          const score = searchMatchScore(query, entry.name, entry.id);
          if (score <= 0) return;
          results.push({ entry, score });
        });
        return results
          .sort((a, b) => b.score - a.score
            || b.entry.overall - a.entry.overall
            || a.entry.nameDisplay.localeCompare(b.entry.nameDisplay))
          .slice(0, 5)
          .map((result) => result.entry);
      };
      Object.defineProperty(surnameFirstEvaluationSearchMatches, "__mflSurnameFirst", { value: true });
      evaluationSearchMatches = surnameFirstEvaluationSearchMatches;
    }
    return true;
  }

  function renderGlobalSearchResults() {
    if (typeof renderSearchResultsNow !== "function") return false;
    renderSearchResultsNow();
    return true;
  }

  function renderCurrentEvaluationSearchResults() {
    if (typeof renderEvaluationSearchResults !== "function") return false;
    renderEvaluationSearchResults();
    return true;
  }

  function resetCurrentEvaluationSelection() {
    if (typeof resetEvaluationSelection !== "function") return false;
    resetEvaluationSelection();
    return true;
  }

  function applySearchPayload(payload, type = "all") {
    if (typeof applyDatabaseSearchPayload !== "function") return false;
    applyDatabaseSearchPayload(payload, type);
    return true;
  }

  function invalidateDatabaseSearch(type = "all") {
    if (typeof databaseSearchAbortControllers !== "undefined") {
      databaseSearchAbortControllers.get(type)?.abort?.();
    }
    if (typeof databaseSearchSequences !== "undefined") {
      databaseSearchSequences.set(type, (databaseSearchSequences.get(type) || 0) + 1);
    }
  }

  function evaluationRecentPlayerIds() {
    return Array.isArray(state.recentEvaluationPlayerIds)
      ? normalizeIdList(state.recentEvaluationPlayerIds, 5)
      : [];
  }

  function setEvaluationRecentPlayerIds(ids) {
    state.recentEvaluationPlayerIds = normalizeIdList(Array.isArray(ids) ? ids : [], 5);
    return [...state.recentEvaluationPlayerIds];
  }

  function evaluationSearchEntry(playerId) {
    const key = String(playerId || "").trim();
    if (!key || !Array.isArray(state.evaluationSearchIndex)) return null;
    return state.evaluationSearchIndex.find((item) => String(item?.playerId || "") === key) || null;
  }

  function buildEvaluationRecentEntries(payload) {
    const columns = Array.isArray(payload?.columns) ? payload.columns : [];
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    if (typeof buildPlayerSearchEntryFromCompactRow !== "function") return [];
    return rows
      .map((row) => buildPlayerSearchEntryFromCompactRow(row, columns))
      .filter((entry) => entry && !entry.retired);
  }

  async function persistEvaluationRecentPlayerIds(ids) {
    setEvaluationRecentPlayerIds(ids);
    if (state.walletPreferencesSaveTimer) {
      window.clearTimeout(state.walletPreferencesSaveTimer);
      state.walletPreferencesSaveTimer = null;
    }
    if (!state.linkedWalletAddress
      || typeof hasWalletProof !== "function"
      || !hasWalletProof()
      || typeof saveWalletPreferencesNow !== "function") {
      return false;
    }
    try {
      await saveWalletPreferencesNow();
      return true;
    } catch {
      return false;
    }
  }

  function installEvaluationRecentRowsOwner(provider) {
    if (typeof recentEvaluationRows !== "function" || typeof provider !== "function") return false;
    if (recentEvaluationRows.__mflSupabaseOnly) return true;
    const supabaseRecentRows = function() {
      const entries = provider();
      return Array.isArray(entries) ? entries.slice(0, 5) : [];
    };
    Object.defineProperty(supabaseRecentRows, "__mflSupabaseOnly", { value: true });
    recentEvaluationRows = supabaseRecentRows;
    return true;
  }

  function installEvaluationEmptySearchOwner(restore) {
    if (typeof requestDatabaseSearch !== "function" || typeof restore !== "function") return false;
    if (requestDatabaseSearch.__mflEvaluationSupabaseOnly) return true;
    const originalRequestDatabaseSearch = requestDatabaseSearch;
    const supabaseOnlyRequestDatabaseSearch = function(rawQuery = "", type = "all", options = {}) {
      if (type === "players" && !String(rawQuery || "").trim()) {
        return Promise.resolve(restore(Boolean(options?.force)));
      }
      return originalRequestDatabaseSearch.apply(this, arguments);
    };
    Object.defineProperty(supabaseOnlyRequestDatabaseSearch, "__mflEvaluationSupabaseOnly", { value: true });
    requestDatabaseSearch = supabaseOnlyRequestDatabaseSearch;
    return true;
  }

  function installEvaluationRecentWriteOwner(commit) {
    if (typeof rememberEvaluationResult !== "function" || typeof commit !== "function") return false;
    if (rememberEvaluationResult.__mflSupabaseImmediate) return true;
    const originalRememberEvaluationResult = rememberEvaluationResult;
    const supabaseImmediateRememberEvaluationResult = function(playerId) {
      const result = originalRememberEvaluationResult.apply(this, arguments);
      commit(playerId);
      return result;
    };
    Object.defineProperty(supabaseImmediateRememberEvaluationResult, "__mflSupabaseImmediate", { value: true });
    rememberEvaluationResult = supabaseImmediateRememberEvaluationResult;
    return true;
  }

  let evaluationRecentStateHydrated = false;

  function installEvaluationRecentStateOwnership() {
    if (typeof restoreRecentEvaluationState !== "function"
      || typeof persistRecentSearchStates !== "function"
      || typeof saveTableStateLocally !== "function") return false;
    if (restoreRecentEvaluationState.__mflRecentStateOnly) return true;

    state.recentEvaluationPlayerIds = [];

    const recentStateOnlyRestore = function(savedState) {
      const incoming = savedState && typeof savedState === "object" && !Array.isArray(savedState)
        && Array.isArray(savedState.recentEvaluationPlayerIds)
        ? savedState.recentEvaluationPlayerIds
        : [];
      state.recentEvaluationPlayerIds = normalizeIdList(incoming, 5);
      evaluationRecentStateHydrated = true;
      if (/^\/evaluation\/?$/i.test(window.location.pathname)) {
        void window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false, true);
      }
    };
    Object.defineProperty(recentStateOnlyRestore, "__mflRecentStateOnly", { value: true });
    restoreRecentEvaluationState = recentStateOnlyRestore;

    persistRecentSearchStates = function persistSearchStatesWithoutEvaluationLocalStorage() {
      saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
      saveRecentIdsToStorage(RECENT_AGENT_SEARCH_STORAGE_KEY, state.recentSearchAgentWallets);
      saveRecentIdsToStorage(RECENT_MIXED_SEARCH_STORAGE_KEY, state.recentSearchItems);
    };

    const originalSaveTableStateLocally = saveTableStateLocally;
    saveTableStateLocally = function saveTableStateWithoutEvaluationRecents(tableState) {
      if (!tableState || typeof tableState !== "object" || Array.isArray(tableState)) {
        return originalSaveTableStateLocally(tableState);
      }
      const localState = { ...tableState };
      delete localState.recentEvaluationPlayerIds;
      return originalSaveTableStateLocally(localState);
    };

    window.__mflWalletPreferencesStartupPromise = ensureEvaluationRecentStateHydrated();
    return true;
  }

  async function ensureEvaluationRecentStateHydrated() {
    const pendingStartup = window.__mflWalletPreferencesStartupPromise;
    if (pendingStartup && typeof pendingStartup.then === "function") {
      await Promise.resolve(pendingStartup).catch(() => undefined);
    }

    if (evaluationRecentStateHydrated) return true;
    if (!state.linkedWalletAddress
      || typeof hasWalletProof !== "function"
      || !hasWalletProof()
      || typeof loadWalletPreferences !== "function") {
      return false;
    }

    await loadWalletPreferences({ force: true });
    return evaluationRecentStateHydrated;
  }

  window.__mflCoreContracts = Object.freeze({
    ensureCanonicalTableHeader,
    installTableLoadingOwners,
    installSearchMatching,
    renderGlobalSearchResults,
    renderCurrentEvaluationSearchResults,
    resetCurrentEvaluationSelection,
    applySearchPayload,
    invalidateDatabaseSearch,
    evaluationRecentPlayerIds,
    setEvaluationRecentPlayerIds,
    evaluationSearchEntry,
    buildEvaluationRecentEntries,
    persistEvaluationRecentPlayerIds,
    installEvaluationRecentRowsOwner,
    installEvaluationEmptySearchOwner,
    installEvaluationRecentWriteOwner,
    installEvaluationRecentStateOwnership,
    ensureEvaluationRecentStateHydrated,
  });
})();
;(() => {
  if (typeof setPage !== "function" || setPage.__mflRouteRuntimeGate) return;
  const originalRouteRuntimeSetPage = setPage;
  const routeRuntimeSetPage = async function setPageWithRouteRuntime(pageName, updateHash = true, options = {}) {
    const incomingOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
    const runtimeReady = incomingOptions.__mflRouteRuntimeReady === true;
    let previousTableStateSaved = false;

    if (!runtimeReady) {
      if (String(pageName || "") === "player") {
        const playerId = String(
          incomingOptions.playerId
          || incomingOptions.__mflPlayerFirstPaintContext?.playerId
          || window.__mflPlayerFirstPaintPendingContext?.playerId
          || "",
        ).trim();
        if (playerId) {
          const suppliedContext = incomingOptions.__mflPlayerFirstPaintContext;
          const cachedContext = window.__mflPlayerFirstPaintPendingContext;
          const buildContext = window.__mflBuildPlayerFirstPaintContext;
          const pendingContext = String(suppliedContext?.playerId || "").trim() === playerId
            ? suppliedContext
            : String(cachedContext?.playerId || "").trim() === playerId
              ? cachedContext
              : (typeof buildContext === "function" ? buildContext(playerId) : { playerId });
          window.__mflPlayerFirstPaintPendingContext = pendingContext;

          const playerCorePromise = typeof window.__mflEnsureRouteCore === "function"
            ? window.__mflEnsureRouteCore("player", { ...incomingOptions, playerId })
            : null;
          if (typeof window.__mflEnsureRouteRuntime === "function") {
            await window.__mflEnsureRouteRuntime("player", { ...incomingOptions, playerId });
          }
          if (playerCorePromise) await playerCorePromise;

          window.__mflPlayerFirstPaintRuntime?.beginDetailNavigation?.(pendingContext);
          window.__mflPlayerFirstPaintRuntime?.renderPending?.(pendingContext);
        }
      }

      const stagedTransition = incomingOptions.__mflNavigationTransition
        || (incomingOptions.skipNavigationTransition === true ? pendingViewTransition : null);
      const loadCommittedRoute = async (transition = stagedTransition) => {
        const ownerBeforeRuntime = setPage;
        const routeCorePromise = typeof window.__mflEnsureRouteCore === "function"
          ? window.__mflEnsureRouteCore(String(pageName || ""), incomingOptions)
          : null;
        if (typeof window.__mflEnsureRouteRuntime === "function") {
          await window.__mflEnsureRouteRuntime(String(pageName || ""), incomingOptions);
        }
        if (routeCorePromise) await routeCorePromise;

        if (transition && !navigationTransitionIsCurrent(transition)) return null;

        const committedOptions = {
          ...incomingOptions,
          skipNavigationTransition: true,
          ...(transition ? { __mflNavigationTransition: transition } : {}),
          ...(previousTableStateSaved ? { __mflPreviousTableStateSaved: true } : {}),
        };
        if (setPage !== ownerBeforeRuntime) {
          return setPage.call(this, pageName, updateHash, {
            ...committedOptions,
            __mflRouteRuntimeReady: true,
          });
        }
        return originalRouteRuntimeSetPage.call(this, pageName, updateHash, committedOptions);
      };

      if (incomingOptions.skipNavigationTransition === true) {
        return loadCommittedRoute();
      }

      const previousTablePage = typeof tablePageKey === "function" ? tablePageKey() : null;
      if (previousTablePage && typeof currentTablePageState === "function" && typeof saveTableState === "function") {
        state.tablePageStates[previousTablePage] = currentTablePageState();
        saveTableState();
      }
      previousTableStateSaved = true;

      const runTransition = Reflect.get(window, "__mflRunPageTransition");
      if (typeof runTransition !== "function") {
        throw new Error("Global page transition owner is unavailable.");
      }
      return runTransition(String(pageName || ""), updateHash, incomingOptions, loadCommittedRoute);
    }

    const cleanOptions = { ...incomingOptions };
    delete cleanOptions.__mflRouteRuntimeReady;
    return originalRouteRuntimeSetPage.call(this, pageName, updateHash, cleanOptions);
  };
  Object.defineProperty(routeRuntimeSetPage, "__mflRouteRuntimeGate", { value: true });
  setPage = routeRuntimeSetPage;
})();

window.__mflMarkApplicationCoreLoaded?.();

window.__mflAppStartPromise = (async () => {
  if (typeof pageTargetFromPath === "function" && typeof window.__mflEnsureRouteCore === "function") {
    const initialRouteTarget = pageTargetFromPath(window.location.pathname);
    if (initialRouteTarget?.pageName) {
      await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});
    }
  }
  return startApp();
})();

;(() => {
  if (window.__mflFooterSpaNavigationBound) return;
  window.__mflFooterSpaNavigationBound = true;
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const footer = event.target.closest('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (!footer || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (window.location.pathname === "/changelog") return;
    if (typeof setPage === "function") {
      void Promise.resolve(setPage("changelog", true));
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const toggle = event.target.closest(".changelogMinorToggle");
    if (!toggle) return;
    const section = toggle.closest(".changelogMinorSection");
    if (!section) return;
    const expanded = section.classList.toggle("is-expanded");
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
})();
;(() => {
  const RELEASE_VERSION = String(window.__mflReleaseVersion || "");

  function contractClubId(playerId, teamName) {
    try {
      const row = rowByPlayerId(String(playerId || ""));
      const directId = String(getValue(row, "active_contract_club_id") || "").trim();
      if (directId) return directId;
      const normalizedName = String(teamName || "").trim().toLowerCase();
      const clubs = [
        ...(Array.isArray(state?.clubSearchIndex) ? state.clubSearchIndex : []),
        ...(Array.isArray(state?.bootstrapData?.clubs) ? state.bootstrapData.clubs : []),
      ];
      const club = clubs.find((item) => String(item?.name || "").trim().toLowerCase() === normalizedName);
      return String(club?.clubId || "").trim();
    } catch {
      return "";
    }
  }

  function bindContractTeamLink(playerId) {
    const team = document.querySelector("#playerDetail .contractDetailCard .playerContractTeam, #playerDetail .contractDetailCard .playerContractTeamLink");
    if (!team) return;
    const teamName = String(team.textContent || "").trim();
    if (!teamName || /^(free agent|development center)$/i.test(teamName)) return;
    const clubId = contractClubId(playerId, teamName);
    if (!clubId) return;
    const href = "/clubs/" + encodeURIComponent(clubId) + "/squad";
    const link = team instanceof HTMLAnchorElement ? team : document.createElement("a");
    if (link !== team) {
      link.className = String(team.className || "playerContractTeam");
      link.textContent = teamName;
      team.replaceWith(link);
    }
    link.classList.add("clubPageLink", "playerContractTeamLink");
    link.href = href;
    link.dataset.clubId = clubId;
    if (link.dataset.mflReleaseContractBound === RELEASE_VERSION) return;
    link.dataset.mflReleaseContractBound = RELEASE_VERSION;
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (typeof window.mflOpenClubPage !== "function") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.mflOpenClubPage(clubId, "attributes");
    }, true);
  }

  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    renderPlayerPage = function renderPlayerPageWithStableContractLink(playerId) {
      const result = originalRenderPlayerPage.apply(this, arguments);
      bindContractTeamLink(playerId);
      return result;
    };
  }


  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const home = event.target.closest('.brandLink[href="/"], .brandLink[data-page="home"]');
    if (!home || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void Promise.resolve(setPage("home", true));
  }, true);
})();
