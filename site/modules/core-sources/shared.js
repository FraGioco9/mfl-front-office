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
    void saveWalletPreferencesNow({ domains: ["settings"], includeSettings: true });
  }, 0);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.dataset.activeTheme = theme;
  themeButton.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to night mode");

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
  state.menuOpen = true;
  document.body.classList.toggle("guest", state.currentPage === "progression" && !hasProgressionAccess());
  menuRail.hidden = false;
  menuButton.hidden = false;
  sidebar.hidden = false;
  appShell.classList.remove("menuClosed");
  statusText.hidden = false;
  menuButton.disabled = true;
  menuButton.tabIndex = -1;
  menuButton.setAttribute("aria-disabled", "true");
  menuButton.setAttribute("aria-expanded", "true");
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



function normalizedAgentName(value) {
  const name = value === null || value === undefined ? "" : String(value).trim();
  return name && name.toUpperCase() !== "NULL" ? name : "";
}




function savedAgentNameForWallet(address) {
  const normalizedAddress = normalizeWalletAddress(address).toLowerCase();
  if (!normalizedAddress) return "";
  try {
    const names = JSON.parse(localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY) || "{}");
    const name = normalizedAgentName(names?.[normalizedAddress]);
    return name && name.toLowerCase() !== normalizedAddress ? name : "";
  } catch {
    return "";
  }
}

function saveAgentNameForWallet(address, name) {
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
  const routeAtOptOut = pageTargetFromPath(`${window.location.pathname}${window.location.search}`);
  const protectedRouteAtOptOut = ["myplayers", "watchlist", "settings"].includes(routeAtOptOut.pageName)
    ? routeAtOptOut
    : null;
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

  if (protectedRouteAtOptOut) {
    const lockedPage = protectedRouteAtOptOut.pageName;
    const lockedOptions = protectedRouteAtOptOut.options && typeof protectedRouteAtOptOut.options === "object"
      ? protectedRouteAtOptOut.options
      : {};
    setPage(lockedPage, false, { ...lockedOptions, preserveScroll: true });
    saveTableState();
    showToast("Dapper opt-in removed.");
    return;
  }

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

  if (state.currentPage === "myplayers" || state.currentPage === "watchlist" || state.currentPage === "settings") {
    setPage(state.currentPage, false, { preserveScroll: true });
    return;
  }

  if (pageRequiresProgressionPermission(state.currentPage)) {
    setPage("home");
  }
}






function walletAccessMessage() {
  return "MFL Front Office Dapper Opt-In";
}

let __mflWalletLinkOwner = null;

