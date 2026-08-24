// Temporary one-shot migration; remove before merge.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

let core = await read("modules/app-core.js");
core = replaceRequired(
  core,
  `evaluationSearchInput.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (!isPlainEvaluationUrl() && document.activeElement !== evaluationSearchInput && !evaluationSearchResults.contains(document.activeElement)) {
      evaluationSearchResults.hidden = true;
      evaluationSearchResults.replaceChildren();
    }
  }, 120);
});\n`,
  "",
  "Evaluation blur result-hide handler",
);
core = replaceRequired(
  core,
  `function clearEvaluationSearch() {
  evaluationSearchInput.value = "";
  resetEvaluationSelection();
  renderEvaluationSearchResults();
  evaluationSearchInput.focus();
}`,
  `function clearEvaluationSearch() {
  evaluationSearchInput.value = "";
  resetEvaluationSelection();
  renderEvaluationSearchResults();
  window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();
}`,
  "Evaluation clear search focus owner",
);
core = replaceRequired(
  core,
  `evaluationSearchClearButton.addEventListener("click", clearEvaluationSearch);`,
  `evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());
evaluationSearchClearButton.addEventListener("click", clearEvaluationSearch);`,
  "Evaluation clear pointer focus ownership",
);
await writeFile(resolve(siteRoot, "modules/app-core.js"), core);

let build = await read("modules/app-core-build-normalizer.js");
build = replaceRequired(
  build,
  'import { normalizeEvaluationSearchLifecycle } from "./app-core-evaluation-search-lifecycle.js";\n',
  "",
  "Evaluation search normalizer import",
);
build = replaceRequired(
  build,
  `  const evaluationArtifacts = splitEvaluationApplicationCoreRuntime(evaluationRouteArtifacts);
  const evaluationSearchArtifacts = normalizeEvaluationSearchLifecycle(evaluationArtifacts);
  const settingsArtifacts = splitSettingsApplicationCoreRuntime(evaluationSearchArtifacts);`,
  `  const evaluationArtifacts = splitEvaluationApplicationCoreRuntime(evaluationRouteArtifacts);
  const settingsArtifacts = splitSettingsApplicationCoreRuntime(evaluationArtifacts);`,
  "Evaluation search build stage",
);
await writeFile(resolve(siteRoot, "modules/app-core-build-normalizer.js"), build);

let routeOwnership = await read("validate-evaluation-route-ownership.mjs");
routeOwnership = replaceRequired(
  routeOwnership,
  `const evaluationRouteIndex = buildNormalizer.indexOf("normalizeEvaluationRouteLifecycle(routeArtifacts)");
const evaluationSplitIndex = buildNormalizer.indexOf("splitEvaluationApplicationCoreRuntime(evaluationRouteArtifacts)");
const evaluationSearchIndex = buildNormalizer.indexOf("normalizeEvaluationSearchLifecycle(evaluationArtifacts)");
const settingsSplitIndex = buildNormalizer.indexOf("splitSettingsApplicationCoreRuntime(evaluationSearchArtifacts)");
invariant(
  evaluationRouteIndex >= 0
    && evaluationSplitIndex > evaluationRouteIndex
    && evaluationSearchIndex > evaluationSplitIndex
    && settingsSplitIndex > evaluationSearchIndex,
  "Evaluation routing must preserve query identity before route splitting, then normalize search before later route splitters.",
);`,
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
  "Evaluation route ownership build ordering assertion",
);
await writeFile(resolve(siteRoot, "validate-evaluation-route-ownership.mjs"), routeOwnership);

let searchValidator = await read("validate-evaluation-search-lifecycle.mjs");
const generatedBlurCheck = `invariant(
  !generatedEvaluationCore.includes('evaluationSearchInput.addEventListener("blur", () => {'),
  "The generated Evaluation route core must not install a second blur handler that hides typed results.",
);`;
const sourceOwnershipCheck = `${generatedBlurCheck}
invariant(
  !appCoreSource.includes('evaluationSearchInput.addEventListener("blur", () => {')
    && appCoreSource.includes("window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();")
    && appCoreSource.includes('evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());'),
  "Canonical Evaluation source must own typed-result persistence and Clear focus behavior before route splitting.",
);`;
searchValidator = replaceRequired(
  searchValidator,
  generatedBlurCheck,
  sourceOwnershipCheck,
  "Evaluation search generated blur validator",
);
await writeFile(resolve(siteRoot, "validate-evaluation-search-lifecycle.mjs"), searchValidator);

await rm(resolve(siteRoot, "modules/app-core-evaluation-search-lifecycle.js"));
console.log("Canonical Evaluation search interaction lifecycle migration applied.");
