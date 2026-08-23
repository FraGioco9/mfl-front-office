// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const SAVED_CACHE_ENTRY = `function rememberSavedEvaluationCacheEntry(entry) {
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
}`;

const SAVED_CACHE_ENTRY_WITH_VALUATION = `function rememberSavedEvaluationCacheEntry(entry) {
  const id = String(entry?.id || "").trim();
  if (!id || !entry?.payload) return null;
  const playerId = String(entry?.playerId || entry?.payload?.playerId || "").trim();
  const playerRow = playerId ? rowByPlayerId(playerId) : null;
  const cache = savedEvaluationPayloadCache();
  const cachedEntry = cache[id] || null;
  const computedPresentValue = evaluationPresentValueTotalFromPayload(entry.payload);
  const normalizedEntry = {
    ...entry,
    id,
    playerId,
    playerName: String(entry?.playerName || cachedEntry?.playerName || (playerRow ? formatCellValue(playerRow, "name") : "")).trim(),
    presentValue: Number.isFinite(entry?.presentValue)
      ? entry.presentValue
      : (Number.isFinite(cachedEntry?.presentValue)
        ? cachedEntry.presentValue
        : (Number.isFinite(computedPresentValue) ? computedPresentValue : null)),
  };
  cache[id] = normalizedEntry;
  return normalizedEntry;
}`;

const SAVED_LIST_VALUATION = `    const value = document.createElement("strong");
    value.className = "evaluationLoadPresentValue";
    const presentValue = evaluationPresentValueTotalFromPayload(entry.payload);
    value.textContent = Number.isFinite(presentValue) ? formatEvaluationCurrency(presentValue) : "-";`;

const SAVED_LIST_VALUATION_FROM_CACHE = `    const value = document.createElement("strong");
    value.className = "evaluationLoadPresentValue";
    const presentValue = Number.isFinite(entry?.presentValue)
      ? entry.presentValue
      : evaluationPresentValueTotalFromPayload(entry.payload);
    value.textContent = Number.isFinite(presentValue) ? formatEvaluationCurrency(presentValue) : "-";`;

const SAVED_LOAD_AFTER_PLAYER_HYDRATION = `      if (!playerPayload) throw new Error("Evaluation player is not available.");
    }
    state.evaluationSavedId = id;
    state.evaluationShareId = "";`;

const SAVED_LOAD_AFTER_PLAYER_HYDRATION_WITH_CACHE_REFRESH = `      if (!playerPayload) throw new Error("Evaluation player is not available.");
    }
    data = rememberSavedEvaluationCacheEntry(data) || data;
    state.evaluationSavedId = id;
    state.evaluationShareId = "";`;

/**
 * Keep the valuation shown in Saved Evaluations independent from transient
 * route rows. The first complete list hydration computes the value once and
 * keeps it with the wallet-scoped cached entry; saved-route hydration refreshes
 * the same entry after restoring a missing player row.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeEvaluationSavedValuationCache(artifacts) {
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  const evaluationSource = String(routeChunks.evaluation || "");
  if (!evaluationSource) throw new Error("Cannot normalize Saved Evaluation valuation cache without Evaluation route core.");

  let evaluation = replaceRequired(
    evaluationSource,
    SAVED_CACHE_ENTRY,
    SAVED_CACHE_ENTRY_WITH_VALUATION,
    "Saved Evaluation cache entries retain their computed valuation across route row replacement",
  );
  evaluation = replaceRequired(
    evaluation,
    SAVED_LIST_VALUATION,
    SAVED_LIST_VALUATION_FROM_CACHE,
    "Saved Evaluation list renders the cached valuation before consulting transient page rows",
  );
  evaluation = replaceRequired(
    evaluation,
    SAVED_LOAD_AFTER_PLAYER_HYDRATION,
    SAVED_LOAD_AFTER_PLAYER_HYDRATION_WITH_CACHE_REFRESH,
    "Saved Evaluation hydration refreshes cached identity and valuation after restoring its player row",
  );

  routeChunks.evaluation = evaluation;
  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze(routeChunks),
  });
}
