import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

// Keep the source-level contract on the final PR head after canonical artifacts are generated.
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

const emptySelectionStart = shared.indexOf("function renderEmptyEvaluationSelection(showRecentResults = true, forcePlain = false)");
const emptySelectionEnd = shared.indexOf("function renderEvaluationSearchResults", emptySelectionStart);
const emptySelectionSource = emptySelectionStart >= 0 && emptySelectionEnd > emptySelectionStart
  ? shared.slice(emptySelectionStart, emptySelectionEnd)
  : "";
invariant(
  emptySelectionSource.includes('const evaluationRouteParams = new URLSearchParams(window.location.search);')
    && emptySelectionSource.includes('const pendingEvaluationRoute = !forcePlain && window.location.pathname === "/evaluation" && Boolean(')
    && emptySelectionSource.includes('evaluationRouteParams.get("player") || evaluationRouteParams.get("saved") || evaluationRouteParams.get("share")')
    && emptySelectionSource.includes('evaluationSearchInput.placeholder = "Search ID or player name";')
    && !emptySelectionSource.includes("requestAnimationFrame")
    && !emptySelectionSource.includes("evaluationSearchInput.focus(")
    && !emptySelectionSource.includes("evaluationSearchInput.select()"),
  "The empty-Evaluation renderer must preserve selected refresh routes, allow a forced plain shell on cached return, and never focus before readiness.",
);

invariant(
  shared.includes('const evaluationRouteSelected = Boolean(\n      state.evaluationPlayerId || evaluationPlayerIdFromUrl() || evaluationSavedIdFromUrl() || evaluationShareIdFromUrl()')
    && shared.includes("evaluationLoadButton.hidden = evaluationRouteSelected || !walletLinked;")
    && shared.includes("evaluationButtons.hidden = evaluationRouteSelected ? false : !walletLinked;")
    && !shared.includes("evaluationLoadButton.hidden = Boolean(state.evaluationPlayerId) || !walletLinked;"),
  "Wallet/account hydration must never expose Load while a player, saved, or shared Evaluation route is selected.",
);

const plainResetStart = shared.indexOf("function preparePlainEvaluationReentry() {");
const plainResetEnd = shared.indexOf("async function setPage(", plainResetStart);
const plainResetSource = plainResetStart >= 0 && plainResetEnd > plainResetStart
  ? shared.slice(plainResetStart, plainResetEnd)
  : "";
const setPageStart = shared.indexOf("async function setPage(pageName, updateHash = true, options = {}) {");
const setPagePrePaintEnd = shared.indexOf("  const previousPage = state.currentPage;", setPageStart);
const setPagePrePaintSource = setPageStart >= 0 && setPagePrePaintEnd > setPageStart
  ? shared.slice(setPageStart, setPagePrePaintEnd)
  : "";
invariant(
  shared.includes("let evaluationPageCacheReady = false;")
    && plainResetSource.includes('state.evaluationShareId = "";')
    && plainResetSource.includes('state.evaluationSavedId = "";')
    && plainResetSource.includes("state.evaluationPlayerId = null;")
    && plainResetSource.includes("state.evaluationOverallRows = {};")
    && plainResetSource.includes("state.evaluationSummaryPositions = {};")
    && plainResetSource.includes('const routeParams = new URLSearchParams(window.location.search);')
    && plainResetSource.includes("const hadEvaluationSelection = Boolean(")
    && plainResetSource.includes("const clearSearchInput = evaluationPageCacheReady || hadEvaluationSelection;")
    && plainResetSource.includes('if (clearSearchInput) {\n    evaluationSearchInput.value = "";\n  }')
    && plainResetSource.includes("renderEmptyEvaluationSelection(false, true);")
    && plainResetSource.includes("syncEvaluationSearchClearButton();")
    && !plainResetSource.includes('state.evaluationSummaryPositions = {};\n  evaluationSearchInput.value = "";')
    && setPagePrePaintSource.includes('const plainEvaluationEntry = pageName === "evaluation" && (options.plain || isPlainEvaluationUrl());')
    && setPagePrePaintSource.includes("if (plainEvaluationEntry) preparePlainEvaluationReentry();")
    && shared.includes('const reuseCachedEvaluationRoute = pageName === "evaluation" && evaluationPageCacheReady;')
    && shared.includes("? { plain: true, reuseCachedRoute: reuseCachedEvaluationRoute }")
    && shared.includes('if (pageName === "evaluation") preparePlainEvaluationReentry();')
    && shared.includes("await setPageWithoutRouteLoading(pageName, true, options);")
    && shared.includes("await setPage(pageName, true, options);"),
  "Plain Evaluation entry must always clear stale selected-player state, while the initial already-plain startup pass must preserve any live typed search text; later cached re-entry still starts clean.",
);

const evaluationPageStart = shared.indexOf("  if (evaluationPageActive) {");
const evaluationPageEnd = shared.indexOf("  if (playerPageActive) {", evaluationPageStart);
const evaluationPageSource = evaluationPageStart >= 0 && evaluationPageEnd > evaluationPageStart
  ? shared.slice(evaluationPageStart, evaluationPageEnd)
  : "";
