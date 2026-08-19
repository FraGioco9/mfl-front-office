import { readFile, writeFile } from "node:fs/promises";

async function replaceInFile(path, replacements) {
  const filePath = new URL(path, import.meta.url);
  let source = await readFile(filePath, "utf8");
  for (const [before, after, label] of replacements) {
    if (!source.includes(before)) throw new Error(`Late validation migration pattern missing (${label}) in ${path}`);
    source = source.replace(before, after);
  }
  await writeFile(filePath, source, "utf8");
}

await replaceInFile("./validate-bootstrap-ownership.mjs", [
  [
    "controller.beginIntent?.(target",
    "navigationController()?.beginIntent?.(target",
    "navigation intent delegation",
  ],
]);

await replaceInFile("./validate-app-core-startup-handshake.mjs", [
  [
    'import { normalizeStartupDataDependencies } from "./modules/app-core-startup-data-normalizer.js";\n',
    "",
    "startup normalizer import",
  ],
  [
    [
      "const [entry, routeNormalizer, applicationCore] = await Promise.all([",
      '  read("./modules/app-entry.js"),',
      '  read("./modules/app-core-route-runtime-normalizer.js"),',
      '  read("./modules/app-core.js"),',
      "]);",
    ].join("\n"),
    [
      "const [entry, applicationCore] = await Promise.all([",
      '  read("./modules/app-entry.js"),',
      '  read("./modules/app-core.js"),',
      "]);",
    ].join("\n"),
    "startup source reads",
  ],
  [
    [
      "includes(",
      "  routeNormalizer,",
      '  "window.__mflMarkApplicationCoreLoaded?.();",',
      '  "The generated application core must explicitly mark successful initialization.",',
      ");",
      "includes(",
      "  routeNormalizer,",
      '  "window.__mflAppStartPromise = (async () => {",',
      '  "The generated application core must publish its startup promise.",',
      ");",
      'const markerIndex = routeNormalizer.indexOf("window.__mflMarkApplicationCoreLoaded?.();");',
      'const startupPromiseIndex = routeNormalizer.indexOf("window.__mflAppStartPromise = (async () => {");',
    ].join("\n"),
    [
      "includes(",
      "  applicationCore,",
      '  "window.__mflMarkApplicationCoreLoaded?.();",',
      '  "The authored application core must explicitly mark successful initialization.",',
      ");",
      "includes(",
      "  applicationCore,",
      '  "window.__mflAppStartPromise = (async () => {",',
      '  "The authored application core must publish its startup promise.",',
      ");",
      'const markerIndex = applicationCore.indexOf("window.__mflMarkApplicationCoreLoaded?.();");',
      'const startupPromiseIndex = applicationCore.indexOf("window.__mflAppStartPromise = (async () => {");',
    ].join("\n"),
    "startup marker ownership",
  ],
  [
    "const normalizedStartup = normalizeStartupDataDependencies(applicationCore);",
    "const normalizedStartup = applicationCore;",
    "canonical startup source",
  ],
]);

const evalPath = new URL("./validate-eval-ownership.mjs", import.meta.url);
let evalSource = await readFile(evalPath, "utf8");
const evalReadBefore = [
  "  buildAppCore,",
  "  routeRuntimeNormalizer,",
  "  appCoreSource,",
].join("\n");
const evalReadAfter = [
  "  buildAppCore,",
  "  appCoreSource,",
].join("\n");
if (!evalSource.includes(evalReadBefore)) throw new Error("Eval ownership route-normalizer binding was not found.");
evalSource = evalSource.replace(evalReadBefore, evalReadAfter);
const evalPromiseBefore = [
  '  read("./build-app-core.mjs"),',
  '  read("./modules/app-core-route-runtime-normalizer.js"),',
  '  read("./modules/app-core.js"),',
].join("\n");
const evalPromiseAfter = [
  '  read("./build-app-core.mjs"),',
  '  read("./modules/app-core.js"),',
].join("\n");
if (!evalSource.includes(evalPromiseBefore)) throw new Error("Eval ownership route-normalizer read was not found.");
evalSource = evalSource.replace(evalPromiseBefore, evalPromiseAfter);

const legacyEvalOwnerBlockStart = evalSource.indexOf("invariant(\n  routeRuntimeNormalizer.includes(\"window.__mflCoreContracts = Object.freeze({\"),");
const legacyEvalOwnerBlockEnd = evalSource.indexOf("invariant(\n  !buildAppCore.includes(\"function removeLegacyEvaluationRouteStability(source)\"),", legacyEvalOwnerBlockStart);
if (legacyEvalOwnerBlockStart < 0 || legacyEvalOwnerBlockEnd <= legacyEvalOwnerBlockStart) {
  throw new Error("Legacy eval ownership normalizer block was not found.");
}
const canonicalEvalOwnerBlock = [
  "invariant(",
  '  appCoreSource.includes("window.__mflCoreContracts = Object.freeze({"),',
  '  "The authored application core must publish one immutable lexical-owner contract before startup.",',
  ");",
  "invariant(",
  '  !appCoreSource.includes("__mflEvaluationRouteStability") && !appCoreSource.includes("evaluationRouteStabilityStyles"),',
  '  "The authored application core must not retain the historical Evaluation stability repair.",',
  ");",
  "for (const contractMethod of [",
  '  "ensureCanonicalTableHeader",',
  '  "installTableLoadingOwners",',
  '  "installSearchMatching",',
  '  "renderGlobalSearchResults",',
  '  "renderCurrentEvaluationSearchResults",',
  '  "resetCurrentEvaluationSelection",',
  '  "applySearchPayload",',
  '  "invalidateDatabaseSearch",',
  '  "evaluationRecentPlayerIds",',
  '  "setEvaluationRecentPlayerIds",',
  '  "evaluationSearchEntry",',
  '  "buildEvaluationRecentEntries",',
  '  "persistEvaluationRecentPlayerIds",',
  '  "installEvaluationRecentRowsOwner",',
  '  "installEvaluationEmptySearchOwner",',
  '  "installEvaluationRecentWriteOwner",',
  '  "installEvaluationRecentStateOwnership",',
  "]) {",
  "  invariant(",
  "    appCoreSource.includes(contractMethod),",
  "    `Application-core contract must expose ${contractMethod}.`,",
  "  );",
  "}",
  "invariant(",
  '  !appCoreSource.includes("stableRenderTableLoadingShell"),',
  '  "Canonical core contracts must not recreate the obsolete renderTableLoadingShell monkey patch.",',
  ");",
  "",
].join("\n");
evalSource = `${evalSource.slice(0, legacyEvalOwnerBlockStart)}${canonicalEvalOwnerBlock}${evalSource.slice(legacyEvalOwnerBlockEnd)}`;
await writeFile(evalPath, evalSource, "utf8");
