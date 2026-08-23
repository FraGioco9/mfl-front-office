import { readFile } from "node:fs/promises";

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [databaseStats, mflStats, normalizer, histogramStyles, styles, buildCore] = await Promise.all([
  read("./database-stats-runtime.js"),
  read("./modules/app-core-mfl-stats-runtime.js"),
  read("./modules/app-core-stats-histogram-animation.js"),
  read("./stats-histogram.css"),
  read("./styles.css"),
  read("./build-app-core.mjs"),
]);

includes(styles, '@import url("/stats-histogram.css");', "The canonical site stylesheet must load the Stats histogram owner.");

for (const [name, source] of [["Database Stats", databaseStats], ["MFL Stats", mflStats]]) {
  includes(source, 'mflStatsHistogramPersistent', `${name} must render the non-animated persistent histogram class.`);
  includes(source, 'mflStatsHistogramFillPersistent', `${name} must render fills that inherit animation progress from the persistent container.`);
  excludes(source, 'className = "mflStatsHistogram";', `${name} must not render the legacy per-node animated histogram class.`);
  excludes(source, 'class="mflStatsHistogramFill"', `${name} must not render the legacy per-node animated fill class.`);
  includes(source, "restartDistributionAnimation: true", `${name} must restart the parent animation only for an intentional interaction.`);
}

includes(
  databaseStats,
  "animateDistribution(container, options.restartDistributionAnimation === true);",
  "Database Stats must start or intentionally restart animation on the persistent distribution container.",
);
includes(
  databaseStats,
  "const routeAnimationObserver = new MutationObserver(syncDistributionRouteAnimation);",
  "Database Stats must reset its persistent animation class when the route is left.",
);
includes(
  mflStats,
  "animateMflStatsDistribution(options.restartDistributionAnimation === true);",
  "MFL Stats must start or intentionally restart animation on the persistent distribution container.",
);
includes(
  mflStats,
  "const mflStatsDistributionAnimationObserver = new MutationObserver(syncMflStatsDistributionAnimationRoute);",
  "MFL Stats must reset its persistent animation class when the route is left.",
);

includes(histogramStyles, "@property --mfl-stats-rise-progress", "Stats histogram rise progress must be a registered custom property.");
includes(histogramStyles, "inherits: true;", "Replacement bars must inherit the persistent container's current animation progress.");
includes(
  histogramStyles,
  ":is(#databaseStatsDistribution, #mflStatsAgeDistribution).mflStatsDistributionAnimating",
  "Only the persistent distribution containers may own the Stats rise animation.",
);
includes(histogramStyles, "animation: mflStatsDistributionRise 220ms ease-out both;", "The persistent container must own the single 220ms rise animation and finish in its visible state.");
includes(histogramStyles, ".mflStatsHistogramPersistent > .mflStatsHistogramItem {", "The persistent histogram stylesheet must own item layout directly.");
includes(histogramStyles, ".mflStatsHistogramPersistent .mflStatsHistogramBar {", "The persistent histogram stylesheet must own bar geometry directly.");
includes(histogramStyles, "transform: scaleY(1);", "Stats columns must be fully visible by default outside the active animation.");
includes(
  histogramStyles,
  ".mflStatsDistributionAnimating .mflStatsHistogramFillPersistent",
  "Only an actively animating persistent container may apply inherited rise progress to a fill.",
);
includes(
  histogramStyles,
  "transform: scaleY(var(--mfl-stats-rise-progress));",
  "Actively animating histogram fills must derive their transform from inherited parent progress.",
);
includes(histogramStyles, ".mflStatsHistogramPersistent .mflStatsHistogramLabel {", "The persistent histogram stylesheet must own label layout directly.");
includes(histogramStyles, "@keyframes mflStatsDistributionRise", "The shared persistent rise keyframes must exist.");
excludes(histogramStyles, ".mflStatsHistogram {", "The new stylesheet must not override the legacy histogram class.");
excludes(histogramStyles, ".mflStatsHistogramFill {", "The new stylesheet must not override the legacy fill class.");
excludes(histogramStyles, "!important", "Persistent Stats histogram animation must not use priority overrides.");

includes(
  normalizer,
  'histogram.className = "mflStatsHistogramPersistent";',
  "The canonical MFL Stats generator must emit the persistent histogram class.",
);
includes(
  normalizer,
  'class="mflStatsHistogramFillPersistent"',
  "The canonical MFL Stats generator must emit persistent fill classes.",
);
includes(
  buildCore,
  "normalizeMflStatsHistogramAnimation",
  "The canonical application-core build must apply the persistent MFL Stats animation normalizer.",
);

console.log("Database Stats and MFL Stats keep one inherited animation timeline with a fully visible non-animated fallback.");
