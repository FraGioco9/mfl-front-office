import { readCanonicalCoreSource } from "./validate-core-sources.mjs";
import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [layoutRuntime, searchRuntime, appCoreSource, indexHtml] = await Promise.all([
  read("./evaluation-layout-runtime.js"),
  read("./evaluation-search-state-runtime.js"),
  Promise.all([
    readCanonicalCoreSource("shared"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./index.html"),
]);

invariant(
  !layoutRuntime.includes(".focus(")
    && !layoutRuntime.includes(".select(")
    && !layoutRuntime.includes('window.addEventListener("mfl:ready"')
    && !layoutRuntime.includes('window.addEventListener("mfl:loading-state"')
    && !layoutRuntime.includes('window.addEventListener("mfl:evaluation-ready"')
    && !layoutRuntime.includes("selectEmptySearchAfterLoading")
    && !layoutRuntime.includes("suppressNextIdleSelection")
    && !layoutRuntime.includes("SAVED_EVALUATIONS_LOADING_REASON"),
  "Evaluation layout must never own automatic search focus/selection during first paint, route readiness, or loading settlement.",
);

const layoutSyncStart = layoutRuntime.indexOf("function sync() {");
const layoutSyncEnd = layoutRuntime.indexOf("function destroy()", layoutSyncStart);
const layoutSyncSource = layoutSyncStart >= 0 && layoutSyncEnd > layoutSyncStart
  ? layoutRuntime.slice(layoutSyncStart, layoutSyncEnd)
  : "";
invariant(
  layoutRuntime.includes("function renderEmptyRecents()")
    && layoutRuntime.includes("restoreEmptyRecentResults?.(false)")
    && layoutRuntime.includes("function onPointerDown(event)")
    && layoutRuntime.includes("if (input && document.activeElement === input) input.blur();")
    && layoutRuntime.includes("queueMicrotask(renderEmptyRecents);")
    && !layoutSyncSource.includes("renderEmptyRecents")
    && !layoutSyncSource.includes("restoreEmptyRecentResults"),
  "Evaluation layout may restore empty recents after an explicit outside pointer interaction, but startup sync must never become a second recent-five loader.",
);

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
    && selectorSource.includes("field.focus({ preventScroll: true });")
    && selectorSource.includes("field.select();")
    && !selectorSource.includes("directPointerFocus")
    && !selectorSource.includes("clearDirectPointerFocus"),
  "Explicit Evaluation search selection must be empty-only and idle-only without a route-owned focus gate.",
);

const clearStart = searchRuntime.indexOf('const clear = event.target.closest("#evaluationSearchClearButton");');
const clearEnd = searchRuntime.indexOf('const result = event.target.closest("#evaluationSearchResults .evaluationSearchResult");', clearStart);
const clearSource = clearStart >= 0 && clearEnd > clearStart ? searchRuntime.slice(clearStart, clearEnd) : "";
invariant(
  clearSource.includes("queueMicrotask(() => {")
    && clearSource.includes("selectEmptySearch();")
    && !clearSource.includes("restoreEmptyRecentResults("),
  "The clear action must remain the explicit delegated focus path without starting a duplicate recent-results restore.",
);

const canonicalClearStart = appCoreSource.indexOf("function clearEvaluationSearch() {");
const canonicalClearEnd = appCoreSource.indexOf("\n}\n\nfunction handleEvaluationSearchInput()", canonicalClearStart);
const canonicalClearSource = canonicalClearStart >= 0 && canonicalClearEnd > canonicalClearStart
  ? appCoreSource.slice(canonicalClearStart, canonicalClearEnd)
  : "";
invariant(
  canonicalClearSource.includes("resetEvaluationSelection();")
    && canonicalClearSource.includes("renderEvaluationSearchResults();")
    && canonicalClearSource.includes("window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();")
    && !canonicalClearSource.includes("evaluationSearchInput.focus()")
    && appCoreSource.includes('evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());'),
  "Clicking the Evaluation clear X must select the empty search only because the user explicitly requested a reset.",
);

invariant(
  !indexHtml.includes('id="evaluationSearchInput" autofocus')
    && !indexHtml.includes('autofocus id="evaluationSearchInput"'),
  "The Evaluation search input must not use HTML autofocus on first paint.",
);

invariant(
  !searchRuntime.includes("blockSearchInteractionWhileLoading")
    && !searchRuntime.includes('addEventListener("beforeinput"'),
  "Evaluation search must not block ordinary keyboard interaction while loading.",
);

console.log("Evaluation search selection validation passed: navigation/readiness never auto-focuses, empty recents remain passive, and only explicit user actions such as Clear may select the search field.");
