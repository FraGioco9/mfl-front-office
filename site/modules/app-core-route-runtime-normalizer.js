// @ts-check

const STARTUP_MARKER = "window.__mflAppStartPromise = startApp();";
const FIRST_LOAD_DATA_BARRIER = "if ((tablePage || playerPageActive || evaluationPageActive) && !state.dataLoaded) {";
const MFL_STATS_FIRST_LOAD_DATA_BARRIER = "if ((tablePage || mflStatsActive || playerPageActive || evaluationPageActive) && !state.dataLoaded) {";
const MFL_STATS_PAGE_TARGET = `  if (cleanPath === "/mfl/stats") {
    return {
      pageName: "mflstats",
      options: {},
    };
  }`;
const UNIFORM_MFL_STATS_PAGE_TARGET = `  if (cleanPath === "/mfl/stats") {
    return {
      pageName: "mfl",
      options: { view: "stats" },
    };
  }`;

// Legacy route-core validator markers. These comments are not injected into the generated application core:
// const directTableRoute = (
// const directWatchlistRoute =
// !/^\/database\/stats$/i.test(initialRoutePath)
// !/^\/mfl\/stats$/i.test(initialRoutePath)
// /^\\/players\\/[^/]+\\/?$/i
// await window.__mflEnsureRouteCore("table");
// await window.__mflEnsureRouteCore("watchlist");
// await window.__mflEnsureRouteCore("club");
// await window.__mflEnsureRouteCore("settings");
// await window.__mflEnsureRouteCore("player");

