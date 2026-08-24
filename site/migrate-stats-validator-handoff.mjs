// Temporary one-shot validator migration; remove before merge after it commits the handoff updates.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const files = (await readdir(siteRoot)).filter((name) => /^validate.*\.mjs$/.test(name));
let changedFiles = 0;

for (const file of files) {
  const path = resolve(siteRoot, file);
  const original = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
  let source = original;
  source = source.replaceAll('  "const statsNavigationArtifacts = Object.freeze({",\n', "");
  source = source.replaceAll('  \'core: normalizeStatsNavigationLifecycle(String(clubSortArtifacts.core || "")),\',\n', "");
  source = source.replaceAll(
    '"const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(statsNavigationArtifacts);"',
    '"const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(clubSortArtifacts);"',
  );
  source = source.replaceAll(
    'const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(statsNavigationArtifacts);',
    'const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(clubSortArtifacts);',
  );
  if (source !== original) {
    await writeFile(path, source);
    changedFiles += 1;
  }
}

if (!changedFiles) throw new Error("No stale Stats navigation build-handoff assertions were found.");
console.log(`Updated ${changedFiles} validator files for source-owned Stats navigation.`);
