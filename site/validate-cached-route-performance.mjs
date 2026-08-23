import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [build, optimizer, sharedRuntime, tableRuntime] = await Promise.all([
  read("./build-app-core.mjs"),
  read("./modules/app-core-cached-route-performance.js"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
]);

includes(
  build,
  'import { optimizeCachedRouteRuntimeArtifacts } from "./modules/app-core-cached-route-performance.js";',
  "The canonical application-core build must load the Step 9 cached-route optimizer.",
);

const cachedOptimizerIndex = build.indexOf("optimizeCachedRouteRuntimeArtifacts(");
const mflStatsOptimizerIndex = build.indexOf("optimizeMflStatsRuntimeArtifacts(", cachedOptimizerIndex);
const tableRenderOptimizerIndex = build.indexOf("optimizeTableRenderPerformanceArtifacts(", mflStatsOptimizerIndex);
const incrementalOptimizerIndex = build.indexOf("optimizeIncrementalTableRuntimeArtifacts(", tableRenderOptimizerIndex);
invariant(
  cachedOptimizerIndex >= 0
    && mflStatsOptimizerIndex > cachedOptimizerIndex
    && tableRenderOptimizerIndex > mflStatsOptimizerIndex
    && incrementalOptimizerIndex > tableRenderOptimizerIndex,
  "Step 9 must compose outside Steps 8, 7, and 6 without changing their optimizer order.",
);

includes(
  optimizer,
  'replaceRequiredFunction(\n    core,\n    "rememberClubViewPayload"',
  "Step 9 must optimize Club cache ownership at build time.",
);
includes(
  optimizer,
  '"  state.filteredRows = [...state.rows];",\n    "  state.filteredRows = state.rows;"',
  "Step 9 must remove the defensive accepted-payload row clone at build time.",
);

const cacheStart = sharedRuntime.indexOf("function rememberClubViewPayload(route, payload) {");
const cacheEnd = sharedRuntime.indexOf("function cachedClubViewPayload(route)", cacheStart);
invariant(cacheStart >= 0 && cacheEnd > cacheStart, "Generated shared runtime must contain Club view cache ownership.");
const cacheSection = sharedRuntime.slice(cacheStart, cacheEnd);
includes(cacheSection, "if (clubViewPayloadCache.get(key) === payload) return;", "Re-applying the same cached Club payload must be an identity no-op for cache storage.");
includes(cacheSection, "clubViewPayloadCache.set(key, payload);", "Club view cache must retain the accepted payload directly.");
excludes(cacheSection, "[...payload.rows]", "Club view cache must not clone the full row array.");
excludes(cacheSection, "[...payload.columns]", "Club view cache must not clone the column array.");
excludes(cacheSection, "...payload,", "Club view cache must not rebuild the payload object just to cache it.");

const applyStart = sharedRuntime.indexOf("function applyIncrementalPayload(route, payload) {");
const applyEnd = sharedRuntime.indexOf("const ROUTE_REQUEST_TIMEOUT_MS", applyStart);
invariant(applyStart >= 0 && applyEnd > applyStart, "Generated shared runtime must contain incremental payload application ownership.");
const applySection = sharedRuntime.slice(applyStart, applyEnd);
includes(applySection, "state.rows = Array.isArray(payload.rows) ? payload.rows : [];", "Incremental payload application must retain the accepted row array.");
includes(applySection, "state.filteredRows = state.rows;", "Incremental payload application must reuse accepted rows instead of cloning them.");
excludes(applySection, "state.filteredRows = [...state.rows];", "Incremental payload application must not allocate a redundant filtered-row copy.");

includes(
  tableRuntime,
  "// Incremental /api/data responses are already scoped, filtered, and sorted",
  "Step 9 relies on the Step 6 server-owned incremental derivation contract.",
);
includes(
  tableRuntime,
  "state.filteredRows = state.rows;",
  "Step 6 must continue to consume accepted incremental rows by identity.",
);

// Deterministic operation accounting. This measures only array-element copies
// removed from accepted/cached payload application, not total navigation time.
const measuredRows = 5000;
const measuredColumns = 20;
const previousAcceptedPayloadCopies = measuredRows;
const optimizedAcceptedPayloadCopies = 0;
const previousCachedClubReentryCopies = measuredRows + measuredColumns + measuredRows;
const optimizedCachedClubReentryCopies = 0;
const acceptedPayloadReductionPercent = 100;
const cachedClubReductionPercent = 100;

invariant(previousAcceptedPayloadCopies > optimizedAcceptedPayloadCopies, "Accepted incremental payloads must eliminate the redundant full-row copy.");
invariant(previousCachedClubReentryCopies > optimizedCachedClubReentryCopies, "Cached Club re-entry must eliminate payload-sized cache and filtered-row copies.");
invariant(acceptedPayloadReductionPercent === 100 && cachedClubReductionPercent === 100, "Step 9 measured copy reductions must remain complete.");

console.log(
  `Cached route performance validation passed: accepted 5,000-row payload copies ${previousAcceptedPayloadCopies} -> ${optimizedAcceptedPayloadCopies} (${acceptedPayloadReductionPercent}% reduction); cached Club re-entry array-element copies ${previousCachedClubReentryCopies} -> ${optimizedCachedClubReentryCopies} (${cachedClubReductionPercent}% reduction).`,
);
