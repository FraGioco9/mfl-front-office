import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [runtime, styles, controls, core, walletPreferencesApi] = await Promise.all([
  read("./global-search-runtime.js"),
  read("./styles-base.css"),
  read("./controls.css"),
  read("./modules/app-core.js"),
  read("./api/wallet-preferences.js"),
]);

for (const required of [
  "const MAX_GLOBAL_SEARCH_RESULTS = 10;",
  "const MAX_RECENT_GLOBAL_SEARCH_RESULTS = 5;",
  "function normalizeSearchResults() {",
  "const hasQuery = Boolean(input.value.trim());",
  "const maxResults = hasQuery ? MAX_GLOBAL_SEARCH_RESULTS : MAX_RECENT_GLOBAL_SEARCH_RESULTS;",
  'results.querySelectorAll(":scope > .searchResult")',
  "directResults.slice(maxResults).forEach((result) => result.remove());",
  'results.classList.toggle("filledSearchResults", !hasQuery && directResults.length > 0);',
  "function normalizedSupabaseRecentItems(tableState) {",
  'windowFunction("hasWalletProof")',
  'windowFunction("walletProofHeaders")',
  'fetch("/api/wallet-preferences", {',
  "applySupabaseRecentState(data?.tableState);",
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

invariant(
  runtime.includes("let recentLoadPromise = null;")
    && runtime.includes("let recentLoadedForSession = false;")
    && runtime.includes("let canonicalRecentItems = [];")
    && runtime.includes("let canonicalRecentResults = new Map();")
    && runtime.includes("async function hydrateSupabaseRecentResults()")
    && runtime.includes("if (recentLoadedForSession) return true;")
    && runtime.includes("if (recentLoadPromise) return recentLoadPromise;")
    && runtime.includes("recentLoadedForSession = true;")
    && runtime.includes("async function restoreSupabaseRecentResults()")
    && runtime.includes("if (!recentLoadedForSession) await hydrateSupabaseRecentResults();")
    && !runtime.includes("recentLoadedForOpen")
    && !runtime.includes("options.force")
    && !runtime.includes("renderEmptySearchResults({ force: true })"),
  "Global Search must hydrate its Supabase recent state once per session and reuse it like Evaluation.",
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
    && runtime.includes("if (renderCanonicalRecentResults()) return true;"),
  "Typed Global Search must preserve a separate canonical five-result payload so replacing typed indexes cannot collapse the next empty state to one card.",
);

invariant(
  core.includes("state.searchIndex = playerEntries;")
    && core.includes("state.agentSearchIndex = Array.isArray(agents?.rows)")
    && core.includes("state.clubSearchIndex = Array.isArray(payload?.clubs)"),
  "Regression coverage must account for typed database searches replacing the live player, agent, and club indexes.",
);

invariant(
  runtime.includes('event.target.closest("#playerSearchResults > .searchResult")')
    && runtime.includes("promoteCanonicalRecentResult(target);")
    && runtime.includes("flushCanonicalRecentState();")
    && runtime.includes('const saveWalletPreferencesNow = windowFunction("saveWalletPreferencesNow");')
    && runtime.includes("if (hasWalletProof?.() && saveWalletPreferencesNow) void saveWalletPreferencesNow();"),
  "Clicking a Global Search result must promote it into the canonical five before flushing the complete updated history to Supabase.",
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
    && core.includes("recentSearchItems: state.recentSearchItems")
    && core.includes("queueCloudTableStateSave(savedState);"),
  "Global Search recent history must persist through the Supabase-backed wallet preferences table state.",
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
    && styles.includes("overflow: auto;"),
  "Global Search must retain the existing fixed 66px result boxes, 8px spacing, and scrolling container.",
);

invariant(
  styles.includes(".searchDialog {\n  display: flex;\n  flex-direction: column;\n  width: min(960px, calc(100vw - 32px));\n  height: 505px;")
    && styles.includes(".searchBody {\n  display: grid;\n  gap: 12px;\n  padding: 16px 18px 12px;"),
  "Global Search popup must preserve five full fixed-height result boxes with matching 12px spacing above and below the result stack.",
);

invariant(
  !runtime.includes('document.createElement("style")')
    && !runtime.includes("!important")
    && !controls.includes("!important"),
  "Global Search behavior must not be implemented through runtime CSS or priority overrides.",
);

console.log("Global Search keeps a canonical Supabase-derived five-result payload independent of typed indexes, promotes clicks without collapsing history, and restores the five instantly when empty.");