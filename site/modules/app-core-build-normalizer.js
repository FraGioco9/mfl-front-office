// @ts-check
// Canonical app-core behavior is normalized for route-safe contracts, then split into generated runtimes.

import { normalizeAgentPageTitleLoading } from "./app-core-agent-title-normalizer.js";
import { splitEvaluationApplicationCoreRuntime } from "./app-core-evaluation-chunk.js";
import { splitPlayerApplicationCoreRuntime } from "./app-core-player-chunk.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { splitWalletApplicationCoreRuntime } from "./app-core-wallet-chunk.js";
import { splitWatchlistRouteApplicationCoreRuntime } from "./app-core-watchlist-route-chunk.js";

export function normalizeBuiltApplicationCoreArtifacts(source) {
  const canonicalSource = String(source || "").replace(/\r\n?/g, "\n");
  if (!canonicalSource.trim()) throw new Error("Cannot build an empty application core.");

  const normalizedSource = normalizeAgentPageTitleLoading(canonicalSource);
  const routeArtifacts = splitApplicationCoreRuntime(normalizedSource);
  const evaluationArtifacts = splitEvaluationApplicationCoreRuntime(routeArtifacts);
  const settingsArtifacts = splitSettingsApplicationCoreRuntime(evaluationArtifacts);
  const playerArtifacts = splitPlayerApplicationCoreRuntime(settingsArtifacts);
  const tableArtifacts = splitTableApplicationCoreRuntime(playerArtifacts);
  const walletArtifacts = splitWalletApplicationCoreRuntime(tableArtifacts);
  return splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
