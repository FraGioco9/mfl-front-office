import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(siteRoot, "..");
const readSite = (path) => readFile(resolve(siteRoot, path), "utf8");
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const [
  incrementalRouting,
  appEntry,
  appConfig,
  dataPage,
  browserRouting,
  sitePackageSource,
  siteQuality,
  performanceDocs,
  architectureGuardrails,
  qualityScope,
] = await Promise.all([
  readSite("modules/core-sources/shared-incremental-routing.js"),
  readSite("modules/app-entry.js"),
  readSite("modules/app-config.js"),
  readSite("api/_data-page.js"),
  readSite("validation/browser-routing-regression.mjs"),
  readSite("package.json"),
  readRepository(".github/workflows/site-quality.yml"),
  readRepository("docs/performance-923.md"),
  readRepository("docs/architecture-guardrails.md"),
  readSite("ci-quality-scope.mjs"),
]);

const sitePackage = JSON.parse(sitePackageSource);

const cacheReadIndex = incrementalRouting.indexOf("const cachedPayload = !force ? readIncrementalPayloadCache(cacheKey) : null;");
const cacheReturnIndex = incrementalRouting.indexOf("return cachedPayload;", cacheReadIndex);
const networkFetchIndex = incrementalRouting.indexOf('window.__mflDataClient.fetch("/api/data?" + requestKey', cacheReadIndex);
invariant(
  cacheReadIndex >= 0 && cacheReturnIndex > cacheReadIndex && networkFetchIndex > cacheReturnIndex,
  "Incremental route cache hits must resolve before the network fetch branch.",
);
invariant(
  incrementalRouting.includes("const INCREMENTAL_PAYLOAD_CACHE_MAX_ENTRIES = 64;")
    && incrementalRouting.includes('const datasetKey = String(state.manifest?.generated_at || "unversioned")')
    && incrementalRouting.includes("const walletKey = normalizeWalletAddress(state.linkedWalletAddress).toLowerCase() || \"guest\";")
    && incrementalRouting.includes("state.incrementalPayloadCache.clear();"),
  "Incremental route caching must remain bounded and namespaced by dataset generation plus linked wallet.",
);

const universalStart = appEntry.indexOf("const UNIVERSAL_RUNTIME_SCRIPTS");
const universalEnd = appEntry.indexOf("]);", universalStart);
const universalSource = universalStart >= 0 && universalEnd > universalStart
  ? appEntry.slice(universalStart, universalEnd)
  : "";
invariant(
  !universalSource.includes("global-search-runtime.js")
    && !universalSource.includes("bug-report-runtime.js")
    && appEntry.includes('loadClassicScript("/global-search-runtime.js")')
    && appEntry.includes('loadClassicScript("/bug-report-runtime.js")'),
  "Optional Global Search and Bug Report runtimes must remain first-use lazy rather than universal startup work.",
);
invariant(
  appConfig.includes('playerPre: Object.freeze([\n    "/shared-table-ui-runtime.js",\n    "/player-interactions-runtime.js",\n    "/marketplace-overlay-runtime.js",\n  ])')
    && appConfig.includes('evaluationPre: Object.freeze([\n    "/global-search-runtime.js",'),
  "Player-only interactions and Evaluation Search must remain route-scoped rather than universal.",
);

const marketplaceOwnerStart = dataPage.indexOf("function marketplaceRequiredForPage");
const marketplaceOwnerEnd = dataPage.indexOf("\n}", marketplaceOwnerStart);
const marketplaceOwner = marketplaceOwnerStart >= 0 && marketplaceOwnerEnd > marketplaceOwnerStart
  ? dataPage.slice(marketplaceOwnerStart, marketplaceOwnerEnd + 2)
  : "";
invariant(
  marketplaceOwner.includes('String(sortKey || "").toLowerCase() === LISTING_COLUMN')
    && marketplaceOwner.includes('rules.some((rule) => String(rule?.column || "").toLowerCase() === LISTING_COLUMN)')
    && !marketplaceOwner.includes("player")
    && !marketplaceOwner.includes("evaluation"),
  "Player/Evaluation core data must remain marketplace-nonblocking except for explicit Listing sort/filter requests.",
);

invariant(
  browserRouting.includes("MFL Stats cached re-entry repeated the compact summary request.")
    && browserRouting.includes("My Clubs return navigation repeated fresh data requests.")
    && browserRouting.includes("My Clubs repeated a pending ownership or competition request."),
  "Browser routing regression must retain explicit cached-navigation request ownership checks.",
);

invariant(
  sitePackage.scripts?.["performance:baseline"] === "node validation/performance-baseline.mjs",
  "The repeatable performance harness must remain available through the canonical site script.",
);
invariant(
  !siteQuality.includes("performance:baseline"),
  "Noisy browser wall-clock performance baselines must remain opt-in rather than normal Site Quality gates.",
);
invariant(
  performanceDocs.includes("CI performance enforcement")
    && performanceDocs.includes("do not enforce wall-clock millisecond thresholds in normal Site Quality"),
  "Performance documentation must explain the stable CI enforcement boundary.",
);
invariant(
  architectureGuardrails.includes("### Performance enforcement boundary — keep")
    && architectureGuardrails.includes("normal Site Quality enforces deterministic performance architecture"),
  "Architecture guardrails must preserve the deterministic-vs-timing performance boundary.",
);
invariant(
  qualityScope.includes('file === "docs/foundations-audit-923.md"')
    && qualityScope.includes('file === "docs/performance-923.md"'),
  "Final foundations/performance documentation changes must trigger Site Quality validation.",
);

console.log("Stable performance foundations and opt-in timing enforcement validation passed.");
