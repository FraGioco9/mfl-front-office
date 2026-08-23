import { readFile } from "node:fs/promises";

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [databaseStats, mflStats, buildCore, lifecycle, indexHtml] = await Promise.all([
  read("./database-stats-runtime.js"),
  read("./modules/app-core-mfl-stats-runtime.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-core-stats-render-lifecycle.js"),
  read("./index.html"),
]);

includes(
  databaseStats,
  "container.dataset.mflStatsRenderSignature === distributionSignature",
  "Database Stats must preserve an identical histogram DOM instead of replaying its animation.",
);
includes(
  mflStats,
  "mflStatsAgeDistribution.dataset.mflStatsRenderSignature === distributionSignature",
  "MFL Stats must preserve an identical histogram DOM instead of replaying its animation.",
);
includes(
  buildCore,
  "normalizeMflStatsHistogramLifecycle",
  "The generated MFL Stats runtime must receive its single-render lifecycle during the canonical core build.",
);
includes(
  lifecycle,
  "MFL Stats histogram renders once for each distinct distribution",
  "The MFL Stats build normalizer must own the distinct-distribution render contract.",
);
excludes(
  indexHtml,
  "#databaseStatsPage .mflStatsHistogram {\n        animation: none !important;",
  "Database Stats must not suppress histogram animation with the legacy !important workaround.",
);

console.log("Database Stats and MFL Stats rebuild animated histogram columns only for distinct distributions.");
