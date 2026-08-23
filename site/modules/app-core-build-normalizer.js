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
import { normalizeGlobalSearchOpenLifecycle } from "./app-core-global-search-lifecycle.js";
import { normalizeHomeSummaryLifecycle } from "./app-core-home-summary-lifecycle.js";
import { splitPlayerApplicationCoreRuntime } from "./app-core-player-chunk.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { replaceRequired } from "./app-core-splitter-utils.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { normalizeTableControlCellAlignment } from "./app-core-table-cell-alignment.js";
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

function normalizeTableRequestLoadingBoundary(artifacts) {
  const core = String(artifacts?.core || "");
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  const table = String(routeChunks.table || "");
  if (!core) throw new Error("Cannot normalize table loading request boundary without shared application core.");
  if (!table) throw new Error("Cannot normalize table loading request boundary without the Table route chunk.");

  let normalizedCore = replaceRequired(
    core,
    "  let requestPromise = force ? null : state.incrementalRequestPromises.get(cacheKey);",
    `  const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0;

  let requestPromise = force ? null : state.incrementalRequestPromises.get(cacheKey);`,
    "uncached table request loading boundary",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    `  let payload;
  try {
    payload = await requestPromise;
  } catch (error) {
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    throw error;
  }
  if (!payload || !incrementalRouteRequestIsCurrent(generation)) return null;
  applyIncrementalPayload(route, payload);
  state.incrementalLastKey = requestKey;
  state.incrementalLastLoadedAt = Date.now();
  return payload;`,
    `  let payload;
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
  }`,
    "table request loading boundary completion",
  );

  const normalizedTable = replaceRequired(
    table,
    "function tableRenderTableOwner() {\n",
    "function tableRenderTableOwner() {\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\n",
    "stale table render isolation during active request",
  );
  routeChunks.table = normalizedTable;

  return Object.freeze({
    ...artifacts,
    core: normalizedCore,
    routeChunks: Object.freeze(routeChunks),
  });
}

