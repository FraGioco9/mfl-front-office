// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const WALLET_PREFERENCES_START = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  const startupProgressionPermissionPromise = (`;

const WALLET_PREFERENCES_WITH_READINESS = `  const startupWalletPreferencesPromise = loadWalletPreferences();
  window.__mflWalletPreferencesStartupPromise = Promise.resolve(startupWalletPreferencesPromise);
  const startupProgressionPermissionPromise = (`;

const SET_PAGE_MARKER = `async function setPage(pageName, updateHash = true, options = {}) {`;
const SET_PAGE_WITH_EVALUATION_CACHE = `let evaluationPageCacheReady = false;

function preparePlainEvaluationReentry() {
  state.evaluationShareId = "";
  state.evaluationSavedId = "";
  state.evaluationPlayerId = null;
  state.evaluationOverallRows = {};
  state.evaluationSummaryPositions = {};
  evaluationSearchInput.value = "";
  renderEmptyEvaluationSelection(false, true);
}

async function setPage(pageName, updateHash = true, options = {}) {
  const plainEvaluationEntry = pageName === "evaluation" && (options.plain || isPlainEvaluationUrl());
  if (plainEvaluationEntry) preparePlainEvaluationReentry();`;

const EVALUATION_EMPTY_SELECTION_START = `function renderEmptyEvaluationSelection(showRecentResults = true) {
  const evaluationRouteParams = new URLSearchParams(window.location.search);
  const pendingEvaluationRoute = window.location.pathname === "/evaluation" && Boolean(`;
const EVALUATION_EMPTY_SELECTION_WITH_FORCE_PLAIN = `function renderEmptyEvaluationSelection(showRecentResults = true, forcePlain = false) {
  const evaluationRouteParams = new URLSearchParams(window.location.search);
  const pendingEvaluationRoute = !forcePlain && window.location.pathname === "/evaluation" && Boolean(`;

const EVALUATION_ROUTE_LOADING_START = `  if (evaluationPageActive) {
    const evaluationBusyToken = window.__mflInteractionBusy?.begin?.("evaluation-loading");
    document.documentElement.classList.remove("mflEvaluationReady");
    document.body.classList.add("evaluationPageLoading");
    if (options.plain) {
      state.evaluationShareId = "";
      state.evaluationSavedId = "";
      state.evaluationPlayerId = null;
      state.evaluationOverallRows = {};
      state.evaluationSummaryPositions = {};
      evaluationSearchInput.value = "";
    }
    try {
      await renderEvaluationPage();
      await finishEvaluationReadiness();`;
const EVALUATION_ROUTE_LOADING_WITH_CACHE = `  if (evaluationPageActive) {
    const plainEvaluationRoute = options.plain || isPlainEvaluationUrl();
    const cachedEvaluationReentry = plainEvaluationRoute
      && options.reuseCachedRoute === true
      && evaluationPageCacheReady;
    const evaluationBusyToken = cachedEvaluationReentry
      ? ""
      : window.__mflInteractionBusy?.begin?.("evaluation-loading");
    if (!cachedEvaluationReentry) {
      document.documentElement.classList.remove("mflEvaluationReady");
      document.body.classList.add("evaluationPageLoading");
    }
    try {
      await renderEvaluationPage();
      if (!cachedEvaluationReentry) {
        await finishEvaluationReadiness();
      }`;

const EVALUATION_READY_MARKER = `      document.documentElement.classList.add("mflEvaluationReady");
      window.dispatchEvent(new CustomEvent("mfl:evaluation-ready"));`;
const EVALUATION_READY_WITH_CACHE = `      evaluationPageCacheReady = true;
      document.documentElement.classList.add("mflEvaluationReady");
      window.dispatchEvent(new CustomEvent("mfl:evaluation-ready"));`;

const EVALUATION_NAVIGATION_HANDLER = `navButtons.forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    const pageName = button.dataset.page;
    const options = tablePages.has(pageName)
      ? { view: preferredViewForPage(pageName) }
      : pageName === "evaluation"
        ? { plain: true }
        : {};
    const target = pagePath(pageName, options);
    if (button.classList.contains("active") && target === \`\${location.pathname}\${location.search}\`) return;
    await setPage(pageName, true, options);
  });
});`;
const EVALUATION_NAVIGATION_HANDLER_WITH_CACHE = `const setPageWithoutRouteLoading = setPage;

navButtons.forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    const pageName = button.dataset.page;
    const reuseCachedEvaluationRoute = pageName === "evaluation" && evaluationPageCacheReady;
    const options = tablePages.has(pageName)
      ? { view: preferredViewForPage(pageName) }
      : pageName === "evaluation"
        ? { plain: true, reuseCachedRoute: reuseCachedEvaluationRoute }
        : {};
    const target = pagePath(pageName, options);
    if (button.classList.contains("active") && target === \`\${location.pathname}\${location.search}\`) return;
    if (pageName === "evaluation") preparePlainEvaluationReentry();
    if (reuseCachedEvaluationRoute) {
      await setPageWithoutRouteLoading(pageName, true, options);
      return;
    }
    await setPage(pageName, true, options);
  });
});`;

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
 * Once Evaluation has completed one full readiness cycle in this SPA session,
 * returning to plain /evaluation reuses that in-memory route/search state. The
 * cached path clears player-specific chrome synchronously before the destination
 * can paint, bypasses the global setPage loading wrapper, and skips the expensive
 * readiness cycle while the existing Evaluation search runtime republishes its
 * cached recent-player payload.
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
    SET_PAGE_MARKER,
    SET_PAGE_WITH_EVALUATION_CACHE,
    "Evaluation route readiness is retained for cached in-session re-entry",
  );
  core = replaceRequired(
    core,
    EVALUATION_EMPTY_SELECTION_START,
    EVALUATION_EMPTY_SELECTION_WITH_FORCE_PLAIN,
    "plain Evaluation first paint can ignore stale selected-route URL chrome",
  );
  core = replaceRequired(
    core,
    EVALUATION_ROUTE_LOADING_START,
    EVALUATION_ROUTE_LOADING_WITH_CACHE,
    "cached plain Evaluation re-entry bypasses repeated readiness loading",
  );
  core = replaceRequired(
    core,
    EVALUATION_READY_MARKER,
    EVALUATION_READY_WITH_CACHE,
    "successful Evaluation readiness marks the in-session route cache reusable",
  );
  core = replaceRequired(
    core,
    EVALUATION_NAVIGATION_HANDLER,
    EVALUATION_NAVIGATION_HANDLER_WITH_CACHE,
    "Evaluation sidebar re-entry uses the cached unwrapped setPage owner",
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