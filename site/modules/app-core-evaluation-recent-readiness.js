// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const WALLET_PREFERENCES_START = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  const startupProgressionPermissionPromise = (`;

const WALLET_PREFERENCES_WITH_READINESS = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);
  const startupProgressionPermissionPromise = (`;

const EVALUATION_PLAIN_ROUTE_RESET = `    if (options.plain) {`;

const EVALUATION_PLAIN_ROUTE_RESET_WITH_URL = `    if (options.plain || isPlainEvaluationUrl()) {`;

/**
 * Publish the already-existing startup wallet-preferences request as a readiness
 * dependency for route runtimes that require Supabase-backed preference state.
 * This does not create another request; consumers await the same startup promise.
 *
 * Plain /evaluation entry also clears any stale in-memory selected/saved/shared
 * Evaluation state before render. That keeps an in-app return to /evaluation
 * eligible for the Supabase-backed recent-five lifecycle just like a direct load.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeEvaluationRecentReadiness(artifacts) {
  const source = String(artifacts?.core || "");
  if (!source) throw new Error("Cannot normalize Evaluation recent-search readiness without shared core.");

  let core = replaceRequired(
    source,
    WALLET_PREFERENCES_START,
    WALLET_PREFERENCES_WITH_READINESS,
    "Supabase wallet-preference startup readiness is published for Evaluation recent searches",
  );
  core = replaceRequired(
    core,
    EVALUATION_PLAIN_ROUTE_RESET,
    EVALUATION_PLAIN_ROUTE_RESET_WITH_URL,
    "plain Evaluation routes clear stale selection state before recent-search readiness",
  );

  return Object.freeze({
    ...artifacts,
    core,
  });
}
