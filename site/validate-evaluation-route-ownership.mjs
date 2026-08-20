import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hasFunction = (source, name) => new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(source);

const [coreSource, splitter, buildNormalizer] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-evaluation-chunk.js"),
  read("./modules/app-core-build-normalizer.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const shared = String(artifacts.core || "");
const evaluation = String(artifacts.routeChunks?.evaluation || "");

const advancedFunctions = [
  "formatAdvancedPlayerTableValue",
  "renderAdvancedPlayerTable",
  "updateAdvancedPlayerTableClip",
  "syncAdvancedSettingsValues",
  "updateAdvancedRewardRateResetVisibility",
  "updateAdvancedMflUsdResetVisibility",
  "openAdvancedSettings",
  "closeAdvancedSettings",
  "toggleAdvancedLateSeasonRewards",
  "syncAdvancedRewardRateDraft",
  "syncAdvancedRewardRateDrafts",
  "applyAdvancedSettings",
  "resetAdvancedSettingsDraft",
  "discardAdvancedSettings",
  "adjustAdvancedMflUsdDraft",
  "resetAdvancedMflUsd",
  "adjustAdvancedRewardRateDraft",
  "resetAdvancedRewardRateDraft",
];

const startupAndDependencyClosedFunctions = [
  "evaluationDiscountRateValue",
  "formatEvaluationRate",
  "formatEvaluationMflPerUsd",
  "clampEvaluationRewardRate",
  "normalizeEvaluationRewardRateDraft",
  "formatEvaluationRewardRate",
  "clearEvaluationSearchFocus",
  "renderEvaluationMflPerUsdControl",
  "commitEvaluationMflPerUsd",
  "resetEvaluationMflPerUsd",
  "adjustEvaluationMflPerUsdDraft",
];

for (const name of [...advancedFunctions, ...startupAndDependencyClosedFunctions]) {
  invariant(!hasFunction(shared, name), `Evaluation route-owned function ${name} must not remain in shared core.`);
  invariant(hasFunction(evaluation, name), `Evaluation chunk must own route function ${name}.`);
}

for (const name of ["loadEvaluationMflPerUsd", "loadEvaluationLateSeasonRewardRates", "currentEvaluationSettingsPayload", "applyEvaluationSettingsPayload", "saveEvaluationSettingsLocally"]) {
  invariant(hasFunction(shared, name), `Evaluation persistence function ${name} must remain shared for wallet/startup state hydration.`);
}

const evaluationBindings = [
  'advancedSettingsButton.addEventListener("click", openAdvancedSettings);',
  'closeAdvancedSettingsButton.addEventListener("click", closeAdvancedSettings);',
  'advancedSettingsBody.addEventListener("scroll", updateAdvancedPlayerTableClip, { passive: true });',
  'advancedLateSeasonRewardsToggle?.addEventListener("click", toggleAdvancedLateSeasonRewards);',
  'window.addEventListener("resize", updateAdvancedPlayerTableClip);',
  'advancedMflUsdInput.addEventListener("input", updateAdvancedMflUsdResetVisibility);',
  'resetAdvancedSettingsButton.addEventListener("click", resetAdvancedSettingsDraft);',
  'discardAdvancedSettingsButton.addEventListener("click", discardAdvancedSettings);',
  'applyAdvancedSettingsButton.addEventListener("click", applyAdvancedSettings);',
  "setupBackdropClickClose(advancedSettingsModal, closeAdvancedSettings);",
];

for (const binding of evaluationBindings) {
  invariant(!shared.includes(binding), `Evaluation binding must not execute eagerly: ${binding}`);
  invariant(evaluation.includes(binding), `Evaluation chunk must own binding: ${binding}`);
}

invariant(
  shared.includes("  loadEvaluationMflPerUsd();\n  loadEvaluationLateSeasonRewardRates();\n  updateMenuVisibility();"),
  "Startup must hydrate Evaluation persistence state without eagerly rendering Evaluation-only UI.",
);
invariant(
  evaluation.includes("renderEvaluationMflPerUsdControl(false);\nevaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());"),
  "Evaluation route loading must initialize its MFL-per-USD control and discount-rate text.",
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
  buildNormalizer.indexOf("splitEvaluationApplicationCoreRuntime(routeArtifacts)")
    < buildNormalizer.indexOf("splitSettingsApplicationCoreRuntime(evaluationArtifacts)"),
  "Evaluation ownership must split immediately after base route extraction and before later route splitters.",
);

new Function(shared);
new Function(evaluation);
console.log("Evaluation startup UI, advanced settings, and dependency-closed helpers are lazy route-owned while persistence hydration remains shared.");
