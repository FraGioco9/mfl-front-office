import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [appCoreSource, splitter, buildNormalizer] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-evaluation-chunk.js"),
  read("./modules/app-core-build-normalizer.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const shared = String(artifacts.core || "");
const evaluation = String(artifacts.routeChunks?.evaluation || "");

invariant(
  !shared.includes("const evaluationConversions = {"),
  "Evaluation discount-rate conversion data must not remain in shared core.",
);
invariant(
  !evaluation.includes("const evaluationConversions = {"),
  "Evaluation route core must not retain legacy hard-coded discount-rate conversion data.",
);
invariant(
  !shared.includes("function renderEvaluationMflPerUsdControl("),
  "Evaluation MFL/USD UI rendering must not remain in shared core.",
);
invariant(
  evaluation.includes("function renderEvaluationMflPerUsdControl("),
  "Evaluation route core must own MFL/USD UI rendering.",
);
invariant(
  !shared.includes("function formatAdvancedPlayerTableValue(value) {"),
  "Evaluation advanced-settings UI ownership must not remain in shared core.",
);
invariant(
  evaluation.includes("function formatAdvancedPlayerTableValue(value) {"),
  "Evaluation route core must own advanced-settings UI behavior.",
);
invariant(
  !shared.includes('advancedSettingsButton.addEventListener("click", openAdvancedSettings);'),
  "Evaluation advanced-settings primary bindings must not remain in shared core.",
);
invariant(
  evaluation.includes('advancedSettingsButton.addEventListener("click", openAdvancedSettings);'),
  "Evaluation route core must own advanced-settings primary bindings.",
);
invariant(
  !shared.includes('window.addEventListener("resize", updateAdvancedPlayerTableClip);'),
  "Evaluation advanced-settings control bindings must not remain in shared core.",
);
invariant(
  evaluation.includes('window.addEventListener("resize", updateAdvancedPlayerTableClip);'),
  "Evaluation route core must own advanced-settings control bindings.",
);
invariant(
  !shared.includes('evaluationSearchInput.addEventListener("input", handleEvaluationSearchInput);'),
  "Evaluation search/settings bindings must not remain in shared core.",
);
invariant(
  evaluation.includes('evaluationSearchInput.addEventListener("input", handleEvaluationSearchInput);'),
  "Evaluation route core must own search/settings bindings.",
);
invariant(
  !evaluation.includes('evaluationSearchInput.addEventListener("blur", () => {'),
  "Evaluation route core must not hide typed search results on blur.",
);
invariant(
  !shared.includes('setupBackdropClickClose(advancedSettingsModal, closeAdvancedSettings);'),
  "Evaluation advanced-settings backdrop binding must not remain in shared core.",
);
invariant(
  evaluation.includes('setupBackdropClickClose(advancedSettingsModal, closeAdvancedSettings);'),
  "Evaluation route core must own its advanced-settings backdrop binding.",
);
invariant(
  !shared.includes("function evaluationDiscountRateValue("),
  "Evaluation discount-rate helper must not remain in shared core.",
);
invariant(
  evaluation.includes("function evaluationDiscountRateValue("),
  "Evaluation route core must own discount-rate helper dependencies.",
);
invariant(
  !shared.includes("function formatEvaluationRate("),
  "Evaluation rate formatting helper must not remain in shared core.",
);
invariant(
  evaluation.includes("function formatEvaluationRate("),
  "Evaluation route core must own rate formatting helper dependencies.",
);
invariant(
  !shared.includes("function clearEvaluationSearch("),
  "Evaluation search helper must not remain in shared core.",
);
invariant(
  evaluation.includes("function clearEvaluationSearch("),
  "Evaluation route core must own its search helper dependencies.",
);
invariant(
  !shared.includes("function queueEvaluationSettingsSave("),
  "Evaluation settings save helper must not remain in shared core.",
);
invariant(
  evaluation.includes("function queueEvaluationSettingsSave("),
  "Evaluation route core must own settings save helper dependencies.",
);
invariant(
  shared.includes('state.currentPage === "evaluation" && typeof renderEvaluationMflPerUsdControl === "function"'),
  "Wallet preference hydration must refresh Evaluation UI only when its route owner is already loaded.",
);
invariant(
  shared.includes('window.addEventListener("storage", syncRecentSearchStateFromStorage);'),
  "Cross-route recent-search storage synchronization must remain shared.",
);
invariant(
  shared.includes('playerSearchInput.addEventListener("input", renderSearchResults);'),
  "Global player search input ownership must remain shared.",
);
invariant(
  shared.includes('event.key === "Escape" && !advancedSettingsModal.hidden'),
  "The shared Escape dispatcher must retain the Evaluation modal branch.",
);
invariant(
  shared.includes('event.key === "Enter" && !advancedSettingsModal.hidden'),
  "The shared Enter dispatcher must retain the Evaluation modal branch.",
);
invariant(
  splitter.includes("export function splitEvaluationApplicationCoreRuntime(artifacts)"),
  "Evaluation ownership must use a dedicated structural splitter stage.",
);
invariant(
  appCoreSource.includes('const search = queryIndex >= 0 ? requestedPath.slice(queryIndex + 1) : "";')
    && appCoreSource.includes("...(savedId ? { savedId } : {})")
    && appCoreSource.includes("...(shareId ? { shareId } : {})")
    && appCoreSource.includes("async function recoverInvalidEvaluationLink()")
    && appCoreSource.includes("async function applySharedEvaluationPayload(payload, options = {})")
    && appCoreSource.includes("await applySharedEvaluationPayload(data.payload, {")
    && appCoreSource.includes("mflPerUsdRevisionAtLoadStart: evaluationMflPerUsdRevisionAtLoadStart,"),
  "Canonical Evaluation source must own route identity, invalid-link recovery, and final saved/shared payload rendering with latest MFL/USD commit ownership.",
);
invariant(
  shared.includes('const requestedPath = String(path || "");')
    && shared.includes('path: search ? `/evaluation?${search}` : "/evaluation"')
    && shared.includes('const explicitPath = String(options.path || "");'),
  "Built shared routing must preserve the exact Evaluation URL through refresh and page-path resolution.",
);
const routeSplitIndex = buildNormalizer.indexOf("splitApplicationCoreRuntime(canonicalSource)");
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
);

new Function(shared);
new Function(evaluation);
console.log("Evaluation refresh URLs, startup UI, persistent typed-search results, search/settings bindings, advanced settings, and dependency-closed helpers are route-owned while shared persistence and Player focus ownership remain eager.");
