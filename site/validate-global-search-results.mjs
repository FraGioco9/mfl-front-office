import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [runtime, styles, core, walletPreferencesApi] = await Promise.all([
  read("./global-search-runtime.js"),
  read("./styles-base.css"),
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
  'windowFunction("requestDatabaseSearch")',
  'requestDatabaseSearch("", "all", { force: true })',
  "recent: restoreSupabaseRecentResults,",
]) {
  invariant(runtime.includes(required), `Global Search result ownership is missing ${required}`);
}

invariant(
  runtime.includes('const hidden = !input.value.trim();')
    && runtime.includes("button.hidden = hidden;")
    && runtime.includes('button.toggleAttribute("hidden", hidden);')
    && runtime.includes('document.addEventListener("click", onClearClick, true);')
    && runtime.includes('input.value = "";\n    clearGlobalRequest();\n    clearRecentRequest();\n    syncClearButton();'),
  "Global Search clear control must stay hidden until the input contains text and hide immediately when cleared.",
);

invariant(
  walletPreferencesApi.includes("wallet_preferences?select=watchlists,player_notes,table_state,evaluation_settings,settings")
    && walletPreferencesApi.includes("tableState: row.table_state")
    && core.includes("recentSearchItems: state.recentSearchItems")
    && core.includes("queueCloudTableStateSave(savedState);"),
  "Global Search recent history must persist through the Supabase-backed wallet preferences table state.",
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
  !runtime.includes('document.createElement("style")') && !runtime.includes("!important"),
  "Global Search behavior must not be implemented through runtime CSS or priority overrides.",
);

console.log("Global Search loads five Supabase recent searches when empty, caps typed results at 10, and only shows clear while typed.");
