import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [layoutRuntime, searchRuntime, searchLifecycleNormalizer, indexHtml] = await Promise.all([
  read("./evaluation-layout-runtime.js"),
  read("./evaluation-search-state-runtime.js"),
  read("./modules/app-core-evaluation-search-lifecycle.js"),
  read("./index.html"),
]);

invariant(
  !layoutRuntime.includes(".focus(")
    && !layoutRuntime.includes(".select(")
    && !layoutRuntime.includes('window.addEventListener("mfl:ready"'),
  "Evaluation layout must not focus/select the search input at first paint or generic application readiness.",
);

for (const required of [
  "function selectEmptySearchAfterLoading(snapshot)",
  "if (destroyed || snapshot?.busy || !evaluationActive()) return;",
  "if (!input || input.value.trim()) return;",
  "window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();",
  "function onLoadingState(event)",
  'window.addEventListener("mfl:loading-state", onLoadingState);',
  'window.removeEventListener("mfl:loading-state", onLoadingState);',
]) {
  invariant(layoutRuntime.includes(required), `Evaluation post-loading selection contract is missing ${required}`);
}

const selectorStart = searchRuntime.indexOf("function selectEmptySearch()");
const selectorEnd = searchRuntime.indexOf("function onPointerDown(event)", selectorStart);
const selectorSource = selectorStart >= 0 && selectorEnd > selectorStart
  ? searchRuntime.slice(selectorStart, selectorEnd)
  : "";
invariant(
  selectorSource.includes("!active()")
    && selectorSource.includes("playerSelected()")
    && selectorSource.includes("field.value.trim()")
    && selectorSource.includes("window.__mflInteractionBusy?.isBusy?.()")
    && selectorSource.includes("directPointerFocus = true;")
    && selectorSource.includes("field.focus({ preventScroll: true });")
    && selectorSource.includes("field.select();")
    && selectorSource.includes("clearDirectPointerFocus();"),
  "Evaluation search selection must be empty-only, idle-only, and pass through the canonical focus owner.",
);

const clearStart = searchRuntime.indexOf('const clear = event.target.closest("#evaluationSearchClearButton");');
const clearEnd = searchRuntime.indexOf('const result = event.target.closest("#evaluationSearchResults .evaluationSearchResult");', clearStart);
const clearSource = clearStart >= 0 && clearEnd > clearStart ? searchRuntime.slice(clearStart, clearEnd) : "";
invariant(
  clearSource.includes("queueMicrotask(() => {")
    && clearSource.includes("selectEmptySearch();")
    && clearSource.includes("void restoreEmptyRecentResults(false);"),
  "The Evaluation search-state owner must retain its delegated clear fallback.",
);

invariant(
  searchLifecycleNormalizer.includes("EVALUATION_CLEAR_SEARCH_WITH_RUNTIME_FOCUS")
    && searchLifecycleNormalizer.includes("resetEvaluationSelection();\n  renderEvaluationSearchResults();\n  window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();")
    && !searchLifecycleNormalizer.includes("activateEvaluationSearch")
    && !searchLifecycleNormalizer.includes("requestAnimationFrame(activateEvaluationSearch)"),
  "Clicking the Evaluation clear X must select the empty search directly after the core reset through the canonical search-state owner.",
);

invariant(
  !indexHtml.includes('id="evaluationSearchInput" autofocus')
    && !indexHtml.includes('autofocus id="evaluationSearchInput"'),
  "The Evaluation search input must not use HTML autofocus on first paint.",
);

invariant(
  !searchRuntime.includes("blockSearchInteractionWhileLoading")
    && !searchRuntime.includes('addEventListener("beforeinput"'),
  "Evaluation selection must not add keyboard blocking while loading.",
);

console.log("Evaluation search selection validation passed: first paint stays unselected, clear X directly selects after reset, and an empty search selects when Uniform Loading becomes idle.");
