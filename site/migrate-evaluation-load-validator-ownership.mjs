// Temporary one-shot validator ownership migration; removed by its workflow before commit.
// Trigger after the workflow exists on this branch.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const files = [
  "validate-global-search-open-lifecycle.mjs",
  "validate-pager-current-page.mjs",
  "validate-table-loading-state.mjs",
  "validate-home-summary-first-paint.mjs",
  "validate-table-filter-selection-lifecycle.mjs",
  "validate-filter-popup-interactions.mjs",
];

const inlineBefore = '&& buildNormalizer.includes("const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(clubSortArtifacts);")';
const inlineAfter = `&& !buildNormalizer.includes("normalizeEvaluationLoadLifecycle")
    && !buildNormalizer.includes("evaluationLoadArtifacts")
    && buildNormalizer.includes("return normalizeEvaluationSavedValuationCache(clubSortArtifacts);")`;

const homeBefore = `includes(
  buildNormalizer,
  "const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(clubSortArtifacts);",
  "Later Evaluation Load normalization must consume Club-sort artifacts directly after recent-readiness becomes source-owned.",
);`;
const homeAfter = `excludes(buildNormalizer, "normalizeEvaluationLoadLifecycle", "Build normalization must not rewrite Evaluation Load behavior.");
excludes(buildNormalizer, "evaluationLoadArtifacts", "The obsolete Evaluation Load build artifact must stay removed.");
includes(
  buildNormalizer,
  "return normalizeEvaluationSavedValuationCache(clubSortArtifacts);",
  "Saved Valuation Cache normalization must consume Club-sort artifacts directly after Evaluation Load becomes source-owned.",
);`;

const filterRequiredBefore = `for (const required of [
  "const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(clubSortArtifacts);",
]) {`;
const filterRequiredAfter = `for (const required of [
  "return normalizeEvaluationSavedValuationCache(clubSortArtifacts);",
]) {`;
const filterInvariantBefore = `invariant(
  !buildNormalizer.includes("normalizeEvaluationRecentReadiness")`;
const filterInvariantAfter = `invariant(
  !buildNormalizer.includes("normalizeEvaluationLoadLifecycle")
    && !buildNormalizer.includes("evaluationLoadArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationRecentReadiness")`;

for (const relativePath of files) {
  const path = resolve(siteRoot, relativePath);
  const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
  let updated = source;

  if (updated.includes(inlineBefore)) {
    updated = updated.replace(inlineBefore, inlineAfter);
  } else if (relativePath === "validate-home-summary-first-paint.mjs" && updated.includes(homeBefore)) {
    updated = updated.replace(homeBefore, homeAfter);
  } else if (relativePath === "validate-filter-popup-interactions.mjs"
      && updated.includes(filterRequiredBefore)
      && updated.includes(filterInvariantBefore)) {
    updated = updated
      .replace(filterRequiredBefore, filterRequiredAfter)
      .replace(filterInvariantBefore, filterInvariantAfter);
  } else {
    throw new Error(`Missing Evaluation Load build handoff assertion in ${relativePath}.`);
  }

  await writeFile(path, updated);
}

console.log(`Updated Evaluation Load source-ownership assertions in ${files.length} validators.`);
