import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [layoutRuntime, searchRuntime, appCoreSource, indexHtml] = await Promise.all([
  read("./evaluation-layout-runtime.js"),
  read("./evaluation-search-state-runtime.js"),
  read("./modules/app-core.js"),
  read("./index.html"),
]);

invariant(
  !layoutRuntime.includes(".focus(")
    && !layoutRuntime.includes(".select(")
    && !layoutRuntime.includes('window.addEventListener("mfl:ready"'),
  "Evaluation layout must not focus/select the search input at first paint or generic application readiness.",
);

for (const required of [
  'const SAVED_EVALUATIONS_LOADING_REASON = "evaluation-load";',
  "let suppressNextIdleSelection = false;",
  "function selectEmptySearchAfterLoading(snapshot)",
  "if (destroyed || snapshot?.busy || !evaluationActive()) return;",
  "if (!input || input.value.trim()) return;",
  "window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();",
  "function onLoadingState(event)",
  "snapshot.reasons.includes(SAVED_EVALUATIONS_LOADING_REASON)",
  "suppressNextIdleSelection = true;",
  "if (suppressNextIdleSelection) {",
  "suppressNextIdleSelection = false;",
  "function onEvaluationReady()",
  "selectEmptySearchAfterLoading(window.__mflInteractionBusy?.snapshot?.());",
  'window.addEventListener("mfl:loading-state", onLoadingState);',
  'window.addEventListener("mfl:evaluation-ready", onEvaluationReady);',
  'window.removeEventListener("mfl:loading-state", onLoadingState);',
  'window.removeEventListener("mfl:evaluation-ready", onEvaluationReady);',
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
    && !clearSource.includes("restoreEmptyRecentResults("),
  "The Evaluation search-state owner must retain only the delegated clear focus fallback and must not start a second recent-results restore.",
);

const canonicalClearStart = appCoreSource.indexOf("function clearEvaluationSearch() {");
const canonicalClearEnd = appCoreSource.indexOf("\n}\nfunction handleEvaluationSearchInput()", canonicalClearStart);
const canonicalClearSource = canonicalClearStart >= 0 && canonicalClearEnd > canonicalClearStart
  ? appCoreSource.slice(canonicalClearStart, canonicalClearEnd)
  : "";
invariant(
  canonicalClearSource.includes("resetEvaluationSelection();")
    && canonicalClearSource.includes("renderEvaluationSearchResults();")
    && canonicalClearSource.includes("window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();")
    && !canonicalClearSource.includes("evaluationSearchInput.focus()")
    && appCoreSource.includes('evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());'),
  "Clicking the Evaluation clear X must select the empty search directly after the canonical core reset through the search-state owner without stealing pointer focus.",
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

console.log("Evaluation search selection validation passed: first paint stays unselected, normal loading focuses an empty search only after idle, cached Evaluation readiness focuses the same empty search without a loading transition, clear X selects after reset without a duplicate recent-results restore, and Saved Evaluations Load keeps it deselected.");