async function linkWallet() {
  if (typeof __mflWalletLinkOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("wallet");
  }
  if (typeof __mflWalletLinkOwner !== "function") {
    throw new Error("Wallet opt-in owner is unavailable.");
  }
  return __mflWalletLinkOwner.apply(this, arguments);
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
  updateMenuVisibility();
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

let __mflOpenSavedEvaluationsModalOwner = null;

async function openSavedEvaluationsModal() {
  evaluationSearchInput.blur();
  if (document.activeElement === evaluationLoadButton) evaluationLoadButton.blur();
  const activeWallet = String(state.linkedWalletAddress || "").trim().toLowerCase();
  const cached = typeof __mflOpenSavedEvaluationsModalOwner === "function"
    && activeWallet
    && String(window.__mflSavedEvaluationsSessionCacheWallet || "") === activeWallet
    && Array.isArray(window.__mflSavedEvaluationsSessionCache);
  const busyToken = cached ? "" : (window.__mflInteractionBusy?.begin?.("evaluation-load") || "");
  try {
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
      await window.__mflEnsureRouteCore("evaluation");
    }
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function") {
      throw new Error("Evaluation route core is not loaded.");
    }
    return await __mflOpenSavedEvaluationsModalOwner.apply(this, arguments);
  } finally {
    if (busyToken) window.__mflInteractionBusy?.end?.(busyToken);
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
    pageName: ["home", "evaluation", "settings", "changelog", "privacy"].includes(pageName) ? pageName : "home",
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
  if (tablePages.has(statePageName) || statePageName === "club") buildHeader();
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
  if (tablePages.has(statePageName) || statePageName === "club") buildHeader();

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

function syncMobileTablePageTransitionChrome(pageName) {
  if (!window.matchMedia("(max-width: 900px)").matches) return;
  const normalizePage = (value) => {
    const page = String(value || "").trim().toLowerCase();
    if (page === "mflstats") return "mfl";
    if (page === "my-players") return "myplayers";
    return page;
  };
  const targetPage = normalizePage(pageName);
  const currentPage = normalizePage(document.body.dataset.page || state.currentPage);

  if (targetPage && currentPage && targetPage !== currentPage) {
    const scroller = document.querySelector("#progressionPage .playerTableScroller");
    if (scroller instanceof HTMLElement) scroller.scrollLeft = 0;
  }

  const views = document.querySelector("#progressionPage .views");
  const switcher = document.getElementById("watchlistSwitcher");
  if (!(views instanceof HTMLElement) || !(switcher instanceof HTMLElement)) return;

  const showWatchlistSelector = targetPage === "watchlist"
    && document.documentElement.dataset.storedWalletOptIn === "true";
  switcher.hidden = !showWatchlistSelector;

  if (showWatchlistSelector) {
    const shell = views.parentElement instanceof HTMLElement
      && views.parentElement.classList.contains("viewsScrollerShell")
      ? views.parentElement
      : null;
    (shell || views).insertAdjacentElement("afterend", switcher);
    switcher.classList.add("mflMobileWatchlistSwitcher");
    return;
  }

  switcher.classList.remove("mflMobileWatchlistSwitcher");
  if (switcher.parentElement !== views) views.appendChild(switcher);
  const dropdown = document.getElementById("watchlistDropdown");
  if (dropdown instanceof HTMLElement) dropdown.hidden = true;
  const button = document.getElementById("watchlistButton");
  if (button instanceof HTMLButtonElement) button.setAttribute("aria-expanded", "false");
}

async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {
  if (!settingsConfirmNavigation(pageName, updateHash)) return null;
  syncMobileTablePageTransitionChrome(pageName);
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
  const preserveInitialRecentLoading = isPlainEvaluationUrl()
    && document.documentElement.classList.contains("mflSingleRenderPending");
  if (preserveInitialRecentLoading) window.__mflSyncEvaluationRecentLoadingShell?.();
  renderEmptyEvaluationSelection(preserveInitialRecentLoading, true);
  syncEvaluationSearchClearButton();
}





let __mflTableTitleForPageOwner = null;
let __mflTableEnsureAgentPageTitleNameOwner = null;
let __mflTableBuildTableColGroupOwner = null;
let __mflTableBuildHeaderOwner = null;
let __mflTableUpdateSelectionHeaderOwner = null;
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

function syncTableSelectionHeader() {
  return typeof __mflTableUpdateSelectionHeaderOwner === "function"
    ? __mflTableUpdateSelectionHeaderOwner.apply(this, arguments)
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
}

async function setPage(pageName, updateHash = true, options = {}) {
  const lockedOptOutRoute = (pageName === "myplayers" || pageName === "watchlist" || pageName === "settings") && !hasWalletOptIn();
  resetTableSortSession(pageName, options);
  if (!pageNavigationIsCurrent(options)) return null;
  const plainEvaluationEntry = pageName === "evaluation" && (options.plain || isPlainEvaluationUrl());
  if (plainEvaluationEntry) preparePlainEvaluationReentry();
  if (pageName === "home") void loadSummary();
  if (pageName === "mfl" && normalizeViewForPage(options.view, "mfl") === "stats") {
    await setPage("mflstats", updateHash, { ...options, replaceUrl: options.replaceUrl || "/mfl/stats" });
    return;
  }

  const previousPage = state.currentPage;
  const shouldResetScroll = previousPage !== pageName && options.preserveScroll !== true;
  if (previousPage === "settings" && pageName !== "settings") {
    discardSettingsEmailAddressDraftSilently();
  }
  if (pageName === "agents") {
    state.currentAgentWalletAddress = normalizeWalletAddress(options.walletAddress || agentWalletAddressFromUrl()).toLowerCase();
  }
  const agentTitleReady = pageName === "agents"
    ? ensureAgentPageTitleName(state.currentAgentWalletAddress, options.agentName)
    : Promise.resolve("");
  if (!lockedOptOutRoute && options.replaceUrl && `${window.location.pathname}${window.location.search}` !== options.replaceUrl) {
    window.history.replaceState({}, "", options.replaceUrl);
  }
  document.body.dataset.page = pageName;
  if (!lockedOptOutRoute) {
    updatePageUrl(pageName, { ...options, updateUrl: updateHash && !options.replaceUrl });
  }

  if (pageRequiresProgressionPermission(pageName) && !hasProgressionAccess()) {
    return showUnauthorizedProgressionRedirect();
  }

  if (lockedOptOutRoute) {
    state.currentPage = pageName;
    homePage.hidden = true;
    progressionPage.hidden = true;
    mflStatsPage.hidden = true;
    myPlayersLockedPage.hidden = false;
    evaluationPage.hidden = true;
    playerPage.hidden = true;
    settingsPage.hidden = true;
    changelogPage.hidden = true;
    privacyPage.hidden = true;
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
    syncHomeLoginButton();
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }
    if (!pageNavigationIsCurrent(options)) return null;
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
    privacyPage.hidden = true;

    if (tablePage) {
      renderTableLoadingShell(pageName);
    }


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
  privacyPage.hidden = pageName !== "privacy";
  if (pageName === "agents") {
    await agentTitleReady;
    if (!pageNavigationIsCurrent(options)) return null;
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else {
    tablePageTitle.textContent = tableTitleForPage(pageName);
  }
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


  if (mflStatsActive) {
    state.view = "stats";
    rememberMflStatsView();
    updateViewButtons();
    renderMflStatsPage();
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }
    if (!pageNavigationIsCurrent(options)) return null;

    syncHomeLoginButton();
    if (shouldResetScroll) {
      resetPageScroll();
    }

    return;
  }

  if (settingsPageActive) {
    primeSettingsFreshFirstPaint();
    await waitForViewTransitionPaint();
    if (!pageNavigationIsCurrent(options)) return null;
    renderSettingsIdentity();
    await settingsPrepareCommittedForEntry();
    if (!pageNavigationIsCurrent(options)) return null;
    renderSettingsPage();
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }
    if (!pageNavigationIsCurrent(options)) return null;

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
      if (!pageNavigationIsCurrent(options)) return null;

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
    if (!pageNavigationIsCurrent(options)) return null;

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
  if (!pageNavigationIsCurrent(options)) return null;

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
function defaultSortStateForView(
  viewName = defaultViewForPage(tablePageKey() || "progression"),
  pageName = tablePageKey() || state.currentPage || "progression",
) {
  if (pageName === "club") {
    return {
      sortKey: "positions",
      sortDirection: "asc",
    };
  }
  return {
    sortKey: "overall",
    sortDirection: "desc",
  };
}

function sortKeySupportedByView(
  sortKey,
  viewName = defaultViewForPage(tablePageKey() || "progression"),
  pageName = tablePageKey() || state.currentPage || "progression",
) {
  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  if (normalizedPageName === "club" && sortKey === "positions") return true;
  const normalizedView = normalizeViewForPage(viewName, normalizedPageName || "progression");
  const visibleColumns = (views[normalizedView]?.columns || [])
    .map((column) => displayColumnForPage(column, normalizedPageName));
  return sortableColumns.has(sortKey) && visibleColumns.includes(sortKey);
}

function normalizedViewSortState(
  sortState,
  viewName = defaultViewForPage(tablePageKey() || "progression"),
  pageName = tablePageKey() || state.currentPage || "progression",
) {
  const defaultSortState = defaultSortStateForView(viewName, pageName);
  const sortKeyIsSupported = sortKeySupportedByView(sortState?.sortKey, viewName, pageName);
  const sortKey = sortKeyIsSupported ? sortState.sortKey : defaultSortState.sortKey;

  return {
    sortKey,
    sortDirection: sortKeyIsSupported && (sortState?.sortDirection === "asc" || sortState?.sortDirection === "desc")
      ? sortState.sortDirection
      : defaultSortState.sortDirection,
  };
}

function tableSortSessionKey(pageName = state.currentPage, options = {}) {
  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  if (normalizedPageName === "agents") {
    const walletAddress = normalizeWalletAddress(
      options.walletAddress || agentWalletAddressFromUrl() || state.currentAgentWalletAddress,
    ).toLowerCase();
    return `agents:${walletAddress || window.location.pathname}`;
  }
  if (normalizedPageName === "watchlist") {
    const watchlistId = String(
      options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "default",
    ).trim();
    return `watchlist:${watchlistId || "default"}`;
  }
  if (normalizedPageName === "club") {
    const clubRoute = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
    const clubId = String(options.clubId || clubRoute?.clubId || "").trim();
    return `club:${clubId || window.location.pathname}`;
  }
  return tablePages.has(normalizedPageName) ? normalizedPageName : "";
}

function tableSortStateForView(
  viewName = state.view,
  pageName = tablePageKey() || state.currentPage || "progression",
  fallbackSortState = null,
) {
  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  const normalizedView = normalizeViewForPage(viewName, normalizedPageName || "progression");
  const sourceSortState = state.tableSortSessionSortState || fallbackSortState;
  const sourceSortSupported = sortKeySupportedByView(sourceSortState?.sortKey, normalizedView, normalizedPageName);
  const resolvedSortState = normalizedViewSortState(
    sourceSortState,
    normalizedView,
    normalizedPageName,
  );
  if (!sourceSortSupported && state.tableSortSessionKey) {
    state.tableSortSessionSortState = resolvedSortState;
  }
  return resolvedSortState;
}

function rememberTableSortState(
  sortState = { sortKey: state.sortKey, sortDirection: state.sortDirection },
  viewName = state.view,
  pageName = tablePageKey() || state.currentPage || "progression",
) {
  if (!state.tableSortSessionKey) return false;
  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  const normalizedView = normalizeViewForPage(viewName, normalizedPageName || "progression");
  if (!sortKeySupportedByView(sortState?.sortKey, normalizedView, normalizedPageName)) return false;
  state.tableSortSessionSortState = normalizedViewSortState(sortState, normalizedView, normalizedPageName);
  return true;
}

function resetTableSortSession(pageName, options = {}) {
  const nextSessionKey = tableSortSessionKey(pageName, options);
  if (nextSessionKey === state.tableSortSessionKey) return false;
  state.tableSortSessionKey = nextSessionKey;
  state.tableSortSessionSortState = null;
  if (!nextSessionKey) return false;

  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  const nextView = normalizeViewForPage(options.view, normalizedPageName || "progression");
  const defaultSortState = defaultSortStateForView(nextView, normalizedPageName);
  state.tableSortSessionSortState = defaultSortState;
  state.sortKey = defaultSortState.sortKey;
  state.sortDirection = defaultSortState.sortDirection;
  return true;
}

function defaultTablePageState(pageName = tablePageKey() || "progression") {
  const defaultView = defaultViewForPage(pageName);
  const defaultSortState = defaultSortStateForView(defaultView, pageName);

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
  saveWalletWatchlistLocally();
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

function reconcileSettingsReceiveEmailsForWithCurrentWatchlists(values) {
  const validTargets = new Set(["myplayers"]);
  (Array.isArray(state.watchlists) ? state.watchlists : []).forEach((watchlist) => {
    const watchlistId = String(watchlist?.id || "").trim();
    if (watchlistId) validTargets.add(`watchlist-${watchlistId}`);
  });
  return normalizeSettingsReceiveEmailsFor(values).filter((value) => validTargets.has(value));
}

function normalizeSettingsEmailAddress(value) {
  return String(value || "").trim().slice(0, 254);
}


function settingsEmailDraftIsActive() {
  return settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
}

function settingsEmailOptionsDraftIsActive() {
  return settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
}

function settingsRouteActive() {
  return state.currentPage === "settings"
    || document.body?.dataset?.page === "settings"
    || settingsPage?.hidden === false;
}

function settingsRestoreDraftBaselineForNavigation() {
  const baseline = state.settingsDraftBaseline || currentSettingsPayload();
  state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(baseline.receiveEmailsFor);
  state.settingsEmailAddress = normalizeSettingsEmailAddress(baseline.emailAddress);
  state.settingsEmailAddressDraft = state.settingsEmailAddress;
  state.settingsDateFormat = normalizeSettingsDateFormat(baseline.dateFormat);
  state.settingsTimeFormat = normalizeSettingsTimeFormat(baseline.timeFormat);
  state.settingsDraftDirty = false;
  if (settingsEmailAddressInput) delete settingsEmailAddressInput.dataset.settingsEmailEditing;
}

async function settingsRefreshCommittedFromSupabase(options = {}) {
  if (!state.linkedWalletAddress || !hasWalletProof()) return false;

  const force = options.force === true;
  const render = options.render !== false;
  const activeDraft = settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
  if (activeDraft && !force) return false;

  try {
    const loaded = await loadWalletPreferences({ force });
    if (!loaded && !state.walletPreferencesLoaded) return false;
    state.settingsDraftDirty = false;
    state.settingsDraftBaseline = currentSettingsPayload();
    state.settingsDraftDirty = false;
    if (render && settingsRouteActive()) renderSettingsPage();
    return true;
  } catch {
    return false;
  }
}

function settingsResetFromSupabaseForNavigation() {
  settingsRestoreDraftBaselineForNavigation();
  clearPendingSettingsLocally();
  state.settingsDraftBaseline = currentSettingsPayload();
  state.settingsDraftDirty = false;
}

async function settingsPrepareCommittedForEntry() {
  clearPendingSettingsLocally();
  state.settingsDraftDirty = false;

  const startupHydrationPending = Reflect.get(window, "__mflSettingsStartupWalletPreferencesPending") === true;
  const startupHydration = Reflect.get(window, "__mflWalletPreferencesStartupPromise");
  if (startupHydrationPending && startupHydration && typeof startupHydration.then === "function") {
    await startupHydration;
    Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", false);
  } else {
    Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", false);
    await settingsRefreshCommittedFromSupabase({ force: true, render: false });
  }

  state.settingsDraftBaseline = currentSettingsPayload();
  state.settingsDraftDirty = false;
}

function settingsConfirmNavigation(pageName, updateHash = true) {
  const leavingSettings = settingsRouteActive() && pageName !== "settings";
  if (!leavingSettings) return true;

  if (state.settingsDraftDirty) {
    const leave = window.confirm("You have unsaved settings changes. Leave without saving?");
    if (!leave) {
      if (!updateHash) window.history.replaceState({}, "", "/settings");
      return false;
    }
  }

  settingsResetFromSupabaseForNavigation();
  return true;
}

window.addEventListener("beforeunload", (event) => {
  if (!settingsRouteActive() || !state.settingsDraftDirty) return;
  event.preventDefault();
  event.returnValue = "";
});

function applySettingsPayload(settings = {}, options = {}) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  const renderSettings = options.render !== false;
  const suppressStartupRender = Reflect.get(window, "__mflSettingsStartupWalletPreferencesPending") === true;
  state.walletSettingsLoaded = true;
  const preserveDraft = settingsRouteActive() && state.settingsDraftDirty && !state.settingsSaveInFlight;
  if (!preserveDraft) {
    state.settingsReceiveEmailsFor = normalizeSettingsReceiveEmailsFor(data.receiveEmailsFor);
    state.settingsEmailAddress = normalizeSettingsEmailAddress(data.emailAddress || data.email_address);
    state.settingsEmailAddressDraft = state.settingsEmailAddress;
    state.settingsDateFormat = normalizeSettingsDateFormat(data.dateFormat || data.date_format);
    state.settingsTimeFormat = normalizeSettingsTimeFormat(data.timeFormat || data.time_format);
    if (settingsRouteActive()) {
      state.settingsDraftBaseline = currentSettingsPayload();
      state.settingsDraftDirty = false;
    }
  }
  if (renderSettings && settingsRouteActive() && !suppressStartupRender) renderSettingsPage({ preserveEmailDraft: preserveDraft });
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

function currentSettingsPayloadForSave() {
  return {
    ...currentSettingsPayload(),
    receiveEmailsFor: reconcileSettingsReceiveEmailsForWithCurrentWatchlists(state.settingsReceiveEmailsFor),
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





function discardSettingsEmailAddressDraftSilently() {
  if (state.settingsEmailAddressDraft !== state.settingsEmailAddress) {
    state.settingsEmailAddressDraft = state.settingsEmailAddress;
    if (state.currentPage === "settings") {
      renderSettingsEmailControls();
    }
  }
}





function saveSettingsPreferencesAfterChange() {
  state.walletSettingsLoaded = true;
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  state.settingsSaveInFlight = true;

  window.clearTimeout(state.walletPreferencesSaveTimer);

  state.walletPreferencesSaveTimer = null;

  void saveWalletPreferencesNow({ domains: ["settings"] });
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

  const tableLoadingActive = Boolean(window.__mflTableLoadingRuntime?.requestActive?.());
  const visible = tablePages.has(state.currentPage) && !tableLoadingActive;
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

let __mflWatchlistRenderSwitcherOwner = null;
let __mflWatchlistCloseDropdownOwner = null;
let __mflWatchlistToggleDropdownOwner = null;

function renderWatchlistSwitcher() {
  if (typeof __mflWatchlistRenderSwitcherOwner === "function") {
    return __mflWatchlistRenderSwitcherOwner.apply(this, arguments);
  }
  updateWatchlistTitle();
  updateTablePlayerCount();
  return undefined;
}

function closeWatchlistDropdown() {
  if (typeof __mflWatchlistCloseDropdownOwner === "function") {
    return __mflWatchlistCloseDropdownOwner.apply(this, arguments);
  }
  if (watchlistDropdown) watchlistDropdown.hidden = true;
  if (watchlistButton) watchlistButton.setAttribute("aria-expanded", "false");
  return undefined;
}

function toggleWatchlistDropdown() {
  return typeof __mflWatchlistToggleDropdownOwner === "function"
    ? __mflWatchlistToggleDropdownOwner.apply(this, arguments)
    : undefined;
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
  state.selectedPlayerIds.clear();
  state.selectionAnchorPlayerId = null;
  setActiveWatchlistIds(nextWatchlist.playerIds);
  state.page = 1;
  renderWatchlistSwitcher();
  updateWatchlistUrl();
  saveTableState();
  applyFilters();
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
  const previousSettingsReceiveEmailsFor = [...state.settingsReceiveEmailsFor];
  state.settingsReceiveEmailsFor = reconcileSettingsReceiveEmailsForWithCurrentWatchlists(state.settingsReceiveEmailsFor);
  const pendingSettings = loadPendingSettingsLocally();
  const settingsTargetsChanged = JSON.stringify(previousSettingsReceiveEmailsFor) !== JSON.stringify(state.settingsReceiveEmailsFor);
  if (pendingSettings || settingsTargetsChanged) {
    const pendingBase = pendingSettings || currentSettingsPayloadForSave();
    savePendingSettingsLocally({
      ...pendingBase,
      receiveEmailsFor: reconcileSettingsReceiveEmailsForWithCurrentWatchlists(
        pendingSettings ? pendingSettings.receiveEmailsFor : state.settingsReceiveEmailsFor,
      ),
      theme: currentMflTheme(),
    });
  }
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



function remainingWatchlistCapacity() {
  return Math.max(0, MAX_WATCHLIST_PLAYERS - state.watchlistPlayerIds.size);
}

function showWatchlistFullToast() {
  showGenericToast(`A watchlist can contain up to ${MAX_WATCHLIST_PLAYERS} players.`);
}



function refreshPlayerPageAfterWalletSync() {
  if (state.currentPage !== "player") {
    return;
  }

  renderPlayerPage(playerIdFromUrl());
}



async function loadWalletPreferences(options = {}) {
  const force = Boolean(options.force);

  if (!state.linkedWalletAddress || !hasWalletProof()) return false;
  if (state.walletPreferencesLoadPromise) return state.walletPreferencesLoadPromise;
  if (state.walletPreferencesLoaded && !force) return true;

  const loadPromise = (async () => {
    state.walletPreferencesLoading = true;
  const walletPreferencesPageAtLoadStart = state.currentPage;
  const walletPreferencesPathAtLoadStart = `${window.location.pathname}${window.location.search}`;
  const evaluationMflPerUsdRevisionAtLoadStart = state.evaluationMflPerUsdRevision;
  const previousNotes = JSON.stringify(normalizedPlayerNotes(state.playerNotes));
  try {
    const localWatchlists = loadLocalWalletWatchlist();
    const requestedWatchlistId = String(
      watchlistIdFromUrl() || state.pendingWatchlistRouteId || state.currentWatchlistId || "",
    ).trim();
    if (Array.isArray(localWatchlists) && localWatchlists.some((item) => item && typeof item === "object" && !Array.isArray(item))) {
      applyWatchlists(localWatchlists, requestedWatchlistId, Array.from(state.watchlistPlayerIds));
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
        void saveWalletPreferencesNow({ domains: ["watchlists"] });
      }
      state.watchlistPlayerIdsAdded.clear();
      state.watchlistPlayerIdsRemoved.clear();
      const tableStateChanged = applyWalletTableState(data.tableState);
      applyWalletPlayerNotes(data.playerNotes);
      const pendingSettings = loadPendingSettingsLocally();
      if (pendingSettings || state.settingsSaveInFlight) {
        applySettingsPayload(pendingSettings || currentSettingsPayload());
        void saveWalletPreferencesNow({ domains: ["settings"] });
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
        if (state.currentPage === "evaluation" && typeof renderEvaluationMflPerUsdControl === "function") {
          renderEvaluationMflPerUsdControl(false);
          renderEvaluationPage();
        }
      }
      saveWalletNotesLocally();
      if (tableStateChanged && tablePageKey()) {
        restoreSavedTableState(tablePageKey());
        syncRestoredTableControls(tablePageKey());
        globalThis.syncQuickFilterLabels?.();
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
    return true;
  })();

  state.walletPreferencesLoadPromise = loadPromise;
  try {
    return await loadPromise;
  } finally {
    if (state.walletPreferencesLoadPromise === loadPromise) {
      state.walletPreferencesLoadPromise = null;
    }
  }
}

async function performWalletPreferencesSave(options = {}) {
  if (!state.linkedWalletAddress || !hasWalletProof()) {
    return;
  }

  saveWalletWatchlistLocally();
  saveWalletNotesLocally();

  const saveSequence = ++state.walletPreferencesSaveSequence;
  let shouldSaveSettings = false;

  try {
    const addedIds = Array.from(state.watchlistPlayerIdsAdded);
    const removedIds = Array.from(state.watchlistPlayerIdsRemoved);
    const pendingSettings = loadPendingSettingsLocally();
    const requestedDomains = Array.isArray(options.domains) ? new Set(options.domains) : null;
    const includesDomain = (domain) => !requestedDomains || requestedDomains.has(domain);
    shouldSaveSettings = includesDomain("settings") && (options.includeSettings === true || state.settingsSaveInFlight || Boolean(pendingSettings));
    const settingsPayload = currentSettingsPayloadForSave();
    state.settingsReceiveEmailsFor = [...settingsPayload.receiveEmailsFor];
    if (shouldSaveSettings && (pendingSettings || state.settingsSaveInFlight)) {
      savePendingSettingsLocally(settingsPayload);
    }
    const body = {
      ...(includesDomain("playerNotes") ? { playerNotes: normalizedPlayerNotes(state.playerNotes) } : {}),
      ...(includesDomain("watchlists") ? { watchlists: watchlistsPayload() } : {}),
      ...(includesDomain("tableState") ? { tableState: stripPersistentSortState(currentTableState()) } : {}),
      ...(includesDomain("evaluationSettings") ? { evaluationSettings: currentEvaluationSettingsPayload() } : {}),
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
      if (includesDomain("watchlists")) {
        clearSyncedWatchlistChanges(addedIds, removedIds);
      }

      let watchlistChanged = false;
      if (includesDomain("watchlists") && Array.isArray(data.watchlists) && data.watchlists.length) {
        applyWatchlists(data.watchlists, state.currentWatchlistId, []);
        saveWalletWatchlistLocally();
        watchlistChanged = true;
      }

      if (shouldSaveSettings) {
        const savedSettings = data.settings || settingsPayload;
        applySettingsPayload(savedSettings);
        state.settingsReceiveEmailsFor = reconcileSettingsReceiveEmailsForWithCurrentWatchlists(savedSettings.receiveEmailsFor);
        state.settingsSaveInFlight = false;
        clearPendingSettingsLocally();
      }

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
    if (shouldSaveSettings && saveSequence === state.walletPreferencesSaveSequence) {
      state.settingsSaveInFlight = false;
    }
    // Local wallet watchlist and notes remain saved if cloud sync is unavailable.
  }
}

async function saveWalletPreferencesNow(options = {}) {
  const run = () => performWalletPreferencesSave(options);
  state.walletPreferencesWritePromise = Promise.resolve(state.walletPreferencesWritePromise)
    .catch(() => undefined)
    .then(run);
  return state.walletPreferencesWritePromise;
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
    void saveWalletPreferencesNow({ domains: ["watchlists", "tableState", "settings"] });
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
    void saveWalletPreferencesNow({ domains: ["tableState"] });
  }, 500);
}

function restoreWatchlistState() {
  ensureDefaultWatchlist();
}

function restoreMenuState() {
  state.menuOpen = true;
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





function normalizeEvaluationLateSeasonRewardRates(value) {
  const source = Array.isArray(value) ? value : [];
  return DEFAULT_EVALUATION_LATE_SEASON_REWARD_RATES.map((defaultRate, index) => {
    const parsedRate = parseEvaluationRewardRate(source[index]);
    return parsedRate === null ? defaultRate : parsedRate;
  });
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

const EVALUATION_SEARCH_FAST_COLUMNS = Object.freeze([
  "player_id",
  "name",
  "overall",
  "age",
  "positions",
  "retirement_years",
]);

function evaluationSearchRoutePayload(entry) {
  const columns = Array.isArray(entry?.columns) ? entry.columns : [];
  const row = Array.isArray(entry?.row) ? entry.row : null;
  if (!row || !columns.length || !EVALUATION_SEARCH_FAST_COLUMNS.every((column) => columns.includes(column))) {
    return null;
  }

  const playerIdIndex = columns.indexOf("player_id");
  if (playerIdIndex < 0 || String(row[playerIdIndex] ?? "") !== String(entry?.playerId ?? "")) {
    return null;
  }

  return {
    columns: [...columns],
    rows: [[...row]],
    page: 1,
    pageSize: 1,
    totalRows: 1,
    sourceRows: 1,
    generatedAt: state.manifest?.generated_at || null,
  };
}

function renderEvaluationSearchEntryImmediately(entry, route) {
  if (!route) return false;
  const payload = evaluationSearchRoutePayload(entry);
  if (!payload) return false;

  const { requestKey, cacheKey } = incrementalRequestDetails(route, 1);
  state.incrementalPayloadCache.set(cacheKey, payload);
  applyIncrementalPayload(route, payload);
  state.incrementalLastKey = requestKey;
  state.incrementalLastLoadedAt = Date.now();

  const row = rowByPlayerId(entry.playerId);
  if (!row) return false;
  renderEvaluationTable(row);
  return true;
}

function renderEvaluationSearchResults(options = {}) {
  syncEvaluationSearchClearButton();
  const query = normalizeSearchText(evaluationSearchInput.value.trim());
  const releaseRecentLoading = options.releaseRecentLoading === true;

  if (query && window.__mflEvaluationSearchStateRuntime?.shouldShowTypedResults?.() === false) {
    evaluationSearchResults.hidden = true;
    return false;
  }

  const evaluationRecentLoadingOwned = evaluationSearchResults.dataset.mflEvaluationRecentLoading === "true"
    || window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.();
  if (!query && evaluationRecentLoadingOwned && !releaseRecentLoading) {
    return false;
  }

  if (!query && !shouldShowEvaluationRecentResults()) {
    evaluationSearchResults.replaceChildren();
    evaluationSearchResults.hidden = true;
    return true;
  }

  const results = query ? evaluationSearchMatches(query) : recentEvaluationRows();
  const resultEntries = results.map((entry) => {
    const playerId = String(entry.playerId);
    return {
      entry,
      playerId,
      metadataHtml: playerSearchMetadataHtml(entry, playerId),
    };
  });
  const renderSignature = JSON.stringify([
    query,
    resultEntries.map(({ entry, playerId, metadataHtml }) => [
      playerId,
      String(entry.nameDisplay || ""),
      metadataHtml,
    ]),
  ]);
  const reusableResults = evaluationSearchResults.dataset.mflEvaluationRenderSignature === renderSignature
    && evaluationSearchResults.children.length === resultEntries.length
    && resultEntries.every(({ playerId }, index) => {
      const child = evaluationSearchResults.children[index];
      return child instanceof HTMLButtonElement
        && child.classList.contains("evaluationSearchResult")
        && child.dataset.playerId === playerId;
    });

  if (reusableResults) {
    evaluationSearchResults.hidden = resultEntries.length === 0;
    return true;
  }

  const fragment = document.createDocumentFragment();

  resultEntries.forEach(({ entry, playerId, metadataHtml }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evaluationSearchResult";
    button.dataset.playerId = playerId;
    button.innerHTML = `<strong>${escapeHtml(entry.nameDisplay)}</strong><span>${metadataHtml}</span>`;
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
        if (renderEvaluationSearchEntryImmediately(entry, route)) return;
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
    fragment.appendChild(button);
  });
  evaluationSearchResults.replaceChildren(fragment);
  evaluationSearchResults.hidden = resultEntries.length === 0;
  evaluationSearchResults.dataset.mflEvaluationRenderSignature = renderSignature;
  return true;
}




function primeEmptyEvaluationSearch() {
  const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
  if (typeof prime !== "function") return Promise.resolve(false);

  // Recent players are search chrome, not Evaluation page readiness. During the
  // initial direct refresh, the first authoritative hydration already comes from
  // the startup ownership chain, so do not schedule a second Supabase refresh.
  const initialRefreshPending = isPlainEvaluationUrl()
    && document.documentElement.classList.contains("mflSingleRenderPending");
  void prime(false, true, false);
  if (!initialRefreshPending) {
    queueMicrotask(() => {
      if (!isPlainEvaluationUrl() || state.evaluationPlayerId) return;
      void prime(false, false, true);
    });
  }
  return Promise.resolve(false);
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

  detachEvaluationSnapshotForEdit();
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

function handleEvaluationOverallControlClick(event) {
  const target = event.target instanceof Element
    ? event.target.closest("[data-evaluation-overall-season][data-evaluation-overall-delta]")
    : null;
  if (!(target instanceof HTMLButtonElement) || !evaluationTableBody?.contains(target)) return;
  const playerId = String(state.evaluationPlayerId || "").trim();
  if (!playerId) return;
  adjustEvaluationOverall(
    playerId,
    Number(target.dataset.evaluationOverallSeason),
    Number(target.dataset.evaluationOverallDelta),
  );
}

evaluationTableBody?.addEventListener("click", handleEvaluationOverallControlClick);

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

  return `<select class="evaluationSummaryPositionSelect" data-mfl-dropdown-enhanced="true" data-evaluation-summary-position>${positions.map((position) => `<option value="${escapeHtml(position)}"${position === selectedPosition ? " selected" : ""}>${escapeHtml(position)}</option>`).join("")}</select>`;
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
  const compactPlayerName = playerName.replace(/^(\S)[^\s]*\s+(?:.*\s)?(\S+)$/, "$1. $2");
  const playerNameMarkup = `<span class="evaluationPlayerNameFull">${escapeHtml(playerName)}</span><span class="evaluationPlayerNameCompact">${escapeHtml(compactPlayerName)}</span>`;
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
      playerNameMarkup,
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
      if (typeof value === "string" && (value.includes("evaluationOverallControl") || value.includes("evaluationPlayerName"))) {
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
    playerNameMarkup,
    evaluationSummaryPositionControl(row, summaryPosition),
    Number.isFinite(currentAge) ? currentAge + seasonOffset : "",
    summaryOverall,
    expectedSeasons,
    formatEvaluationMfl(mflValueTotal),
    formatEvaluationCurrency(presentValueTotal),
  ].forEach((value) => {
    const cell = document.createElement("td");

    if (typeof value === "string" && (value.includes("data-evaluation-summary-position") || value.includes("evaluationPlayerName"))) {
      cell.innerHTML = value;
    } else {
      cell.textContent = value;
    }

    summaryRow.appendChild(cell);
  });

  evaluationSummaryBody.replaceChildren(summaryRow);
  evaluationTableBody.replaceChildren(fragment);
  window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
  updateEvaluationFooterActions();
  evaluationSummaryBody.querySelectorAll("[data-evaluation-summary-position]").forEach((select) => {
    select.addEventListener("dblclick", (event) => {
      event.preventDefault();
      select.blur();
      window.getSelection()?.removeAllRanges();
    });
    select.addEventListener("change", () => {
      detachEvaluationSnapshotForEdit();
      state.evaluationSummaryPositions[String(getValue(row, "player_id") || "")] = select.value;
      renderEvaluationTable(row);
    });
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
    await loadSavedEvaluation(savedId);
    return;
  }

  const shareId = evaluationShareIdFromUrl();
  if (shareId && state.evaluationShareId !== shareId) {
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
function playerFirstPaintKnownValues(row) {
  const knownValues = {};
  if (!Array.isArray(row) || !Array.isArray(state.columns)) return knownValues;
  state.columns.forEach((column, index) => {
    if (!column || index >= row.length) return;
    const rawValue = row[index];
    if (rawValue === null || rawValue === undefined || rawValue === "") return;
    const rawType = typeof rawValue;
    const serializedRaw = rawType === "string" || rawType === "number" || rawType === "boolean" ? rawValue : String(rawValue);
    const display = String(formatCellValue(row, column) || serializedRaw).trim();
    knownValues[column] = { raw: serializedRaw, display };
  });
  return knownValues;
}

function playerFirstPaintSearchEntry(playerId) {
  const key = String(playerId || "").trim();
  return [...state.searchIndex, ...state.evaluationSearchIndex]
    .find((entry) => String(entry?.playerId || "").trim() === key) || null;
}

function playerFirstPaintNavigationContext(playerId) {
  const key = String(playerId || "").trim();
  const searchEntry = playerFirstPaintSearchEntry(key);
  const directRow = rowByPlayerId(key);
  const indexedRow = !directRow && Array.isArray(searchEntry?.row) && searchEntry.row.length === state.columns.length
    ? searchEntry.row
    : null;
  const row = directRow || indexedRow;
  const knownValues = playerFirstPaintKnownValues(row);
  const rememberKnown = (column, raw, display) => {
    if (knownValues[column] || raw === null || raw === undefined || raw === "") return;
    const text = String(display ?? raw).trim();
    if (!text) return;
    knownValues[column] = { raw, display: text };
  };
  const searchPositionsText = String(searchEntry?.positionsDisplay || "").trim();
  const searchPositions = searchPositionsText
    ? searchPositionsText.split(",").map((position) => position.trim()).filter(Boolean)
    : [];
  const searchOverall = Number(searchEntry?.overall || 0);
  if (searchEntry) {
    rememberKnown("name", searchEntry.nameDisplay || "", searchEntry.nameDisplay || "");
    rememberKnown("positions", searchPositionsText, searchPositionsText);
    rememberKnown("nationality", searchEntry.nationalityRaw ?? searchEntry.nationalityDisplay ?? "", searchEntry.nationalityDisplay || "");
    if (searchOverall > 0) rememberKnown("overall", searchOverall, formatPlainValue(searchOverall, "overall"));
  }

  const knownAgentName = String(knownValues.wallet_name?.display || "").trim();
  if (knownAgentName && !knownValues.wallet_address) {
    const normalizedName = normalizeSearchText(knownAgentName);
    const matches = state.agentSearchIndex.filter((entry) => normalizeSearchText(entry?.name || "") === normalizedName);
    if (matches.length === 1) rememberKnown("wallet_address", matches[0].walletAddress || "", matches[0].walletAddress || "");
  }

  const knownClubName = String(knownValues.active_contract_club_name?.display || "").trim();
  if (knownClubName && !knownValues.active_contract_club_id) {
    const normalizedName = normalizeSearchText(knownClubName);
    const matches = state.clubSearchIndex.filter((entry) => normalizeSearchText(entry?.name || "") === normalizedName);
    if (matches.length === 1) rememberKnown("active_contract_club_id", matches[0].clubId || "", matches[0].clubId || "");
  }
  return {
    playerId: key,
    name: row ? formatCellValue(row, "name") : String(searchEntry?.nameDisplay || "").trim(),
    positions: row ? playerPositions(row) : searchPositions,
    overall: row ? statDisplayValue(row, "overall") : (searchOverall > 0 ? formatPlainValue(searchOverall, "overall") : ""),
    externalUrl: row ? formatCellValue(row, linkColumn) : "",
    knownValues,
  };
}

window.__mflBuildPlayerFirstPaintContext = playerFirstPaintNavigationContext;

function openPlayerPage(playerId) {
  const pendingContext = playerFirstPaintNavigationContext(playerId);
  const key = pendingContext.playerId;
  window.__mflPlayerFirstPaintPendingContext = pendingContext;
  setPage("player", true, { playerId: key, __mflPlayerFirstPaintContext: pendingContext });
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



function nextOverallColorClass(neededStatGain) {
  if (neededStatGain <= 1) return "easy";
  if (neededStatGain <= 2) return "medium";
  if (neededStatGain <= 3) return "hard";
  return "veryHard";
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
  const owner = window.__mflRenderPlayerPageOwner;
  if (typeof owner !== "function") {
    throw new Error("Player route core is not loaded.");
  }
  return owner(playerId);
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
    if (query) return;
    playerSearchResults.classList.remove("filledSearchResults");
    playerSearchResults.innerHTML = '<div class="searchHint">Recent searches will appear here.</div>';
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
        navigateFromSearch(() => openAgentPage(result.walletAddress, result.name));
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

function linkedWalletAddressesForOwnedPlayers() {
  return new Set([state.linkedWalletAddress, state.linkedWalletProof?.signingAddress, state.linkedWalletProof?.address]
    .map((address) => normalizeWalletAddress(address).toLowerCase())
    .filter(Boolean));
}



function rowIsMflWalletPlayer(row) {
  const walletAddress = normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase();
  const walletName = normalizedAgentName(getValue(row, "wallet_name")).toLowerCase();
  return walletAddress === mflWalletAddress || walletName === "mfl";
}

function rowHasHiddenMflJoinedAgencyDate(row) {
  if (state?.currentPage === "club" || /^\/(?:clubs|club)\/[^/]+(?:\/|$)/i.test(window.location.pathname)) return false;
  if (!rowIsMflWalletPlayer(row)) {
    return false;
  }

  const joinedDay = ownedSinceDay(row);
  return joinedDay !== null && [parseFilterDateDay("2025-10-09"), parseFilterDateDay("2025-10-10")].includes(joinedDay);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
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
  const route = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
  return route
    ? { scope: "club", clubId: route.clubId, view: route.view }
    : null;
}

function incrementalWatchlistPlayerIds(options = {}) {
  const watchlistId = String(options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "");
  const watchlist = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds))
    .find((candidate) => candidate.id === watchlistId);
  return normalizeWatchlistIdList(watchlist?.playerIds || Array.from(state.watchlistPlayerIds));
}

function incrementalRouteTarget(pageName, options = {}) {
  const clubTarget = options.ignoreCurrentClubRoute ? null : clubRouteTargetFromPath();
  if (pageName === "club") {
    const requestedClubId = String(options.clubId || clubTarget?.clubId || "").trim();
    if (!requestedClubId) return null;
    const requestedClubView = String(options.view || clubTarget?.view || "attributes").toLowerCase();
    const clubView = ["attributes", "contracts", "current", "all"].includes(requestedClubView)
      ? requestedClubView
      : "attributes";
    return {
      pageName: "club",
      scope: "club",
      clubId: requestedClubId,
      view: clubView,
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
    if (rules.length) query.set("filters", JSON.stringify(serializeFilterRulesForRequest(rules)));
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
  return false;
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
  window.__mflPlayerFirstPaintRuntime?.markDetailPayloadReady?.(route, payload);
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
  const navigationTransition = options.__mflNavigationTransition || null;
  const navigationRequestIsCurrent = () => !navigationTransition || navigationTransitionIsCurrent(navigationTransition);

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
    if (!incrementalRouteRequestIsCurrent(generation) || !navigationRequestIsCurrent()) return null;
    applyIncrementalPayload(route, payload);
    state.incrementalMode = false;
    return payload;
  }

  const { requestKey, cacheKey } = incrementalRequestDetails(route, page);
  const generation = beginIncrementalRouteRequest(cacheKey, force);
  if (force) state.incrementalPayloadCache.delete(cacheKey);

  const cachedPayload = !force ? state.incrementalPayloadCache.get(cacheKey) : null;
  const inheritedTableLoadingRequestToken = Number(options.tableLoadingRequestToken || 0);
  const cachedPayloadSupersedesActiveRequest = Boolean(cachedPayload && window.__mflTableLoadingRuntime?.requestActive?.());
  const tableLoadingRequestToken = inheritedTableLoadingRequestToken
    || (!cachedPayload || cachedPayloadSupersedesActiveRequest
      ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode })
      : 0)
    || 0;

  if (cachedPayload) {
    if (!incrementalRouteRequestIsCurrent(generation) || !navigationRequestIsCurrent()) {
      finishOwnedTableLoadingRequest();
      return null;
    }
    try {
      applyIncrementalPayload(route, cachedPayload);
      state.incrementalLastKey = requestKey;
      state.incrementalLastLoadedAt = Date.now();
      return cachedPayload;
    } finally {
      finishOwnedTableLoadingRequest();
    }
  }

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
    finishOwnedTableLoadingRequest();
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    throw error;
  }
  if (!payload || !incrementalRouteRequestIsCurrent(generation) || !navigationRequestIsCurrent()) {
    finishOwnedTableLoadingRequest();
  }
  if (!payload || !incrementalRouteRequestIsCurrent(generation) || !navigationRequestIsCurrent()) return null;
  try {
    applyIncrementalPayload(route, payload);
    state.incrementalLastKey = requestKey;
    state.incrementalLastLoadedAt = Date.now();
    return payload;
  } finally {
    finishOwnedTableLoadingRequest();
  }

function finishOwnedTableLoadingRequest() {
  if (inheritedTableLoadingRequestToken === 0 && tableLoadingRequestToken !== 0) {
    window.__mflTableLoadingRuntime?.finishRequest?.(tableLoadingRequestToken);
  }
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
  const reloadLoadingRequestToken = (!incrementalRouteIsCached(route, page) || window.__mflTableLoadingRuntime?.requestActive?.())
    ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode }) || 0
    : 0;

  const loadAndRender = async () => {
    try {
      const payload = await requestIncrementalRoute(route, page, {
        loadingMode: options.loadingMode,
        tableLoadingRequestToken: reloadLoadingRequestToken,
      });
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
    } finally {
      window.__mflTableLoadingRuntime?.finishRequest?.(reloadLoadingRequestToken);
    }
  };

  if (incrementalRouteIsCached(route, page)) {
    return loadAndRender();
  }

  return withInteractionBusy(loadAndRender, options.loadingReason);
}
window.mflReloadIncrementalPage = reloadIncrementalPage;

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
  const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;
  if (pageName === "club" && !clubTarget?.clubId) return;
  const clubPath = clubTarget?.clubId
    ? window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName) || ""
    : "";
  void runViewTransition(pageName, viewName, {
    walletAddress: state.currentAgentWalletAddress,
    watchlistId: state.currentWatchlistId,
    ...(clubTarget?.clubId ? {
      clubId: clubTarget.clubId,
      path: clubPath,
    } : {}),
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
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && searchModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !filtersModal.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && filtersModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !watchlistChoiceModal?.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && watchlistChoiceModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !addWatchlistModal.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && addWatchlistModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !deleteWatchlistModal.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && deleteWatchlistModal.contains(document.activeElement)) document.activeElement.blur();
  } else if (event.key === "Escape" && !advancedSettingsModal.hidden) {
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && advancedSettingsModal.contains(document.activeElement)) document.activeElement.blur();
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
window.addEventListener("storage", syncRecentSearchStateFromStorage);
playerSearchInput.addEventListener("input", renderSearchResults);
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
  if (document.activeElement instanceof HTMLElement && evaluationLoadModal.contains(document.activeElement)) {
    document.activeElement.blur();
  }
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
    openAgentPage(agentLink.dataset.walletAddress || "", agentLink.dataset.agentName || agentLink.textContent || "");
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
  setPage(target.pageName, false, { ...target.options, preserveScroll: true });
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
  window.__mflCoreContracts?.installEvaluationRecentStateOwnership?.();
  const initialTarget = pageTargetFromPath(`${location.pathname}${location.search}`);
  commitPageTransition(initialTarget.pageName, false, initialTarget.options);
  const startupNavigationSequence = navigationTransitionSequence;
  const earlyGlobalSearch = primeGlobalSearchIndexes();
  const startupSummaryPromise = loadSummary();
  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);
  Reflect.set(window, "__mflSettingsStartupWalletPreferencesPending", initialTarget.pageName === "settings");
  const startupProgressionPermissionPromise = (
    pageRequiresProgressionPermission(initialTarget.pageName)
    && hasWalletOptIn()
  )
    ? loadWalletPermissions({ force: true })
    : null;
  applyStoredWalletPermission();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
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
      if (pageName === "watchlist" && routeView) enforceWatchlistRouteView(true);
      return result;
    };
  }

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

;(() => {
  // Compatibility marker for legacy validation; route ownership lives in the Club chunk:
  // squad|contracts|current-season|all-time
  // Compatibility marker; the executable stale-payload guard is route-owned: if (!dataLoaded) return;
  if (typeof renderSearchResultsNow !== "function" || renderSearchResultsNow.__mflUniversalClubSearch) return;

  const CLUB_SEARCH_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];

  function clubSearchIdColumn() {
    return CLUB_SEARCH_ID_COLUMNS.find((column) => typeof hasColumn === "function" ? hasColumn(column) : state.columns.includes(column)) || "";
  }

  function universalClubSearchEntries(query) {
    const idColumn = clubSearchIdColumn();
    if (!query || !idColumn || !Array.isArray(state.rows)) return [];
    const normalizedQuery = typeof normalizeSearchText === "function" ? normalizeSearchText(query) : String(query).toLowerCase();
    const clubs = new Map();

    state.rows.forEach((row) => {
      const clubId = String(getValue(row, idColumn) || "").trim();
      const name = String(getValue(row, "active_contract_club_name") || "").trim();
      if (!clubId || !name || clubs.has(clubId)) return;
      const searchable = typeof normalizeSearchText === "function"
        ? normalizeSearchText(name + " " + clubId)
        : (name + " " + clubId).toLowerCase();
      if (!searchable.includes(normalizedQuery)) return;
      const divisionRank = typeof contractDivisionSortValue === "function"
        ? contractDivisionSortValue(getValue(row, "active_contract_club_division"))
        : null;
      clubs.set(clubId, {
        clubId,
        name,
        divisionRank: divisionRank ?? Number.POSITIVE_INFINITY,
      });
    });

    return Array.from(clubs.values())
      .sort((a, b) => a.divisionRank - b.divisionRank || a.name.localeCompare(b.name))
      .slice(0, 5);
  }

  function addUniversalClubSearchResults() {
    if (typeof playerSearchInput === "undefined" || typeof playerSearchResults === "undefined") return;
    const query = String(playerSearchInput.value || "").trim();
    const entries = universalClubSearchEntries(query);
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
      button.innerHTML = "<strong>" + safeName + "</strong><span>Club &middot; #" + safeId + "</span>";
      button.addEventListener("click", () => {
        if (typeof closeSearch === "function") closeSearch();
        if (typeof window.mflOpenClubPage === "function") {
          void window.mflOpenClubPage(clubId, "attributes");
        }
      });
      fragment.appendChild(button);
    });
    playerSearchResults.prepend(fragment);
    playerSearchResults.classList.add("filledSearchResults");
  }

  const originalRenderSearchResultsNow = renderSearchResultsNow;
  const renderSearchResultsNowWithUniversalClubs = function() {
    const result = originalRenderSearchResultsNow.apply(this, arguments);
    addUniversalClubSearchResults();
    return result;
  };
  Object.defineProperty(renderSearchResultsNowWithUniversalClubs, "__mflUniversalClubSearch", { value: true });
  renderSearchResultsNow = renderSearchResultsNowWithUniversalClubs;
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
    privacyPage.hidden = true;
    tablePageTitle.textContent = tableTitleForPage(pageName);
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
    privacyPage.hidden = true;


    if (tableRoute) {
      if (route.scope !== "club") globalThis.syncQuickFilterLabels?.();
      if (route.scope !== "club") {
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
  if (!pageNavigationIsCurrent(options)) return false;
  const inheritedTableLoadingRequestToken = Number(requestOptions.tableLoadingRequestToken || 0);
  const renderLoadingRequestToken = inheritedTableLoadingRequestToken
    || (!incrementalRouteIsCached(route, 1) || window.__mflTableLoadingRuntime?.requestActive?.()
      ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: requestOptions.loadingMode }) || 0
      : 0);
  const ownsRenderLoadingRequestToken = inheritedTableLoadingRequestToken === 0 && renderLoadingRequestToken !== 0;
  try {
    const payload = await requestIncrementalRoute(route, 1, {
      ...requestOptions,
      tableLoadingRequestToken: renderLoadingRequestToken,
      __mflNavigationTransition: options.__mflNavigationTransition || null,
    });
    if (!payload || !pageNavigationIsCurrent(options)) return false;
    if (tablePages.has(pageName)) {
      restoreSavedTableState(pageName, { view: route.view || options.view });
    }
    state.dataAccess = currentDataAccess(pageName);
    state.incrementalApplying = true;
    try {
      const result = await originalSetPage.call(this, pageName, false, {
        ...options,
        replaceUrl: "",
        skipNavigationLoading: true,
      });
      return pageNavigationIsCurrent(options) ? result : false;
    } finally {
      state.incrementalApplying = false;
    }
  } finally {
    if (ownsRenderLoadingRequestToken) {
      window.__mflTableLoadingRuntime?.finishRequest?.(renderLoadingRequestToken);
    }
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
    if (!tablePages.has(pageName) && pageName !== "club") {
      return originalSetView.apply(this, arguments);
    }
    const nextView = normalizeViewForPage(viewName, pageName);
    if (!allowedViewsForPage(pageName).includes(nextView)) return;

    const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;
    const routeOptions = {
      view: nextView,
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
      ...(clubTarget?.clubId ? { clubId: clubTarget.clubId } : {}),
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

    const targetSortState = tableSortStateForView(
      nextView,
      pageKey || pageName,
      { sortKey: previousSortKey, sortDirection: previousSortDirection },
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

    const viewLoadingRequestToken = (!incrementalRouteIsCached(route, 1) || window.__mflTableLoadingRuntime?.requestActive?.())
      ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0
      : 0;
    const loadAndRender = async () => {
      try {
        const payload = await requestIncrementalRoute(route, 1, {
          tableLoadingRequestToken: viewLoadingRequestToken,
        });
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
      } finally {
        window.__mflTableLoadingRuntime?.finishRequest?.(viewLoadingRequestToken);
      }
    };

    if (incrementalRouteIsCached(route, 1)) return loadAndRender();
    return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);
};

  setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {
    resetTableSortSession(pageName, options);
    const navigationUpdatesHistory = options.__mflNavigationUpdatesHistory ?? updateHash;
    if (!options.skipNavigationTransition) {
      return runPageTransition(pageName, navigationUpdatesHistory, options, (navigationTransition) => setPage(pageName, false, {
        ...options,
        skipNavigationTransition: true,
        __mflNavigationTransition: navigationTransition,
        __mflNavigationUpdatesHistory: navigationUpdatesHistory,
      }));
    }
    const progressionLoadingRequestToken = pageName === "progression" && !routeDataCacheReady(pageName, options)
      ? window.__mflTableLoadingRuntime?.beginRequest?.("progression") || 0
      : 0;
    const navigationTransition = options.__mflNavigationTransition || null;
    const navigationOptions = navigationTransition
      ? { ...options, __mflNavigationTransition: navigationTransition }
      : options;
    if (!pageNavigationIsCurrent(navigationOptions)) {
      window.__mflTableLoadingRuntime?.finishRequest?.(progressionLoadingRequestToken);
      return null;
    }
    updateHash = false;

    const requestedMflView = pageName === "mfl"
      ? normalizeViewForPage(options.view, "mfl")
      : "";
    if (pageName === "mfl" && requestedMflView === "stats") {
      const route = prepareIncrementalRoute(pageName, {
        ...navigationOptions,
        view: "stats",
        ignoreCurrentClubRoute: navigationUpdatesHistory,
      });
      if (!route) {
        state.incrementalMode = false;
        return originalSetPage.call(this, "mflstats", false, {
          ...navigationOptions,
          replaceUrl: "",
          view: "stats",
          skipNavigationLoading: true,
        });
      }
      const statsLoadingRequestToken = (!incrementalRouteIsCached(route, 1) || window.__mflTableLoadingRuntime?.requestActive?.())
      ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0
      : 0;
    try {
      const payload = await requestIncrementalRoute(route, 1, {
        tableLoadingRequestToken: statsLoadingRequestToken,
        __mflNavigationTransition: navigationTransition,
      });
      if (!payload || !pageNavigationIsCurrent(navigationOptions)) return false;
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
    } finally {
      window.__mflTableLoadingRuntime?.finishRequest?.(statsLoadingRequestToken);
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
      if (!pageNavigationIsCurrent(navigationOptions)) return null;
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
      ...navigationOptions,
      ignoreCurrentClubRoute: navigationUpdatesHistory,
    });
    const shellFirst = shellFirstTablePages.has(pageName);
    if (shellFirst) {
      commitIncrementalLocation(pageName, updateHash, navigationOptions);
      renderTableDestinationShell(pageName, route);
    }
    if (!route) {
      window.__mflTableLoadingRuntime?.finishRequest?.(progressionLoadingRequestToken);
      state.incrementalMode = false;
      return originalSetPage.call(this, pageName, updateHash, navigationOptions);
    }

    if (!shellFirst) {
      commitIncrementalLocation(pageName, updateHash, navigationOptions);
    } else {
      globalThis.syncQuickFilterLabels?.();
      updateViewButtons();
      buildHeader();
    }
    const loadAndRender = async () => {
      try {
        const result = await renderLoadedIncrementalRoute.call(this, pageName, updateHash, navigationOptions, route, {
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
    const stagedViewCommit = pendingViewTransition?.pageName === currentPage
      && pendingViewTransition?.viewName === currentView;
    const staticRoutePending = staticHeader
      && !stagedViewCommit
      && staticPage
      && staticView
      && (currentPage !== staticPage || currentView !== staticView);
    if (staticRoutePending) return true;
    if (staticHeader && !stagedViewCommit && staticSignature && staticSignature !== signature) return true;
    const needsCanonicalBuild = !head.rows[0] || staticHeader || staticSignature !== signature;
    if (needsCanonicalBuild) buildHeader();
    if (!head.rows[0]) return false;
    if (needsCanonicalBuild) {
      head.dataset.mflHeaderSignature = signature;
      delete head.dataset.mflStaticHeader;
    }
    return head.dataset.mflStaticHeader === "true" || head.dataset.mflHeaderSignature === signature;
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

  function renderCurrentEvaluationSearchResults(options = {}) {
    if (typeof renderEvaluationSearchResults !== "function") return false;
    return renderEvaluationSearchResults(options) !== false;
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
      await saveWalletPreferencesNow({ domains: ["tableState"] });
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

    return true;
  }

  async function ensureEvaluationRecentStateHydrated(options = {}) {
    const force = Boolean(options.force);
    if (evaluationRecentStateHydrated && !force) return true;

    const pendingStartup = window.__mflWalletPreferencesStartupPromise;
    if (!force && pendingStartup && typeof pendingStartup.then === "function") {
      await Promise.resolve(pendingStartup).catch(() => undefined);
      if (evaluationRecentStateHydrated) return true;
    }

    if (!state.linkedWalletAddress
      || typeof hasWalletProof !== "function"
      || !hasWalletProof()
      || typeof loadWalletPreferences !== "function") {
      return false;
    }

    if (force) evaluationRecentStateHydrated = false;
    await loadWalletPreferences({ force });
    return evaluationRecentStateHydrated;
  }

  window.__mflCoreContracts = Object.freeze({
    ensureCanonicalTableHeader,
    syncTableSelectionHeader,
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
    evaluationRecentStateHydrated: () => evaluationRecentStateHydrated,
    ensureEvaluationRecentStateHydrated,
  });
})();
;(() => {
  if (typeof setPage !== "function" || setPage.__mflRouteRuntimeGate) return;
  const originalRouteRuntimeSetPage = setPage;
  const routeRuntimeSetPage = async function setPageWithRouteRuntime(pageName, updateHash = true, options = {}) {
    const incomingOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
    const runtimeReady = incomingOptions.__mflRouteRuntimeReady === true;
    const crossPageNavigation = !runtimeReady
      && String(pageName || "") !== String(state.currentPage || "");
    if (crossPageNavigation) {
      const canonicalFilterSummaryUpdater = Reflect.get(window, "updateFilterSummary");
      if (typeof canonicalFilterSummaryUpdater === "function") {
        canonicalFilterSummaryUpdater(0);
      }
    }
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
    const footer = event.target.closest('.siteFooterDetails a[href="/changelog"], .siteFooterDetails a[data-page="changelog"]');
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
  

  



  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const home = event.target.closest('.brandLink[href="/"], .brandLink[data-page="home"]');
    if (!home || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void Promise.resolve(setPage("home", true));
  }, true);
})();
