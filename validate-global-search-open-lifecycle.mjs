import { invariant } from "./validation/assertions.mjs";
import { readCombinedCanonicalCoreSource } from "./validate-core-sources.mjs";

const sourceCore = readCombinedCanonicalCoreSource();

invariant(
  sourceCore.includes('const ensureGlobalSearchRuntime = Reflect.get(window, "__mflEnsureGlobalSearchRuntime");')
    && sourceCore.includes('if (typeof ensureGlobalSearchRuntime === "function") {\n    await ensureGlobalSearchRuntime();\n  }')
    && sourceCore.indexOf('await ensureGlobalSearchRuntime();') < sourceCore.indexOf("showModal(searchModal);"),
  "Global Search first open must load the authoritative runtime before revealing or hydrating the modal.",
);

invariant(
  sourceCore.includes("const renderAuthoritativeRecentSearches = async () => {")
    && sourceCore.includes("const renderRecent = window.__mflGlobalSearchRuntime?.recent;")
    && sourceCore.includes("return Boolean(await renderRecent());")
    && sourceCore.includes("if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();"),
  "Canonical Global Search source must delegate the empty-state render to the recent-five runtime before falling back to mutable live search indexes.",
);

invariant(
  sourceCore.includes("const renderAuthoritativeRecentSearches = async () => {")
    && sourceCore.includes("void renderAuthoritativeRecentSearches().then((rendered) => {")
    && sourceCore.includes("if (!rendered && !playerSearchInput.value.trim()) renderSearchResultsNow();")
    && sourceCore.includes("await ensureSearchIndexes();\n  if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();")
    && !sourceCore.includes("await ensureSearchIndexes();\n  renderSearchResultsNow();\n}"),
  "After search indexes become ready, openSearch must not overwrite canonical recent-five cards with whichever typed results remain in the mutable live indexes.",
);

invariant(
  sourceCore.includes("const clubResults = state.clubSearchIndex")
    && sourceCore.includes(".slice(0, 10)\n    .map(clubSearchResult);")
    && sourceCore.includes("return [\n    ...playerResults,\n    ...clubResults,\n    ...agentResults,\n  ].slice(0, 10);")
    && sourceCore.includes("return items.slice(0, 5).map((item) => {")
    && sourceCore.includes('if (item.startsWith("club:")) {')
    && !sourceCore.includes("__mflUniversalClubSearch")
    && !sourceCore.includes("renderSearchResultsNowV1500")
    && !sourceCore.includes("renderSearchResultsFromBootstrap"),
  "Typed Global Search must own Player/Club/Agent merging directly with one ten-result budget and no wrapper-based Club enhancer.",
);

const mergedResultsStart = sourceCore.indexOf("return [\n    ...playerResults,\n    ...clubResults,\n    ...agentResults,");
invariant(
  mergedResultsStart >= 0,
  "Typed Global Search must preserve player -> club -> agent category priority while applying the shared ten-result cap.",
);

console.log("Global Search keeps canonical recents authoritative and uses one shared ten-result typed-result budget across players, clubs and agents.");
