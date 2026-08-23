// @ts-check

import { normalizeModalEntranceLifecycle } from "./app-core-modal-entrance-lifecycle.js";
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
  evaluationSearchInput.blur();
  if (document.activeElement === evaluationLoadButton) evaluationLoadButton.blur();
  const activeWallet = String(state.linkedWalletAddress || "").trim().toLowerCase();
  const cached = typeof __mflOpenSavedEvaluationsModalOwner === "function"
    && activeWallet
    && String(window.__mflSavedEvaluationsSessionCacheWallet || "") === activeWallet
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

const EVALUATION_LOAD_CLOSE_BINDING = `if (closeEvaluationLoadButton) {
  closeEvaluationLoadButton.addEventListener("click", () => {
    hideModal(evaluationLoadModal);
  });
}
setupBackdropClickClose(evaluationLoadModal, () => hideModal(evaluationLoadModal));`;
const EVALUATION_LOAD_CLOSE_BINDING_WITH_ESCAPE = `if (closeEvaluationLoadButton) {
  closeEvaluationLoadButton.addEventListener("click", () => {
    hideModal(evaluationLoadModal);
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !evaluationLoadModal || evaluationLoadModal.hidden) return;
  event.preventDefault();
  hideEvaluationLoadActionTooltip();
  hideModal(evaluationLoadModal);
});
setupBackdropClickClose(evaluationLoadModal, () => hideModal(evaluationLoadModal));`;

const EVALUATION_CREATE_SAVED_START = `async function createSavedEvaluation() {`;
const EVALUATION_CREATE_SAVED_START_WITH_CACHE = `function savedEvaluationCacheWallet() {
  return normalizeWalletAddress(state.linkedWalletAddress).toLowerCase();
}

function ensureSavedEvaluationCacheWallet() {
  const wallet = savedEvaluationCacheWallet();
  if (String(window.__mflSavedEvaluationsSessionCacheWallet || "") !== wallet) {
    window.__mflSavedEvaluationsSessionCacheWallet = wallet;
    window.__mflSavedEvaluationsSessionCache = null;
    window.__mflSavedEvaluationPayloadCache = Object.create(null);
  }
  return wallet;
}

function savedEvaluationPayloadCache() {
  ensureSavedEvaluationCacheWallet();
  const cache = window.__mflSavedEvaluationPayloadCache;
  if (cache && typeof cache === "object" && !Array.isArray(cache)) return cache;
  const nextCache = Object.create(null);
  window.__mflSavedEvaluationPayloadCache = nextCache;
  return nextCache;
}

function rememberSavedEvaluationCacheEntry(entry) {
  const id = String(entry?.id || "").trim();
  if (!id || !entry?.payload) return null;
  const playerId = String(entry?.playerId || entry?.payload?.playerId || "").trim();
  const playerRow = playerId ? rowByPlayerId(playerId) : null;
  const normalizedEntry = {
    ...entry,
    id,
    playerId,
    playerName: String(entry?.playerName || (playerRow ? formatCellValue(playerRow, "name") : "")).trim(),
  };
  savedEvaluationPayloadCache()[id] = normalizedEntry;
  return normalizedEntry;
}

function cachedSavedEvaluationEntry(savedId) {
  const id = String(savedId || "").trim();
  if (!id) return null;
  ensureSavedEvaluationCacheWallet();
  const list = window.__mflSavedEvaluationsSessionCache;
  if (Array.isArray(list)) {
    const listEntry = list.find((entry) => String(entry?.id || "").trim() === id) || null;
    if (listEntry?.payload) return rememberSavedEvaluationCacheEntry(listEntry);
  }
  return savedEvaluationPayloadCache()[id] || null;
}

function showSavedEvaluationPlayerName(entry, fallbackPlayerId = "") {
  const playerId = String(entry?.playerId || entry?.payload?.playerId || fallbackPlayerId || "").trim();
  const playerRow = playerId ? rowByPlayerId(playerId) : null;
  const playerName = String(entry?.playerName || (playerRow ? formatCellValue(playerRow, "name") : "")).trim();
  if (playerName) evaluationSearchInput.value = playerName;
  return playerName;
}

function rememberSavedEvaluationList(entries) {
  ensureSavedEvaluationCacheWallet();
  const list = Array.isArray(entries)
    ? entries.map((entry) => rememberSavedEvaluationCacheEntry(entry) || entry)
    : [];
  window.__mflSavedEvaluationsSessionCache = list;
  return list;
}

function savedEvaluationListCache() {
  const wallet = ensureSavedEvaluationCacheWallet();
  return wallet && Array.isArray(window.__mflSavedEvaluationsSessionCache)
    ? window.__mflSavedEvaluationsSessionCache
    : null;
}

function invalidateSavedEvaluationCache() {
  ensureSavedEvaluationCacheWallet();
  window.__mflSavedEvaluationsSessionCache = null;
  window.__mflSavedEvaluationPayloadCache = Object.create(null);
}

async function createSavedEvaluation() {`;

