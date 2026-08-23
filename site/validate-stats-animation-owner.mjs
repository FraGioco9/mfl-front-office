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
  read("./modules/app-core-stats-animation-owner.js"),
  read("./build-app-core.mjs"),
  read("./styles-base.css"),
]);

includes(
  databaseState,
  "state owner must not invoke renderDatabaseStatsPage a second time",
  "Database Stats state ownership must document why it does not start a second render.",
);
excludes(
  databaseState,
  "await window.renderDatabaseStatsPage(false);",
  "Database Stats route-state runtime must not duplicate the render already started by database-stats-runtime.",
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
  buildCore,
  "normalizeMflStatsAnimationOwner",
  "The canonical application-core build must apply the MFL Stats animation-owner normalization.",
);

console.log("Database Stats and MFL Stats render one column animation owner and preserve identical histogram DOM.");
