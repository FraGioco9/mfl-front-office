// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const INCREMENTAL_EMPTY_STATE_HELPER = `function incrementalTableEmptyStateMessage(sourceRowsCount = state.incrementalSourceRows) {
  const hasSourceRows = Number(sourceRowsCount || 0) > 0;
  if (state.currentPage === "watchlist") {
    return hasSourceRows ? "No watchlist players match the current filters." : "No players in your watchlist yet.";
  }
  if (state.currentPage === "myplayers") {
    return hasSourceRows ? "No owned players match the current filters." : "No players found for this wallet.";
  }
  if (state.currentPage === "mfl") {
    return hasSourceRows ? "No MFL players match the current filters." : "No MFL players found.";
  }
  if (state.currentPage === "agents") {
    return hasSourceRows ? "No agent players match the current filters." : "No players found for this agent.";
  }
  return "No players match the current filters.";
}`;

const INCREMENTAL_FAST_PATH = `  if (state.incrementalMode) {
    const incrementalRules = readFilterRules();
    const filterSignature = appliedTableFilterSignature(incrementalRules);
    if (lastAppliedTableFilterSignature && filterSignature !== lastAppliedTableFilterSignature) {
      state.selectedPlayerIds.clear();
      state.selectionAnchorPlayerId = null;
    }
    lastAppliedTableFilterSignature = filterSignature;
    updateFilterSummary();

    if (!state.incrementalApplying) {
      if (options.save !== false) saveTableState();
      state.page = 1;
      void reloadIncrementalPage(1, { save: false });
      return;
    }

    // Incremental /api/data responses are already scoped, filtered, and sorted
    // from the exact query that produced this page. Reuse that accepted payload
    // instead of repeating the same row predicates and sort in the browser.
    state.tableSourceRowsCount = state.incrementalSourceRows;
    state.filteredRows = state.rows;
    emptyState.textContent = incrementalTableEmptyStateMessage(state.incrementalSourceRows);
    syncActiveWatchlistFromSet();
    if (options.save !== false) saveTableState();
    renderTable();
    return;
  }

`;

export function optimizeIncrementalTableRuntimeArtifacts(artifacts) {
  const core = String(artifacts?.core || "");
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  let table = String(routeChunks.table || "");
  if (!core) throw new Error("Cannot optimize incremental table runtime without the shared application core.");
  if (!table) throw new Error("Cannot optimize incremental table runtime without the Table route chunk.");

  table = replaceRequired(
    table,
    "function tableApplyFiltersOwner(options = {}) {",
    `${INCREMENTAL_EMPTY_STATE_HELPER}\n\nfunction tableApplyFiltersOwner(options = {}) {`,
    "incremental table empty-state helper",
  );

  table = replaceRequired(
    table,
    `  const rules = readFilterRules();\n  const filterSignature = appliedTableFilterSignature(rules);`,
    `${INCREMENTAL_FAST_PATH}  const rules = readFilterRules();\n  const filterSignature = appliedTableFilterSignature(rules);`,
    "incremental table server-owned filter/sort fast path",
  );

  routeChunks.table = table;
  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze(routeChunks),
  });
}
