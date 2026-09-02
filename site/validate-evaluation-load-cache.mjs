import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [controls, appCoreSource] = await Promise.all([
  read("./controls.css"),
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
]);
const artifacts = readCanonicalCoreArtifacts(appCoreSource);
const sharedCore = String(artifacts.core || "");
const evaluationCore = String(artifacts.routeChunks?.evaluation || "");

for (const retiredOwner of [
  "normalizeEvaluationSavedValuationCache",
  "app-core-build-normalizer",
  "app-core-evaluation-chunk",
]) {
  invariant(!appCoreSource.includes(retiredOwner), `Saved Evaluation behavior must remain source-owned without retired build owner ${retiredOwner}.`);
}

invariant(
  controls.includes(".evaluationSearchControl:hover #evaluationSearchInput:not(:disabled),")
    && controls.includes("#evaluationSearchInput:focus:not(:disabled),")
    && !controls.includes("#evaluationSearchInput:hover:not(:disabled),")
    && !controls.includes("#evaluationSearchInput:focus-visible:not(:disabled)"),
  "Evaluation search highlighting must be owned by the search-control hover area plus direct input focus: Player-title hover is outside that area, while input focus keeps the normal highlight without a separate white border.",
);

invariant(
  sharedCore.includes('const activeWallet = String(state.linkedWalletAddress || "").trim().toLowerCase();')
    && sharedCore.includes('String(window.__mflSavedEvaluationsSessionCacheWallet || "") === activeWallet')
    && sharedCore.includes("Array.isArray(window.__mflSavedEvaluationsSessionCache)")
    && sharedCore.includes('const busyToken = cached ? "" : (window.__mflInteractionBusy?.begin?.("evaluation-load") || "");'),
  "Cached Saved Evaluations must only bypass Uniform Loading when the list belongs to the active wallet.",
);

invariant(
  sharedCore.includes('evaluationLoadButton.addEventListener("click", openSavedEvaluationsModal);')
    && sharedCore.includes('async function openSavedEvaluationsModal() {\n  evaluationSearchInput.blur();\n  if (document.activeElement === evaluationLoadButton) evaluationLoadButton.blur();')
    && !sharedCore.includes('async function openSavedEvaluationsModal() {\n  clearEvaluationSearchFocus();'),
  "Clicking Load must preserve the direct universal binding while clearing both Evaluation-search focus and stale trigger focus before opening the modal.",
);

invariant(
  sharedCore.includes('document.addEventListener("keydown", (event) => {\n  if (event.key !== "Escape" || !evaluationLoadModal || evaluationLoadModal.hidden) return;')
    && sharedCore.includes('event.preventDefault();\n  hideEvaluationLoadActionTooltip();\n  if (document.activeElement instanceof HTMLElement && evaluationLoadModal.contains(document.activeElement)) {\n    document.activeElement.blur();'),
  "Saved Evaluations must stay open on Escape while the active control is deselected.",
);

for (const required of [
  "function ensureSavedEvaluationCacheWallet()",
  "window.__mflSavedEvaluationsSessionCacheWallet = wallet;",
  "window.__mflSavedEvaluationPayloadCache = Object.create(null);",
  "function rememberSavedEvaluationCacheEntry(entry)",
  "function cachedSavedEvaluationEntry(savedId)",
  "function rememberSavedEvaluationList(entries)",
  "function savedEvaluationListCache()",
  "function invalidateSavedEvaluationCache()",
]) {
  invariant(evaluationCore.includes(required), `Saved Evaluation cache ownership is missing ${required}`);
}

invariant(
  evaluationCore.includes('playerName: String(entry?.playerName || cachedEntry?.playerName || (playerRow ? formatCellValue(playerRow, "name") : "")).trim(),')
    && evaluationCore.includes("const computedPresentValue = evaluationPresentValueTotalFromPayload(entry.payload);")
    && evaluationCore.includes("presentValue: Number.isFinite(entry?.presentValue)")
    && evaluationCore.includes("Number.isFinite(cachedEntry?.presentValue)")
    && evaluationCore.includes("entries.map((entry) => rememberSavedEvaluationCacheEntry(entry) || entry)"),
  "The Saved Evaluations list cache must retain player identity and computed valuation instead of depending on whichever page rows are currently active.",
);

invariant(
  evaluationCore.includes("let savedEvaluationListPreloadPromise = null;")
    && evaluationCore.includes("async function loadSavedEvaluationListData()")
    && evaluationCore.includes("if (savedEvaluationListPreloadPromise) return savedEvaluationListPreloadPromise;")
    && evaluationCore.includes('fetch("/api/evaluation-save", {')
    && evaluationCore.includes("return rememberSavedEvaluationList(evaluations);")
    && evaluationCore.includes("function preloadSavedEvaluationList()")
    && evaluationCore.includes("queueMicrotask(() => {")
    && evaluationCore.includes('window.addEventListener("mfl:evaluation-ready", () => {')
    && evaluationCore.includes("const evaluations = await loadSavedEvaluationListData();")
    && evaluationCore.includes("renderSavedEvaluationList(Array.isArray(evaluations) ? evaluations : []);"),
  "Saved Evaluation list/player data must preload in the background on Evaluation entry and the Load modal must reuse the same cache/in-flight request.",
);

