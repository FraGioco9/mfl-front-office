import { readFile } from "node:fs/promises";

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [databaseStats, mflStats, buildCore, lifecycle, bootstrapCore, indexHtml] = await Promise.all([
  read("./database-stats-runtime.js"),
  read("./modules/app-core-mfl-stats-runtime.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-core-stats-render-lifecycle.js"),
  read("./bootstrap-core.js"),
  read("./index.html"),
]);

includes(
  databaseStats,
  "container.dataset.mflStatsRenderSignature === distributionSignature",
  "Database Stats must preserve an identical histogram DOM during repeated hydration renders.",
);
includes(
  mflStats,
  "mflStatsAgeDistribution.dataset.mflStatsRenderSignature === distributionSignature",
  "MFL Stats must preserve an identical histogram DOM during repeated hydration renders.",
);
includes(
  bootstrapCore,
  "snapshot: () => currentSnapshot",
  "The shared loading controller must expose its settled-state snapshot.",
);
includes(
  bootstrapCore,
  "subscribe,",
  "The shared loading controller must expose loading-state subscriptions.",
);
for (const [name, source] of [["Database Stats", databaseStats], ["MFL Stats", mflStats]]) {
  includes(
    source,
    "controller?.isBusy?.()",
    `${name} must defer its histogram animation while route/data loading is active.`,
  );
  includes(
    source,
    "subscribe?.((snapshot)",
    `${name} must wait for the shared loading controller to settle before animating.`,
  );
  includes(
    source,
    "fill.animate([",
    `${name} must start its column rise explicitly after loading settles.`,
  );
  includes(
    source,
    '{ transform: "scaleY(0.18)" },',
    `${name} must preserve the intended column-rise start state.`,
  );
  includes(
    source,
    '{ transform: "scaleY(1)" },',
    `${name} must preserve the intended column-rise end state.`,
  );
}
includes(
  databaseStats,
  'fill.style.animation = "none";',
  "Database Stats must prevent each intermediate DOM creation from auto-starting the CSS animation.",
);
includes(
  mflStats,
  'style="animation:none;--bar-height:${barHeight}%"',
  "MFL Stats must prevent each intermediate DOM creation from auto-starting the CSS animation.",
);
includes(
  buildCore,
  "normalizeMflStatsHistogramLifecycle",
  "The generated MFL Stats runtime must receive the post-loading animation lifecycle during the canonical core build.",
);
includes(
  lifecycle,
  "MFL Stats owns a single post-loading histogram animation scheduler",
  "The MFL Stats build normalizer must own the final-render animation scheduler.",
);
includes(
  lifecycle,
  "scheduleMflStatsDistributionAnimation(mflStatsAgeDistribution)",
  "The generated MFL Stats runtime must schedule animation only after replacing the final histogram DOM.",
);
excludes(
  indexHtml,
  "#databaseStatsPage .mflStatsHistogram {\n        animation: none !important;",
  "Database Stats must not suppress animation with the legacy !important workaround.",
);

console.log("Database Stats and MFL Stats animate the final post-loading histogram exactly once.");
