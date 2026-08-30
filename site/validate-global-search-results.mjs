import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [runtime, styles, controls, core, appEntry, walletPreferencesApi, dataViews] = await Promise.all([
  read("./global-search-runtime.js"),
  read("./styles-base.css"),
  read("./controls.css"),
  read("./modules/app-core.js"),
  read("./modules/app-entry.js"),
  read("./api/wallet-preferences.js"),
  read("./api/_data-views.js"),
]);

for (const required of [
  "const MAX_GLOBAL_SEARCH_RESULTS = 10;",
  "const MAX_RECENT_GLOBAL_SEARCH_RESULTS = 5;",
  "function normalizeSearchResults() {",
  "const hasQuery = Boolean(input.value.trim());",
  "const maxResults = hasQuery ? MAX_GLOBAL_SEARCH_RESULTS : MAX_RECENT_GLOBAL_SEARCH_RESULTS;",
  'results.querySelectorAll(":scope > .searchResult")',
  "directResults.slice(maxResults).forEach((result) => result.remove());",
  'results.classList.remove("filledSearchResults");',
  "function normalizedSupabaseRecentItems(tableState) {",
  'windowFunction("hasWalletProof")',
  'windowFunction("walletProofHeaders")',
  'fetch("/api/wallet-preferences", {',
  "applySupabaseRecentState(data?.tableState);",
  "preload: preloadRecentResults,",
  "recent: restoreSupabaseRecentResults,",
]) {
  invariant(runtime.includes(required), `Global Search result ownership is missing ${required}`);
}

invariant(
  runtime.includes('const TABLE_STATE_STORAGE_KEY = "mfl-table-filters-v1";')
    && runtime.includes("const GLOBAL_RECENT_STORAGE_KEYS = new Set([")
    && runtime.includes('"mfl-recent-player-searches-v1"')
    && runtime.includes('"mfl-recent-agent-searches-v1"')
    && runtime.includes('"mfl-recent-searches-v1"')
    && runtime.includes('"mfl-recent-search-clubs"')
    && runtime.includes("delete sanitized.recentSearchItems;")
    && runtime.includes("delete sanitized.recentSearchPlayerIds;")
    && runtime.includes("delete sanitized.recentSearchAgentWallets;")
    && runtime.includes('Reflect.set(window, "loadRecentIdsFromStorage", function loadNonGlobalRecentIds(storageKey) {')
    && runtime.includes('Reflect.set(window, "saveRecentIdsToStorage", function saveNonGlobalRecentIds(storageKey) {')
    && runtime.includes('Reflect.set(window, "saveTableStateLocally", function saveTableStateWithoutGlobalRecents(savedState) {')
    && runtime.includes("GLOBAL_RECENT_STORAGE_KEYS.forEach((storageKey) => localStorage.removeItem(storageKey));")
    && !runtime.includes("RECENT_MIXED_CACHE_KEY")
    && !runtime.includes("RECENT_PLAYER_CACHE_KEY")
    && !runtime.includes("RECENT_AGENT_CACHE_KEY"),
  "Global Search history must never use browser recent-history storage, including the legacy club-only key.",
);

const restoreRecentSection = runtime.slice(
  runtime.indexOf("async function restoreSupabaseRecentResults()"),
  runtime.indexOf("async function renderEmptySearchResults()"),
);
const modalOpenSection = runtime.slice(
  runtime.indexOf("function observeSearchModal()"),
  runtime.indexOf("function onReady()"),
);

invariant(
  runtime.includes("let recentLoadPromise = null;")
    && runtime.includes("let recentLoadedForSession = false;")
    && runtime.includes("let recentLoadFailed = false;")
    && runtime.includes("let canonicalRecentItems = [];")
    && runtime.includes("let canonicalRecentResults = new Map();")
    && runtime.includes("let canonicalRecentPayload = null;")
    && runtime.includes("async function hydrateSupabaseRecentResults()")
    && runtime.includes("function preloadRecentResults() {")
    && runtime.includes("return hydrateSupabaseRecentResults();")
    && runtime.includes("if (recentLoadedForSession) return true;")
    && runtime.includes("if (recentLoadPromise) return recentLoadPromise;")
    && runtime.includes("recentLoadedForSession = true;")
    && runtime.includes("async function restoreSupabaseRecentResults()")
    && runtime.includes("const pendingRecentLoad = recentLoadPromise;")
    && runtime.includes("if (!recentLoadedForSession && pendingRecentLoad) await pendingRecentLoad;")
    && !restoreRecentSection.includes("hydrateSupabaseRecentResults(")
    && !modalOpenSection.includes("hydrateSupabaseRecentResults(")
    && !runtime.includes("recentLoadedForOpen")
    && !runtime.includes("options.force")
    && !runtime.includes("renderEmptySearchResults({ force: true })"),
  "Global Search must preload its Supabase recent state during page startup; opening the popup may only consume an existing preload and must never initiate the recent-history fetch.",
);

