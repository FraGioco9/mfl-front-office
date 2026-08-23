// @ts-check

import { replaceRequiredFunction } from "./app-core-splitter-utils.js";

const COUNTED_SEARCH_INDEX = `function buildSearchIndex(options = {}) {
  if (state.searchIndexesLoaded && state.searchIndex.length && !options.force) {
    return;
  }

  state.searchIndex = state.rows.map((row) => buildPlayerSearchEntryFromRow(row));
  if (!state.evaluationSearchIndex.length || options.force) {
    state.evaluationSearchIndex = [...state.searchIndex];
  }

  const agentsByWallet = new Map();
  const addAgent = (walletAddress, name, playerCountIncrement = 0) => {
    const entry = buildAgentSearchEntry(walletAddress, name, playerCountIncrement);
    if (!entry) {
      return;
    }

    const existing = agentsByWallet.get(entry.walletAddress);
    if (existing) {
      if (playerCountIncrement > 0) {
        existing.playerCount = Number(existing.playerCount || 0) + playerCountIncrement;
      }
      return;
    }

    agentsByWallet.set(entry.walletAddress, entry);
    if (entry.name) saveAgentDisplayName(entry.walletAddress, entry.name);
  };

  state.walletRows.forEach((wallet) => addAgent(wallet.wallet_address, wallet.wallet_name));
  state.rows.forEach((row) => addAgent(getValue(row, "wallet_address"), getValue(row, "wallet_name"), 1));
  state.agentSearchIndex = Array.from(agentsByWallet.values());
  state.searchIndexesLoaded = true;
  if (state.currentPage === "agents" && tablePageTitle) {
      renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  }
}`;

const REUSED_AGENT_COUNTS = `function bestSearchResults(query) {
  if ((!state.searchIndex.length && state.rows.length) || (!state.agentSearchIndex.length && (state.rows.length || state.walletRows.length))) {
    buildSearchIndex();
  }

  const relevanceSort = (a, b) => (
    b.score - a.score
    || b.overall - a.overall
    || String(a.label).localeCompare(String(b.label))
  );

  const playerResults = state.searchIndex
    .map((entry) => ({
      type: "player",
      entry,
      row: entry.row || null,
      score: Math.max(searchMatchScore(query, entry.name, entry.id), searchMatchScore(query, entry.id, entry.name)),
      overall: entry.overall,
      label: entry.nameDisplay,
    }))
    .filter((result) => result.score > 0)
    .sort(relevanceSort);

  const agentResults = state.agentSearchIndex
    .map((entry) => ({
      ...entry,
      score: Math.max(searchMatchScore(query, entry.nameText, entry.walletText), searchMatchScore(query, entry.walletText, entry.nameText)),
      playerCount: Number(entry.playerCount || 0),
      overall: -1,
      label: entry.name,
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => (
      b.score - a.score
      || b.playerCount - a.playerCount
      || String(a.label).localeCompare(String(b.label))
    ));

  // Keep category priority while giving typed Global Search one shared ten-result budget.
  // The club-search enhancer will insert clubs between players and agents before applying
  // the same overall cap.
  return [...playerResults, ...agentResults].slice(0, 10);
}`;

export function optimizeGlobalSearchRuntimeArtifacts(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = { ...(input.routeChunks || {}) };
  let core = String(input.core || "");
  let search = String(routeChunks.search || "");
  if (!core) throw new Error("Cannot optimize Global Search without shared core.");
  if (!search) throw new Error("Cannot optimize Global Search without its action chunk.");

  core = replaceRequiredFunction(
    core,
    "buildSearchIndex",
    COUNTED_SEARCH_INDEX,
    "Global Search local agent player counts accumulated during index construction",
  );
  search = replaceRequiredFunction(
    search,
    "bestSearchResults",
    REUSED_AGENT_COUNTS,
    "Global Search indexed agent player-count reuse",
  );

  routeChunks.search = search;
  return Object.freeze({
    ...input,
    core,
    routeChunks: Object.freeze(routeChunks),
  });
}
