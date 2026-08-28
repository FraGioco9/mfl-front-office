// @ts-check

import {
  extractRequiredFunctions,
  extractRequiredSection,
  finalizeSplitArtifacts,
  normalizeApplicationCoreSource,
  replaceRequired,
} from "./app-core-splitter-utils.js";
import { normalizeEvaluationSnapshotEditRoute } from "./app-core-evaluation-snapshot-edit-route.js";

const ADVANCED_SETTINGS_BACKDROP_BINDING = "setupBackdropClickClose(advancedSettingsModal, closeAdvancedSettings);";
const EVALUATION_ROUTE_INITIALIZATION = `renderEvaluationMflPerUsdControl(false);
evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());`;
const EVALUATION_LOAD_TOOLTIP_BINDING = `function attachEvaluationLoadActionTooltip(button) {
  button.addEventListener("mouseenter", () => showEvaluationLoadActionTooltip(button));
  button.addEventListener("focus", () => showEvaluationLoadActionTooltip(button));
  button.addEventListener("mouseleave", hideEvaluationLoadActionTooltip);
  button.addEventListener("blur", hideEvaluationLoadActionTooltip);
}`;
const EVALUATION_LOAD_TOOLTIP_MOBILE_BINDING = `function attachEvaluationLoadActionTooltip(button) {
  const showTooltip = () => {
    if (window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches) return;
    showEvaluationLoadActionTooltip(button);
  };
  button.addEventListener("mouseenter", showTooltip);
  button.addEventListener("focus", showTooltip);
  button.addEventListener("mouseleave", hideEvaluationLoadActionTooltip);
  button.addEventListener("blur", hideEvaluationLoadActionTooltip);
}`;

export function splitEvaluationApplicationCoreRuntime(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  let existingEvaluation = String(routeChunks.evaluation || "").replace(/\s*$/, "");
  if (!existingEvaluation) {
    throw new Error("Evaluation route chunk must exist before Evaluation ownership splitting.");
  }
  existingEvaluation = replaceRequired(
    existingEvaluation,
    EVALUATION_LOAD_TOOLTIP_BINDING,
    EVALUATION_LOAD_TOOLTIP_MOBILE_BINDING,
    "Evaluation saved-action mobile tooltip ownership",
  );

  let core = normalizeEvaluationSnapshotEditRoute(
    normalizeApplicationCoreSource(input.core, "Evaluation ownership"),
  );
  const evaluationParts = [existingEvaluation];

  core = replaceRequired(
    core,
    `  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());`,
    `  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();`,
    "Evaluation startup UI initialization",
  );

  core = replaceRequired(
    core,
    `      if (data.evaluationSettings) {
        const latestMflPerUsd = state.evaluationMflPerUsd;
        const preserveLatestMflPerUsd = state.evaluationMflPerUsdRevision !== evaluationMflPerUsdRevisionAtLoadStart;
        applyEvaluationSettingsPayload(data.evaluationSettings);
        if (preserveLatestMflPerUsd) {
          state.evaluationMflPerUsd = latestMflPerUsd;
        }
        saveEvaluationSettingsLocally();
        renderEvaluationMflPerUsdControl(false);
        if (state.currentPage === "evaluation") {
          renderEvaluationPage();
        }
      }`,
    `      if (data.evaluationSettings) {
        const latestMflPerUsd = state.evaluationMflPerUsd;
        const preserveLatestMflPerUsd = state.evaluationMflPerUsdRevision !== evaluationMflPerUsdRevisionAtLoadStart;
        applyEvaluationSettingsPayload(data.evaluationSettings);
        if (preserveLatestMflPerUsd) {
          state.evaluationMflPerUsd = latestMflPerUsd;
        }
        saveEvaluationSettingsLocally();
        if (state.currentPage === "evaluation" && typeof renderEvaluationMflPerUsdControl === "function") {
          renderEvaluationMflPerUsdControl(false);
          renderEvaluationPage();
        }
      }`,
    "Evaluation wallet-preference UI refresh",
  );

  const routeOnlyHelpers = extractRequiredFunctions(
    core,
    [
      "evaluationDiscountRateValue",
      "formatEvaluationRate",
      "formatEvaluationMflPerUsd",
      "clampEvaluationRewardRate",
      "normalizeEvaluationRewardRateDraft",
      "formatEvaluationRewardRate",
      "clearEvaluationSearch",
      "handleEvaluationSearchInput",
      "detachEvaluationSnapshotForEdit",
      "queueEvaluationSettingsSave",
    ],
    "Evaluation startup and dependency-closed helper",
  );
  core = routeOnlyHelpers.core;
  evaluationParts.push(...routeOnlyHelpers.chunks);

  let extracted = extractRequiredSection(
    core,
    "function formatAdvancedPlayerTableValue(value) {",
    "function renderEvaluationMflPerUsdControl(",
    "Evaluation advanced-settings UI owner",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "function renderEvaluationMflPerUsdControl(",
    "function evaluationMflMultiplierForSeason(",
    "Evaluation MFL-per-USD control owner",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    'advancedSettingsButton.addEventListener("click", openAdvancedSettings);',
    'window.addEventListener("storage", syncRecentSearchStateFromStorage);',
    "Evaluation advanced-settings primary bindings",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    'window.addEventListener("resize", updateAdvancedPlayerTableClip);',
    'playerSearchInput.addEventListener("input", renderSearchResults);',
    "Evaluation advanced-settings control bindings",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    'evaluationSearchInput.addEventListener("input", handleEvaluationSearchInput);',
    "if (evaluationDeleteButton) {",
    "Evaluation search and settings bindings",
  );
  core = extracted.core;
  evaluationParts.push(extracted.chunk);

  core = replaceRequired(
    core,
    `${ADVANCED_SETTINGS_BACKDROP_BINDING}\n`,
    "",
    "Evaluation advanced-settings backdrop binding",
  );
  evaluationParts.push(ADVANCED_SETTINGS_BACKDROP_BINDING, EVALUATION_ROUTE_INITIALIZATION);

  return finalizeSplitArtifacts(
    core,
    routeChunks,
    "evaluation",
    evaluationParts.join("\n\n"),
    "Evaluation",
  );
}