const routeReadyIndex = appEntry.indexOf('window.dispatchEvent(new CustomEvent("mfl:route-ready", { detail: release }));');
const backgroundPreloadIndex = appEntry.indexOf("const globalSearchPreloadPromise = runtimeWindow.__mflGlobalSearchRuntime?.preload?.();");
const appReadyIndex = appEntry.indexOf('document.documentElement.dataset.mflReady = "true";');
invariant(
  appEntry.includes("__mflGlobalSearchRuntime?: { preload?: () => Promise<boolean>, flush?: () => boolean, focus?: () => void }")
    && appEntry.includes("void runtimeWindow.__mflGlobalSearchRuntime?.preload?.();")
    && appEntry.includes("initialGlobalSearchWarmupPromise")
    && appEntry.includes("function installCoreBridges() {")
    && appEntry.indexOf("void runtimeWindow.__mflGlobalSearchRuntime?.preload?.();") < routeReadyIndex
    && routeReadyIndex >= 0
    && backgroundPreloadIndex > routeReadyIndex
    && appEntry.includes("await Promise.allSettled([\n    initialGlobalSearchWarmupPromise,\n    globalSearchPreloadPromise,\n  ]);")
    && appReadyIndex > backgroundPreloadIndex,
  "Application startup must launch Global Search recent preloading early, release the visible route independently, and still settle Global Search warm-up before application-wide readiness.",
);

invariant(
  runtime.includes("function recentIdentifiers(items = canonicalRecentItems) {")
    && runtime.includes('const parameters = new URLSearchParams({ mode: "search", type: "recent", v: VERSION });')
    && runtime.includes('parameters.set("playerIds", identifiers.playerIds.join(","));')
    && runtime.includes('parameters.set("walletAddresses", identifiers.walletAddresses.join(","));')
    && runtime.includes('parameters.set("clubIds", identifiers.clubIds.join(","));')
    && runtime.includes("canonicalRecentPayload = await fetchCanonicalRecentPayload(activeController.signal)")
    && runtime.includes("recentLoadedForSession = true;\n        recentLoadFailed = false;\n        publishCanonicalRecentPayload();")
    && runtime.includes("function publishCanonicalRecentPayload() {")
    && runtime.includes('applySearchPayload(canonicalRecentPayload, "all");')
    && dataViews.includes('if (type === "recent") return recentSearchData(request);')
    && dataViews.includes("const playerIds = integerIds(request.query?.playerIds, 50);")
    && dataViews.includes("const walletAddresses = csvValues(request.query?.walletAddresses, 50)")
    && dataViews.includes("const clubIds = csvValues(request.query?.clubIds, 50);"),
  "Initial Global Search recent hydration must resolve every Supabase recent entity and publish the complete canonical payload into the hidden search state before first open.",
);

invariant(
  runtime.includes("function captureCanonicalRecentResults() {")
    && runtime.includes("function renderCanonicalRecentResults() {")
    && runtime.includes("function promoteCanonicalRecentResult(result) {")
    && runtime.includes("canonicalRecentItems = [\n      key,\n      ...canonicalRecentItems.filter((item) => item !== key),\n    ].slice(0, MAX_RECENT_GLOBAL_SEARCH_RESULTS);")
    && runtime.includes("canonicalRecentResults.set(key, result);")
    && runtime.includes("applyRecentItemsToCore();")
    && runtime.includes("results.replaceChildren(...ordered);")
    && runtime.includes("captureCanonicalRecentResults();\n    void searchDatabase(query);")
    && runtime.includes("if (renderCanonicalRecentResults()) return true;")
    && runtime.includes("if (publishCanonicalRecentPayload()) return true;"),
  "Typed Global Search must preserve a separate canonical five-result payload so replacing typed indexes cannot collapse the next empty state or initial render.",
);

