// Temporary one-shot migration; remove before merge.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeEvaluationRecentReadiness } from "./modules/app-core-evaluation-recent-readiness.js";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

const sourceCore = await read("modules/app-core.js");
const migrated = normalizeEvaluationRecentReadiness({ core: sourceCore, routeChunks: {} });
const migratedCore = String(migrated?.core || "");
if (!migratedCore || migratedCore === sourceCore) {
  throw new Error("Evaluation recent-readiness migration did not change canonical source.");
}
await writeFile(resolve(siteRoot, "modules/app-core.js"), migratedCore);

let build = await read("modules/app-core-build-normalizer.js");
build = replaceRequired(
  build,
  'import { normalizeEvaluationRecentReadiness } from "./app-core-evaluation-recent-readiness.js";\n',
  "",
  "Evaluation recent-readiness normalizer import",
);
build = replaceRequired(
  build,
  `  const clubSortArtifacts = normalizeClubSortLifecycle(clubStartupArtifacts);
  const evaluationRecentArtifacts = normalizeEvaluationRecentReadiness(clubSortArtifacts);
  const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(evaluationRecentArtifacts);`,
  `  const clubSortArtifacts = normalizeClubSortLifecycle(clubStartupArtifacts);
  const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(clubSortArtifacts);`,
  "Evaluation recent-readiness build stage",
);
await writeFile(resolve(siteRoot, "modules/app-core-build-normalizer.js"), build);

await rm(resolve(siteRoot, "modules/app-core-evaluation-recent-readiness.js"));
console.log("Canonical Evaluation recent-readiness migration applied.");
