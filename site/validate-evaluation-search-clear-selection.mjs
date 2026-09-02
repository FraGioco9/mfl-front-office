import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [layoutRuntime, searchRuntime, appCoreSource, indexHtml] = await Promise.all([
  read("./evaluation-layout-runtime.js"),
  read("./evaluation-search-state-runtime.js"),
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
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
    && !selectorSource.includes("window.__mflInteractionBusy?.isDataLoading?.()")
    && !selectorSource.includes("window.__mflInteractionBusy?.isBusy?.()")
    && selectorSource.includes("directPointerFocus = true;")
    && selectorSource.includes("field.focus({ preventScroll: true });")
    && selectorSource.includes("field.select();")
    && selectorSource.includes("clearDirectPointerFocus();"),
  "Evaluation search selection must be empty-only and pass through the canonical focus owner, including a user-requested clear while an obsolete player request finishes.",
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

const resetSelectionStart = appCoreSource.indexOf("function resetEvaluationSelection() {");
const resetSelectionEnd = appCoreSource.indexOf("\n}\n\nfunction clearEvaluationSearchFocus()", resetSelectionStart);
const resetSelectionSource = resetSelectionStart >= 0 && resetSelectionEnd > resetSelectionStart
  ? appCoreSource.slice(resetSelectionStart, resetSelectionEnd)
  : "";
invariant(
  resetSelectionSource.includes("syncEvaluationPlayerUrl(null);")
    && resetSelectionSource.includes("renderEmptyEvaluationSelection(true, true);"),
  "An explicit Evaluation reset must force the plain empty-state DOM after clearing the player URL, so transient pending-route state cannot preserve selected-player mobile geometry.",
);

const canonicalClearStart = appCoreSource.indexOf("function clearEvaluationSearch() {");
const canonicalClearEnd = appCoreSource.indexOf("\n}\n\nfunction handleEvaluationSearchInput()", canonicalClearStart);
const canonicalClearSource = canonicalClearStart >= 0 && canonicalClearEnd > canonicalClearStart
  ? appCoreSource.slice(canonicalClearStart, canonicalClearEnd)
  : "";
invariant(
  !canonicalClearSource.includes("__mflInteractionBusy")
    && canonicalClearSource.includes('evaluationSearchInput.value = "";')
    && canonicalClearSource.includes("resetEvaluationSelection();")
    && canonicalClearSource.includes("renderEvaluationSearchResults();")
    && canonicalClearSource.includes("window.__mflEvaluationSearchStateRuntime?.selectEmptySearch?.();")
    && !canonicalClearSource.includes("evaluationSearchInput.focus()")
    && appCoreSource.includes('evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());'),
  "Clicking the Evaluation clear X must always perform the canonical empty-state reset, including while a player request is still loading.",
);

const emptyStart = appCoreSource.indexOf("function renderEmptyEvaluationSelection(");
const emptyEnd = appCoreSource.indexOf("\nfunction resetEvaluationSelection()", emptyStart);
const emptySource = emptyStart >= 0 && emptyEnd > emptyStart ? appCoreSource.slice(emptyStart, emptyEnd) : "";
invariant(
  emptySource.includes("evaluationButtons.hidden = !hasWalletOptIn();")
    && emptySource.includes("evaluationResetButton.hidden = true;")
    && emptySource.includes("evaluationLoadButton.hidden = !hasWalletOptIn();")
    && emptySource.includes("evaluationPlayerPageButton.hidden = true;"),
  "The canonical empty Evaluation reset must immediately restore Load and remove selected-player actions.",
);

const evaluationSearchRenderStart = appCoreSource.indexOf("function renderEvaluationSearchResults() {");
const evaluationSearchRenderEnd = appCoreSource.indexOf("let evaluationEmptySearchFocusScheduled", evaluationSearchRenderStart);
const evaluationSearchRenderSource = evaluationSearchRenderStart >= 0 && evaluationSearchRenderEnd > evaluationSearchRenderStart
  ? appCoreSource.slice(evaluationSearchRenderStart, evaluationSearchRenderEnd)
  : "";
const stalePlayerGuard = 'if (String(state.evaluationPlayerId || "") !== playerId || evaluationPlayerIdFromUrl() !== playerId) return false;';
invariant(
  evaluationSearchRenderSource.includes("const payload = await requestIncrementalRoute(route, 1);")
    && evaluationSearchRenderSource.includes(stalePlayerGuard)
    && evaluationSearchRenderSource.indexOf(stalePlayerGuard) > evaluationSearchRenderSource.indexOf("const payload = await requestIncrementalRoute(route, 1);")
    && evaluationSearchRenderSource.indexOf(stalePlayerGuard) < evaluationSearchRenderSource.indexOf("const row = rowByPlayerId(playerId);")
    && evaluationSearchRenderSource.indexOf(stalePlayerGuard) < evaluationSearchRenderSource.indexOf("renderEvaluationTable(row);"),
  "A completed Evaluation player request must not repaint a player after the clear X has reset the route to the empty state.",
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

console.log("Evaluation search selection validation passed: first paint stays unselected, normal loading focuses an empty search only after idle, cached Evaluation readiness focuses the same empty search without a loading transition, clear X forces the canonical plain empty state immediately during loading with Load restored, stale player completion cannot repaint the cleared selection, and Saved Evaluations Load keeps it deselected.");
