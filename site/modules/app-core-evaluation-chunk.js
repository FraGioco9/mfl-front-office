// @ts-check

import {
  extractRequiredSection,
  finalizeSplitArtifacts,
  normalizeApplicationCoreSource,
  replaceRequired,
} from "./app-core-splitter-utils.js";

const ADVANCED_SETTINGS_BACKDROP_BINDING = "setupBackdropClickClose(advancedSettingsModal, closeAdvancedSettings);";

export function splitEvaluationApplicationCoreRuntime(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  const existingEvaluation = String(routeChunks.evaluation || "").replace(/\s*$/, "");
  if (!existingEvaluation) {
    throw new Error("Evaluation route chunk must exist before Evaluation ownership splitting.");
  }

  let core = normalizeApplicationCoreSource(input.core, "Evaluation ownership");
  const evaluationParts = [existingEvaluation];

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

  core = replaceRequired(
    core,
    `${ADVANCED_SETTINGS_BACKDROP_BINDING}\n`,
    "",
    "Evaluation advanced-settings backdrop binding",
  );
  evaluationParts.push(ADVANCED_SETTINGS_BACKDROP_BINDING);

  return finalizeSplitArtifacts(
    core,
    routeChunks,
    "evaluation",
    evaluationParts.join("\n\n"),
    "Evaluation",
  );
}
