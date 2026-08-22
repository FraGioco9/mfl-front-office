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

invariant(
  appEntry.includes("__mflGlobalSearchRuntime?: { preload?: () => Promise<boolean>, flush?: () => boolean, focus?: () => void }")
    && appEntry.includes("void runtimeWindow.__mflGlobalSearchRuntime?.preload?.();")
    && appEntry.includes("await runtimeWindow.__mflGlobalSearchRuntime?.preload?.();")
    && appEntry.includes("function installCoreBridges() {")
    && appEntry.indexOf("void runtimeWindow.__mflGlobalSearchRuntime?.preload?.();")
      < appEntry.indexOf('document.documentElement.dataset.mflReady = "true";')
    && appEntry.lastIndexOf("await runtimeWindow.__mflGlobalSearchRuntime?.preload?.();")
      < appEntry.indexOf('document.documentElement.dataset.mflReady = "true";'),
  "Application startup must launch Global Search recent preloading as soon as the core bridge is installed and await the completed preload before the page is marked ready.",
);

invariant(
  runtime.includes("function recentIdentifiers(items = canonicalRecentItems) {")
    && runtime.includes('const parameters = new URLSearchParams({ mode: "search", type: "recent", v: VERSION });')
    && runtime.includes('parameters.set("playerIds", identifiers.playerIds.join(","));')
    && runtime.includes('parameters.set("walletAddresses", identifiers.walletAddresses.join(","));')
    && runtime.includes('parameters.set("clubIds", identifiers.clubIds.join(","));')
    && runtime.includes("canonicalRecentPayload = await fetchCanonicalRecentPayload(activeController.signal);")
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
  runtime.includes("function searchResultTarget(event) {")
    && runtime.includes("function onSearchResultClickCapture(event) {")
    && runtime.includes("if (!target || !recentLoadedForSession) return;\n    promoteCanonicalRecentResult(target);")
    && runtime.includes('document.addEventListener("click", onSearchResultClickCapture, true);')
    && runtime.includes('document.removeEventListener("click", onSearchResultClickCapture, true);')
    && runtime.includes("function onSearchResultClick(event) {")
    && runtime.includes("if (recentLoadedForSession) {\n      flushCanonicalRecentState();\n      return;\n    }")
    && runtime.includes("const pendingRecentLoad = recentLoadPromise;")
    && runtime.includes('const saveWalletPreferencesNow = windowFunction("saveWalletPreferencesNow");')
    && runtime.includes("if (hasWalletProof?.() && saveWalletPreferencesNow) void saveWalletPreferencesNow();"),
  "Global Search must promote the clicked result during capture, before the core click handler snapshots table state, so Supabase receives clicked plus the previous four instead of a one-result stale snapshot.",
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
    && walletPreferencesApi.includes("tableState: row.table_state")
    && walletPreferencesApi.includes("recentSearchItems: mergeRecentIds(incoming.recentSearchItems, current.recentSearchItems),")
    && walletPreferencesApi.includes("recentSearchPlayerIds: mergeRecentIds(incoming.recentSearchPlayerIds, current.recentSearchPlayerIds),")
    && walletPreferencesApi.includes("recentSearchAgentWallets: mergeRecentIds(incoming.recentSearchAgentWallets, current.recentSearchAgentWallets),")
    && core.includes("recentSearchItems: state.recentSearchItems")
    && core.includes("queueCloudTableStateSave(savedState);"),
  "Supabase persistence must merge the mixed Global Search history and agent history with the existing five so a partial or concurrent save cannot collapse recentSearchItems to only the newly clicked result.",
);

invariant(
  core.includes("async function openSearch() {")
    && core.includes("await ensureSearchIndexes();\n  renderSearchResultsNow();"),
  "Regression coverage must account for the core Global Search open lifecycle rendering again after indexes are ready.",
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

console.log("Global Search completes and prebuilds its Supabase recent five before page readiness, preserves the mixed five across partial/concurrent saves, promotes clicks before core persistence, and uses identical 66px boxes with 8px gaps for recent and typed results.");
