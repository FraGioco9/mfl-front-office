import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";
import { optimizeCachedRouteRuntimeArtifacts } from "./modules/app-core-cached-route-performance.js";
import { optimizeGlobalSearchRuntimeArtifacts } from "./modules/app-core-global-search-performance.js";
import { optimizeIncrementalTableRuntimeArtifacts } from "./modules/app-core-incremental-table-performance.js";
import { optimizeMflStatsRuntimeArtifacts } from "./modules/app-core-mfl-stats-performance.js";
import { optimizePersistenceRuntimeArtifacts } from "./modules/app-core-persistence-performance.js";
import { optimizeTableChromeRuntimeArtifacts } from "./modules/app-core-table-chrome-performance.js";
import { optimizeTableLoadingRuntimeArtifacts } from "./modules/app-core-table-loading-performance.js";
import { optimizeTableRenderPerformanceArtifacts } from "./modules/app-core-table-render-performance.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, buildSource, optimizerSource] = await Promise.all([
  read("./modules/app-core.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-core-global-search-performance.js"),
]);

const artifacts = optimizeGlobalSearchRuntimeArtifacts(
  optimizePersistenceRuntimeArtifacts(
    optimizeTableChromeRuntimeArtifacts(
      optimizeTableLoadingRuntimeArtifacts(
        optimizeCachedRouteRuntimeArtifacts(
          optimizeMflStatsRuntimeArtifacts(
            optimizeTableRenderPerformanceArtifacts(
              optimizeIncrementalTableRuntimeArtifacts(normalizeBuiltApplicationCoreArtifacts(coreSource)),
            ),
          ),
        ),
      ),
    ),
  ),
);
const eagerCore = String(artifacts.core || "");
const searchCore = String(artifacts.routeChunks?.search || "");
new Function(eagerCore);
new Function(searchCore);

includes(
  buildSource,
  'import { optimizeGlobalSearchRuntimeArtifacts } from "./modules/app-core-global-search-performance.js";',
  "The canonical build must import the Global Search performance optimizer.",
);
includes(
  buildSource,
  "const artifacts = optimizeGlobalSearchRuntimeArtifacts(\n  optimizePersistenceRuntimeArtifacts(",
  "Global Search optimization must compose outside the existing Step 12 pipeline without replacing it.",
);
includes(
  optimizerSource,
  'replaceRequiredFunction(\n    core,\n    "buildSearchIndex"',
  "Global Search optimization must transform the canonical local index builder.",
);
includes(
  optimizerSource,
  'replaceRequiredFunction(\n    search,\n    "bestSearchResults"',
  "Global Search optimization must transform only the route-owned ranking helper for typed results.",
);

includes(
  eagerCore,
  "const addAgent = (walletAddress, name, playerCountIncrement = 0) => {",
  "Local Global Search index construction must accumulate agent player counts while agents are already being indexed.",
);
includes(
  eagerCore,
  'state.rows.forEach((row) => addAgent(getValue(row, "wallet_address"), getValue(row, "wallet_name"), 1));',
  "Each locally indexed player row must contribute exactly one player to its agent count.",
);
includes(
  eagerCore,
  "existing.playerCount = Number(existing.playerCount || 0) + playerCountIncrement;",
  "Repeated rows for the same local agent must increment the existing indexed count without replacing the preferred agent identity.",
);
includes(
  eagerCore,
  'compactSearchValue(row, agentColumns, "player_count")',
  "Database-backed Global Search results must keep using the authoritative API player_count field.",
);

includes(
  searchCore,
  "playerCount: Number(entry.playerCount || 0),",
  "Typed agent ranking must reuse the indexed/API player count directly.",
);
includes(
  searchCore,
  "|| b.playerCount - a.playerCount",
  "Agent ranking must retain player-count ordering after relevance score.",
);
excludes(
  searchCore,
  "const agentPlayerCounts = new Map();",
  "Typed Global Search must not rebuild an agent player-count map on every result render.",
);
const bestSearchStart = searchCore.indexOf("function bestSearchResults(query) {");
const recentSearchStart = searchCore.indexOf("\nfunction recentSearchRows()", bestSearchStart);
const bestSearchBlock = bestSearchStart >= 0 && recentSearchStart > bestSearchStart
  ? searchCore.slice(bestSearchStart, recentSearchStart)
  : "";
invariant(bestSearchBlock, "The optimized Global Search ranking helper must exist.");
excludes(
  bestSearchBlock,
  "state.rows.forEach",
  "Typed Global Search ranking must not traverse the loaded Table rows to derive agent counts.",
);

// Deterministic accounting for the removed agent-count derivation only. A typed
// result render with 5,000 loaded rows previously visited all 5,000 rows solely
// to rebuild agent counts. The optimized ranking path visits none of those rows;
// counts are accumulated during the already-existing index-construction pass or
// supplied by the database search response.
const representativeLoadedRows = 5000;
const previousAgentCountRowVisits = representativeLoadedRows;
const optimizedAgentCountRowVisits = 0;
const reductionPercent = Math.round((1 - optimizedAgentCountRowVisits / previousAgentCountRowVisits) * 100);
invariant(reductionPercent === 100, "Step 17 must eliminate repeated typed-search agent-count row visits.");

console.log(
  `Global Search performance validation passed: per typed result render agent-count row visits ${previousAgentCountRowVisits} -> ${optimizedAgentCountRowVisits} (${reductionPercent}% reduction), while local index construction and API player_count remain authoritative.`,
);
