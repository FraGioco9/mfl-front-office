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
  runtime.includes("let recentLoadPromise = null;")
    && runtime.includes("let recentLoadedForOpen = false;")
    && runtime.includes("if (recentLoadedForOpen) {\n      renderCurrentResults();\n      return true;\n    }")
    && runtime.includes("if (recentLoadPromise) return recentLoadPromise;")
    && runtime.includes('const hadRenderedResults = Boolean(results?.querySelector(":scope > .searchResult"));')
    && runtime.includes('if (!hadRenderedResults) renderSearchMessage("Loading recent searches…");')
    && runtime.includes("recentLoadedForOpen = true;\n        renderCurrentResults();")
    && runtime.includes("if (hadRenderedResults) renderCurrentResults();\n          else renderSearchMessage(\"Could not load recent searches.\");")
    && runtime.includes("clearRecentRequest({ resetLoaded: true });"),
  "Empty Global Search must use one Supabase load per popup opening and preserve already-rendered recent results if a redundant refresh fails.",
);

invariant(
  runtime.includes("applySupabaseRecentState(data?.tableState);")
    && !runtime.includes('requestDatabaseSearch("", "all", { force: true })'),
  "Successful Supabase recent results must render directly without a second empty database search that can replace them with an error state.",
);

invariant(
  runtime.includes('const hidden = !input.value.trim();')
    && runtime.includes("button.hidden = hidden;")
    && runtime.includes('button.toggleAttribute("hidden", hidden);')
    && runtime.includes('document.addEventListener("click", onClearClick, true);')
    && runtime.includes('input.value = "";\n    clearGlobalRequest();\n    clearRecentRequest();\n    syncClearButton();')
    && controls.includes("#evaluationSearchInput:placeholder-shown + .evaluationSearchClearButton,\n#playerSearchInput:placeholder-shown + .playerSearchClearButton {")
    && controls.includes("visibility: hidden;\n  opacity: 0;\n  pointer-events: none;"),
  "Global Search clear control must be visually hidden whenever its input is empty and hide immediately when cleared.",
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

console.log("Global Search keeps one stable Supabase recent load per popup opening, caps typed results at 10, and only shows clear while typed.");
