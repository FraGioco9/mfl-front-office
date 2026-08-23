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
import { normalizeStatsNavigationLifecycle } from "./app-core-stats-navigation-lifecycle.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { replaceRequired } from "./app-core-splitter-utils.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { normalizeTableControlCellAlignment } from "./app-core-table-cell-alignment.js";
import { splitWalletApplicationCoreRuntime } from "./app-core-wallet-chunk.js";
import { splitWatchlistRouteApplicationCoreRuntime } from "./app-core-watchlist-route-chunk.js";

function normalizePagerCurrentPageLifecycle(artifacts) {
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  const table = String(routeChunks.table || "");
  if (!table) throw new Error("Cannot normalize editable pager behavior without the Table route chunk.");

  const pagerRuntime = `const PAGER_CURRENT_PAGE_INPUT_ID = "pagerCurrentPageInput";
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
  const parsed = /^-?\\d+$/.test(raw) ? Number.parseInt(raw, 10) : current;
  const target = Math.min(total, Math.max(1, parsed));

  input.value = String(target);
  input.dataset.dirty = "false";
  input.setAttribute("aria-valuenow", String(target));
  if (target === current) return;

  if (state.incrementalMode) {
    input.disabled = true;
    try {
      await reloadIncrementalPage(target);
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
    controls.input.select();
  });

  controls.input.addEventListener("input", () => {
    const raw = controls.input.value;
    const negative = raw.trimStart().startsWith("-");
    const digits = raw.replace(/\\D+/g, "");
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
`;

  let normalizedTable = replaceRequired(
    table,
    "function tableRenderTableOwner() {\n",
    `${pagerRuntime}\nfunction tableRenderTableOwner() {\n`,
    "Table route core owns the editable current-page control",
  );
  normalizedTable = replaceRequired(
    normalizedTable,
    '  pageText.textContent = `Page ${state.page} of ${totalPages}`;',
    "  syncPagerCurrentPage(state.page, totalPages);",
    "table pager renders through the editable current-page control",
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
  const statsNavigationArtifacts = Object.freeze({
    ...clubSortArtifacts,
    core: normalizeStatsNavigationLifecycle(String(clubSortArtifacts.core || "")),
  });
  const pagerCurrentPageArtifacts = normalizePagerCurrentPageLifecycle(statsNavigationArtifacts);
  const tableControlCellArtifacts = normalizeTableControlCellAlignment(pagerCurrentPageArtifacts);
  const homeSummaryArtifacts = normalizeHomeSummaryLifecycle(tableControlCellArtifacts);
  const globalSearchArtifacts = normalizeGlobalSearchOpenLifecycle(homeSummaryArtifacts);
  const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(globalSearchArtifacts);
  const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(evaluationRecentArtifacts);
  return normalizeEvaluationSavedValuationCache(evaluationLoadArtifacts);
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
