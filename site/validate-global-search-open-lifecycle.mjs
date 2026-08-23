import { readFile } from "node:fs/promises";
import { normalizeGlobalSearchOpenLifecycle } from "./modules/app-core-global-search-lifecycle.js";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [sourceCore, buildNormalizer, lifecycleNormalizer, searchSplitter] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-core-global-search-lifecycle.js"),
  read("./modules/app-core-search-chunk.js"),
]);

const artifacts = normalizeGlobalSearchOpenLifecycle({ core: sourceCore });
const normalizedCore = String(artifacts.core || "");
const searchCore = String(artifacts.routeChunks?.search || "");
new Function(normalizedCore);
new Function(searchCore);

invariant(
  buildNormalizer.includes('import { normalizeGlobalSearchOpenLifecycle } from "./app-core-global-search-lifecycle.js";')
    && buildNormalizer.includes("const globalSearchArtifacts = normalizeGlobalSearchOpenLifecycle(homeSummaryArtifacts);")
    && buildNormalizer.includes("normalizeEvaluationRecentReadiness(globalSearchArtifacts)"),
  "Canonical application-core builds must apply Global Search lifecycle normalization before later readiness transforms.",
);

invariant(
  lifecycleNormalizer.includes('import { splitSearchApplicationCoreRuntime } from "./app-core-search-chunk.js";')
    && lifecycleNormalizer.includes("return splitSearchApplicationCoreRuntime(Object.freeze({")
    && searchSplitter.includes('"Global Search action ownership"'),
  "Global Search lifecycle normalization must hand finalized behavior directly to its lazy action owner.",
);

invariant(
  searchCore.includes("const renderAuthoritativeRecentSearches = async () => {")
    && searchCore.includes("const renderRecent = window.__mflGlobalSearchRuntime?.recent;")
    && searchCore.includes("return Boolean(await renderRecent());")
    && searchCore.includes("if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();"),
  "The lazy Global Search owner must delegate the empty-state render to the canonical recent-five runtime before falling back to mutable live search indexes.",
);

invariant(
  searchCore.includes("async function searchOpenOwner() {")
    && searchCore.includes("void renderAuthoritativeRecentSearches().then((rendered) => {")
    && searchCore.includes("if (!rendered && !playerSearchInput.value.trim()) renderSearchResultsNow();")
    && searchCore.includes("await ensureSearchIndexes();\n  if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();")
    && !searchCore.includes("await ensureSearchIndexes();\n  renderSearchResultsNow();\n}"),
  "After search indexes become ready, the lazy open owner must not overwrite canonical recent-five cards with mutable typed indexes.",
);

invariant(
  searchCore.includes("return [...playerResults, ...agentResults].slice(0, 10);")
    && !searchCore.includes("return [...playerResults.slice(0, 5), ...agentResults.slice(0, 5)];"),
  "The lazy Search owner must give players and agents one shared ten-result budget before the club bridge runs.",
);

invariant(
  normalizedCore.includes("const clubResults = clubs.slice(0, query ? 10 : 5).map(clubSearchResult);")
    && normalizedCore.includes("const mergedResults = [\n      ...playerResults,\n      ...clubResults,\n      ...agentResults,\n    ].slice(0, 10);")
    && !normalizedCore.includes("...playerResults.slice(0, 5),\n      ...clubResults,\n      ...agentResults.slice(0, 5),"),
  "The shared club-search enhancer must preserve the same ten-result total budget when it merges club matches into Search output.",
);

const mergedResultsStart = normalizedCore.indexOf("const mergedResults = [\n      ...playerResults,\n      ...clubResults,\n      ...agentResults,");
invariant(
  mergedResultsStart >= 0,
  "The club-search bridge must preserve player -> club -> agent category priority while applying the shared ten-result cap.",
);

invariant(
  normalizedCore.includes("function ensureGlobalSearchActionCore() {")
    && normalizedCore.includes('window.__mflEnsureRouteCore("search")')
    && normalizedCore.includes("async function openSearch() {")
    && normalizedCore.includes("function renderSearchResultsNow() {")
    && !normalizedCore.includes("function searchMatchScore(query, primaryText, secondaryText = \"\") {")
    && !normalizedCore.includes("function bestSearchResults(query) {"),
  "The eager core must retain only Global Search facades while base ranking and rendering implementations stay lazy.",
);

console.log("Global Search lifecycle validation passed with canonical recent-five behavior and base ranking owned by the lazy Search core while the club merge remains a shared bridge.");
