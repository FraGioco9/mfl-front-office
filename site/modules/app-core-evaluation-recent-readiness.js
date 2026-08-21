// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const WALLET_PREFERENCES_START = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  const startupProgressionPermissionPromise = (`;

const WALLET_PREFERENCES_WITH_READINESS = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);
  const startupProgressionPermissionPromise = (`;

/**
 * Publish the already-existing startup wallet-preferences request as a readiness
 * dependency for route runtimes that require Supabase-backed preference state.
 * This does not create another request; consumers await the same startup promise.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeEvaluationRecentReadiness(artifacts) {
  const source = String(artifacts?.core || "");
  if (!source) throw new Error("Cannot normalize Evaluation recent-search readiness without shared core.");

  const core = replaceRequired(
    source,
    WALLET_PREFERENCES_START,
    WALLET_PREFERENCES_WITH_READINESS,
    "Supabase wallet-preference startup readiness is published for Evaluation recent searches",
  );

  return Object.freeze({
    ...artifacts,
    core,
  });
}
