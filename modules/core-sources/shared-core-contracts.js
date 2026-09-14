;(() => {
  function tableHeaderContext() {
    if (typeof buildHeader !== "function") return null;
    const head = document.getElementById("tableHead");
    if (!(head instanceof HTMLTableSectionElement)) return null;
    const page = typeof tablePageKey === "function"
      ? (tablePageKey() || state.currentPage || "")
      : (state.currentPage || "");
    const signature = [page, state.view, state.sortKey, state.sortDirection].join("|");
    return { head, page, signature };
  }

  function ensureCanonicalTableHeader() {
    const context = tableHeaderContext();
    if (!context) return false;
    const { head, signature } = context;
    const staticHeader = head.dataset.mflStaticHeader === "true";
    const staticSignature = String(head.dataset.mflHeaderSignature || "");
    const staticPage = String(document.documentElement.dataset.initialTablePage || "").toLowerCase();
    const staticView = String(document.documentElement.dataset.initialTableView || "").toLowerCase();
    const currentPage = String(state.currentPage || "").toLowerCase();
    const currentView = String(state.view || "").toLowerCase();
    const stagedViewCommit = pendingViewTransition?.pageName === currentPage
      && pendingViewTransition?.viewName === currentView;
    const staticRoutePending = staticHeader
      && !stagedViewCommit
      && staticPage
      && staticView
      && (currentPage !== staticPage || currentView !== staticView);
    if (staticRoutePending) return true;
    if (staticHeader && !stagedViewCommit && staticSignature && staticSignature !== signature) return true;
    const needsCanonicalBuild = !head.rows[0] || staticHeader || staticSignature !== signature;
    if (needsCanonicalBuild) buildHeader();
    if (!head.rows[0]) return false;
    if (needsCanonicalBuild) {
      head.dataset.mflHeaderSignature = signature;
      delete head.dataset.mflStaticHeader;
    }
    return head.dataset.mflStaticHeader === "true" || head.dataset.mflHeaderSignature === signature;
  }

  

  const searchTokens = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const orderedTokensMatch = (text, query) => {
    const haystack = searchTokens(text).join(" ");
    const tokens = searchTokens(query);
    if (!tokens.length) return false;
    let cursor = 0;
    for (const token of tokens) {
      const index = haystack.indexOf(token, cursor);
      if (index < 0) return false;
      cursor = index + token.length;
    }
    return true;
  };

  function installSearchMatching() {
    if (typeof normalizeSearchText !== "function") return false;

    if (typeof searchMatchScore === "function" && !searchMatchScore.__mflSurnameFirst) {
      const surnameFirstSearchMatchScore = function(query, primaryText, secondaryText = "") {
        const normalizedQuery = normalizeSearchText(query);
        const primary = normalizeSearchText(primaryText);
        const secondary = normalizeSearchText(secondaryText);
        const primaryIsPlayerName = /^\d+$/.test(secondary) && primary && !/^\d+$/.test(primary);

        if (primaryIsPlayerName) {
          const surname = searchTokens(primary).at(-1) || "";
          if (secondary === normalizedQuery) return 120;
          if (surname === normalizedQuery) return 110;
          if (surname.startsWith(normalizedQuery)) return 95;
          if (primary === normalizedQuery) return 90;
          if (secondary.startsWith(normalizedQuery)) return 85;
          if (primary.startsWith(normalizedQuery)) return 75;
          if (surname.includes(normalizedQuery)) return 65;
          if (primary.includes(normalizedQuery)) return 50;
          if (orderedTokensMatch(primary, normalizedQuery)) return 45;
          if (secondary.includes(normalizedQuery)) return 40;
          return 0;
        }

        if (primary === normalizedQuery || secondary === normalizedQuery) return 100;
        if (primary.startsWith(normalizedQuery)) return 80;
        if (secondary.startsWith(normalizedQuery)) return 70;
        if (primary.includes(normalizedQuery)) return 50;
        if (secondary.includes(normalizedQuery)) return 40;
        if (orderedTokensMatch(primary, normalizedQuery)) return 45;
        if (orderedTokensMatch(secondary, normalizedQuery)) return 35;
        return 0;
      };
      Object.defineProperty(surnameFirstSearchMatchScore, "__mflSurnameFirst", { value: true });
      searchMatchScore = surnameFirstSearchMatchScore;
    }

    if (typeof evaluationSearchMatches === "function" && !evaluationSearchMatches.__mflSurnameFirst) {
      const surnameFirstEvaluationSearchMatches = function(query) {
        if (!state.evaluationSearchIndex.length && state.rows.length) buildSearchIndex();
        const results = [];
        state.evaluationSearchIndex.forEach((entry) => {
          if (entry.retired) return;
          const score = searchMatchScore(query, entry.name, entry.id);
          if (score <= 0) return;
          results.push({ entry, score });
        });
        return results
          .sort((a, b) => b.score - a.score
            || b.entry.overall - a.entry.overall
            || a.entry.nameDisplay.localeCompare(b.entry.nameDisplay))
          .slice(0, 5)
          .map((result) => result.entry);
      };
      Object.defineProperty(surnameFirstEvaluationSearchMatches, "__mflSurnameFirst", { value: true });
      evaluationSearchMatches = surnameFirstEvaluationSearchMatches;
    }
    return true;
  }

  function renderGlobalSearchResults() {
    if (typeof renderSearchResultsNow !== "function") return false;
    renderSearchResultsNow();
    return true;
  }

  function renderCurrentEvaluationSearchResults(options = {}) {
    if (typeof renderEvaluationSearchResults !== "function") return false;
    return renderEvaluationSearchResults(options) !== false;
  }

  function resetCurrentEvaluationSelection() {
    if (typeof resetEvaluationSelection !== "function") return false;
    resetEvaluationSelection();
    return true;
  }

  function applySearchPayload(payload, type = "all") {
    if (typeof applyDatabaseSearchPayload !== "function") return false;
    applyDatabaseSearchPayload(payload, type);
    return true;
  }

  function invalidateDatabaseSearch(type = "all") {
    if (typeof databaseSearchAbortControllers !== "undefined") {
      databaseSearchAbortControllers.get(type)?.abort?.();
    }
    if (typeof databaseSearchSequences !== "undefined") {
      databaseSearchSequences.set(type, (databaseSearchSequences.get(type) || 0) + 1);
    }
  }

  function evaluationRecentPlayerIds() {
    return Array.isArray(state.recentEvaluationPlayerIds)
      ? normalizeIdList(state.recentEvaluationPlayerIds, 5)
      : [];
  }

  function setEvaluationRecentPlayerIds(ids) {
    state.recentEvaluationPlayerIds = normalizeIdList(Array.isArray(ids) ? ids : [], 5);
    return [...state.recentEvaluationPlayerIds];
  }

  function evaluationSearchEntry(playerId) {
    const key = String(playerId || "").trim();
    if (!key || !Array.isArray(state.evaluationSearchIndex)) return null;
    return state.evaluationSearchIndex.find((item) => String(item?.playerId || "") === key) || null;
  }

  function buildEvaluationRecentEntries(payload) {
    const columns = Array.isArray(payload?.columns) ? payload.columns : [];
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    if (typeof buildPlayerSearchEntryFromCompactRow !== "function") return [];
    return rows
      .map((row) => buildPlayerSearchEntryFromCompactRow(row, columns))
      .filter((entry) => entry && !entry.retired);
  }

  async function persistEvaluationRecentPlayerIds(ids) {
    setEvaluationRecentPlayerIds(ids);
    if (state.walletPreferencesSaveTimer) {
      window.clearTimeout(state.walletPreferencesSaveTimer);
      state.walletPreferencesSaveTimer = null;
    }
    if (!state.linkedWalletAddress
      || typeof hasWalletProof !== "function"
      || !hasWalletProof()
      || typeof saveWalletPreferencesNow !== "function") {
      return false;
    }
    try {
      await saveWalletPreferencesNow({ domains: ["tableState"] });
      return true;
    } catch {
      return false;
    }
  }

  function installEvaluationRecentRowsOwner(provider) {
    if (typeof recentEvaluationRows !== "function" || typeof provider !== "function") return false;
    if (recentEvaluationRows.__mflSupabaseOnly) return true;
    const supabaseRecentRows = function() {
      const entries = provider();
      return Array.isArray(entries) ? entries.slice(0, 5) : [];
    };
    Object.defineProperty(supabaseRecentRows, "__mflSupabaseOnly", { value: true });
    recentEvaluationRows = supabaseRecentRows;
    return true;
  }

  function installEvaluationEmptySearchOwner(restore) {
    if (typeof requestDatabaseSearch !== "function" || typeof restore !== "function") return false;
    if (requestDatabaseSearch.__mflEvaluationSupabaseOnly) return true;
    const originalRequestDatabaseSearch = requestDatabaseSearch;
    const supabaseOnlyRequestDatabaseSearch = function(rawQuery = "", type = "all", options = {}) {
      if (type === "players" && !String(rawQuery || "").trim()) {
        return Promise.resolve(restore(Boolean(options?.force)));
      }
      return originalRequestDatabaseSearch.apply(this, arguments);
    };
    Object.defineProperty(supabaseOnlyRequestDatabaseSearch, "__mflEvaluationSupabaseOnly", { value: true });
    requestDatabaseSearch = supabaseOnlyRequestDatabaseSearch;
    return true;
  }

  function installEvaluationRecentWriteOwner(commit) {
    if (typeof rememberEvaluationResult !== "function" || typeof commit !== "function") return false;
    if (rememberEvaluationResult.__mflSupabaseImmediate) return true;
    const originalRememberEvaluationResult = rememberEvaluationResult;
    const supabaseImmediateRememberEvaluationResult = function(playerId) {
      const result = originalRememberEvaluationResult.apply(this, arguments);
      commit(playerId);
      return result;
    };
    Object.defineProperty(supabaseImmediateRememberEvaluationResult, "__mflSupabaseImmediate", { value: true });
    rememberEvaluationResult = supabaseImmediateRememberEvaluationResult;
    return true;
  }

  let evaluationRecentStateHydrated = false;

  function installEvaluationRecentStateOwnership() {
    if (typeof restoreRecentEvaluationState !== "function"
      || typeof persistRecentSearchStates !== "function") return false;
    if (restoreRecentEvaluationState.__mflRecentStateOnly) return true;

    state.recentEvaluationPlayerIds = [];

    const recentStateOnlyRestore = function(savedState) {
      const incoming = savedState && typeof savedState === "object" && !Array.isArray(savedState)
        && Array.isArray(savedState.recentEvaluationPlayerIds)
        ? savedState.recentEvaluationPlayerIds
        : [];
      state.recentEvaluationPlayerIds = normalizeIdList(incoming, 5);
      evaluationRecentStateHydrated = true;
      if (/^\/evaluation\/?$/i.test(window.location.pathname)) {
        void window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false, true);
      }
    };
    Object.defineProperty(recentStateOnlyRestore, "__mflRecentStateOnly", { value: true });
    restoreRecentEvaluationState = recentStateOnlyRestore;

    persistRecentSearchStates = function persistSearchStatesWithoutEvaluationLocalStorage() {
      saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
      saveRecentIdsToStorage(RECENT_AGENT_SEARCH_STORAGE_KEY, state.recentSearchAgentWallets);
      saveRecentIdsToStorage(RECENT_MIXED_SEARCH_STORAGE_KEY, state.recentSearchItems);
    };

    return true;
  }

  async function ensureEvaluationRecentStateHydrated(options = {}) {
    const force = Boolean(options.force);
    if (evaluationRecentStateHydrated && !force) return true;

    const pendingStartup = window.__mflWalletPreferencesStartupPromise;
    if (!force && pendingStartup && typeof pendingStartup.then === "function") {
      await Promise.resolve(pendingStartup).catch(() => undefined);
      if (evaluationRecentStateHydrated) return true;
    }

    if (!state.linkedWalletAddress
      || typeof hasWalletProof !== "function"
      || !hasWalletProof()
      || typeof loadWalletPreferences !== "function") {
      return false;
    }

    if (force) evaluationRecentStateHydrated = false;
    await loadWalletPreferences({ force });
    return evaluationRecentStateHydrated;
  }

  window.__mflCoreContracts = Object.freeze({
    ensureCanonicalTableHeader,
    syncTableSelectionHeader,
    installSearchMatching,
    renderGlobalSearchResults,
    renderCurrentEvaluationSearchResults,
    resetCurrentEvaluationSelection,
    applySearchPayload,
    invalidateDatabaseSearch,
    evaluationRecentPlayerIds,
    setEvaluationRecentPlayerIds,
    evaluationSearchEntry,
    buildEvaluationRecentEntries,
    persistEvaluationRecentPlayerIds,
    installEvaluationRecentRowsOwner,
    installEvaluationEmptySearchOwner,
    installEvaluationRecentWriteOwner,
    installEvaluationRecentStateOwnership,
    evaluationRecentStateHydrated: () => evaluationRecentStateHydrated,
    ensureEvaluationRecentStateHydrated,
  });
})();
