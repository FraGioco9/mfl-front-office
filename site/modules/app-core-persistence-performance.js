// @ts-check

import { replaceRequiredFunction } from "./app-core-splitter-utils.js";

const OPTIMIZED_RECENT_STORAGE_WRITE = `function saveRecentIdsToStorage(storageKey, ids) {
  try {
    const serializedIds = JSON.stringify(normalizeIdList(ids, 5));
    if (localStorage.getItem(storageKey) === serializedIds) return;
    localStorage.setItem(storageKey, serializedIds);
  } catch {
    // Recent search sync is best-effort when browser storage is blocked.
  }
}`;

const OPTIMIZED_TABLE_STATE_WRITE = `function saveTableStateLocally(savedState) {
  try {
    const serializedState = JSON.stringify(stripPersistentSortState(savedState));
    if (localStorage.getItem(FILTER_STORAGE_KEY) === serializedState) return;
    localStorage.setItem(FILTER_STORAGE_KEY, serializedState);
  } catch {
    // Filtering still works for this page even if the browser blocks storage.
  }
}`;

const OPTIMIZED_GUEST_WATCHLIST_WRITE = `function saveGuestWatchlist() {
  if (state.linkedWalletAddress && hasWalletProof()) {
    return;
  }

  try {
    const serializedPlayerIds = JSON.stringify(Array.from(state.watchlistPlayerIds));
    if (localStorage.getItem(GUEST_WATCHLIST_STORAGE_KEY) === serializedPlayerIds) return;
    localStorage.setItem(GUEST_WATCHLIST_STORAGE_KEY, serializedPlayerIds);
  } catch {
    // Watchlist still works for this page even if the browser blocks storage.
  }
}`;

export function optimizePersistenceRuntimeArtifacts(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  let core = String(input.core || "");
  if (!core) throw new Error("Cannot optimize persistence work without the shared application core.");

  core = replaceRequiredFunction(
    core,
    "saveRecentIdsToStorage",
    OPTIMIZED_RECENT_STORAGE_WRITE,
    "unchanged recent-search persistence writes",
  );

  core = replaceRequiredFunction(
    core,
    "saveTableStateLocally",
    OPTIMIZED_TABLE_STATE_WRITE,
    "unchanged Table-state persistence writes",
  );

  core = replaceRequiredFunction(
    core,
    "saveGuestWatchlist",
    OPTIMIZED_GUEST_WATCHLIST_WRITE,
    "unchanged guest-watchlist persistence writes",
  );

  return Object.freeze({
    ...input,
    core,
  });
}
