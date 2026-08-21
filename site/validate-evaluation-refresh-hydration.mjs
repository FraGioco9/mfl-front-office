import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [appCoreSource, bootstrap, loading, styles, evaluationSearchState] = await Promise.all([
  read("./modules/app-core.js"),
  read("./bootstrap.js"),
  read("./loading.css"),
  read("./styles.css"),
  read("./evaluation-search-state-runtime.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const shared = String(artifacts.core || "");
const evaluation = String(artifacts.routeChunks?.evaluation || "");
const builtApplicationSources = [shared, ...Object.values(artifacts.routeChunks || {}).map((chunk) => String(chunk || ""))].join("\n");

invariant(
  shared.includes('const routePlayerId = String(evaluationPlayerIdFromUrl() || state.evaluationPlayerId || "").trim();')
    && shared.includes("playerId: routePlayerId,")
    && shared.includes("const pendingEvaluationRoute = Boolean(")
    && shared.includes("const firstPaintEvaluationPlayerName = String(evaluationSearchInput.value || \"\").trim();")
    && shared.includes("if (pendingEvaluationRoute) {\n    evaluationSearchInput.placeholder = \"\";")
    && shared.includes("evaluationButtons.hidden = false;")
    && shared.includes("evaluationResetButton.hidden = false;")
    && shared.includes("evaluationPlayerPageButton.hidden = false;")
    && shared.includes("if (firstPaintEvaluationPlayerName) {\n        evaluationSearchInput.value = firstPaintEvaluationPlayerName;")
    && !shared.includes('if (!row || getValue(row, "retirement_years") === 0) {'),
  "A refreshed player/saved/shared Evaluation must hydrate without clearing its first-paint name or Reset/Player Page chrome.",
);

const emptySelectionStart = shared.indexOf("function renderEmptyEvaluationSelection(showRecentResults = true)");
const emptySelectionEnd = shared.indexOf("function renderEvaluationSearchResults", emptySelectionStart);
const emptySelectionSource = emptySelectionStart >= 0 && emptySelectionEnd > emptySelectionStart
  ? shared.slice(emptySelectionStart, emptySelectionEnd)
  : "";
invariant(
  emptySelectionSource.includes('const evaluationRouteParams = new URLSearchParams(window.location.search);')
    && emptySelectionSource.includes('evaluationRouteParams.get("player") || evaluationRouteParams.get("saved") || evaluationRouteParams.get("share")')
    && emptySelectionSource.includes('evaluationSearchInput.placeholder = "Search ID or player name";')
    && !emptySelectionSource.includes("requestAnimationFrame")
    && !emptySelectionSource.includes("evaluationSearchInput.focus(")
    && !emptySelectionSource.includes("evaluationSearchInput.select()"),
  "The empty-Evaluation renderer must preserve selected routes without focusing the empty search before Uniform Loading finishes.",
);

invariant(
  builtApplicationSources.includes('sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${id}`, playerName);')
    && builtApplicationSources.includes('sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${playerId}`, entry.nameDisplay);'),
  "Evaluation navigation from Player pages and search results must cache the player name before the route changes.",
);

invariant(
  shared.includes('["watchlist", "myplayers", "settings", "player", "evaluation"].includes(initialTarget.pageName)')
    && evaluation.includes("async function applySharedEvaluationPayload(payload) {")
    && evaluation.includes("await renderEvaluationPage();\n}\n\nasync function loadSharedEvaluation")
    && evaluation.includes("await applySharedEvaluationPayload(data.payload);")
    && evaluation.includes('const payloadPlayerId = String(data?.payload?.playerId || playerId || "").trim();')
    && evaluation.includes("playerId: payloadPlayerId,")
    && !evaluation.includes('evaluationSearchInput.value = "";\n  renderEvaluationMflPerUsdControl(false);'),
  "Evaluation startup must keep loading active through wallet/settings hydration and the final player/saved/shared render without blanking the player name.",
);

invariant(
  shared.includes('const evaluationPlayerName = formatCellValue(row, "name");')
    && shared.includes('["player", String(evaluationRoute.searchParams.get("player") || state.evaluationPlayerId || "").trim()]')
    && shared.includes('["saved", String(evaluationRoute.searchParams.get("saved") || state.evaluationSavedId || "").trim()]')
    && shared.includes('["share", String(evaluationRoute.searchParams.get("share") || state.evaluationShareId || "").trim()]')
    && shared.includes('sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:${kind}:${id}`, evaluationPlayerName);'),
  "Rendered player, saved, and shared Evaluations must cache their player name by stable Evaluation identity for refresh first paint.",
);

invariant(
  bootstrap.includes('const EVALUATION_FIRST_PAINT_NAME_STORAGE_PREFIX = "mfl-evaluation-first-paint-name-v2:";')
    && bootstrap.includes("function firstPaintEvaluationRouteState(")
    && bootstrap.includes("function firstPaintEvaluationPlayerName(")
    && bootstrap.includes('const cachedName = String(sessionStorage.getItem(`${EVALUATION_FIRST_PAINT_NAME_STORAGE_PREFIX}${kind}:${id}`) || "").trim();')
    && bootstrap.includes("const evaluationRouteState = firstPaintEvaluationRouteState();")
    && bootstrap.includes("if (searchInput instanceof HTMLInputElement && initialPlayerName) searchInput.value = initialPlayerName;")
    && bootstrap.includes("const canLoad = plainEvaluation;"),
  "Evaluation bootstrap must synchronously restore the cached player name by player/saved/share identity and expose Load on plain /evaluation.",
);

invariant(
  !bootstrap.includes("requestPlainEvaluationFirstPaintFocus")
    && !bootstrap.includes("searchInput.focus({ preventScroll: true });")
    && !bootstrap.includes("searchInput.select();"),
  "Plain /evaluation must remain unselected at first paint; focus is owned only after Uniform Loading finishes.",
);

const clearStart = evaluationSearchState.indexOf('const clear = event.target.closest("#evaluationSearchClearButton");');
const clearEnd = evaluationSearchState.indexOf('const result = event.target.closest("#evaluationSearchResults .evaluationSearchResult");', clearStart);
const clearSource = clearStart >= 0 && clearEnd > clearStart
  ? evaluationSearchState.slice(clearStart, clearEnd)
  : "";
invariant(
  evaluation.includes('evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());')
    && !evaluation.includes("activateEvaluationSearch")
    && !evaluation.includes("requestAnimationFrame(activateEvaluationSearch)")
    && evaluationSearchState.includes("function selectEmptySearch()")
    && evaluationSearchState.includes('field.focus({ preventScroll: true });')
    && evaluationSearchState.includes("field.select();")
    && clearSource.includes("selectEmptySearch();")
    && clearSource.includes("void restoreEmptyRecentResults(false);"),
  "Clearing the Evaluation search must prevent the clear control from stealing focus and select the cleared input through the single search-state focus owner.",
);

invariant(
  loading.includes('[data-initial-evaluation-selection="false"] #evaluationLoadButton[hidden]')
    && loading.includes(':is(#evaluationResetButton, #evaluationPlayerPageButton)')
    && loading.includes('[data-initial-evaluation-selection="true"] #evaluationLoadButton')
    && loading.includes('[data-initial-evaluation-selection="true"] #evaluationSearchInput::placeholder')
    && loading.includes("color: transparent;"),
  "Evaluation first-paint CSS must show only Load on plain /evaluation, keep Load hidden on selected routes, and suppress the selected-route placeholder before hydration.",
);

invariant(
  styles.includes('.evaluationTable tbody tr:last-child > :is(th, td) {\n  border-bottom: 0;\n}'),
  "Evaluation tables must let tableShell own the outer bottom edge instead of drawing a duplicate last-row border.",
);

console.log("Evaluation refresh hydration, stable first-paint name/actions/placeholder, first-paint-unselected timing, clear-focus ownership, and table-edge validation passed.");
