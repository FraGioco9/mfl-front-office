// @ts-check
// Canonical app-core behavior is source-owned; this module composes the build-time route/action normalizers.

import { normalizeClubEntryLifecycle } from "./app-core-club-entry-lifecycle.js";
import { normalizeClubSortLifecycle } from "./app-core-club-sort-lifecycle.js";
import { normalizeClubStartupLifecycle } from "./app-core-club-startup-lifecycle.js";
import { splitEvaluationApplicationCoreRuntime } from "./app-core-evaluation-chunk.js";
import { normalizeHomeSummaryLifecycle } from "./app-core-home-summary-lifecycle.js";
import { splitPlayerApplicationCoreRuntime } from "./app-core-player-chunk.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { replaceRequired } from "./app-core-splitter-utils.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { splitWalletApplicationCoreRuntime } from "./app-core-wallet-chunk.js";
import { splitWatchlistRouteApplicationCoreRuntime } from "./app-core-watchlist-route-chunk.js";

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
  const evaluationArtifacts = splitEvaluationApplicationCoreRuntime(routeArtifacts);
  const settingsArtifacts = splitSettingsApplicationCoreRuntime(evaluationArtifacts);
  const playerArtifacts = splitPlayerApplicationCoreRuntime(settingsArtifacts);
  const tableArtifacts = splitTableApplicationCoreRuntime(playerArtifacts);
  const walletArtifacts = splitWalletApplicationCoreRuntime(tableArtifacts);
  const watchlistArtifacts = splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);
  const clubStartupArtifacts = normalizeClubStartupLifecycle(watchlistArtifacts);
  const clubEntryArtifacts = normalizeClubEntryLifecycle(clubStartupArtifacts);
  const clubSortArtifacts = normalizeClubSortLifecycle(clubEntryArtifacts);
  // Club lifecycle normalization owns the filter-free Club branch, so normalize the shared count after it settles.
  const filterSummaryArtifacts = normalizeFilterSummaryLifecycle(clubSortArtifacts);
  return normalizeHomeSummaryLifecycle(filterSummaryArtifacts);
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