invariant(
  evaluationPageSource.includes("const cachedEvaluationReentry = plainEvaluationRoute")
    && evaluationPageSource.includes("&& options.reuseCachedRoute === true")
    && evaluationPageSource.includes("&& evaluationPageCacheReady;")
    && evaluationPageSource.includes('window.__mflInteractionBusy?.begin?.("evaluation-loading")')
    && evaluationPageSource.includes('if (!cachedEvaluationReentry) {\n      document.documentElement.classList.remove("mflEvaluationReady");')
    && !evaluationPageSource.includes("preparePlainEvaluationReentry();")
    && evaluationPageSource.includes("if (!cachedEvaluationReentry) {\n        await finishEvaluationReadiness();")
    && evaluationPageSource.includes("evaluationPageCacheReady = true;"),
  "Cached plain Evaluation re-entry must skip repeated loading/readiness, with stale-selection clearing owned before destination visibility rather than inside the visible Evaluation block.",
);

invariant(
  evaluationSearchState.includes("if (!force && recentPayload && recentPayloadSignature === currentSignature) {")
    && evaluationSearchState.includes("publishRecentPayload(recentPayload);")
    && evaluationSearchState.includes("return Promise.resolve(renderEmptySearchFromCore());"),
  "An already loaded plain Evaluation must republish its recent-player data from the in-memory cache before any new request or loading gate.",
);

invariant(
  builtApplicationSources.includes('sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${id}`, playerName);')
    && builtApplicationSources.includes('sessionStorage.setItem(`mfl-evaluation-first-paint-name-v2:player:${playerId}`, entry.nameDisplay);'),
  "Evaluation navigation from Player pages and search results must cache the player name before the route changes.",
);

invariant(
  shared.includes('["watchlist", "myplayers", "settings", "player", "evaluation"].includes(initialTarget.pageName)')
    && evaluation.includes("async function applySharedEvaluationPayload(payload, options = {}) {")
    && evaluation.includes("await renderEvaluationPage();\n}\n\nasync function loadSharedEvaluation")
    && evaluation.includes("await applySharedEvaluationPayload(data.payload, {")
    && evaluation.includes("mflPerUsdRevisionAtLoadStart: evaluationMflPerUsdRevisionAtLoadStart,")
    && evaluation.includes('const payloadPlayerId = String(data?.payload?.playerId || playerId || "").trim();')
    && evaluation.includes("playerId: payloadPlayerId,")
    && !evaluation.includes('evaluationSearchInput.value = "";\n  renderEvaluationMflPerUsdControl(false);'),
  "Evaluation startup must keep loading active through wallet/settings hydration and the final revision-aware player/saved/shared render without blanking the player name.",
);

invariant(
  evaluation.includes("async function recoverInvalidEvaluationLink() {")
    && evaluation.includes('const candidatePlayerId = String(evaluationPlayerIdFromUrl() || state.evaluationPlayerId || "").trim();')
    && evaluation.includes("playerRow = rowByPlayerId(candidatePlayerId);")
    && evaluation.includes('if (!data.playerId) {\n    throw new Error("Evaluation player is not available.");\n  }')
    && evaluation.includes('window.history.replaceState({}, "", basicEvaluationPathForPlayer(playerId));')
    && evaluation.includes('window.history.replaceState({}, "", "/evaluation");')
    && evaluation.includes('document.documentElement.dataset.initialEvaluationSelection = "false";')
    && evaluation.includes('evaluationSearchInput.value = "";')
    && evaluation.includes("renderEmptyEvaluationSelection(true, true);")
    && evaluation.includes("syncEvaluationSearchClearButton();")
    && evaluation.includes("await recoverInvalidEvaluationLink();\n    await renderEvaluationPage();")
    && !evaluation.includes("resetInvalidEvaluationLinkToPlainEvaluation"),
  "Invalid saved/shared Evaluation URLs, including successful payloads without a player ID, must recover to a resolvable base player Evaluation or synchronously restore plain /evaluation and its search tip.",
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
  "Evaluation bootstrap must synchronously restore the cached player name by player/saved/share identity on refresh, while in-app plain re-entry clears that chrome before destination paint.",
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
  "Evaluation refresh first-paint CSS must show only Load on plain /evaluation, keep Load hidden on selected refresh routes, and suppress the selected-route placeholder before hydration.",
);

invariant(
  styles.includes('.tableShell tbody tr:last-child > :is(th, td) {\n  border-bottom: 0;\n}')
    && !styles.includes('.evaluationTable tbody tr:last-child > :is(th, td) {\n  border-bottom: 0;\n}'),
  "Every bordered tableShell must own its single outer bottom edge without a duplicate last-row cell border.",
);

console.log("Evaluation refresh hydration, selected-route action stability, invalid-link recovery including missing-player payloads, cached plain-route re-entry, pre-paint empty history/navigation return, recent-player cache reuse, first-paint timing, clear-focus ownership, and shared table-edge validation passed.");
