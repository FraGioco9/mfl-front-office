// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const OPEN_SEARCH = `async function openSearch() {
  showModal(searchModal);
  playerSearchInput.value = "";
  renderSearchResultsNow();
  window.setTimeout(() => playerSearchInput.focus(), 0);
  await ensureSearchIndexes();
  renderSearchResultsNow();
}`;

const OPEN_SEARCH_WITH_AUTHORITATIVE_RECENTS = `async function openSearch() {
  showModal(searchModal);
  playerSearchInput.value = "";

  const renderAuthoritativeRecentSearches = async () => {
    const renderRecent = window.__mflGlobalSearchRuntime?.recent;
    if (typeof renderRecent !== "function") return false;
    return Boolean(await renderRecent());
  };

  void renderAuthoritativeRecentSearches().then((rendered) => {
    if (!rendered && !playerSearchInput.value.trim()) renderSearchResultsNow();
  });
  window.setTimeout(() => playerSearchInput.focus(), 0);
  await ensureSearchIndexes();
  if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();
}`;

/**
 * Keep the canonical recent-five renderer authoritative throughout Global Search open.
 * The core's live search indexes may still contain only the last typed result, so a
 * legacy render after ensureSearchIndexes() can collapse the visible empty state to
 * that one item. Delegate both empty renders to the Global Search runtime first and
 * fall back to the legacy core renderer only when no canonical recent state renders.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeGlobalSearchOpenLifecycle(artifacts) {
  const source = String(artifacts?.core || "");
  if (!source) throw new Error("Cannot normalize Global Search open lifecycle without shared core.");

  return Object.freeze({
    ...artifacts,
    core: replaceRequired(
      source,
      OPEN_SEARCH,
      OPEN_SEARCH_WITH_AUTHORITATIVE_RECENTS,
      "Global Search open keeps canonical recent-five rendering authoritative after search-index readiness",
    ),
  });
}
