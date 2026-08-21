// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const WALLET_PREFERENCES_START = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  const startupProgressionPermissionPromise = (`;

const WALLET_PREFERENCES_WITH_READINESS = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);
  const startupProgressionPermissionPromise = (`;

const PAGE_ROUTE_ACTIVATION = `  document.body.dataset.page = pageName;
  updatePageUrl(pageName, { ...options, updateUrl: updateHash && !options.replaceUrl });`;

const PAGE_ROUTE_ACTIVATION_WITH_EVALUATION_RECENTS = `  document.body.dataset.page = pageName;
  updatePageUrl(pageName, { ...options, updateUrl: updateHash && !options.replaceUrl });
  if (pageName === "evaluation") window.dispatchEvent(new CustomEvent("mfl:evaluation-route-active"));`;

/**
 * Publish the already-existing startup wallet-preferences request as a readiness
 * dependency for route runtimes that require Supabase-backed preference state.
 * This does not create another request; consumers await the same startup promise.
 *
 * Evaluation route activation is also published explicitly from setPage after
 * the route/body state is committed. This lets the Evaluation search runtime
 * restore Supabase recents on in-app navigation without observing DOM changes.
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
    PAGE_ROUTE_ACTIVATION,
    PAGE_ROUTE_ACTIVATION_WITH_EVALUATION_RECENTS,
    "Evaluation route activation explicitly restores Supabase recent searches",
  );

  return Object.freeze({
    ...artifacts,
    core,
  });
}
