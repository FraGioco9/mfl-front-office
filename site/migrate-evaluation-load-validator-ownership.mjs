// Temporary one-shot validator ownership migration; removed by its workflow before commit.
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
const before = '&& buildNormalizer.includes("const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(clubSortArtifacts);")';
const after = `&& !buildNormalizer.includes("normalizeEvaluationLoadLifecycle")
    && !buildNormalizer.includes("evaluationLoadArtifacts")
    && buildNormalizer.includes("return normalizeEvaluationSavedValuationCache(clubSortArtifacts);")`;

for (const relativePath of files) {
  const path = resolve(siteRoot, relativePath);
  const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
  if (!source.includes(before)) throw new Error(`Missing Evaluation Load build handoff assertion in ${relativePath}.`);
  await writeFile(path, source.replace(before, after));
}

console.log(`Updated Evaluation Load source-ownership assertions in ${files.length} validators.`);
