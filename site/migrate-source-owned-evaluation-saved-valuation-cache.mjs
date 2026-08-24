// Temporary one-shot source migration; remove before merge after the source rewrite commits.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

const lifecycle = await read("modules/app-core-evaluation-saved-valuation-cache.js");

function constantValue(name) {
  const marker = `const ${name} = `;
  const markerIndex = lifecycle.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing Saved Valuation Cache constant ${name}.`);
  const start = markerIndex + marker.length;
  const quote = lifecycle[start];
  if (quote !== "`" && quote !== '"' && quote !== "'") throw new Error(`Unsupported literal for ${name}.`);
  let raw = "";
  for (let index = start + 1; index < lifecycle.length; index += 1) {
    const char = lifecycle[index];
    if (char === "\\") {
      if (index + 1 >= lifecycle.length) throw new Error(`Unterminated escape in ${name}.`);
      raw += char + lifecycle[index + 1];
      index += 1;
      continue;
    }
    if (char === quote) return Function(`"use strict"; return ${quote}${raw}${quote};`)();
    raw += char;
  }
  throw new Error(`Unterminated literal for ${name}.`);
}

const replacements = [
  ["SAVED_CACHE_ENTRY", "SAVED_CACHE_ENTRY_WITH_VALUATION"],
  ["SAVED_LIST_VALUATION", "SAVED_LIST_VALUATION_FROM_CACHE"],
  ["SAVED_LOAD_AFTER_PLAYER_HYDRATION", "SAVED_LOAD_AFTER_PLAYER_HYDRATION_WITH_CACHE_REFRESH"],
];

let core = await read("modules/app-core.js");
for (const [beforeName, afterName] of replacements) {
  core = replaceRequired(core, constantValue(beforeName), constantValue(afterName), `${beforeName} source ownership`);
}
await writeFile(resolve(siteRoot, "modules/app-core.js"), core);

let build = await read("modules/app-core-build-normalizer.js");
build = replaceRequired(
  build,
  'import { normalizeEvaluationSavedValuationCache } from "./app-core-evaluation-saved-valuation-cache.js";\n',
  "",
  "Saved Valuation Cache normalizer import",
);
build = replaceRequired(
  build,
  "  return normalizeEvaluationSavedValuationCache(clubSortArtifacts);",
  "  return clubSortArtifacts;",
  "Saved Valuation Cache build stage",
);
await writeFile(resolve(siteRoot, "modules/app-core-build-normalizer.js"), build);
await rm(resolve(siteRoot, "modules/app-core-evaluation-saved-valuation-cache.js"));

const inlineValidatorFiles = [
  "validate-global-search-open-lifecycle.mjs",
  "validate-pager-current-page.mjs",
  "validate-table-filter-selection-lifecycle.mjs",
  "validate-table-loading-state.mjs",
  "validate-modal-entrance-lifecycle.mjs",
];
const inlineBefore = '&& buildNormalizer.includes("return normalizeEvaluationSavedValuationCache(clubSortArtifacts);")';
const inlineAfter = `&& !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")
    && buildNormalizer.includes("return clubSortArtifacts;")`;
for (const relativePath of inlineValidatorFiles) {
  const path = resolve(siteRoot, relativePath);
  const source = await read(relativePath);
  await writeFile(path, replaceRequired(source, inlineBefore, inlineAfter, `${relativePath} Saved Valuation Cache handoff assertion`));
}

const homePath = resolve(siteRoot, "validate-home-summary-first-paint.mjs");
let home = await read("validate-home-summary-first-paint.mjs");
home = replaceRequired(
  home,
  `includes(
  buildNormalizer,
  "return normalizeEvaluationSavedValuationCache(clubSortArtifacts);",
  "Saved Valuation Cache normalization must consume Club-sort artifacts directly after Evaluation Load becomes source-owned.",
);`,
  `excludes(buildNormalizer, "normalizeEvaluationSavedValuationCache", "Build normalization must not rewrite Saved Valuation Cache behavior.");
includes(
  buildNormalizer,
  "return clubSortArtifacts;",
  "Club-sort artifacts must be the final application-core build output after Saved Valuation Cache becomes source-owned.",
);`,
  "Home first-paint Saved Valuation Cache ownership assertion",
);
await writeFile(homePath, home);

const filterPath = resolve(siteRoot, "validate-filter-popup-interactions.mjs");
let filters = await read("validate-filter-popup-interactions.mjs");
filters = replaceRequired(
  filters,
  `for (const required of [
  "return normalizeEvaluationSavedValuationCache(clubSortArtifacts);",
]) {`,
  `for (const required of [
  "return clubSortArtifacts;",
]) {`,
  "Filters build terminal artifact assertion",
);
filters = replaceRequired(
  filters,
  `invariant(
  !buildNormalizer.includes("normalizeEvaluationLoadLifecycle")
    && !buildNormalizer.includes("evaluationLoadArtifacts")`,
  `invariant(
  !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")
    && !buildNormalizer.includes("normalizeEvaluationLoadLifecycle")
    && !buildNormalizer.includes("evaluationLoadArtifacts")`,
  "Filters Saved Valuation Cache removal assertion",
);
await writeFile(filterPath, filters);

const loadCachePath = resolve(siteRoot, "validate-evaluation-load-cache.mjs");
let loadCache = await read("validate-evaluation-load-cache.mjs");
loadCache = replaceRequired(
  loadCache,
  `const evaluationCore = String(artifacts.routeChunks?.evaluation || "");`,
  `const evaluationCore = String(artifacts.routeChunks?.evaluation || "");

invariant(
  !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")
    && buildNormalizer.includes("return clubSortArtifacts;"),
  "Saved Evaluation valuation/cache behavior must be source-owned with Club sort as the terminal build artifact.",
);`,
  "Evaluation Load cache source-ownership assertion",
);
await writeFile(loadCachePath, loadCache);

console.log(`Moved ${replacements.length} Saved Valuation Cache rewrites into canonical source and updated ownership validators.`);
