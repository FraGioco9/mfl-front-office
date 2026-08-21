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

invariant(
  shared.includes('const evaluationRouteParams = new URLSearchParams(window.location.search);')
    && shared.includes('evaluationRouteParams.get("player") || evaluationRouteParams.get("saved") || evaluationRouteParams.get("share")')
    && shared.includes('evaluationSearchInput.placeholder = "Search ID or player name";')
    && shared.includes('const plainEvaluationRoute = window.location.pathname === "/evaluation"')
    && shared.includes('evaluationSearchInput.focus({ preventScroll: true });')
    && shared.includes("evaluationSearchInput.select();"),
  "The empty-Evaluation renderer must preserve selected routes and focus an empty search when plain Evaluation is entered from any page.",
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
    && bootstrap.includes("if (initialPlayerName) searchInput.value = initialPlayerName;")
    && bootstrap.includes("const canLoad = plainEvaluation;"),
  "Evaluation bootstrap must synchronously restore the cached player name by player/saved/share identity and expose Load on plain /evaluation.",
);

invariant(
  bootstrap.includes("function requestPlainEvaluationFirstPaintFocus(searchInput)")
    && bootstrap.includes("window.requestAnimationFrame(() => {")
    && bootstrap.includes("if (!firstPaintEvaluationRouteState().plain) return;")
    && bootstrap.includes("searchInput.focus({ preventScroll: true });")
    && bootstrap.includes("searchInput.select();")
    && bootstrap.includes("if (evaluationRouteState.plain) requestPlainEvaluationFirstPaintFocus(searchInput);"),
  "Plain /evaluation must focus and select the Evaluation search input before the first rendered frame on refresh and route entry.",
);

invariant(
  evaluation.includes('evaluationSearchClearButton.addEventListener("pointerdown", (event) => event.preventDefault());')
    && evaluation.includes("const activateEvaluationSearch = () => {")
    && evaluation.includes("activateEvaluationSearch();")
    && evaluation.includes("window.requestAnimationFrame(activateEvaluationSearch);")
    && evaluation.includes('evaluationSearchInput.focus({ preventScroll: true });')
    && evaluation.includes("evaluationSearchInput.select();")
    && evaluationSearchState.includes('const clear = event.target.closest("#evaluationSearchClearButton");')
    && evaluationSearchState.includes("directPointerFocus = true;\n          field.focus({ preventScroll: true });\n          field.select();\n          clearDirectPointerFocus();"),
  "Clearing the Evaluation search must prevent the clear control from stealing focus and let the search-state runtime keep the input focused after route reset.",
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

console.log("Evaluation refresh hydration, stable first-paint name/actions/placeholder, complete loading lifecycle, clear-focus ownership, and table-edge validation passed.");
