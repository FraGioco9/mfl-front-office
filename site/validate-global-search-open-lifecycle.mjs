import { readFile } from "node:fs/promises";
import { normalizeGlobalSearchOpenLifecycle } from "./modules/app-core-global-search-lifecycle.js";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [sourceCore, buildNormalizer, lifecycleNormalizer] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-core-global-search-lifecycle.js"),
]);

const normalizedCore = normalizeGlobalSearchOpenLifecycle({ core: sourceCore }).core;

invariant(
  buildNormalizer.includes('import { normalizeGlobalSearchOpenLifecycle } from "./app-core-global-search-lifecycle.js";')
    && buildNormalizer.includes("const globalSearchArtifacts = normalizeGlobalSearchOpenLifecycle(homeSummaryArtifacts);")
    && buildNormalizer.includes("normalizeEvaluationRecentReadiness(globalSearchArtifacts)"),
  "Canonical application-core builds must apply Global Search open-lifecycle normalization before later readiness transforms.",
);

invariant(
  lifecycleNormalizer.includes("const renderAuthoritativeRecentSearches = async () => {")
    && lifecycleNormalizer.includes("const renderRecent = window.__mflGlobalSearchRuntime?.recent;")
    && lifecycleNormalizer.includes("return Boolean(await renderRecent());")
    && lifecycleNormalizer.includes("if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();"),
  "Global Search open lifecycle must delegate the empty-state render to the canonical recent-five runtime before falling back to mutable live search indexes.",
);

invariant(
  normalizedCore.includes("const renderAuthoritativeRecentSearches = async () => {")
    && normalizedCore.includes("void renderAuthoritativeRecentSearches().then((rendered) => {")
    && normalizedCore.includes("if (!rendered && !playerSearchInput.value.trim()) renderSearchResultsNow();")
    && normalizedCore.includes("await ensureSearchIndexes();\n  if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();")
    && !normalizedCore.includes("await ensureSearchIndexes();\n  renderSearchResultsNow();\n}"),
  "After search indexes become ready, openSearch must not overwrite canonical recent-five cards with whichever typed results remain in the mutable live indexes.",
);

console.log("Global Search open keeps the canonical recent five authoritative before and after search-index readiness.");