invariant(
  core.includes('function applyDatabaseSearchPayload(payload, type = "all")')
    && core.includes("state.searchIndex = playerEntries;")
    && core.includes("state.agentSearchIndex = Array.isArray(agents?.rows)"),
  "Regression coverage must account for typed database searches replacing the live player and agent indexes that recent rendering previously depended on.",
);

invariant(
  core.includes('if (!results.length) {\n    if (query) return;')
    && !core.includes('query ? "No players, clubs, or agents found."')
    && runtime.includes('function renderSettledTypedSearchEmptyState(normalizedQuery) {')
    && runtime.includes('if (results.querySelector(":scope > .searchResult")) return false;')
    && runtime.includes('renderSearchMessage("No players, clubs, or agents found.");')
    && runtime.includes('finishSearching(normalizedQuery);\n    renderSettledTypedSearchEmptyState(normalizedQuery);'),
  "Only the authoritative request runtime may render the typed Global Search empty state, and only after the current query settles with zero final result cards.",
);

const searchResultCaptureSection = runtime.slice(
  runtime.indexOf("function onSearchResultClickCapture(event)"),
  runtime.indexOf("function onSearchResultClick(event)"),
);
invariant(
  runtime.includes("function searchResultTarget(event) {")
    && searchResultCaptureSection.includes("if (!target || !recentLoadedForSession) return;\n    promoteCanonicalRecentResult(target);")
    && !searchResultCaptureSection.includes("preventDefault(")
    && !searchResultCaptureSection.includes("stopPropagation(")
    && !searchResultCaptureSection.includes("stopImmediatePropagation(")
    && !searchResultCaptureSection.includes("navigateToAgentSearchResult")
    && core.includes("rememberAgentSearchResult(result.walletAddress);")
    && core.includes("navigateFromSearch(() => openAgentPage(result.walletAddress));")
    && runtime.includes('document.addEventListener("click", onSearchResultClickCapture, true);')
    && runtime.includes('document.removeEventListener("click", onSearchResultClickCapture, true);')
    && runtime.includes("function onSearchResultClick(event) {")
    && runtime.includes("if (recentLoadedForSession) {\n      flushCanonicalRecentState();\n      return;\n    }")
    && runtime.includes("const pendingRecentLoad = recentLoadPromise;")
    && runtime.includes('const saveWalletPreferencesNow = windowFunction("saveWalletPreferencesNow");')
    && runtime.includes("if (hasWalletProof?.() && saveWalletPreferencesNow) void saveWalletPreferencesNow();"),
  "Global Search capture may promote recents but must never suppress or replace the canonical Player, Club, or Agent result click navigation.",
);

invariant(
  runtime.includes("applySupabaseRecentState(data?.tableState);")
    && !runtime.includes('requestDatabaseSearch("", "all", { force: true })')
    && !runtime.includes("if (hadRenderedResults) renderCurrentResults();"),
  "Successful Supabase recent results must render directly without a second empty database search or a stale local fallback.",
);

invariant(
  runtime.includes('renderSearchMessage("Opt in to load recent searches.");')
    && !runtime.includes("if (hasWalletProof?.()) return restoreSupabaseRecentResults();\n\n    renderCurrentResults();"),
  "Users without wallet proof must not receive a browser-stored Global Search history fallback.",
);

invariant(
  runtime.includes('const hidden = !input.value.trim();')
    && runtime.includes("button.hidden = hidden;")
    && runtime.includes('button.toggleAttribute("hidden", hidden);')
    && runtime.includes('document.addEventListener("click", onClearClick, true);')
    && runtime.includes('input.value = "";\n    clearGlobalRequest();\n    syncClearButton();')
    && controls.includes("#evaluationSearchInput:placeholder-shown + .evaluationSearchClearButton,\n#playerSearchInput:placeholder-shown + .playerSearchClearButton {")
    && controls.includes("visibility: hidden;\n  opacity: 0;\n  pointer-events: none;"),
  "Global Search clear control must be visually hidden whenever its input is empty and restore canonical recents without invalidating session hydration.",
);