function normalizePagerQuickJumpLifecycle(artifacts) {
  const core = String(artifacts?.core || "");
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  const table = String(routeChunks.table || "");
  if (!core) throw new Error("Cannot normalize pager quick-jump behavior without shared application core.");
  if (!table) throw new Error("Cannot normalize pager quick-jump behavior without the Table route chunk.");

  const pagerRuntime = `const PAGER_CURRENT_PAGE_INPUT_ID = "pagerCurrentPageInput";
const PAGER_CURRENT_PAGE_TOTAL_ID = "pagerCurrentPageTotal";
const PAGER_CURRENT_PAGE_STYLE_HREF = "/pager-current-page.css";
let suppressAdjacentPagerClick = false;

function ensurePagerCurrentPageStyles() {
  if (document.querySelector('link[data-mfl-pager-current-page-style="true"]')) return;
  const link = document.createElement("link");
  const releaseVersion = String(window.__mflReleaseVersion || "").trim();
  link.rel = "stylesheet";
  link.href = releaseVersion
    ? PAGER_CURRENT_PAGE_STYLE_HREF + "?mfl_release=" + encodeURIComponent(releaseVersion)
    : PAGER_CURRENT_PAGE_STYLE_HREF;
  link.dataset.mflPagerCurrentPageStyle = "true";
  document.head.appendChild(link);
}

function pagerCurrentPageControl() {
  let input = document.getElementById(PAGER_CURRENT_PAGE_INPUT_ID);
  let total = document.getElementById(PAGER_CURRENT_PAGE_TOTAL_ID);
  if (input instanceof HTMLInputElement && total instanceof HTMLElement && pageText.contains(input) && pageText.contains(total)) {
    return { input, total };
  }

  input = document.createElement("input");
  input.id = PAGER_CURRENT_PAGE_INPUT_ID;
  input.className = "pagerCurrentPageInput";
  input.type = "text";
  input.inputMode = "numeric";
  input.pattern = "[0-9]*";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Current page");
  input.title = "Type a page number";

  total = document.createElement("span");
  total.id = PAGER_CURRENT_PAGE_TOTAL_ID;
  total.className = "pagerCurrentPageTotal";

  pageText.replaceChildren(document.createTextNode("Page "), input, document.createTextNode(" of "), total);
  return { input, total };
}

function syncPagerQuickJump(currentPage, totalPages) {
  ensurePagerCurrentPageStyles();
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

async function commitPagerQuickJump(input) {
  const total = Math.max(1, Number.parseInt(input.dataset.totalPages || "1", 10) || 1);
  const current = Math.min(total, Math.max(1, Number.parseInt(input.dataset.currentPage || String(state.page || 1), 10) || 1));
  const parsed = Number.parseInt(input.value, 10);
  const target = Number.isInteger(parsed) ? Math.min(total, Math.max(1, parsed)) : current;
  input.value = String(target);
  input.dataset.dirty = "false";
  input.setAttribute("aria-valuenow", String(target));
  if (target === current) return;

  if (state.incrementalMode) {
    await reloadIncrementalPage(target);
    return;
  }

  state.page = target;
  renderTable();
}

function installPagerQuickJumpControl() {
  const controls = pagerCurrentPageControl();
  if (controls.input.dataset.pagerQuickJumpBound === "true") return;
  controls.input.dataset.pagerQuickJumpBound = "true";

  controls.input.addEventListener("focus", () => {
    delete controls.input.dataset.cancelCommit;
    controls.input.select();
  });
  controls.input.addEventListener("input", () => {
    const digitsOnly = controls.input.value.replace(/\\D+/g, "");
    if (digitsOnly !== controls.input.value) controls.input.value = digitsOnly;
    controls.input.dataset.dirty = "true";
  });
  controls.input.addEventListener("blur", () => {
    if (controls.input.dataset.cancelCommit === "true") {
      delete controls.input.dataset.cancelCommit;
      controls.input.dataset.dirty = "false";
      controls.input.value = controls.input.dataset.currentPage || String(state.page || 1);
      return;
    }
    void commitPagerQuickJump(controls.input);
  });
  controls.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      controls.input.blur();
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    controls.input.dataset.cancelCommit = "true";
    controls.input.dataset.dirty = "false";
    controls.input.value = controls.input.dataset.currentPage || String(state.page || 1);
    controls.input.blur();
  });

  [prevButton, nextButton].forEach((button) => {
    button.addEventListener("pointerdown", () => {
      suppressAdjacentPagerClick = document.activeElement === controls.input && controls.input.dataset.dirty === "true";
    }, true);
    button.addEventListener("click", (event) => {
      if (!suppressAdjacentPagerClick) return;
      suppressAdjacentPagerClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });
}

ensurePagerCurrentPageStyles();
installPagerQuickJumpControl();
syncPagerQuickJump(1, 1);
`;

  const normalizedCore = replaceRequired(
    core,
    `watchlistButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleWatchlistDropdown();
});

pageSizeSelect.addEventListener("change", () => {`,
    `watchlistButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleWatchlistDropdown();
});

${pagerRuntime}
pageSizeSelect.addEventListener("change", () => {`,
    "canonical pager quick-jump control installation",
  );

  const normalizedTable = replaceRequired(
    table,
    '  pageText.textContent = `Page ${state.page} of ${totalPages}`;',
    "  syncPagerQuickJump(state.page, totalPages);",
    "table pager renders through the canonical editable current-page control",
  );
  routeChunks.table = normalizedTable;

  return Object.freeze({
    ...artifacts,
    core: normalizedCore,
    routeChunks: Object.freeze(routeChunks),
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
  const tableRequestLoadingArtifacts = normalizeTableRequestLoadingBoundary(viewFilterStateArtifacts);
  // Club lifecycle normalization settles the Club-specific route shape first; Filters then owns count-only UI and close-state timing.
  const filterSummaryArtifacts = normalizeFilterSummaryLifecycle(tableRequestLoadingArtifacts);
  const pagerQuickJumpArtifacts = normalizePagerQuickJumpLifecycle(filterSummaryArtifacts);
  const tableControlCellArtifacts = normalizeTableControlCellAlignment(pagerQuickJumpArtifacts);
  const homeSummaryArtifacts = normalizeHomeSummaryLifecycle(tableControlCellArtifacts);
  const globalSearchArtifacts = normalizeGlobalSearchOpenLifecycle(homeSummaryArtifacts);
  const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(globalSearchArtifacts);
  const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(evaluationRecentArtifacts);
  return normalizeEvaluationSavedValuationCache(evaluationLoadArtifacts);
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