const EVALUATION_LOAD_LIST_NAME = `    name.textContent = row ? formatCellValue(row, "name") : \`Player \${playerId}\`;`;
const EVALUATION_LOAD_LIST_NAME_WITH_CACHE = `    name.textContent = row
      ? formatCellValue(row, "name")
      : (String(entry?.playerName || "").trim() || \`Player \${playerId}\`);`;

const EVALUATION_LOAD_LIST_HANDLER = `    const loadEvaluation = () => {
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
const EVALUATION_LOAD_LIST_HANDLER_WITH_HYDRATION = `    const loadEvaluation = async () => {
      clearEvaluationSearchFocus();
      const savedId = String(entry.id || "").trim();
      showSavedEvaluationPlayerName(entry, playerId);
      const url = new URL("/evaluation", window.location.origin);
      url.searchParams.set("player", playerId);
      url.searchParams.set("saved", savedId);
      window.history.replaceState({}, "", url.toString());
      hideModal(evaluationLoadModal);
      await loadSavedEvaluation(savedId, playerId);
    };`;

const EVALUATION_LOAD_MODAL_START = `  showModal(evaluationLoadModal);
  evaluationLoadList.innerHTML = '<p class="evaluationLoadEmpty">Loading saved evaluations...</p>';
  try {`;

const EVALUATION_LOAD_MODAL_START_WITH_CACHE = `  showModal(evaluationLoadModal);
  const cachedEvaluations = savedEvaluationListCache();
  if (cachedEvaluations) {
    renderSavedEvaluationList(cachedEvaluations);
    return;
  }

  evaluationLoadList.innerHTML = '<p class="evaluationLoadEmpty">Loading saved evaluations...</p>';
  try {`;

const EVALUATION_LOAD_RENDER = `    renderSavedEvaluationList(evaluations);`;
const EVALUATION_LOAD_RENDER_WITH_CACHE = `    const rememberedEvaluations = rememberSavedEvaluationList(evaluations);
    renderSavedEvaluationList(rememberedEvaluations);`;

const EVALUATION_SAVED_LOAD_REQUEST = `  try {
    const requestUrl = new URL("/api/evaluation-save", window.location.origin);
    requestUrl.searchParams.set("id", id);
    const selectedPlayerId = String(playerId || evaluationPlayerIdFromUrl() || "").trim();
    if (selectedPlayerId) {
      requestUrl.searchParams.set("player", selectedPlayerId);
    }

    const response = await fetch(requestUrl.toString(), {
      cache: "no-store",
      headers: walletProofHeaders(true),
    });

    if (!response.ok) {
      throw new Error("Saved evaluation not found.");
    }

    const data = await response.json();
    const payloadPlayerId = String(data?.payload?.playerId || selectedPlayerId || "").trim();`;

const EVALUATION_SAVED_LOAD_REQUEST_WITH_CACHE = `  try {
    const selectedPlayerId = String(playerId || evaluationPlayerIdFromUrl() || "").trim();
    let data = cachedSavedEvaluationEntry(id);
    showSavedEvaluationPlayerName(data, selectedPlayerId);

    if (!data) {
      const requestUrl = new URL("/api/evaluation-save", window.location.origin);
      requestUrl.searchParams.set("id", id);
      if (selectedPlayerId) {
        requestUrl.searchParams.set("player", selectedPlayerId);
      }

      const response = await fetch(requestUrl.toString(), {
        cache: "no-store",
        headers: walletProofHeaders(true),
      });

      if (!response.ok) {
        throw new Error("Saved evaluation not found.");
      }

      data = await response.json();
      rememberSavedEvaluationCacheEntry(data);
      showSavedEvaluationPlayerName(data, selectedPlayerId);
    }

    const payloadPlayerId = String(data?.payload?.playerId || selectedPlayerId || "").trim();`;

const EVALUATION_SAVE_SUCCESS = `  if (!id || !playerId) {
    throw new Error("Could not save evaluation.");
  }

  state.evaluationSavedId = id;`;
const EVALUATION_SAVE_SUCCESS_WITH_INVALIDATION = `  if (!id || !playerId) {
    throw new Error("Could not save evaluation.");
  }

  invalidateSavedEvaluationCache();
  state.evaluationSavedId = id;`;

const EVALUATION_DELETE_SUCCESS = `  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not delete saved evaluation.");
  }

  return true;`;
const EVALUATION_DELETE_SUCCESS_WITH_INVALIDATION = `  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not delete saved evaluation.");
  }

  invalidateSavedEvaluationCache();
  return true;`;

const EVALUATION_MISSING_PLAYER_PAYLOAD = `  if (!data.playerId) {
    showToast("Shared evaluation is not available.");
    return;
  }`;
const EVALUATION_MISSING_PLAYER_PAYLOAD_WITH_RECOVERY = `  if (!data.playerId) {
    throw new Error("Evaluation player is not available.");
  }`;

const EVALUATION_UNRESOLVED_PLAYER_ROUTE = `      if (!playerPayload) return;`;
const EVALUATION_UNRESOLVED_PLAYER_ROUTE_WITH_RECOVERY = `      if (!playerPayload) throw new Error("Evaluation player is not available.");`;

const EVALUATION_INVALID_LINK_RECOVERY = `  const playerId = playerRow ? candidatePlayerId : "";
  state.evaluationSavedId = "";
  state.evaluationShareId = "";
  state.evaluationPlayerId = playerId || null;
  window.history.replaceState({}, "", playerId ? basicEvaluationPathForPlayer(playerId) : "/evaluation");
  return true;`;
const EVALUATION_INVALID_LINK_RECOVERY_WITH_PLAIN_RESET = `  const playerId = playerRow ? candidatePlayerId : "";
  state.evaluationSavedId = "";
  state.evaluationShareId = "";
  state.evaluationPlayerId = playerId || null;

  if (playerId) {
    window.history.replaceState({}, "", basicEvaluationPathForPlayer(playerId));
  } else {
    state.evaluationOverallRows = {};
    state.evaluationSummaryPositions = {};
    evaluationSearchInput.value = "";
    window.history.replaceState({}, "", "/evaluation");
    document.documentElement.dataset.initialEvaluationSelection = "false";
    renderEmptyEvaluationSelection(true, true);
    syncEvaluationSearchClearButton();
  }

  return true;`;

/**
 * Keep Saved Evaluation loading in memory after the first successful fetch.
 * The list cache is scoped to the active wallet, stores stable player identity,
 * and routes every saved-row selection through the standard hydration owner.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeEvaluationLoadLifecycle(artifacts) {
  const modalArtifacts = normalizeModalEntranceLifecycle(artifacts);
  const source = String(modalArtifacts?.core || "");
  if (!source) throw new Error("Cannot normalize Evaluation Load lifecycle without shared core.");

  let core = replaceRequired(
    source,
    EVALUATION_LOAD_FACADE,
    EVALUATION_LOAD_FACADE_WITH_BUSY,
    "Evaluation Load clears stale trigger focus and enters Uniform Loading only when its wallet-scoped list cache is unavailable",
  );
  core = replaceRequired(
    core,
    EVALUATION_LOAD_CLOSE_BINDING,
    EVALUATION_LOAD_CLOSE_BINDING_WITH_ESCAPE,
    "Saved Evaluations closes on Escape through the canonical shared modal owner",
  );

  const routeChunks = { ...(modalArtifacts?.routeChunks || {}) };
  const evaluationSource = String(routeChunks.evaluation || "");
  if (!evaluationSource) throw new Error("Cannot normalize Evaluation Load lifecycle without Evaluation route core.");

  let evaluation = replaceRequired(
    evaluationSource,
    EVALUATION_CREATE_SAVED_START,
    EVALUATION_CREATE_SAVED_START_WITH_CACHE,
    "Saved Evaluation cache helpers own wallet-scoped list and payload reuse",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_LOAD_LIST_NAME,
    EVALUATION_LOAD_LIST_NAME_WITH_CACHE,
    "Cached Saved Evaluation rows keep their player names after page data changes",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_LOAD_LIST_HANDLER,
    EVALUATION_LOAD_LIST_HANDLER_WITH_HYDRATION,
    "Saved Evaluation list rows expose their player name before saved-route hydration starts",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_LOAD_MODAL_START,
    EVALUATION_LOAD_MODAL_START_WITH_CACHE,
    "Evaluation saved-list modal reuses its wallet-scoped session cache",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_LOAD_RENDER,
    EVALUATION_LOAD_RENDER_WITH_CACHE,
    "Evaluation saved-list request populates self-contained list and payload caches",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_SAVED_LOAD_REQUEST,
    EVALUATION_SAVED_LOAD_REQUEST_WITH_CACHE,
    "Saved Evaluation routes show the known player name immediately and reuse cached payloads before making another request",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_MISSING_PLAYER_PAYLOAD,
    EVALUATION_MISSING_PLAYER_PAYLOAD_WITH_RECOVERY,
    "Saved and shared Evaluation payloads without a player ID enter canonical invalid-link recovery",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_UNRESOLVED_PLAYER_ROUTE,
    EVALUATION_UNRESOLVED_PLAYER_ROUTE_WITH_RECOVERY,
    "Shared Evaluation routes with an unresolved player enter canonical invalid-link recovery",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_UNRESOLVED_PLAYER_ROUTE,
    EVALUATION_UNRESOLVED_PLAYER_ROUTE_WITH_RECOVERY,
    "Saved Evaluation routes with an unresolved player enter canonical invalid-link recovery",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_INVALID_LINK_RECOVERY,
    EVALUATION_INVALID_LINK_RECOVERY_WITH_PLAIN_RESET,
    "Broken saved and shared links without a resolvable player synchronously restore plain Evaluation chrome and URL",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_SAVE_SUCCESS,
    EVALUATION_SAVE_SUCCESS_WITH_INVALIDATION,
    "A successful Evaluation save invalidates stale saved data",
  );
  evaluation = replaceRequired(
    evaluation,
    EVALUATION_DELETE_SUCCESS,
    EVALUATION_DELETE_SUCCESS_WITH_INVALIDATION,
    "A successful Evaluation deletion invalidates stale saved data",
  );
  routeChunks.evaluation = evaluation;

  return Object.freeze({
    ...modalArtifacts,
    core,
    routeChunks: Object.freeze(routeChunks),
  });
}
