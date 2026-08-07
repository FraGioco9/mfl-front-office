(() => {
  const VERSION = String(window.__mflReleaseVersion || "1.121.0");
  const DATA_FILE_PATTERN = /^(manifest\.json|players_\d{4}\.json|players_public\.json|players_mfl_public\.json|players_progression\.json|players_search\.json|agents_search\.json|wallets\.json)$/;

  window.__mflSqlDataRuntime?.destroy?.();

  const originalFetch = window.fetch.bind(window);
  let wrappedFetch = null;
  let frame = 0;
  let interval = 0;
  let debounce = 0;
  let requestSequence = 0;
  let installed = false;
  let originalEnsureSearchIndexes = null;
  let originalGlobalRender = null;
  let originalEvaluationRender = null;
  let originalCanUseStaticDataFile = null;

  function rewrittenDataUrl(resource) {
    const rawUrl = resource instanceof Request ? resource.url : resource;
    let url;
    try {
      url = new URL(String(rawUrl || ""), window.location.href);
    } catch {
      return "";
    }
    if (url.origin !== window.location.origin) return "";

    if (url.pathname === "/summary.json") {
      return "/api/summary";
    }
    if (!url.pathname.startsWith("/data/")) return "";

    const fileName = decodeURIComponent(url.pathname.slice("/data/".length));
    if (!DATA_FILE_PATTERN.test(fileName)) return "";
    const query = new URLSearchParams({
      file: fileName,
      access: "public-database",
    });
    return `/api/data?${query.toString()}`;
  }

  wrappedFetch = function fetchSqlRuntimeData(resource, options) {
    const rewritten = rewrittenDataUrl(resource);
    if (!rewritten) return originalFetch(resource, options);
    return originalFetch(rewritten, options);
  };
  window.fetch = wrappedFetch;

  function compactValue(row, columns, column) {
    const index = columns.indexOf(column);
    return index >= 0 ? row[index] : null;
  }

  function emptySearchPayload() {
    return {
      players: { columns: [], rows: [] },
      agents: { columns: [], rows: [] },
      clubs: [],
    };
  }

  function normalizePayload(payload, type) {
    if (type === "players") {
      return {
        players: {
          columns: Array.isArray(payload?.columns) ? payload.columns : [],
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
        },
        agents: { columns: [], rows: [] },
        clubs: [],
      };
    }
    return {
      players: payload?.players || { columns: [], rows: [] },
      agents: payload?.agents || { columns: [], rows: [] },
      clubs: Array.isArray(payload?.clubs) ? payload.clubs : [],
    };
  }

  function applySearchPayload(payload, type = "all") {
    const normalized = normalizePayload(payload, type);
    const players = normalized.players;
    const agents = normalized.agents;
    const playerColumns = Array.isArray(players.columns) ? players.columns : [];
    const agentColumns = Array.isArray(agents.columns) ? agents.columns : [];

    state.searchIndex = Array.isArray(players.rows)
      ? players.rows
        .map((row) => buildPlayerSearchEntryFromCompactRow(row, playerColumns))
        .filter(Boolean)
      : [];

    if (type !== "players") {
      state.agentSearchIndex = Array.isArray(agents.rows)
        ? agents.rows
          .map((row) => buildAgentSearchEntry(
            compactValue(row, agentColumns, "wallet_address"),
            compactValue(row, agentColumns, "wallet_name"),
            compactValue(row, agentColumns, "player_count"),
          ))
          .filter(Boolean)
        : [];
      state.clubSearchIndex = normalized.clubs
        .map((club) => ({
          clubId: String(club?.clubId || ""),
          name: String(club?.name || ""),
          division: Number.isFinite(Number(club?.division)) ? Number(club.division) : null,
          searchText: normalizeSearchText(`${club?.name || ""} ${club?.clubId || ""}`),
        }))
        .filter((club) => club.clubId && club.name);
    }
    state.searchIndexesLoaded = true;
  }

  function clearSearchPayload(type) {
    state.searchIndex = [];
    if (type !== "players") {
      state.agentSearchIndex = [];
      state.clubSearchIndex = [];
    }
    state.searchIndexesLoaded = true;
  }

  function currentGlobalQuery() {
    return typeof playerSearchInput !== "undefined"
      ? String(playerSearchInput.value || "").trim()
      : "";
  }

  function currentEvaluationQuery() {
    return typeof evaluationSearchInput !== "undefined"
      ? String(evaluationSearchInput.value || "").trim()
      : "";
  }

  function refreshVisibleResults(type) {
    if (type !== "players"
        && typeof searchModal !== "undefined"
        && searchModal
        && !searchModal.hidden
        && typeof originalGlobalRender === "function") {
      originalGlobalRender();
    }
    if (type === "players"
        && typeof evaluationSearchInput !== "undefined"
        && document.activeElement === evaluationSearchInput
        && typeof originalEvaluationRender === "function") {
      originalEvaluationRender();
    }
  }

  function recentIdentifiers() {
    const playerIds = new Set();
    const walletAddresses = new Set();
    const clubIds = new Set();
    const items = Array.isArray(state.recentSearchItems) ? state.recentSearchItems : [];

    items.forEach((item) => {
      const value = String(item || "");
      if (value.startsWith("player:")) playerIds.add(value.slice("player:".length));
      else if (value.startsWith("agent:")) walletAddresses.add(value.slice("agent:".length));
      else if (value.startsWith("club:")) clubIds.add(value.slice("club:".length));
    });
    (Array.isArray(state.recentSearchPlayerIds) ? state.recentSearchPlayerIds : [])
      .forEach((value) => playerIds.add(String(value || "")));
    (Array.isArray(state.recentSearchAgentWallets) ? state.recentSearchAgentWallets : [])
      .forEach((value) => walletAddresses.add(String(value || "")));
    (Array.isArray(state.recentEvaluationPlayerIds) ? state.recentEvaluationPlayerIds : [])
      .forEach((value) => playerIds.add(String(value || "")));

    return {
      playerIds: [...playerIds].filter(Boolean).slice(0, 20),
      walletAddresses: [...walletAddresses].filter(Boolean).slice(0, 20),
      clubIds: [...clubIds].filter(Boolean).slice(0, 20),
    };
  }

  async function fetchSearchPayload(query, type, sequence) {
    const parameters = new URLSearchParams({
      mode: "search",
      type,
      limit: "20",
    });
    if (query) {
      parameters.set("q", query);
    } else {
      const recent = recentIdentifiers();
      parameters.set("type", "recent");
      if (recent.playerIds.length) parameters.set("playerIds", recent.playerIds.join(","));
      if (recent.walletAddresses.length) parameters.set("walletAddresses", recent.walletAddresses.join(","));
      if (recent.clubIds.length) parameters.set("clubIds", recent.clubIds.join(","));
    }

    const response = await originalFetch(`/api/data?${parameters.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Could not search the database.");
    }
    if (sequence !== requestSequence) return false;

    const currentQuery = type === "players"
      ? currentEvaluationQuery()
      : currentGlobalQuery();
    if (normalizeSearchText(currentQuery) !== normalizeSearchText(query)) return false;

    if (!query && type === "players") {
      applySearchPayload(payload?.players || {}, "players");
    } else {
      applySearchPayload(payload, type);
    }
    refreshVisibleResults(type);
    return true;
  }

  function requestSearch(rawQuery, type, immediate = false) {
    const query = String(rawQuery || "").trim();
    if (debounce) {
      clearTimeout(debounce);
      debounce = 0;
    }
    const sequence = ++requestSequence;
    clearSearchPayload(type);

    const run = () => fetchSearchPayload(query, type, sequence)
      .catch((error) => {
        if (sequence === requestSequence) {
          applySearchPayload(emptySearchPayload(), type);
          refreshVisibleResults(type);
        }
        console.error(error?.message || "Could not search the SQLite database.");
        return false;
      });

    if (immediate) return run();
    debounce = window.setTimeout(() => {
      debounce = 0;
      void run();
    }, 100);
    return Promise.resolve(true);
  }

  function install() {
    if (installed
        || typeof state !== "object"
        || typeof renderSearchResultsNow !== "function"
        || typeof renderEvaluationSearchResults !== "function") {
      return;
    }

    installed = true;
    originalEnsureSearchIndexes = typeof ensureSearchIndexes === "function"
      ? ensureSearchIndexes
      : null;
    originalGlobalRender = renderSearchResultsNow;
    originalEvaluationRender = renderEvaluationSearchResults;
    originalCanUseStaticDataFile = typeof canUseStaticDataFile === "function"
      ? canUseStaticDataFile
      : null;

    if (originalCanUseStaticDataFile) {
      canUseStaticDataFile = () => false;
    }

    ensureSearchIndexes = async function ensureSqlSearchReady() {
      await requestSearch("", "all", true);
      state.searchIndexesLoaded = true;
      return true;
    };

    renderSearchResultsNow = function renderSqlSearchResults() {
      void requestSearch(currentGlobalQuery(), "all");
      return originalGlobalRender.apply(this, arguments);
    };

    renderEvaluationSearchResults = function renderSqlEvaluationSearchResults() {
      void requestSearch(currentEvaluationQuery(), "players");
      return originalEvaluationRender.apply(this, arguments);
    };

    if (interval) {
      clearInterval(interval);
      interval = 0;
    }
  }

  function schedule() {
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        install();
      });
    }
  }

  interval = window.setInterval(schedule, 50);
  schedule();

  function destroy() {
    if (frame) cancelAnimationFrame(frame);
    if (interval) clearInterval(interval);
    if (debounce) clearTimeout(debounce);
    requestSequence += 1;

    if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    if (installed) {
      if (originalEnsureSearchIndexes) ensureSearchIndexes = originalEnsureSearchIndexes;
      if (originalGlobalRender) renderSearchResultsNow = originalGlobalRender;
      if (originalEvaluationRender) renderEvaluationSearchResults = originalEvaluationRender;
      if (originalCanUseStaticDataFile) canUseStaticDataFile = originalCanUseStaticDataFile;
    }
  }

  window.__mflSqlDataRuntime = {
    version: VERSION,
    destroy,
    sync: schedule,
  };
})();
