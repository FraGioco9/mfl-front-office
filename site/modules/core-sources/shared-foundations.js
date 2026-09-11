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
  watchlistViews: /** @type {Record<string, string>} */ ({}),
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
  settingsDraftBaseline: null,
  settingsDraftDirty: false,
  tablePageStates: {},
  tableSortSessionKey: "",
  tableSortSessionSortState: null,
  toastTimer: null,
  menuOpen: true,
  playerAttributeView: "attributes",
  trainingAdjustments: {},
  searchIndex: [],
  evaluationSearchIndex: [],
  agentSearchIndex: [],
  clubSearchIndex: [],
  clubProfile: null,
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
  walletPreferencesLoadPromise: null,
  walletPreferencesWritePromise: Promise.resolve(),
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
const agentColumn = "wallet_name";
const joinedAgencyColumn = "owned_since";
const linkColumn = "player_link";
const mflWalletAddress = "0xff8d2bbed8164db0";

const tablePages = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"]);
const pageViewOptions = {
  database: ["attributes", "contracts", "stats"],
  mfl: ["attributes", "stats"],
  agents: ["attributes", "contracts", "next", "current", "all"],
  club: ["attributes", "contracts", "current", "all"],
  progression: ["current", "all"],
  watchlist: ["attributes", "next", "contracts", "current", "all"],
  myplayers: ["attributes", "next", "contracts", "current", "all"],
};
const defaultPageViews = {
  database: "attributes",
  mfl: "attributes",
  agents: "attributes",
  club: "attributes",
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
const plannerPage = /** @type {HTMLElement} */ (document.querySelector("#plannerPage"));
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
const privacyPage = document.querySelector("#privacyPage");
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
const addFilterSelect = /** @type {HTMLSelectElement} */ (document.querySelector("#addFilterSelect"));
const filterRules = document.querySelector("#filterRules");
const hideRetiredInput = /** @type {HTMLInputElement} */ (document.querySelector("#hideRetiredInput"));
const hideRetiringInput = /** @type {HTMLInputElement} */ (document.querySelector("#hideRetiringInput"));
const hideMflPlayersFilter = document.querySelector("#hideMflPlayersFilter");
const packablePlayersFilter = document.querySelector("#packablePlayersFilter");
const hideMflPlayersInput = /** @type {HTMLInputElement} */ (document.querySelector("#hideMflPlayersInput"));
const packablePlayersInput = /** @type {HTMLInputElement} */ (document.querySelector("#packablePlayersInput"));
const newMintsInput = /** @type {HTMLInputElement} */ (document.querySelector("#newMintsInput"));
const newMintsLabel = document.querySelector("#newMintsLabel");
const pageSizeSelect = /** @type {HTMLSelectElement} */ (document.querySelector("#pageSizeSelect"));
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
const evaluationSaveButton = /** @type {HTMLButtonElement} */ (document.querySelector("#evaluationSaveButton"));
const evaluationShareButton = /** @type {HTMLButtonElement} */ (document.querySelector("#evaluationShareButton"));
const evaluationDeleteButton = /** @type {HTMLButtonElement} */ (document.querySelector("#evaluationDeleteButton"));
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
const evaluationLoadModal = /** @type {HTMLElement} */ (document.querySelector("#evaluationLoadModal"));
const closeEvaluationLoadButton = document.querySelector("#closeEvaluationLoadButton");
const evaluationLoadList = document.querySelector("#evaluationLoadList");
const selectionBar = document.querySelector("#selectionBar");
const selectionCount = document.querySelector("#selectionCount");
const clearSelectionButton = document.querySelector("#clearSelectionButton");
const addToWatchlistButton = document.querySelector("#addToWatchlistButton");
const moveToWatchlistButton = document.querySelector("#moveToWatchlistButton");
const openSelectedLinksButton = document.querySelector("#openSelectedLinksButton");
