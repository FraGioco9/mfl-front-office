import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [sourceCore, buildNormalizer] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-build-normalizer.js"),
]);

const normalizedCore = sourceCore;

invariant(
  !buildNormalizer.includes("normalizeGlobalSearchOpenLifecycle")
    && !buildNormalizer.includes("globalSearchArtifacts")
    && !buildNormalizer.includes("normalizeHomeSummaryLifecycle")
    && !buildNormalizer.includes("homeSummaryArtifacts")
    && !buildNormalizer.includes("normalizeStatsNavigationLifecycle")
    && !buildNormalizer.includes("statsNavigationArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationRecentReadiness")
    && !buildNormalizer.includes("evaluationRecentArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationLoadLifecycle")
    && !buildNormalizer.includes("evaluationLoadArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")
    && buildNormalizer.includes("return watchlistArtifacts;"),
  "Canonical application-core builds must consume source-owned Global Search, Stats navigation, Evaluation recent-readiness, and Evaluation Load behavior before later transforms.",
);

invariant(
  sourceCore.includes("const renderAuthoritativeRecentSearches = async () => {")
    && sourceCore.includes("const renderRecent = window.__mflGlobalSearchRuntime?.recent;")
    && sourceCore.includes("return Boolean(await renderRecent());")
    && sourceCore.includes("if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();"),
  "Canonical Global Search source must delegate the empty-state render to the recent-five runtime before falling back to mutable live search indexes.",
);

invariant(
  normalizedCore.includes("const renderAuthoritativeRecentSearches = async () => {")
    && normalizedCore.includes("void renderAuthoritativeRecentSearches().then((rendered) => {")
    && normalizedCore.includes("if (!rendered && !playerSearchInput.value.trim()) renderSearchResultsNow();")
    && normalizedCore.includes("await ensureSearchIndexes();\n  if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();")
    && !normalizedCore.includes("await ensureSearchIndexes();\n  renderSearchResultsNow();\n}"),
  "After search indexes become ready, openSearch must not overwrite canonical recent-five cards with whichever typed results remain in the mutable live indexes.",
);

invariant(
  normalizedCore.includes("return [...playerResults, ...agentResults].slice(0, 10);")
    && normalizedCore.includes("const clubResults = clubs.slice(0, query ? 10 : 5).map(clubSearchResult);")
    && normalizedCore.includes("const mergedResults = [\n      ...playerResults,\n      ...clubResults,\n      ...agentResults,\n    ].slice(0, 10);")
    && !normalizedCore.includes("return [...playerResults.slice(0, 5), ...agentResults.slice(0, 5)];")
    && !normalizedCore.includes("...playerResults.slice(0, 5),\n      ...clubResults,\n      ...agentResults.slice(0, 5),"),
  "Typed Global Search must use one ten-result budget across players, clubs and agents instead of reserving five-result category buckets.",
);

const mergedResultsStart = normalizedCore.indexOf("const mergedResults = [\n      ...playerResults,\n      ...clubResults,\n      ...agentResults,");
invariant(
  mergedResultsStart >= 0,
  "Typed Global Search must preserve player -> club -> agent category priority while applying the shared ten-result cap.",
);

console.log("Global Search keeps canonical recents authoritative and uses one shared ten-result typed-result budget across players, clubs and agents.");
