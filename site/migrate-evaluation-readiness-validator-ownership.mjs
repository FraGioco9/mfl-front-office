// Temporary one-shot validator ownership migration; removes itself before commit.
// Trigger after the workflow exists on this branch.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const replaceRequired = async (relativePath, before, after, label) => {
  const path = resolve(siteRoot, relativePath);
  const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
  if (!source.includes(before)) throw new Error(`Missing ${label} in ${relativePath}.`);
  await writeFile(path, source.replace(before, after));
};

await replaceRequired(
  "validate-pager-current-page.mjs",
  `    && !buildNormalizer.includes("normalizeGlobalSearchOpenLifecycle")
    && !buildNormalizer.includes("globalSearchArtifacts")
    && buildNormalizer.includes("const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(clubSortArtifacts);"),
  "Build normalization must flow directly from stats navigation into Home summary without editable-pager or Table control-cell rewriting.",`,
  `    && !buildNormalizer.includes("normalizeGlobalSearchOpenLifecycle")
    && !buildNormalizer.includes("globalSearchArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationRecentReadiness")
    && !buildNormalizer.includes("evaluationRecentArtifacts")
    && buildNormalizer.includes("const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(clubSortArtifacts);"),
  "Build normalization must flow directly through source-owned readiness behavior without editable-pager or Table control-cell rewriting.",`,
  "Pager build ownership assertion",
);

await replaceRequired(
  "validate-table-filter-selection-lifecycle.mjs",
  `    && !buildNormalizer.includes("normalizeStatsNavigationLifecycle")
    && !buildNormalizer.includes("statsNavigationArtifacts")
    && buildNormalizer.includes("const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(clubSortArtifacts);"),
  "Build normalization must not inject page/view filter, editable-pager, Table control-cell, or Stats navigation behavior.",`,
  `    && !buildNormalizer.includes("normalizeStatsNavigationLifecycle")
    && !buildNormalizer.includes("statsNavigationArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationRecentReadiness")
    && !buildNormalizer.includes("evaluationRecentArtifacts")
    && buildNormalizer.includes("const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(clubSortArtifacts);"),
  "Build normalization must not inject page/view filter, editable-pager, Table control-cell, Stats navigation, or Evaluation recent-readiness behavior.",`,
  "Table filter-selection build ownership assertion",
);

await replaceRequired(
  "validate-table-loading-state.mjs",
  `    && !buildNormalizer.includes("normalizeGlobalSearchOpenLifecycle")
    && !buildNormalizer.includes("globalSearchArtifacts")
    && buildNormalizer.includes("const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(clubSortArtifacts);"),
  "The build normalizer must not inject Table request loading or control-cell behavior after source authoring.",`,
  `    && !buildNormalizer.includes("normalizeGlobalSearchOpenLifecycle")
    && !buildNormalizer.includes("globalSearchArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationRecentReadiness")
    && !buildNormalizer.includes("evaluationRecentArtifacts")
    && buildNormalizer.includes("const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(clubSortArtifacts);"),
  "The build normalizer must not inject Table request loading, control-cell, or Evaluation recent-readiness behavior after source authoring.",`,
  "Table loading build ownership assertion",
);

await rm(resolve(siteRoot, "migrate-evaluation-readiness-validator-ownership.mjs"));
await rm(resolve(siteRoot, "../.github/workflows/evaluation-readiness-validator-ownership-migration.yml"));
console.log("Stale Evaluation recent-readiness validator ownership assertions migrated.");
