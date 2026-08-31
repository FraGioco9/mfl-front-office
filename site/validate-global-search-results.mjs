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
    && runtime.includes("function stripGlobalRecentFields(savedState) {")
    && runtime.includes("delete sanitized.recentSearchItems;")
    && runtime.includes("delete sanitized.recentSearchPlayerIds;")
    && runtime.includes("delete sanitized.recentSearchAgentWallets;")
    && runtime.includes("function purgeLocalGlobalSearchHistory() {")
    && runtime.includes("GLOBAL_RECENT_STORAGE_KEYS.forEach((storageKey) => localStorage.removeItem(storageKey));")
    && runtime.includes("function installSupabaseOnlyRecentStorage() {")
    && runtime.includes("if (GLOBAL_RECENT_STORAGE_KEYS.has(String(storageKey || \"\"))) return [];")
    && runtime.includes("if (GLOBAL_RECENT_STORAGE_KEYS.has(String(storageKey || \"\"))) {")
    && runtime.includes("return originalSaveTableStateLocally.call(this, stripGlobalRecentFields(savedState));")
    && runtime.includes("installSupabaseOnlyRecentStorage();")
    && runtime.includes("restoreLocalRecentStorageOwners();"),
  "Global Search recents must be Supabase-only: browser-local Global Search keys and table-state fields must be purged and blocked from load/save fallbacks.",
);

invariant(
  walletPreferencesApi.includes("sanitizeGlobalRecentSearchItems(")
    && walletPreferencesApi.includes("recentSearchItems: sanitizeGlobalRecentSearchItems(tableState.recentSearchItems, 5),")
    && walletPreferencesApi.includes("recentSearchPlayerIds: undefined,")
    && walletPreferencesApi.includes("recentSearchAgentWallets: undefined,")
    && !walletPreferencesApi.includes("recentSearchPlayerIds: sanitizeIds(")
    && !walletPreferencesApi.includes("recentSearchAgentWallets: sanitizeIds("),
  "Wallet preferences must persist one canonical mixed recentSearchItems sequence and derive, not store, legacy player/agent arrays.",
);

invariant(
  dataViews.includes("recentSearchItems: Array.isArray(tableState?.recentSearchItems)")
    && dataViews.includes("recentSearchPlayerIds: recentSearchItems")
    && dataViews.includes("recentSearchAgentWallets: recentSearchItems")
    && dataViews.includes('filter((item) => item.startsWith("player:"))')
    && dataViews.includes('filter((item) => item.startsWith("agent:"))'),
  "Data-view wallet preferences must derive legacy recent player/agent arrays from the canonical mixed recentSearchItems order.",
);

invariant(
  runtime.includes("let canonicalRecentItems = [];")
    && runtime.includes("let canonicalRecentResults = new Map();")
    && runtime.includes("let canonicalRecentPayload = null;")
    && runtime.includes("function applyRecentItemsToCore(items = canonicalRecentItems) {")
    && runtime.includes("function captureCanonicalRecentResults() {")
    && runtime.includes("function renderCanonicalRecentResults() {")
    && runtime.includes("function publishCanonicalRecentPayload() {")
    && runtime.includes("function promoteCanonicalRecentResult(result) {")
    && runtime.includes("function applySupabaseRecentState(tableState) {")
    && runtime.includes("async function fetchCanonicalRecentPayload(signal) {")
    && runtime.includes("const identifiers = recentIdentifiers();")
    && runtime.includes('parameters.set("playerIds", identifiers.playerIds.join(","));')
    && runtime.includes('parameters.set("walletAddresses", identifiers.walletAddresses.join(","));')
    && runtime.includes('parameters.set("clubIds", identifiers.clubIds.join(","));')
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
    && core.includes("navigateFromSearch(() => openAgentPage(result.walletAddress, result.name));")
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
  runtime.includes("const promise = (async () => {")
    && runtime.includes("canonicalRecentPayload = await fetchCanonicalRecentPayload(signal);")
    && runtime.includes("if (canonicalRecentItems.length) publishCanonicalRecentPayload();")
    && runtime.includes("recentLoadPromise = promise;")
    && runtime.includes("return promise;")
    && runtime.includes("if (recentLoadPromise === promise) recentLoadPromise = null;"),
  "Concurrent Global Search recent restoration must share one in-flight promise and one request lifecycle.",
);

invariant(
  runtime.includes("const GLOBAL_SEARCH_RESULT_SIZE_PX = 66;")
    && runtime.includes("const GLOBAL_SEARCH_RESULT_GAP_PX = 8;")
    && runtime.includes("globalSearchResultHeight = GLOBAL_SEARCH_RESULT_SIZE_PX + \"px\";")
    && runtime.includes("globalSearchResultGap = GLOBAL_SEARCH_RESULT_GAP_PX + \"px\";")
    && styles.includes("height: var(--globalSearchResultHeight, 66px);")
    && styles.includes("min-height: var(--globalSearchResultHeight, 66px);")
    && styles.includes("max-height: var(--globalSearchResultHeight, 66px);")
    && styles.includes("gap: var(--globalSearchResultGap, 8px);")
    && controls.includes("height: var(--globalSearchResultHeight, 66px);")
    && controls.includes("min-height: var(--globalSearchResultHeight, 66px);")
    && controls.includes("max-height: var(--globalSearchResultHeight, 66px);"),
  "Recent and typed Global Search results must share one canonical 66px box height and 8px inter-result spacing.",
);

invariant(
  appEntry.includes("const globalSearchPreloadPromise = preloadGlobalSearch();")
    && appEntry.includes("const backgroundStartupTasks = [globalSearchPreloadPromise];")
    && appEntry.includes("await Promise.allSettled(backgroundStartupTasks);")
    && appEntry.indexOf("signalApplicationReady();") < appEntry.indexOf("await Promise.allSettled(backgroundStartupTasks);"),
  "Global Search must preload during startup without blocking visible-route readiness, while application-wide readiness still settles only after background startup tasks complete.",
);

console.log("Global Search starts preloading during startup, may finish after visible route readiness, settles before application-wide readiness, preserves canonical mixed recents across partial/concurrent saves, derives legacy response arrays without duplicate cloud storage, promotes clicks before core persistence without suppressing canonical result navigation, and uses identical 66px boxes with 8px gaps for recent and typed results.");
