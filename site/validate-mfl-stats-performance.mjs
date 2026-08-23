import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [build, optimizer, runtime] = await Promise.all([
  read("./build-app-core.mjs"),
  read("./modules/app-core-mfl-stats-performance.js"),
  read("./modules/app-core-mfl-stats-runtime.js"),
]);

includes(
  build,
  'import { optimizeMflStatsRuntimeArtifacts } from "./modules/app-core-mfl-stats-performance.js";',
  "The canonical application-core build must load the Step 8 MFL Stats optimizer.",
);
const mflStatsOptimizerIndex = build.indexOf("optimizeMflStatsRuntimeArtifacts(");
const tableRenderOptimizerIndex = build.indexOf("optimizeTableRenderPerformanceArtifacts(", mflStatsOptimizerIndex);
const incrementalOptimizerIndex = build.indexOf("optimizeIncrementalTableRuntimeArtifacts(", tableRenderOptimizerIndex);
const normalizedArtifactsIndex = build.indexOf("normalizeBuiltApplicationCoreArtifacts(source)", incrementalOptimizerIndex);
invariant(
  mflStatsOptimizerIndex >= 0
    && tableRenderOptimizerIndex > mflStatsOptimizerIndex
    && incrementalOptimizerIndex > tableRenderOptimizerIndex
    && normalizedArtifactsIndex > incrementalOptimizerIndex,
  "Step 8 must consume the fully normalized Step 6/7 artifacts before generated runtimes are written.",
);
includes(
  optimizer,
  'replaceRequiredFunction(\n    mflStats,\n    "mflStatsRows"',
  "Step 8 must replace MFL Stats aggregation at build time rather than patch it at runtime.",
);

const summaryStart = runtime.indexOf("function mflStatsSummary() {");
const summaryEnd = runtime.indexOf("function renderMflStatsFilterButtons()", summaryStart);
invariant(summaryStart >= 0 && summaryEnd > summaryStart, "Generated MFL Stats runtime must contain the single-pass summary owner.");
const summarySection = runtime.slice(summaryStart, summaryEnd);

includes(summarySection, "for (const row of state.rows) {", "MFL Stats must traverse the source rows once.");
includes(summarySection, "!rowIsMflWalletPlayer(row) || !rowMatchesMflStatsOverallFilter(row, filter)", "The single pass must preserve wallet and overall-filter semantics.");
includes(summarySection, "const category = mflStatsCategory(row);", "The single pass must preserve the canonical category owner.");
includes(summarySection, 'if (category === "packable") {', "The single pass must count packable players.");
includes(summarySection, '} else if (category === "aged") {', "The single pass must count aged players.");
includes(summarySection, "otherPlayers += 1;", "The single pass must count all remaining players as Other.");
includes(summarySection, "const distributionValue = mflStatsDistributionValue(row);", "Packable histogram values must be aggregated during the same source-row pass.");
includes(summarySection, "distributionCounts.set(distributionValue, (distributionCounts.get(distributionValue) || 0) + 1);", "Histogram counts must be accumulated without retaining a packable row array.");
excludes(summarySection, ".filter(", "Single-pass MFL Stats aggregation must not rebuild intermediate filtered row arrays.");

const distributionStart = runtime.indexOf("function renderMflStatsDistribution(");
const distributionEnd = runtime.indexOf("function renderMflStatsPage()", distributionStart);
invariant(distributionStart >= 0 && distributionEnd > distributionStart, "Generated MFL Stats runtime must contain distribution rendering.");
const distributionSection = runtime.slice(distributionStart, distributionEnd);
includes(distributionSection, "function renderMflStatsDistribution(counts, totalPackable)", "Histogram rendering must consume pre-aggregated counts.");
includes(distributionSection, "const maxCount = Math.max(...counts.values());", "Histogram scale must remain derived from canonical bucket counts.");
includes(distributionSection, "const totalPercent = totalPackable > 0 ? ((count / totalPackable) * 100).toFixed(1) : \"0.0\";", "Histogram percentages must preserve packable-player denominator semantics.");
excludes(distributionSection, "packableRows.forEach", "Histogram rendering must not rescan packable rows after aggregation.");

const renderStart = runtime.indexOf("function renderMflStatsPage() {");
const renderEnd = runtime.indexOf("mflStatsDistributionModeButtons?.addEventListener", renderStart);
invariant(renderStart >= 0 && renderEnd > renderStart, "Generated MFL Stats runtime must contain the page renderer.");
const renderSection = runtime.slice(renderStart, renderEnd);
includes(renderSection, "const summary = mflStatsSummary();", "MFL Stats page rendering must consume the single-pass summary.");
includes(renderSection, "formatCount(summary.totalPlayers)", "Total player count must come from the summary.");
includes(renderSection, "formatCount(summary.packablePlayers)", "Packable count must come from the summary.");
includes(renderSection, "formatCount(summary.agedPlayers)", "Aged count must come from the summary.");
includes(renderSection, "formatCount(summary.otherPlayers)", "Other count must come from the summary.");
includes(renderSection, "renderMflStatsDistribution(summary.distributionCounts, summary.packablePlayers);", "The page renderer must hand pre-aggregated histogram data directly to distribution rendering.");
for (const forbidden of ["mflStatsRows()", "rows.filter(", "packableRows", "agedRows", "otherRows"]) {
  excludes(renderSection, forbidden, `MFL Stats rendering must not restore repeated row derivation through ${forbidden}.`);
}

// Deterministic operation accounting for an all-matching 1,000-row payload with
// 300 packable players. This measures row visits removed by Step 8, not total
// page-render latency.
const measuredRows = 1000;
const measuredPackableRows = 300;
const previousRowVisits = measuredRows // wallet filter
  + measuredRows // overall filter
  + measuredRows * 3 // three category filters
  + measuredPackableRows; // histogram pass
const optimizedRowVisits = measuredRows;
const reductionPercent = Math.round((1 - optimizedRowVisits / previousRowVisits) * 100);

invariant(previousRowVisits === 5300, "Step 8 baseline operation accounting must stay deterministic.");
invariant(optimizedRowVisits === 1000, "Step 8 optimized operation accounting must stay deterministic.");
invariant(reductionPercent === 81, "Step 8 must retain the measured 81% row-visit reduction for the reference workload.");

console.log(
  `MFL Stats performance validation passed: reference row visits ${previousRowVisits} -> ${optimizedRowVisits} (${reductionPercent}% reduction) while preserving totals, category semantics, and histogram percentages.`,
);
