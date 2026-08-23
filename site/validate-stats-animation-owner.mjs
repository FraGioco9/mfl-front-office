import { readFile } from "node:fs/promises";

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [databaseStats, databaseState, mflStats, normalizer, buildCore, stylesBase] = await Promise.all([
  read("./database-stats-runtime.js"),
  read("./database-stats-state-runtime.js"),
  read("./modules/app-core-mfl-stats-runtime.js"),
  read("./modules/app-core-stats-route-ownership.js"),
  read("./build-app-core.mjs"),
  read("./styles-base.css"),
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

includes(
  mflStats,
  'if (state.incrementalRoute?.scope !== "mflstats") return;',
  "MFL Stats must not render its histogram from data owned by another incremental route.",
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
  buildCore,
  "normalizeMflStatsRouteOwnership",
  "The canonical application-core build must apply the MFL Stats route-ownership normalization.",
);

console.log("Database Stats revisits render cached data, while MFL Stats waits for owned data and both keep one column animation owner.");
