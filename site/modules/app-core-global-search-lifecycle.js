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

const TYPED_PLAYER_AGENT_CATEGORY_CAP = `  // Preserve each category so player matches cannot crowd agents out before
  // the club-search enhancer merges players -> clubs -> agents.
  return [...playerResults.slice(0, 5), ...agentResults.slice(0, 5)];`;

const TYPED_PLAYER_AGENT_TOTAL_CAP = `  // Keep category priority while giving typed Global Search one shared ten-result budget.
  // The club-search enhancer will insert clubs between players and agents before applying
  // the same overall cap.
  return [...playerResults, ...agentResults].slice(0, 10);`;

const CLUB_RESULT_CATEGORY_CAP = `    const clubResults = clubs.slice(0, 5).map(clubSearchResult);`;
const CLUB_RESULT_QUERY_BUDGET = `    const clubResults = clubs.slice(0, query ? 10 : 5).map(clubSearchResult);`;

const TYPED_CATEGORY_MERGE = `    const mergedResults = [
      ...playerResults.slice(0, 5),
      ...clubResults,
      ...agentResults.slice(0, 5),
    ];`;

const TYPED_TOTAL_MERGE = `    const mergedResults = [
      ...playerResults,
      ...clubResults,
      ...agentResults,
    ].slice(0, 10);`;

/**
 * Keep the canonical recent-five renderer authoritative throughout Global Search open
 * and give typed results one shared ten-result budget across players, clubs and agents.
 * Category priority remains players -> clubs -> agents, but no category has an artificial
 * five-result quota: whichever categories have enough matches fill the ten available rows.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeGlobalSearchOpenLifecycle(artifacts) {
  const source = String(artifacts?.core || "");
  if (!source) throw new Error("Cannot normalize Global Search lifecycle without shared core.");

  let core = replaceRequired(
    source,
    OPEN_SEARCH,
    OPEN_SEARCH_WITH_AUTHORITATIVE_RECENTS,
    "Global Search open keeps canonical recent-five rendering authoritative after search-index readiness",
  );
  core = replaceRequired(
    core,
    TYPED_PLAYER_AGENT_CATEGORY_CAP,
    TYPED_PLAYER_AGENT_TOTAL_CAP,
    "typed Global Search players and agents share the ten-result budget before club insertion",
  );
  core = replaceRequired(
    core,
    CLUB_RESULT_CATEGORY_CAP,
    CLUB_RESULT_QUERY_BUDGET,
    "typed Global Search clubs may fill the ten-result budget while recents remain capped to five",
  );
  core = replaceRequired(
    core,
    TYPED_CATEGORY_MERGE,
    TYPED_TOTAL_MERGE,
    "typed Global Search applies one ten-result cap after players clubs and agents are combined",
  );

  return Object.freeze({
    ...artifacts,
    core,
  });
}
