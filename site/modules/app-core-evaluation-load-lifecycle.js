// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const EVALUATION_LOAD_FACADE = `let __mflOpenSavedEvaluationsModalOwner = null;

async function openSavedEvaluationsModal() {
  if (typeof __mflOpenSavedEvaluationsModalOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("evaluation");
  }
  if (typeof __mflOpenSavedEvaluationsModalOwner !== "function") {
    throw new Error("Evaluation route core is not loaded.");
  }
  return __mflOpenSavedEvaluationsModalOwner.apply(this, arguments);
}`;

const EVALUATION_LOAD_FACADE_WITH_BUSY = `let __mflOpenSavedEvaluationsModalOwner = null;

async function openSavedEvaluationsModal() {
  const cached = typeof __mflOpenSavedEvaluationsModalOwner === "function"
    && Array.isArray(window.__mflSavedEvaluationsSessionCache);
  const busyToken = cached ? "" : (window.__mflInteractionBusy?.begin?.("evaluation-load") || "");
  try {
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
      await window.__mflEnsureRouteCore("evaluation");
    }
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function") {
      throw new Error("Evaluation route core is not loaded.");
    }
    return await __mflOpenSavedEvaluationsModalOwner.apply(this, arguments);
  } finally {
    if (busyToken) window.__mflInteractionBusy?.end?.(busyToken);
  }
}`;

const EVALUATION_LOAD_MODAL_START = `  showModal(evaluationLoadModal);
  evaluationLoadList.innerHTML = '<p class="evaluationLoadEmpty">Loading saved evaluations...</p>';
  try {`;

const EVALUATION_LOAD_MODAL_START_WITH_CACHE = `  showModal(evaluationLoadModal);
  const cachedEvaluations = window.__mflSavedEvaluationsSessionCache;
  if (Array.isArray(cachedEvaluations)) {
    renderSavedEvaluationList(cachedEvaluations);
    return;
  }

  evaluationLoadList.innerHTML = '<p class="evaluationLoadEmpty">Loading saved evaluations...</p>';
  try {`;

const EVALUATION_SAVED_PLAYER_PREFETCH = `    if (playerIds.length) {
      await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "players",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerIds,
      }, 1, { force: true });
    }`;

const EVALUATION_SAVED_PLAYER_PREFETCH_WITH_CACHE = `    if (playerIds.length) {
      const savedPlayersPayload = await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "players",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerIds,
      }, 1, { force: true });

      const columns = Array.isArray(savedPlayersPayload?.columns) ? savedPlayersPayload.columns : [];
      const rows = Array.isArray(savedPlayersPayload?.rows) ? savedPlayersPayload.rows : [];
      const playerIdIndex = columns.indexOf("player_id");
      if (playerIdIndex >= 0) {
        rows.forEach((row) => {
          if (!Array.isArray(row)) return;
          const cachedPlayerId = String(row[playerIdIndex] || "").trim();
          if (!cachedPlayerId) return;
          const route = incrementalRouteTarget("evaluation", { playerId: cachedPlayerId });
          if (!route) return;
          const { cacheKey } = incrementalRequestDetails(route, 1);
          state.incrementalPayloadCache.set(cacheKey, {
            ...savedPlayersPayload,
            rows: [row],
            page: 1,
            pageSize: 1,
            totalRows: 1,
            sourceRows: 1,
          });
        });
      }
    }`;

const EVALUATION_LOAD_RENDER = `    renderSavedEvaluationList(evaluations);`;
const EVALUATION_LOAD_RENDER_WITH_CACHE = `    window.__mflSavedEvaluationsSessionCache = evaluations;
    renderSavedEvaluationList(evaluations);`;

const EVALUATION_SAVE_REQUEST = `  const response = await fetch("/api/evaluation-save", {
    method: "POST",`;
const EVALUATION_SAVE_REQUEST_WITH_CACHE_INVALIDATION = `  window.__mflSavedEvaluationsSessionCache = null;
  const response = await fetch("/api/evaluation-save", {
    method: "POST",`;

const EVALUATION_DELETE_REQUEST = `  const response = await fetch(requestUrl.toString(), {
    method: "DELETE",`;
const EVALUATION_DELETE_REQUEST_WITH_CACHE_INVALIDATION = `  window.__mflSavedEvaluationsSessionCache = null;
  const response = await fetch(requestUrl.toString(), {
    method: "DELETE",`;

const EVALUATION_SAVED_SELECTION = `    const loadEvaluation = () => {
      clearEvaluationSearchFocus();
      const savedId = String(entry.id || "").trim();
      const url = new URL("/evaluation", window.location.origin);
      url.searchParams.set("player", playerId);
      url.searchParams.set("saved", savedId);
      window.history.replaceState({}, "", url.toString());
      state.evaluationSavedId = savedId;
      state.evaluationShareId = "";
      hideModal(evaluationLoadModal);
      updateEvaluationFooterActions();
      applySharedEvaluationPayload(entry.payload);
    };`;

const EVALUATION_SAVED_SELECTION_WITH_ROW_RESTORE = `    let loadingEvaluation = false;
    const loadEvaluation = async () => {
      if (loadingEvaluation) return;
      clearEvaluationSearchFocus();
      const savedId = String(entry.id || "").trim();
      if (!savedId || !playerId) return;

      loadingEvaluation = true;
      try {
        if (!rowByPlayerId(playerId)) {
          const route = incrementalRouteTarget("evaluation", { playerId });
          const playerPayload = route ? await requestIncrementalRoute(route, 1) : null;
          if (!playerPayload || !rowByPlayerId(playerId)) {
            showToast("Saved evaluation could not be loaded.");
            return;
          }
        }

        const url = new URL("/evaluation", window.location.origin);
        url.searchParams.set("player", playerId);
        url.searchParams.set("saved", savedId);
        window.history.replaceState({}, "", url.toString());
        state.evaluationSavedId = savedId;
        state.evaluationShareId = "";
        hideModal(evaluationLoadModal);
        updateEvaluationFooterActions();
        await applySharedEvaluationPayload(entry.payload);
      } catch (error) {
        showToast(error?.message || "Saved evaluation could not be loaded.");
      } finally {
        loadingEvaluation = false;
      }
    };`;

/**
 * Keep saved-Evaluation loading in the shared interaction workflow only when
 * data actually needs to be fetched. The first successful list request is
 * cached for the current browser session; save/delete mutations invalidate it.
 * The same first request also seeds each saved player's canonical Evaluation
 * route payload, so a later reopen after navigating elsewhere restores from
 * the session cache instead of performing another player request.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeEvaluationLoadLifecycle(artifacts) {
  const source = String(artifacts?.core || "");
  if (!source) throw new Error("Cannot normalize Evaluation Load lifecycle without shared core.");

  const core = replaceRequired(
    source,
    EVALUATION_LOAD_FACADE,
    EVALUATION_LOAD_FACADE_WITH_BUSY,
    "Evaluation Load enters Uniform Loading before lazy route-core readiness",
  );

  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  const evaluationSource = String(routeChunks.evaluation || "");
  if (!evaluationSource) throw new Error("Cannot normalize Evaluation Load lifecycle without Evaluation route core.");

  let evaluation = replaceRequired(
    evaluationSource,
    EVALUATION_LOAD_MODAL_START,
    EVALUATION_LOAD_MODAL_START_WITH_CACHE,
    "Evaluation saved-list modal reuses its session cache",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_SAVED_PLAYER_PREFETCH,
    EVALUATION_SAVED_PLAYER_PREFETCH_WITH_CACHE,
    "Saved Evaluation list primes canonical per-player Evaluation route payloads",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_LOAD_RENDER,
    EVALUATION_LOAD_RENDER_WITH_CACHE,
    "Evaluation saved-list request populates its session cache",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_SAVE_REQUEST,
    EVALUATION_SAVE_REQUEST_WITH_CACHE_INVALIDATION,
    "Saving an Evaluation invalidates the saved-list session cache",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_DELETE_REQUEST,
    EVALUATION_DELETE_REQUEST_WITH_CACHE_INVALIDATION,
    "Deleting an Evaluation invalidates the saved-list session cache",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_SAVED_SELECTION,
    EVALUATION_SAVED_SELECTION_WITH_ROW_RESTORE,
    "Cached saved Evaluation selection restores its cached player data before applying its payload",
  );
  routeChunks.evaluation = evaluation;

  return Object.freeze({
    ...artifacts,
    core,
    routeChunks: Object.freeze(routeChunks),
  });
}