invariant(
  walletPreferencesApi.includes("wallet_preferences?select=watchlists,player_notes,table_state,evaluation_settings,settings")
    && walletPreferencesApi.includes("tableStateForClient(row.table_state)")
    && walletPreferencesApi.includes("recentSearchItems: mergeRecentIds(incoming.recentSearchItems, current.recentSearchItems),")
    && walletPreferencesApi.includes("return normalizeCloudTableState({")
    && !walletPreferencesApi.includes("recentSearchPlayerIds: mergeRecentIds(incoming.recentSearchPlayerIds, current.recentSearchPlayerIds),")
    && !walletPreferencesApi.includes("recentSearchAgentWallets: mergeRecentIds(incoming.recentSearchAgentWallets, current.recentSearchAgentWallets),")
    && core.includes("recentSearchItems: state.recentSearchItems")
    && core.includes("queueCloudTableStateSave(savedState);"),
  "Supabase persistence must merge the canonical mixed Global Search history with the existing five while avoiding independently stored legacy player/agent arrays.",
);

invariant(
  walletPreferencesApi.includes("function recentSearchItemsFromLegacy(tableState) {")
    && walletPreferencesApi.includes("function normalizeCloudTableState(tableState) {")
    && walletPreferencesApi.includes("mergeRecentIds(source.recentSearchItems, recentSearchItemsFromLegacy(source))")
    && walletPreferencesApi.includes("function tableStateForClient(tableState) {")
    && walletPreferencesApi.includes("...legacyRecentSearchStateFromItems(canonical.recentSearchItems)")
    && walletPreferencesApi.includes("? tableStateForClient(row.table_state) : null"),
  "Wallet preference reads must fold legacy player/agent histories into canonical mixed recents and derive legacy response arrays without storing duplicates.",
);

invariant(
  core.includes("async function openSearch() {")
    && core.includes("const renderAuthoritativeRecentSearches = async () => {")
    && core.includes("const renderRecent = window.__mflGlobalSearchRuntime?.recent;")
    && core.includes("await ensureSearchIndexes();\n  if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();"),
  "Canonical Global Search open lifecycle must restore authoritative recents again after indexes are ready, with the live renderer only as fallback.",
);

invariant(
  core.includes("const MAX_SEARCH_RESULTS = 5;")
    && core.includes("state.recentSearchItems.slice(0, MAX_SEARCH_RESULTS).forEach((key) => {")
    && core.includes("playerSearchResults.replaceChildren(...ordered.slice(0, MAX_SEARCH_RESULTS));"),
  "Empty Global Search must render only the five most recent mixed player, club, or agent searches.",
);

invariant(
  styles.includes(".searchResults {\n  display: grid;\n  gap: 8px;")
    && styles.includes("grid-auto-rows: 66px;")
    && styles.includes("overflow: auto;")
    && runtime.includes('results.classList.remove("filledSearchResults");')
    && !runtime.includes('results.classList.toggle("filledSearchResults", !hasQuery && directResults.length > 0);')
    && !runtime.includes('results.classList.toggle("filledSearchResults", ordered.length > 0);'),
  "Recent and typed Global Search results must both use the same base 66px result boxes and 8px grid gap rather than switching to a separate filled-results sizing mode.",
);

invariant(
  styles.includes(".searchDialog {\n  display: flex;\n  flex-direction: column;\n  width: min(960px, calc(100vw - 32px));\n  height: 505px;")
    && styles.includes(".searchBody {\n  display: grid;\n  gap: 12px;\n  padding: 16px 18px 12px;"),
  "Global Search popup must preserve the existing dialog geometry while both recent and typed results share one box layout.",
);

invariant(
  !runtime.includes('document.createElement("style")')
    && !runtime.includes("!important")
    && !controls.includes("!important"),
  "Global Search behavior must not be implemented through runtime CSS or priority overrides.",
);

console.log("Global Search starts preloading during startup, may finish after visible route readiness, settles before application-wide readiness, preserves canonical mixed recents across partial/concurrent saves, derives legacy response arrays without duplicate cloud storage, promotes clicks before core persistence without suppressing canonical result navigation, and uses identical 66px boxes with 8px gaps for recent and typed results.");