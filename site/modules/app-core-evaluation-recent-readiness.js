// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const WALLET_PREFERENCES_START = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  const startupProgressionPermissionPromise = (`;

const WALLET_PREFERENCES_WITH_READINESS = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);
  const startupProgressionPermissionPromise = (`;

const EVALUATION_PLAIN_ROUTE_RESET = `    document.body.classList.add("evaluationPageLoading");
    if (options.plain) {`;

const EVALUATION_PLAIN_ROUTE_RESET_WITH_URL = `    document.body.classList.add("evaluationPageLoading");
    if (options.plain || isPlainEvaluationUrl()) {`;

const EVALUATION_RECENT_STATE_OWNER = `  function installEvaluationRecentStateOwnership() {`;
const EVALUATION_RECENT_STATE_OWNER_WITH_HYDRATION = `  let evaluationRecentStateHydrated = false;

  function installEvaluationRecentStateOwnership() {`;

const EVALUATION_RECENT_STATE_APPLY = `      state.recentEvaluationPlayerIds = normalizeIdList(incoming, 5);
      if (/^\\/evaluation\\/?$/i.test(window.location.pathname)) {`;
const EVALUATION_RECENT_STATE_APPLY_WITH_HYDRATION = `      state.recentEvaluationPlayerIds = normalizeIdList(incoming, 5);
      evaluationRecentStateHydrated = true;
      if (/^\\/evaluation\\/?$/i.test(window.location.pathname)) {`;

const CORE_CONTRACT_MARKER = `  window.__mflCoreContracts = Object.freeze({`;
const EVALUATION_RECENT_HYDRATION_CONTRACT = `  async function ensureEvaluationRecentStateHydrated() {
    const pendingStartup = window.__mflWalletPreferencesStartupPromise;
    if (pendingStartup && typeof pendingStartup.then === "function") {
      await Promise.resolve(pendingStartup).catch(() => undefined);
    }

    if (evaluationRecentStateHydrated) return true;
    if (!state.linkedWalletAddress
      || typeof hasWalletProof !== "function"
      || !hasWalletProof()
      || typeof loadWalletPreferences !== "function") {
      return false;
    }

    await loadWalletPreferences({ force: true });
    return evaluationRecentStateHydrated;
  }

${CORE_CONTRACT_MARKER}`;

const EVALUATION_RECENT_OWNER_TAIL = `      finishEvaluationReadiness = finishEvaluationReadinessWithRecents;
    }
    return true;
  }

  async function ensureEvaluationRecentStateHydrated() {`;
const EVALUATION_RECENT_OWNER_TAIL_WITH_READINESS = `      finishEvaluationReadiness = finishEvaluationReadinessWithRecents;
    }
    window.__mflWalletPreferencesStartupPromise = ensureEvaluationRecentStateHydrated();
    return true;
  }

  async function ensureEvaluationRecentStateHydrated() {`;

const EVALUATION_RECENT_STATE_CONTRACT_ENTRY = `    installEvaluationRecentStateOwnership,
  });`;
const EVALUATION_RECENT_STATE_CONTRACT_ENTRY_WITH_HYDRATION = `    installEvaluationRecentStateOwnership,
    ensureEvaluationRecentStateHydrated,
  });`;

/**
 * Publish the already-existing startup wallet-preferences request as a readiness
 * dependency for route runtimes that require Supabase-backed preference state.
 *
 * Evaluation recent-state ownership can be installed after the startup preference
 * request has already completed when the user first navigates into /evaluation
 * from another page. Track whether the Supabase-only restore owner has actually
 * received preference state. Route startup then keeps using the same published
 * readiness promise: it awaits the original startup request when that request is
 * still in flight, or performs one corrective fresh read only when startup finished
 * before Evaluation installed its Supabase-only owner. The existing Evaluation
 * search loader therefore cannot read the cleared recent state before hydration.
 *
 * Plain /evaluation entry also clears any stale in-memory selected/saved/shared
 * Evaluation state in the Evaluation render lifecycle before render. That keeps
 * an in-app return to /evaluation eligible for the Supabase-backed recent-five
 * lifecycle just like a direct load without changing pagePath routing semantics.
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
    "plain Evaluation render routes clear stale selection state before recent-search readiness",
  );
  core = replaceRequired(
    core,
    EVALUATION_RECENT_STATE_OWNER,
    EVALUATION_RECENT_STATE_OWNER_WITH_HYDRATION,
    "Evaluation Supabase recent-state owner tracks authoritative hydration",
  );
  core = replaceRequired(
    core,
    EVALUATION_RECENT_STATE_APPLY,
    EVALUATION_RECENT_STATE_APPLY_WITH_HYDRATION,
    "Evaluation Supabase recent-state restore records authoritative hydration",
  );
  core = replaceRequired(
    core,
    CORE_CONTRACT_MARKER,
    EVALUATION_RECENT_HYDRATION_CONTRACT,
    "Evaluation route can await authoritative Supabase recent-state hydration",
  );
  core = replaceRequired(
    core,
    EVALUATION_RECENT_OWNER_TAIL,
    EVALUATION_RECENT_OWNER_TAIL_WITH_READINESS,
    "late Evaluation ownership chains authoritative hydration into startup readiness",
  );
  core = replaceRequired(
    core,
    EVALUATION_RECENT_STATE_CONTRACT_ENTRY,
    EVALUATION_RECENT_STATE_CONTRACT_ENTRY_WITH_HYDRATION,
    "Evaluation recent-state hydration is exposed through the core contract",
  );

  return Object.freeze({
    ...artifacts,
    core,
  });
}
