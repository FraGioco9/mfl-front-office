// Temporary one-shot migration; remove before merge.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { normalizeStatsNavigationLifecycle } from "./modules/app-core-stats-navigation-lifecycle.js";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");

const appCorePath = resolve(siteRoot, "modules/app-core.js");
const appCoreSource = await read("modules/app-core.js");
const normalizedCore = normalizeStatsNavigationLifecycle(appCoreSource);
if (!normalizedCore || normalizedCore === appCoreSource) throw new Error("Stats navigation migration did not change canonical app-core source.");
await writeFile(appCorePath, normalizedCore);

const buildNormalizerPath = resolve(siteRoot, "modules/app-core-build-normalizer.js");
let buildNormalizer = await read("modules/app-core-build-normalizer.js");
buildNormalizer = buildNormalizer.replace('import { normalizeStatsNavigationLifecycle } from "./app-core-stats-navigation-lifecycle.js";\n', "");
const oldComposition = `  const statsNavigationArtifacts = Object.freeze({\n    ...clubSortArtifacts,\n    core: normalizeStatsNavigationLifecycle(String(clubSortArtifacts.core || "")),\n  });\n  const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(statsNavigationArtifacts);`;
const newComposition = `  const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(clubSortArtifacts);`;
if (!buildNormalizer.includes(oldComposition)) throw new Error("Missing Stats navigation build-composition marker.");
buildNormalizer = buildNormalizer.replace(oldComposition, newComposition);
await writeFile(buildNormalizerPath, buildNormalizer);

const validatorPath = resolve(siteRoot, "validate-stats-navigation-lifecycle.mjs");
let validator = await read("validate-stats-navigation-lifecycle.mjs");
validator = validator.replace(
  'const normalizer = await readFile(new URL("./modules/app-core-build-normalizer.js", import.meta.url), "utf8");\nconst owner = await readFile(new URL("./modules/app-core-stats-navigation-lifecycle.js", import.meta.url), "utf8");',
  'const normalizer = await readFile(new URL("./modules/app-core-build-normalizer.js", import.meta.url), "utf8");\nconst source = await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8");',
);
validator = validator.replace(
  'if (!normalizer.includes("normalizeStatsNavigationLifecycle")) {\n  throw new Error("Stats navigation normalization is not part of the canonical application-core normalizer.");\n}\nif (!owner.includes(\'state.view === "stats"\') || !owner.includes(\'await setPage("database", false\')) {\n  throw new Error("Database Stats does not own an explicit canonical exit to table views.");\n}',
  'if (normalizer.includes("normalizeStatsNavigationLifecycle") || normalizer.includes("statsNavigationArtifacts")) {\n  throw new Error("Build normalization must not rewrite source-owned Stats navigation.");\n}\nif (!source.includes(\'state.view === "stats"\') || !source.includes(\'await setPage("database", false, { view: viewName, skipNavigationLoading: true })\')) {\n  throw new Error("Canonical app-core source must own the Database Stats exit to table views.");\n}',
);
await writeFile(validatorPath, validator);

await rm(resolve(siteRoot, "modules/app-core-stats-navigation-lifecycle.js"));
console.log("Canonical Stats navigation lifecycle migration applied.");
