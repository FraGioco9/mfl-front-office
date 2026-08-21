// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const EVALUATION_BLUR_RESULT_HIDE = `evaluationSearchInput.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (!isPlainEvaluationUrl() && document.activeElement !== evaluationSearchInput && !evaluationSearchResults.contains(document.activeElement)) {
      evaluationSearchResults.hidden = true;
      evaluationSearchResults.replaceChildren();
    }
  }, 120);
});`;

const EVALUATION_CLEAR_SEARCH = `function clearEvaluationSearch() {
  evaluationSearchInput.value = "";
  resetEvaluationSelection();
  renderEvaluationSearchResults();
  evaluationSearchInput.focus();
}`;

const EVALUATION_CLEAR_SEARCH_WITH_RUNTIME_FOCUS = `function clearEvaluationSearch() {
  evaluationSearchInput.value = "";
  resetEvaluationSelection();
  renderEvaluationSearchResults();
  window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();
}`;

const EVALUATION_CLEAR_BINDING = `evaluationSearchClearButton.addEventListener("click", clearEvaluationSearch);`;
const EVALUATION_CLEAR_BINDING_WITH_FOCUS_OWNERSHIP = `evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());
evaluationSearchClearButton.addEventListener("click", clearEvaluationSearch);`;

/**
 * Keep typed Evaluation search results visible after the search input loses focus.
 * Result visibility is query-driven; blur only changes focus styling and must not
 * discard a valid result list while text is still present. Clearing the search
 * explicitly hands focus/selection to the Evaluation search-state runtime after
 * the selected Evaluation has been reset, so the X action finishes focused.
 * @param {{core?: string, routeChunks?: Record<string, string>}} routeArtifacts
 */
export function normalizeEvaluationSearchLifecycle(routeArtifacts) {
  const artifacts = routeArtifacts && typeof routeArtifacts === "object" ? routeArtifacts : null;
  const routeChunks = artifacts?.routeChunks && typeof artifacts.routeChunks === "object"
    ? artifacts.routeChunks
    : null;
  const evaluation = String(routeChunks?.evaluation || "");
  if (!evaluation) throw new Error("Cannot normalize Evaluation search lifecycle without an Evaluation route core.");

  let normalizedEvaluation = replaceRequired(
    evaluation,
    EVALUATION_BLUR_RESULT_HIDE,
    "",
    "Evaluation typed results persist after blur",
  );
  normalizedEvaluation = replaceRequired(
    normalizedEvaluation,
    EVALUATION_CLEAR_SEARCH,
    EVALUATION_CLEAR_SEARCH_WITH_RUNTIME_FOCUS,
    "Evaluation clear selects the empty search through the search-state owner",
  );
  normalizedEvaluation = replaceRequired(
    normalizedEvaluation,
    EVALUATION_CLEAR_BINDING,
    EVALUATION_CLEAR_BINDING_WITH_FOCUS_OWNERSHIP,
    "Evaluation clear control does not steal focus from the search input",
  );

  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze({
      ...routeChunks,
      evaluation: normalizedEvaluation,
    }),
  });
}