const listRenderStart = evaluationCore.indexOf("function renderSavedEvaluationList(rows)");
const listRenderEnd = evaluationCore.indexOf("async function evaluationOpenSavedEvaluationsModalOwner()", listRenderStart);
const listRender = listRenderStart >= 0 && listRenderEnd > listRenderStart
  ? evaluationCore.slice(listRenderStart, listRenderEnd)
  : "";
invariant(
  listRender.includes('String(entry?.playerName || "").trim()')
    && listRender.includes("const presentValue = Number.isFinite(entry?.presentValue)")
    && listRender.includes("? entry.presentValue")
    && listRender.includes("const loadEvaluation = async () => {")
    && listRender.includes("await loadSavedEvaluation(savedId, playerId);")
    && !listRender.includes("applySharedEvaluationPayload(entry.payload);"),
  "Cached Saved Evaluation rows must keep both their valuation and player name after navigation and use the canonical saved hydration path when selected.",
);

const savedLoadStart = evaluationCore.indexOf("async function loadSavedEvaluation(savedId");
const savedLoadEnd = evaluationCore.indexOf("function evaluationPresentValueTotalFromPayload", savedLoadStart);
const savedLoad = savedLoadStart >= 0 && savedLoadEnd > savedLoadStart
  ? evaluationCore.slice(savedLoadStart, savedLoadEnd)
  : "";
invariant(
  savedLoad.includes("let data = cachedSavedEvaluationEntry(id);")
    && savedLoad.includes("if (!data) {")
    && savedLoad.includes('const requestUrl = new URL("/api/evaluation-save", window.location.origin);')
    && savedLoad.includes("data = await response.json();")
    && savedLoad.includes("rememberSavedEvaluationCacheEntry(data);")
    && savedLoad.includes("data = rememberSavedEvaluationCacheEntry(data) || data;")
    && savedLoad.includes("await applySharedEvaluationPayload(data.payload, {")
    && savedLoad.includes("mflPerUsdRevisionAtLoadStart: evaluationMflPerUsdRevisionAtLoadStart,"),
  "Opening a Saved Evaluation must reuse its cached full payload, refresh its cached valuation after row hydration, preserve newer MFL/USD commits during hydration, and fetch only when that saved ID is not cached.",
);

const saveStart = evaluationCore.indexOf("async function createSavedEvaluation()");
const saveEnd = evaluationCore.indexOf("async function loadSavedEvaluation", saveStart);
const saveSource = saveStart >= 0 && saveEnd > saveStart ? evaluationCore.slice(saveStart, saveEnd) : "";
const saveFailureIndex = saveSource.indexOf("if (!response.ok)");
const saveInvalidationIndex = saveSource.indexOf("invalidateSavedEvaluationCache();");
invariant(
  saveFailureIndex >= 0
    && saveInvalidationIndex > saveFailureIndex
    && saveSource.includes('method: "POST"'),
  "Saving an Evaluation must preserve a valid cache when the request fails and invalidate it only after a successful save.",
);

const deleteStart = evaluationCore.indexOf("async function deleteSavedEvaluation(savedId)");
const deleteEnd = evaluationCore.indexOf("function showEvaluationLoadActionTooltip", deleteStart);
const deleteSource = deleteStart >= 0 && deleteEnd > deleteStart ? evaluationCore.slice(deleteStart, deleteEnd) : "";
const deleteFailureIndex = deleteSource.indexOf("if (!response.ok)");
const deleteInvalidationIndex = deleteSource.indexOf("invalidateSavedEvaluationCache();");
invariant(
  deleteFailureIndex >= 0
    && deleteInvalidationIndex > deleteFailureIndex
    && deleteSource.includes('method: "DELETE"'),
  "Deleting an Evaluation must preserve a valid cache when the request fails and invalidate it only after a successful deletion.",
);

invariant(
  evaluationCore.includes('fetch("/api/evaluation-save", {\n      cache: "no-store",')
    || evaluationCore.includes('fetch("/api/evaluation-save", {\n    cache: "no-store",'),
  "The first Saved Evaluation list request must remain server-fresh before it is cached for the session.",
);

new Function(sharedCore);
new Function(evaluationCore);
console.log("Source-owned Evaluation Saved cache validation passed: Saved lists/player rows preload in the background, Load reuses cache/in-flight work, cached rows retain names and valuations, and saved hydration remains source-owned.");
