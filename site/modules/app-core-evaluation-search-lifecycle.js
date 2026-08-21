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

const EVALUATION_CLEAR_SEARCH_WITH_SELECTION = `function clearEvaluationSearch() {
  evaluationSearchInput.value = "";
  resetEvaluationSelection();
  renderEvaluationSearchResults();

  const activateEvaluationSearch = () => {
    if (!isPlainEvaluationUrl() || String(evaluationSearchInput.value || "").trim()) return;
    evaluationSearchInput.focus({ preventScroll: true });
    evaluationSearchInput.select();
  };
  activateEvaluationSearch();
  window.requestAnimationFrame(activateEvaluationSearch);
}`;

/**
 * Keep typed Evaluation search results visible after the search input loses focus.
 * Result visibility is query-driven; blur only changes focus styling and must not
 * discard a valid result list while text is still present. Clearing the search
 * returns focus and selection to the input both immediately and after route sync
 * so the search remains active and typing can resume immediately.
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
    EVALUATION_CLEAR_SEARCH_WITH_SELECTION,
    "Evaluation clear keeps the search input active after route reset",
  );

  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze({
      ...routeChunks,
      evaluation: normalizedEvaluation,
    }),
  });
}
