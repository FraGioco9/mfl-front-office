// @ts-check
// Canonical app-core behavior is source-owned; this module composes the build-time route/action normalizers.

import { normalizeClubEntryLifecycle } from "./app-core-club-entry-lifecycle.js";
import { normalizeClubSortLifecycle } from "./app-core-club-sort-lifecycle.js";
import { normalizeClubStartupLifecycle } from "./app-core-club-startup-lifecycle.js";
import { splitEvaluationApplicationCoreRuntime } from "./app-core-evaluation-chunk.js";
import { normalizeEvaluationLoadLifecycle } from "./app-core-evaluation-load-lifecycle.js";
import { normalizeEvaluationRecentReadiness } from "./app-core-evaluation-recent-readiness.js";
import { normalizeEvaluationRouteLifecycle } from "./app-core-evaluation-route-lifecycle.js";
import { normalizeEvaluationSavedValuationCache } from "./app-core-evaluation-saved-valuation-cache.js";
import { normalizeEvaluationSearchLifecycle } from "./app-core-evaluation-search-lifecycle.js";
import { normalizeHomeSummaryLifecycle } from "./app-core-home-summary-lifecycle.js";
import { splitPlayerApplicationCoreRuntime } from "./app-core-player-chunk.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { replaceRequired } from "./app-core-splitter-utils.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { splitWalletApplicationCoreRuntime } from "./app-core-wallet-chunk.js";
import { splitWatchlistRouteApplicationCoreRuntime } from "./app-core-watchlist-route-chunk.js";

function normalizePageFilterResetBeforeRequest(artifacts) {
  const core = String(artifacts?.core || "");
  if (!core) throw new Error("Cannot normalize destination filter reset without shared application core.");

  const normalizedCore = replaceRequired(
    core,
    `    const savedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)
      ? state.tablePageStates?.[pageName] || defaultTablePageState(pageName)
      : null;
    if (savedPageState) {`,
    `    const storedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)
      ? state.tablePageStates?.[pageName] || defaultTablePageState(pageName)
      : null;
    const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;
    const savedPageState = resetFilters && storedPageState
      ? tableStateWithoutPageFilters(pageName, storedPageState)
      : storedPageState;
    if (resetFilters && savedPageState) state.tablePageStates[pageName] = savedPageState;
    if (savedPageState) {`,
    "destination filters reset before incremental route request",
  );

  return Object.freeze({
    ...artifacts,
    core: normalizedCore,
  });
}

function normalizeViewFilterStateBeforeTransition(artifacts) {
  const core = String(artifacts?.core || "");
  if (!core) throw new Error("Cannot normalize view filter preservation without shared application core.");

  const normalizedCore = replaceRequired(
    core,
    `  if (pageName === activePageName && viewName === activeViewName) return;

`,
    `  if (pageName === activePageName && viewName === activeViewName) return;

  if (pageName === activePageName && tablePages.has(pageName)) {
    saveTableStateLocally(currentTableState());
  }

`,
    "live table filters persisted before same-page view transition",
  );

  return Object.freeze({
    ...artifacts,
    core: normalizedCore,
  });
}

function normalizeFilterSummaryLifecycle(artifacts) {
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  const table = String(routeChunks.table || "");
  if (!table) throw new Error("Cannot normalize Filters summary without the Table route chunk.");

  let normalizedTable = replaceRequired(
    table,
    'function updateFilterSummary(count = activeFilterCount()) {\n  filterSummary.textContent = `${count} active`;\n}',
    'function updateFilterSummary(count = activeFilterCount()) {\n  filterSummary.textContent = String(count);\n}',
    "Filters summary renders the count only",
  );
  normalizedTable = replaceRequired(
    normalizedTable,
    'if (filterSummary) filterSummary.textContent = "0 active";',
    'if (filterSummary) filterSummary.textContent = "0";',
    "Club table clears the Filters summary without the legacy label",
  );
  normalizedTable = replaceRequired(
    normalizedTable,
    `  state.filterDraftRules = null;
  hideModal(filtersModal, () => {
    document.body.classList.remove("filtersOpen");
    if (restoreTriggerFocus) openFiltersButton.focus();
  });`,
    `  state.filterDraftRules = null;
  document.body.classList.remove("filtersOpen");
  hideModal(filtersModal, () => {
    if (restoreTriggerFocus) openFiltersButton.focus();
  });`,
    "Filters highlight clears when close starts",
  );

  routeChunks.table = normalizedTable;
  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze(routeChunks),
  });
}

