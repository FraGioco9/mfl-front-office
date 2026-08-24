// Temporary one-shot validator migration; remove after the ownership validator commit.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(root, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

const filtersPath = resolve(root, "validate-filter-popup-interactions.mjs");
let filters = await read("validate-filter-popup-interactions.mjs");
filters = replaceRequired(
  filters,
  "const [index, bootstrap, controls, sharedTableUi, staticUi, dropdownRuntime, buildNormalizer, appCore, clubStartup, tableSplitter, coreRuntime, tableRuntime] = await Promise.all([",
  "const [index, bootstrap, controls, sharedTableUi, staticUi, dropdownRuntime, buildNormalizer, appCore, tableSplitter, coreRuntime, tableRuntime] = await Promise.all([",
  "Filters Club startup binding",
);
filters = replaceRequired(
  filters,
  '  read("./modules/app-core-club-startup-lifecycle.js"),\n',
  "",
  "Filters Club startup file read",
);
filters = replaceRequired(
  filters,
  `invariant(
  clubStartup.includes('if (filterSummary) filterSummary.textContent = "0";')
    && !clubStartup.includes('if (filterSummary) filterSummary.textContent = "0 active";'),
  "Club filter-free rendering must emit the canonical count-only zero summary directly.",
);`,
  `invariant(
  appCore.includes('if (filterSummary) filterSummary.textContent = "0";')
    && !appCore.includes('if (filterSummary) filterSummary.textContent = "0 active";'),
  "Canonical Club filter-free rendering must emit the count-only zero summary directly.",
);`,
  "Filters Club count-only source ownership assertion",
);
filters = replaceRequired(
  filters,
  `invariant(
  !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")`,
  `invariant(
  !buildNormalizer.includes("normalizeClubStartupLifecycle")
    && !buildNormalizer.includes("clubStartupArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")`,
  "Filters Club startup build ownership assertion",
);
await writeFile(filtersPath, filters);

const titlePath = resolve(root, "validate-club-title-loading.mjs");
let title = await read("validate-club-title-loading.mjs");
title = replaceRequired(
  title,
  `  routeSplitter,
  clubStartupLifecycle,
  bootstrap,`,
  `  routeSplitter,
  buildNormalizer,
  bootstrap,`,
  "Club title startup binding",
);
title = replaceRequired(
  title,
  '  read("./modules/app-core-club-startup-lifecycle.js"),',
  '  read("./modules/app-core-build-normalizer.js"),',
  "Club title startup file read",
);
title = replaceRequired(
  title,
  `excludes(routeSplitter, "!important", "Club route ownership must not add CSS priority overrides.");
excludes(clubStartupLifecycle, "!important", "Club startup ownership must not add CSS priority overrides.");
excludes(loadingCss, "!important", "Club first-paint visibility must not use !important.");`,
  `excludes(routeSplitter, "!important", "Club route ownership must not add CSS priority overrides.");
excludes(buildNormalizer, "normalizeClubStartupLifecycle", "Build composition must not rewrite source-owned Club startup behavior.");
excludes(buildNormalizer, "clubStartupArtifacts", "The obsolete Club startup build artifact must stay removed.");
excludes(loadingCss, "!important", "Club first-paint visibility must not use !important.");`,
  "Club title build ownership assertion",
);
await writeFile(titlePath, title);

console.log("Updated Club startup source-ownership validators.");
