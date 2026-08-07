// @ts-check

/**
 * Ordered top-level boundaries inside the retained classic application source.
 * Each marker starts a new classic-script execution unit while preserving the
 * original source order and global lexical environment.
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

function replaceExactly(source, pattern, replacement, expectedCount, label) {
  let count = 0;
  const nextSource = source.replace(pattern, (...args) => {
    count += 1;
    return typeof replacement === "function" ? replacement(...args) : replacement;
  });
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} ${label} replacement${expectedCount === 1 ? "" : "s"}, found ${count}.`);
  }
  return nextSource;
}

/**
 * Remove the retired interaction-busy compatibility facade before any classic
 * core section is executed. The wrapper was an identity async function, so the
 * direct calls preserve behavior while making loading state explicit at each
 * call site. Counts are intentional: a source drift fails startup/tests rather
 * than silently retaining a facade call.
 * @param {string} source
 */
export function prepareCoreRuntimeSource(source) {
  let prepared = source;
  prepared = replaceExactly(
    prepared,
    /\nasync function withInteractionBusy\(callback\) \{ return callback\(\); \}\n/,
    "\n",
    1,
    "interaction-busy definition",
  );
  prepared = replaceExactly(
    prepared,
    /await withInteractionBusy\(loadAndRender\);/g,
    "await loadAndRender();",
    1,
    "direct player-load call",
  );
  prepared = replaceExactly(
    prepared,
    /return withInteractionBusy\(async \(\) => \{\s*showTableBusyState\(\);\s*return loadAndRender\(\);\s*\}\);/g,
    "showTableBusyState();\n    return loadAndRender();",
    2,
    "table-busy call",
  );
  prepared = replaceExactly(
    prepared,
    /return withInteractionBusy\(async \(\) => \{\s*renderIncrementalLoadingState\(pageName, route\);\s*return loadAndRender\(\);\s*\}\);/g,
    "renderIncrementalLoadingState(pageName, route);\n    return loadAndRender();",
    2,
    "route-loading call",
  );
  if (prepared.includes("withInteractionBusy")) {
    throw new Error("Retired interaction-busy facade remains in prepared core runtime.");
  }
  return prepared;
}