function normalizeTableLoadingRenderLifecycle(artifacts) {
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  const table = String(routeChunks.table || "");
  if (!table) throw new Error("Cannot normalize table loading render lifecycle without the Table route chunk.");

  let normalizedTable = replaceRequired(
    table,
    `function tableRenderTableOwner() {
  const totalRows = state.incrementalMode ? state.incrementalTotalRows : state.filteredRows.length;`,
    `function tableRenderTableOwner() {
  if (document.documentElement.classList.contains("mflDataLoading") && !state.incrementalApplying) {
    window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true });
    return;
  }

  const totalRows = state.incrementalMode ? state.incrementalTotalRows : state.filteredRows.length;`,
    "pre-payload table render loading gate",
  );
  normalizedTable = replaceRequired(
    normalizedTable,
    `  tableBody.replaceChildren(fragment);
  emptyState.hidden = pageRows.length > 0;
  updateTablePlayerCount();`,
    `  tableBody.replaceChildren(fragment);
  emptyState.hidden = pageRows.length > 0;
  window.__mflTableLoadingRuntime?.commitFinalRender?.();
  updateTablePlayerCount();`,
    "fresh table payload render commit",
  );

  routeChunks.table = normalizedTable;
  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze(routeChunks),
  });
}

export function normalizeBuiltApplicationCoreArtifacts(source) {
  const canonicalSource = String(source || "").replace(/\r\n?/g, "\n");
  if (!canonicalSource.trim()) throw new Error("Cannot build an empty application core.");

  const routeArtifacts = splitApplicationCoreRuntime(canonicalSource);
  const evaluationRouteArtifacts = normalizeEvaluationRouteLifecycle(routeArtifacts);
  const evaluationArtifacts = splitEvaluationApplicationCoreRuntime(evaluationRouteArtifacts);
  const evaluationSearchArtifacts = normalizeEvaluationSearchLifecycle(evaluationArtifacts);
  const settingsArtifacts = splitSettingsApplicationCoreRuntime(evaluationSearchArtifacts);
  const playerArtifacts = splitPlayerApplicationCoreRuntime(settingsArtifacts);
  const tableArtifacts = splitTableApplicationCoreRuntime(playerArtifacts);
  const walletArtifacts = splitWalletApplicationCoreRuntime(tableArtifacts);
  const watchlistArtifacts = splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);
  const clubStartupArtifacts = normalizeClubStartupLifecycle(watchlistArtifacts);
  const clubEntryArtifacts = normalizeClubEntryLifecycle(clubStartupArtifacts);
  const clubSortArtifacts = normalizeClubSortLifecycle(clubEntryArtifacts);
  const pageFilterResetArtifacts = normalizePageFilterResetBeforeRequest(clubSortArtifacts);
  const viewFilterStateArtifacts = normalizeViewFilterStateBeforeTransition(pageFilterResetArtifacts);
  // Club lifecycle normalization settles the Club-specific route shape first; Filters then owns count-only UI and close-state timing.
  const filterSummaryArtifacts = normalizeFilterSummaryLifecycle(viewFilterStateArtifacts);
  const tableLoadingArtifacts = normalizeTableLoadingRenderLifecycle(filterSummaryArtifacts);
  const homeSummaryArtifacts = normalizeHomeSummaryLifecycle(tableLoadingArtifacts);
  const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(homeSummaryArtifacts);
  const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(evaluationRecentArtifacts);
  return normalizeEvaluationSavedValuationCache(evaluationLoadArtifacts);
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
