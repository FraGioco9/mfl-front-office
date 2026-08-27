// @ts-check
// Canonical app-core behavior is source-owned; this module composes the build-time route/action normalizers.

import { splitEvaluationApplicationCoreRuntime } from "./app-core-evaluation-chunk.js";
import { addActiveFilterControlState } from "./app-core-filter-control-state.js";
import { splitPlayerApplicationCoreRuntime } from "./app-core-player-chunk.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { addSettingsEmailResetRuntime } from "./app-core-settings-email-reset.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { splitWalletApplicationCoreRuntime } from "./app-core-wallet-chunk.js";
import { splitWatchlistRouteApplicationCoreRuntime } from "./app-core-watchlist-route-chunk.js";

export function normalizeBuiltApplicationCoreArtifacts(source) {
  const canonicalSource = String(source || "").replace(/\r\n?/g, "\n");
  if (!canonicalSource.trim()) throw new Error("Cannot build an empty application core.");

  const routeArtifacts = splitApplicationCoreRuntime(canonicalSource);
  const evaluationArtifacts = splitEvaluationApplicationCoreRuntime(routeArtifacts);
  const settingsArtifacts = splitSettingsApplicationCoreRuntime(evaluationArtifacts);
  const settingsEmailResetArtifacts = addSettingsEmailResetRuntime(settingsArtifacts);
  const playerArtifacts = splitPlayerApplicationCoreRuntime(settingsEmailResetArtifacts);
  const filterArtifacts = addActiveFilterControlState(playerArtifacts);
  const tableArtifacts = splitTableApplicationCoreRuntime(filterArtifacts);
  const walletArtifacts = splitWalletApplicationCoreRuntime(tableArtifacts);
  const watchlistArtifacts = splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);
  return watchlistArtifacts;
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
