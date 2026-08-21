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

/**
 * Keep saved-Evaluation loading in the shared interaction workflow only when
 * data actually needs to be fetched. The first successful list request is
 * cached for the current browser session; save/delete mutations invalidate it.
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
  routeChunks.evaluation = evaluation;

  return Object.freeze({
    ...artifacts,
    core,
    routeChunks: Object.freeze(routeChunks),
  });
}
