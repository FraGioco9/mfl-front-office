import { readFile } from "node:fs/promises";

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [databaseStats, databaseState, mflStats, normalizer, buildCore, stylesBase, loadingStyles] = await Promise.all([
  read("./database-stats-runtime.js"),
  read("./database-stats-state-runtime.js"),
  read("./modules/app-core-mfl-stats-runtime.js"),
  read("./modules/app-core-stats-route-ownership.js"),
  read("./build-app-core.mjs"),
  read("./styles-base.css"),
  read("./loading.css"),
]);

includes(
  databaseState,
  "await window.renderDatabaseStatsPage(false);",
  "Database Stats route-state runtime must delegate to the cached domain renderer so revisits restore data.",
);
includes(
  databaseStats,
  "mflStatsDistributionSignature",
  "Database Stats must preserve identical histogram DOM when startup and delegated renders overlap.",
);

for (const [name, source] of [["Database Stats", databaseStats], ["MFL Stats", mflStats]]) {
  includes(source, "mflStatsHistogramLayout", `${name} must use the structural histogram wrapper.`);
  excludes(source, 'className = "mflStatsHistogram";', `${name} must not render the animated histogram wrapper.`);
  includes(source, "mflStatsHistogramFill", `${name} must retain the existing fill rise as the sole column animation owner.`);
  includes(source, "mflStatsDistributionSignature", `${name} must preserve identical histogram DOM instead of recreating animated fills.`);
  excludes(source, "fill.animate(", `${name} must not introduce a JavaScript animation owner.`);
  excludes(source, "style.animation", `${name} must not suppress CSS animations with inline overrides.`);
  excludes(source, "!important", `${name} must not use CSS priority overrides.`);
}

includes(
  databaseStats,
  "const filterChanged = activeFilter !== filter[0];",
  "Database Stats must ignore an already-active Overall filter.",
);
includes(
  databaseStats,
  "if (nextMode === distributionMode) return;",
  "Database Stats must ignore an already-active distribution mode.",
);
includes(
  databaseStats,
  "clearDistributionRenderSignature();",
  "Database Stats must allow one fresh animation after leaving and re-entering the route.",
);

const mflRenderStart = mflStats.indexOf("function renderMflStatsPage() {");
const mflOwnershipGate = mflStats.indexOf('if (state.incrementalRoute?.scope !== "mflstats") return;', mflRenderStart);
const mflRowsRead = mflStats.indexOf("const rows = mflStatsRows();", mflRenderStart);
invariant(
  mflRenderStart >= 0 && mflOwnershipGate > mflRenderStart && mflRowsRead > mflOwnershipGate,
  "MFL Stats must verify mflstats data ownership before reading shared state.rows.",
);
includes(
  mflStats,
  "if (state.mflStatsOverallFilter === filter.id) return;",
  "MFL Stats must ignore an already-active Overall filter.",
);
includes(
  mflStats,
  "if (nextMode === state.mflStatsDistributionMode) return;",
  "MFL Stats must ignore an already-active distribution mode.",
);
includes(
  mflStats,
  'histogram.style.display = "grid";',
  "Generated MFL Stats must retain the full structural histogram layout after removing the animated wrapper class.",
);
includes(
  mflStats,
  'class="mflStatsHistogramFill"',
  "Generated MFL Stats must leave the canonical CSS fill rise intact without replacing or suppressing it.",
);

for (const required of [
  "let mflStatsPreparedSourceRows = null;",
  "function mflStatsPreparedRowsForCurrentRoute() {",
  "mflStatsPreparedSourceRows === state.rows && mflStatsPreparedSourceColumns === state.columns",
  "category: mflStatsCategory(row),",
  "if (filter.min === null && filter.max === null) return preparedRows;",
  "return preparedRows.filter((entry) => rowMatchesMflStatsOverallFilter(entry.overall, filter));",
  "if (state.mflStatsDistributionMode === \"age\") return entry.age;",
  "rows.forEach((entry) => {",
]) {
  includes(
    mflStats,
    required,
    `MFL Stats filter rendering must reuse prepared route facts: ${required}`,
  );
}
excludes(
  mflStats,
  ".filter((row) => rowIsMflWalletPlayer(row))",
  "MFL Stats must not re-check wallet ownership on every Overall filter click after the mflstats route already scoped the payload.",
);
excludes(
  mflStats,
  'rows.filter((row) => mflStatsCategory(row) === "packable")',
  "MFL Stats must not reclassify the full All result in separate category passes.",
);
excludes(
  mflStats,
  "__mflInteractionBusy",
  "MFL Stats Overall filters must remain local cached-data interactions instead of entering the global loading workflow.",
);
excludes(
  mflStats,
  "withInteractionBusy",
  "MFL Stats Overall filters must not wrap already-loaded filter derivation in a synthetic loading state.",
);

includes(
  stylesBase,
  "animation: mflStatsBarRise 220ms ease-out;",
  "The original fill rise must remain the canonical Stats column animation.",
);
includes(
  normalizer,
  'histogram.className = "mflStatsHistogramLayout";',
  "The MFL Stats generator must remove the animated wrapper from the render path.",
);
includes(
  normalizer,
  'if (state.incrementalRoute?.scope !== "mflstats") return;',
  "The MFL Stats generator must enforce route data ownership before rendering the histogram.",
);
includes(
  normalizer,
  "mflStatsPreparedRowsForCurrentRoute",
  "The canonical MFL Stats normalizer must own prepared filter-row caching.",
);
includes(
  normalizer,
  "MFL Stats categories aggregate in one pass",
  "The canonical MFL Stats normalizer must keep category aggregation single-pass.",
);
includes(
  buildCore,
  "normalizeMflStatsRouteOwnership",
  "The canonical application-core build must apply the MFL Stats route-ownership normalization.",
);

invariant(!loadingStyles.includes("mflInteractionBusy"), "Stats animation ownership must not depend on a retired global busy blocker.");
excludes(loadingStyles, "html.mflInitialChromePreparing", "Refresh/loading state must not blanket-disable transitions or pause animations; normal hover and component animation ownership must remain active.");
excludes(loadingStyles, "animation-play-state: paused;", "Refresh/loading must not globally pause animations.");
excludes(loadingStyles, "transition: none;", "Refresh/loading must not globally disable hover transitions.");

console.log("Database Stats and MFL Stats keep one fill animation owner, stable histogram DOM, first-paint-safe animation timelines, and prepared local MFL filter derivation without global busy state.");
