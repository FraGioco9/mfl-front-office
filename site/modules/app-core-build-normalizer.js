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
import { splitPlayerApplicationCoreRuntime } from "./app-core-player-chunk.js";
import { normalizePlayerListingLifecycle } from "./app-core-player-listing-lifecycle.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { splitWalletApplicationCoreRuntime } from "./app-core-wallet-chunk.js";
import { splitWatchlistRouteApplicationCoreRuntime } from "./app-core-watchlist-route-chunk.js";

export function normalizeBuiltApplicationCoreArtifacts(source) {
  const canonicalSource = String(source || "").replace(/\r\n?/g, "\n");
  if (!canonicalSource.trim()) throw new Error("Cannot build an empty application core.");

  const routeArtifacts = splitApplicationCoreRuntime(canonicalSource);
  const evaluationRouteArtifacts = normalizeEvaluationRouteLifecycle(routeArtifacts);
  const evaluationArtifacts = splitEvaluationApplicationCoreRuntime(evaluationRouteArtifacts);
  const evaluationSearchArtifacts = normalizeEvaluationSearchLifecycle(evaluationArtifacts);
  const settingsArtifacts = splitSettingsApplicationCoreRuntime(evaluationSearchArtifacts);
  const playerArtifacts = splitPlayerApplicationCoreRuntime(settingsArtifacts);
  const playerListingArtifacts = normalizePlayerListingLifecycle(playerArtifacts);
  const tableArtifacts = splitTableApplicationCoreRuntime(playerListingArtifacts);
  const walletArtifacts = splitWalletApplicationCoreRuntime(tableArtifacts);
  const watchlistArtifacts = splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);
  const clubStartupArtifacts = normalizeClubStartupLifecycle(watchlistArtifacts);
  const clubEntryArtifacts = normalizeClubEntryLifecycle(clubStartupArtifacts);
  const clubSortArtifacts = normalizeClubSortLifecycle(clubEntryArtifacts);
  const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(clubSortArtifacts);
  const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(evaluationRecentArtifacts);
  return normalizeEvaluationSavedValuationCache(evaluationLoadArtifacts);
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