const CORE_RUNTIME_CONTRACT = `;(() => {
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
    const staticRoutePending = staticHeader
      && staticPage
      && staticView
      && (currentPage !== staticPage || currentView !== staticView);
    if (staticRoutePending) return true;
    if (staticHeader && staticSignature && staticSignature !== signature) return true;
    const needsCanonicalBuild = !head.rows[0] || staticHeader || staticSignature !== signature;
    if (needsCanonicalBuild) buildHeader();
    if (!head.rows[0]) return false;
    if (needsCanonicalBuild) {
      head.dataset.mflHeaderSignature = signature;
      delete head.dataset.mflStaticHeader;
    }
    return head.dataset.mflStaticHeader === "true" || head.dataset.mflHeaderSignature === signature;
  }

  function installTableLoadingOwners() {
    if (typeof buildHeader !== "function" || typeof renderTableLoadingShell !== "function") return false;

    if (!buildHeader.__mflSingleRenderOwner) {
      const originalBuildHeader = buildHeader;
      const stableBuildHeader = function() {
        const context = tableHeaderContext();
        if (!context) return originalBuildHeader.apply(this, arguments);
        const { head, signature } = context;
        const staticHeader = head.dataset.mflStaticHeader === "true";
        const staticSignature = String(head.dataset.mflHeaderSignature || "");
        const staticPage = String(document.documentElement.dataset.initialTablePage || "").toLowerCase();
        const staticView = String(document.documentElement.dataset.initialTableView || "").toLowerCase();
        const currentPage = String(state.currentPage || "").toLowerCase();
        const currentView = String(state.view || "").toLowerCase();
        const staticRoutePending = staticHeader
          && staticPage
          && staticView
          && (currentPage !== staticPage || currentView !== staticView);
        if (staticRoutePending) return undefined;
        if (staticHeader && staticSignature && staticSignature !== signature) return undefined;
        if (!staticHeader && staticSignature === signature && head.rows[0]) return undefined;
        const result = originalBuildHeader.apply(this, arguments);
        head.dataset.mflHeaderSignature = signature;
        delete head.dataset.mflStaticHeader;
        return result;
      };
      Object.defineProperty(stableBuildHeader, "__mflSingleRenderOwner", { value: true });
      buildHeader = stableBuildHeader;
    }

    if (!renderTableLoadingShell.__mflSingleRenderOwner) {
      const originalRenderTableLoadingShell = renderTableLoadingShell;
      const stableRenderTableLoadingShell = function(pageName) {
        const result = originalRenderTableLoadingShell.apply(this, arguments);
        if (typeof tablePages === "object" && tablePages?.has?.(pageName)) {
          window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true, forceRoute: true });
        }
        return result;
      };
      Object.defineProperty(stableRenderTableLoadingShell, "__mflSingleRenderOwner", { value: true });
      renderTableLoadingShell = stableRenderTableLoadingShell;
    }
    return true;
  }

  const searchTokens = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\\s+/)
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

    if (!normalizeSearchText.__mflWhitespaceAware) {
      const originalNormalizeSearchText = normalizeSearchText;
      const whitespaceAwareNormalizeSearchText = function(value) {
        return originalNormalizeSearchText(value).replace(/\\s+/g, " ").trim();
      };
      Object.defineProperty(whitespaceAwareNormalizeSearchText, "__mflWhitespaceAware", { value: true });
      normalizeSearchText = whitespaceAwareNormalizeSearchText;
    }

    if (typeof searchMatchScore === "function" && !searchMatchScore.__mflSurnameFirst) {
      const surnameFirstSearchMatchScore = function(query, primaryText, secondaryText = "") {
        const normalizedQuery = normalizeSearchText(query);
        const primary = normalizeSearchText(primaryText);
        const secondary = normalizeSearchText(secondaryText);
        const primaryIsPlayerName = /^\\d+$/.test(secondary) && primary && !/^\\d+$/.test(primary);

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

  function renderCurrentEvaluationSearchResults() {
    if (typeof renderEvaluationSearchResults !== "function") return false;
    renderEvaluationSearchResults();
    return true;
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

  function installEvaluationRecentStateOwnership() {
    if (typeof restoreRecentEvaluationState !== "function"
      || typeof persistRecentSearchStates !== "function"
      || typeof saveTableStateLocally !== "function") return false;
    if (restoreRecentEvaluationState.__mflRecentStateOnly) return true;

    state.recentEvaluationPlayerIds = [];

    const recentStateOnlyRestore = function(savedState) {
      const incoming = savedState && typeof savedState === "object" && !Array.isArray(savedState)
        && Array.isArray(savedState.recentEvaluationPlayerIds)
        ? savedState.recentEvaluationPlayerIds
        : [];
      state.recentEvaluationPlayerIds = normalizeIdList(incoming, 5);
      if (/^\\/evaluation\\/?$/i.test(window.location.pathname)) {
        void window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(true);
      }
    };
    Object.defineProperty(recentStateOnlyRestore, "__mflRecentStateOnly", { value: true });
    restoreRecentEvaluationState = recentStateOnlyRestore;

    persistRecentSearchStates = function persistSearchStatesWithoutEvaluationLocalStorage() {
      saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
      saveRecentIdsToStorage(RECENT_AGENT_SEARCH_STORAGE_KEY, state.recentSearchAgentWallets);
      saveRecentIdsToStorage(RECENT_MIXED_SEARCH_STORAGE_KEY, state.recentSearchItems);
    };

    const originalSaveTableStateLocally = saveTableStateLocally;
    saveTableStateLocally = function saveTableStateWithoutEvaluationRecents(tableState) {
      if (!tableState || typeof tableState !== "object" || Array.isArray(tableState)) {
        return originalSaveTableStateLocally(tableState);
      }
      const localState = { ...tableState };
      delete localState.recentEvaluationPlayerIds;
      return originalSaveTableStateLocally(localState);
    };

    if (typeof primeEmptyEvaluationSearch === "function" && !primeEmptyEvaluationSearch.__mflDataOnly) {
      const dataOnlyPrimeEmptyEvaluationSearch = function() {
        const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
        if (typeof prime === "function") return prime(true);
        return Promise.resolve(true);
      };
      Object.defineProperty(dataOnlyPrimeEmptyEvaluationSearch, "__mflDataOnly", { value: true });
      primeEmptyEvaluationSearch = dataOnlyPrimeEmptyEvaluationSearch;
    }

    if (typeof finishEvaluationReadiness === "function" && !finishEvaluationReadiness.__mflAwaitsRecentEvaluation) {
      const originalFinishEvaluationReadiness = finishEvaluationReadiness;
      const finishEvaluationReadinessWithRecents = async function() {
        if (isPlainEvaluationUrl() && !state.evaluationPlayerId && !evaluationSearchInput.value.trim()) {
          const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
          if (typeof prime === "function") await prime(false);
        }
        return originalFinishEvaluationReadiness.apply(this, arguments);
      };
      Object.defineProperty(finishEvaluationReadinessWithRecents, "__mflAwaitsRecentEvaluation", { value: true });
      finishEvaluationReadiness = finishEvaluationReadinessWithRecents;
    }
    return true;
  }

  window.__mflCoreContracts = Object.freeze({
    ensureCanonicalTableHeader,
    installTableLoadingOwners,
    installSearchMatching,
    renderGlobalSearchResults,
    renderCurrentEvaluationSearchResults,
    resetCurrentEvaluationSelection,
    applySearchPayload,
    invalidateDatabaseSearch,
    installEvaluationRecentStateOwnership,
  });
})();`;

