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

/**
 * Keep typed Evaluation search results visible after the search input loses focus.
 * Result visibility is query-driven; blur only changes focus styling and must not
 * discard a valid result list while text is still present.
 * @param {{core?: string, routeChunks?: Record<string, string>}} routeArtifacts
 */
export function normalizeEvaluationSearchLifecycle(routeArtifacts) {
  const artifacts = routeArtifacts && typeof routeArtifacts === "object" ? routeArtifacts : null;
  const routeChunks = artifacts?.routeChunks && typeof artifacts.routeChunks === "object"
    ? artifacts.routeChunks
    : null;
  const evaluation = String(routeChunks?.evaluation || "");
  if (!evaluation) throw new Error("Cannot normalize Evaluation search lifecycle without an Evaluation route core.");

  const normalizedEvaluation = replaceRequired(
    evaluation,
    EVALUATION_BLUR_RESULT_HIDE,
    "",
    "Evaluation typed results persist after blur",
  );

  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze({
      ...routeChunks,
      evaluation: normalizedEvaluation,
    }),
  });
}
