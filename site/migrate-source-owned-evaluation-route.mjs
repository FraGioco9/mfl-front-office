// Temporary one-shot migration; remove before merge.
// Trigger after the workflow exists on this branch.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

function parseTemplateLiteral(source, start) {
  if (source[start] !== "`") throw new Error("Expected template literal.");
  let raw = "";
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      if (index + 1 >= source.length) throw new Error("Unterminated template escape.");
      raw += char + source[index + 1];
      index += 1;
      continue;
    }
    if (char === "`") {
      const value = Function(`"use strict"; return \`${raw}\`;`)();
      return { value, end: index + 1 };
    }
    raw += char;
  }
  throw new Error("Unterminated template literal.");
}

const lifecycle = await read("modules/app-core-evaluation-route-lifecycle.js");
const replacements = [];
let cursor = 0;
while (true) {
  const callStart = lifecycle.indexOf("replaceRequired(", cursor);
  if (callStart < 0) break;
  const beforeStart = lifecycle.indexOf("`", callStart);
  if (beforeStart < 0) throw new Error("Could not find Evaluation route replacement source literal.");
  const before = parseTemplateLiteral(lifecycle, beforeStart);
  const afterStart = lifecycle.indexOf("`", before.end);
  if (afterStart < 0) throw new Error("Could not find Evaluation route replacement target literal.");
  const after = parseTemplateLiteral(lifecycle, afterStart);
  replacements.push([before.value, after.value]);
  cursor = after.end;
}
if (replacements.length !== 18) {
  throw new Error(`Expected 18 Evaluation route replacements, found ${replacements.length}.`);
}

let core = await read("modules/app-core.js");
replacements.forEach(([before, after], index) => {
  core = replaceRequired(core, before, after, `Evaluation route source replacement ${index + 1}`);
});
await writeFile(resolve(siteRoot, "modules/app-core.js"), core);

let build = await read("modules/app-core-build-normalizer.js");
build = replaceRequired(
  build,
  'import { normalizeEvaluationRouteLifecycle } from "./app-core-evaluation-route-lifecycle.js";\n',
  "",
  "Evaluation route normalizer import",
);
build = replaceRequired(
  build,
  `  const routeArtifacts = splitApplicationCoreRuntime(canonicalSource);
  const evaluationRouteArtifacts = normalizeEvaluationRouteLifecycle(routeArtifacts);
  const evaluationArtifacts = splitEvaluationApplicationCoreRuntime(evaluationRouteArtifacts);`,
  `  const routeArtifacts = splitApplicationCoreRuntime(canonicalSource);
  const evaluationArtifacts = splitEvaluationApplicationCoreRuntime(routeArtifacts);`,
  "Evaluation route build stage",
);
await writeFile(resolve(siteRoot, "modules/app-core-build-normalizer.js"), build);

let validator = await read("validate-evaluation-route-ownership.mjs");
validator = replaceRequired(
  validator,
  `const [appCoreSource, splitter, routeLifecycle, buildNormalizer] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-evaluation-chunk.js"),
  read("./modules/app-core-evaluation-route-lifecycle.js"),
  read("./modules/app-core-build-normalizer.js"),
]);`,
  `const [appCoreSource, splitter, buildNormalizer] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-evaluation-chunk.js"),
  read("./modules/app-core-build-normalizer.js"),
]);`,
  "Evaluation route ownership validator inputs",
);
validator = replaceRequired(
  validator,
  `invariant(
  routeLifecycle.includes('const search = queryIndex >= 0 ? requestedPath.slice(queryIndex + 1) : "";')
    && routeLifecycle.includes("...(savedId ? { savedId } : {})")
    && routeLifecycle.includes("...(shareId ? { shareId } : {})"),
  "Evaluation route lifecycle must extract and retain player, saved, and shared query identity.",
);`,
  `invariant(
  appCoreSource.includes('const search = queryIndex >= 0 ? requestedPath.slice(queryIndex + 1) : "";')
    && appCoreSource.includes("...(savedId ? { savedId } : {})")
    && appCoreSource.includes("...(shareId ? { shareId } : {})")
    && appCoreSource.includes("async function recoverInvalidEvaluationLink()")
    && appCoreSource.includes("await applySharedEvaluationPayload(data.payload);"),
  "Canonical Evaluation source must own route identity, invalid-link recovery, and final saved/shared payload rendering.",
);`,
  "Evaluation route lifecycle source assertion",
);
validator = replaceRequired(
  validator,
  `const evaluationRouteIndex = buildNormalizer.indexOf("normalizeEvaluationRouteLifecycle(routeArtifacts)");
const evaluationSplitIndex = buildNormalizer.indexOf("splitEvaluationApplicationCoreRuntime(evaluationRouteArtifacts)");
const settingsSplitIndex = buildNormalizer.indexOf("splitSettingsApplicationCoreRuntime(evaluationArtifacts)");
invariant(
  evaluationRouteIndex >= 0
    && evaluationSplitIndex > evaluationRouteIndex
    && settingsSplitIndex > evaluationSplitIndex
    && !buildNormalizer.includes("normalizeEvaluationSearchLifecycle")
    && !buildNormalizer.includes("evaluationSearchArtifacts"),
  "Evaluation routing must preserve query identity before route splitting, with source-owned search behavior flowing directly into later route splitters.",
);`,
  `const routeSplitIndex = buildNormalizer.indexOf("splitApplicationCoreRuntime(canonicalSource)");
const evaluationSplitIndex = buildNormalizer.indexOf("splitEvaluationApplicationCoreRuntime(routeArtifacts)");
const settingsSplitIndex = buildNormalizer.indexOf("splitSettingsApplicationCoreRuntime(evaluationArtifacts)");
invariant(
  routeSplitIndex >= 0
    && evaluationSplitIndex > routeSplitIndex
    && settingsSplitIndex > evaluationSplitIndex
    && !buildNormalizer.includes("normalizeEvaluationRouteLifecycle")
    && !buildNormalizer.includes("evaluationRouteArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationSearchLifecycle")
    && !buildNormalizer.includes("evaluationSearchArtifacts"),
  "Source-owned Evaluation route/search behavior must flow directly through structural route splitting before later splitters.",
);`,
  "Evaluation route ownership build ordering assertion",
);
await writeFile(resolve(siteRoot, "validate-evaluation-route-ownership.mjs"), validator);

await rm(resolve(siteRoot, "modules/app-core-evaluation-route-lifecycle.js"));
console.log("Canonical Evaluation route lifecycle migration applied.");
