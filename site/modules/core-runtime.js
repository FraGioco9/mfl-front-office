// @ts-check

/**
 * Ordered top-level boundaries inside the retained classic application source.
 * Each marker starts a new classic-script execution unit while preserving the
 * original source bytes and global lexical environment.
 */
export const CORE_RUNTIME_PARTITIONS = Object.freeze([
  { name: "foundation", marker: null },
  { name: "wallet-access", marker: "function applyStoredWalletPermission() {" },
  { name: "account-navigation", marker: "function openAccountMenu() {" },
  { name: "page-routing", marker: "function renderTableLoadingShell(pageName) {" },
  { name: "tooltips-settings", marker: "function hidePlayerNoteTooltip(options = {}) {" },
  { name: "watchlists", marker: "function updateWatchlistUrl(replace = false, force = false) {" },
  { name: "persistence-search", marker: "function saveTableState() {" },
  { name: "table-rendering", marker: "function appendNextOverallTableValue(cell, row, statColumn) {" },
  { name: "evaluation-settings", marker: "function syncAdvancedRewardRateDraft(input, fallbackValue) {" },
  { name: "player-rendering", marker: "function displayedPrimaryOverall(row) {" },
  { name: "table-sorting", marker: "function tableNextOverallSortValue(row, statColumn) {" },
  { name: "filters-selection", marker: "function rowMatchesRules(row, rules) {" },
  { name: "incremental-data-events", marker: "function incrementalDataQuery(route, page = 1) {" },
  { name: "compatibility", marker: "(() => {\n  const currentVersion = \"1.122.0\";" },
]);
