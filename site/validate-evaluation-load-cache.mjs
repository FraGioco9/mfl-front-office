import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [controls, appCoreSource, buildNormalizer] = await Promise.all([
  read("./controls.css"),
  read("./modules/app-core.js"),
  read("./modules/app-core-build-normalizer.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const sharedCore = String(artifacts.core || "");
const evaluationCore = String(artifacts.routeChunks?.evaluation || "");

invariant(
  !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")
    && buildNormalizer.includes("return watchlistArtifacts;"),
  "Saved Evaluation valuation/cache behavior must be source-owned with Club sort as the terminal build artifact.",
);

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
    && sharedCore.includes('event.preventDefault();\n  hideEvaluationLoadActionTooltip();\n  hideModal(evaluationLoadModal);'),
  "Saved Evaluations must close on Escape through the canonical modal owner.",
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
  evaluationCore.includes("const cachedEvaluations = savedEvaluationListCache();")
    && evaluationCore.includes("if (cachedEvaluations) {")
    && evaluationCore.includes("renderSavedEvaluationList(cachedEvaluations);")
    && evaluationCore.includes("const rememberedEvaluations = rememberSavedEvaluationList(evaluations);")
    && evaluationCore.includes("renderSavedEvaluationList(rememberedEvaluations);"),
  "Saved Evaluations must reuse the complete wallet-scoped list after its first successful request.",
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
    && savedLoad.includes("await applySharedEvaluationPayload(data.payload);"),
  "Opening a Saved Evaluation must reuse its cached full payload, refresh its cached valuation after row hydration, and fetch only when that saved ID is not cached.",
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

console.log("Evaluation Saved cache validation passed: Load clears stale focus, Escape closes the modal, cached rows retain names and valuations across page changes, saved hydration refreshes cached data, and successful save/delete mutations invalidate stale data.");