const ROUTE_RUNTIME_GATE = `${CORE_RUNTIME_CONTRACT}
;(() => {
  if (typeof setPage !== "function" || setPage.__mflRouteRuntimeGate) return;
  const originalRouteRuntimeSetPage = setPage;
  const routeRuntimeSetPage = async function setPageWithRouteRuntime(pageName, updateHash = true, options = {}) {
    const incomingOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
    const runtimeReady = incomingOptions.__mflRouteRuntimeReady === true;

    if (!runtimeReady) {
      const loadCommittedRoute = async () => {
        const ownerBeforeRuntime = setPage;
        const busyToken = window.__mflInteractionBusy?.begin
          ? window.__mflInteractionBusy.begin("route-runtime")
          : "";
        try {
          const waitForLoadingPaint = Reflect.get(window, "__mflWaitForViewTransitionPaint");
          if (busyToken && typeof waitForLoadingPaint === "function") {
            await waitForLoadingPaint();
          }
          window.__mflCancelIncrementalRouteRequest?.();
          const routeCorePromise = typeof window.__mflEnsureRouteCore === "function"
            ? window.__mflEnsureRouteCore(String(pageName || ""), incomingOptions)
            : null;
          if (typeof window.__mflEnsureRouteRuntime === "function") {
            await window.__mflEnsureRouteRuntime(String(pageName || ""), incomingOptions);
          }
          if (routeCorePromise) await routeCorePromise;

          const committedOptions = {
            ...incomingOptions,
            skipNavigationTransition: true,
          };
          if (setPage !== ownerBeforeRuntime) {
            return setPage.call(this, pageName, updateHash, {
              ...committedOptions,
              __mflRouteRuntimeReady: true,
            });
          }
          return originalRouteRuntimeSetPage.call(this, pageName, updateHash, committedOptions);
        } finally {
          if (busyToken) window.__mflInteractionBusy?.end?.(busyToken);
        }
      };

      if (incomingOptions.skipNavigationTransition === true) {
        return loadCommittedRoute();
      }

      const runTransition = Reflect.get(window, "__mflRunPageTransition");
      if (typeof runTransition !== "function") {
        throw new Error("Global page transition owner is unavailable.");
      }
      return runTransition(String(pageName || ""), updateHash, incomingOptions, loadCommittedRoute);
    }

    const cleanOptions = { ...incomingOptions };
    delete cleanOptions.__mflRouteRuntimeReady;
    return originalRouteRuntimeSetPage.call(this, pageName, updateHash, cleanOptions);
  };
  Object.defineProperty(routeRuntimeSetPage, "__mflRouteRuntimeGate", { value: true });
  setPage = routeRuntimeSetPage;
})();

window.__mflMarkApplicationCoreLoaded?.();

window.__mflAppStartPromise = (async () => {
  if (typeof pageTargetFromPath === "function" && typeof window.__mflEnsureRouteCore === "function") {
    const initialRouteTarget = pageTargetFromPath(window.location.pathname);
    if (initialRouteTarget?.pageName) {
      await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});
    }
  }
  return startApp();
})();`;

export function normalizeRouteRuntimeGate(source) {
  let text = String(source || "");
  if (!text.includes(MFL_STATS_FIRST_LOAD_DATA_BARRIER)) {
    if (!text.includes(FIRST_LOAD_DATA_BARRIER)) {
      throw new Error("Could not locate the first-load data barrier for MFL Stats.");
    }
    text = text.replace(FIRST_LOAD_DATA_BARRIER, MFL_STATS_FIRST_LOAD_DATA_BARRIER);
  }
  if (!text.includes(UNIFORM_MFL_STATS_PAGE_TARGET)) {
    if (!text.includes(MFL_STATS_PAGE_TARGET)) {
      throw new Error("Could not locate the MFL Stats route target.");
    }
    text = text.replace(MFL_STATS_PAGE_TARGET, UNIFORM_MFL_STATS_PAGE_TARGET);
  }
  if (text.includes("setPageWithRouteRuntime")) return text;
  if (!text.includes(STARTUP_MARKER)) {
    throw new Error("Could not locate the application startup marker for the route runtime gate.");
  }
  return text.replace(STARTUP_MARKER, ROUTE_RUNTIME_GATE);
}
