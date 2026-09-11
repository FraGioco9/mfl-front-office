/* Session-cached incremental route data and destination-first loading */
  function filterRulesForLoading(pageName, savedState, viewName) {
    const normalizedView = normalizeViewForPage(viewName || savedState?.view, pageName);
    const columns = (pageName === "mfl" || pageName === "agents")
      ? baseFilterColumns.filter((column) => column !== agentColumn && (pageName !== "mfl" || column !== contractStatusFilterColumn))
      : [...baseFilterColumns];

    if (normalizedView === "current") {
      columns.push(...statColumns.map((column) => `${column}_prog_current_season`));
    } else if (normalizedView === "all") {
      columns.push(...statColumns.map((column) => `${column}_prog_all`));
    }

    const allowedColumns = new Set(columns);
    return (savedState?.rules || [])
      .filter((rule) => allowedColumns.has(rule.column))
      .filter((rule) => (rule.operator === "between" || rule.operator === "during")
        ? String(rule.value || "").trim() && String(rule.valueTo || "").trim()
        : String(rule.value || "").trim())
      .map((rule) => ({ ...rule }));
  }

  function prepareIncrementalRoute(pageName, options = {}) {
    const clubTarget = options.ignoreCurrentClubRoute ? null : clubRouteTargetFromPath();
    const storedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)
      ? state.tablePageStates?.[pageName] || defaultTablePageState(pageName)
      : null;
    const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;
    const savedPageState = resetFilters && storedPageState
      ? tableStateWithoutPageFilters(pageName, storedPageState)
      : storedPageState;
    if (resetFilters && savedPageState) state.tablePageStates[pageName] = savedPageState;
    const restoredPageState = savedPageState
      ? restoreSavedTableState(pageName, {
          view: options.view,
          path: options.path,
          replaceUrl: options.replaceUrl,
          deferRules: true,
        })
      : null;
    if (!savedPageState && clubTarget) {
      state.view = clubTarget.view;
      state.page = 1;
    }

    if (pageName === "agents") {
      state.currentAgentWalletAddress = normalizeWalletAddress(options.walletAddress || agentWalletAddressFromUrl()).toLowerCase();
    }

    if (pageName === "watchlist" && hasWalletOptIn()) {
      const requestedWatchlistId = String(options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "");
      const watchlist = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds))
        .find((candidate) => candidate.id === requestedWatchlistId);
      if (watchlist) {
        state.currentWatchlistId = watchlist.id;
        setActiveWatchlistIds(watchlist.playerIds);
      }
    }

    const route = incrementalRouteTarget(pageName, options);
    if (route && restoredPageState) {
      route.filterRules = filterRulesForLoading(pageName, restoredPageState, route.view);
      Reflect.set(route, "tableFilters", {
        hideRetired: restoredPageState.hideRetired !== false,
        hideRetiring: Boolean(restoredPageState.hideRetiring),
        hideMflPlayers: pageName === "database" ? restoredPageState.hideMflPlayers !== false : false,
        mflPackable: pageName === "mfl" ? restoredPageState.mflPackable !== false : false,
        newMints: Boolean(restoredPageState.newMints),
      });
    }
    return route;
  }

  function commitIncrementalLocation(pageName, updateHash, options = {}) {
    if (options.replaceUrl && `${window.location.pathname}${window.location.search}` !== options.replaceUrl) {
      window.history.replaceState({}, "", options.replaceUrl);
      return;
    }
    updatePageUrl(pageName, {
      ...options,
      updateUrl: updateHash,
    });
  }

  function incrementalLoadingPageName(pageName, route) {
    if (route.scope === "club") return "club";
    if (route.scope === "agent") return "agents";
    return pageName;
  }

  const shellFirstTablePages = new Set();

  function renderTableDestinationShell(pageName, route = null) {
    if (!shellFirstTablePages.has(pageName)) {
      return;
    }

    state.currentPage = pageName;
    document.body.dataset.page = pageName;
    homePage.hidden = true;
    progressionPage.hidden = false;
    mflStatsPage.hidden = true;
    myPlayersLockedPage.hidden = true;
    evaluationPage.hidden = true;
    playerPage.hidden = true;
    settingsPage.hidden = true;
    changelogPage.hidden = true;
    privacyPage.hidden = true;
    tablePageTitle.textContent = tableTitleForPage(pageName);
    if (route && route.scope !== "empty" && !incrementalRouteIsCached(route, 1)) {
      showTableBusyState();
    }
    syncHomeLoginButton();
  }

  function renderIncrementalLoadingState(pageName, route) {
    const loadingPageName = incrementalLoadingPageName(pageName, route);
    const tableRoute = ["database", "progression", "mfl", "agent", "watchlist", "myplayers", "club"].includes(route.scope);
    const mflStatsActive = route.scope === "mflstats";
    const playerPageActive = route.scope === "player";
    const evaluationPageActive = route.scope === "evaluation";

    state.currentPage = loadingPageName;
    state.view = route.view || state.view;
    document.body.dataset.page = loadingPageName;
    homePage.hidden = true;
    progressionPage.hidden = !tableRoute;
    mflStatsPage.hidden = !mflStatsActive;
    myPlayersLockedPage.hidden = true;
    evaluationPage.hidden = !evaluationPageActive;
    playerPage.hidden = !playerPageActive;
    settingsPage.hidden = true;
    changelogPage.hidden = true;
    privacyPage.hidden = true;


    if (tableRoute) {
      if (route.scope !== "club") globalThis.syncQuickFilterLabels?.();
      if (route.scope !== "club") {
        tablePageTitle.textContent = tableTitleForPage(pageName);
      }
      updateViewButtons();
      showTableBusyState();
    } else if (mflStatsActive) {
      state.view = "stats";
      updateViewButtons();
      if (mflStatsTotalPlayers) mflStatsTotalPlayers.textContent = "-";
      if (mflStatsPackablePlayers) mflStatsPackablePlayers.textContent = "-";
      if (mflStatsAgedPlayers) mflStatsAgedPlayers.textContent = "-";
      if (mflStatsOtherPlayers) mflStatsOtherPlayers.textContent = "-";
      if (mflStatsAgeDistribution) {
        mflStatsAgeDistribution.replaceChildren();
      }
    } else if (playerPageActive && playerDetail) {
      const playerId = String(route.playerId || "").trim();
      const pendingContext = window.__mflPlayerFirstPaintPendingContext;
      const matchingContext = String(pendingContext?.playerId || "").trim() === playerId
        ? pendingContext
        : { playerId };
      window.__mflPlayerFirstPaintPendingContext = matchingContext;
      window.__mflPlayerFirstPaintRuntime?.beginDetailNavigation?.(matchingContext);
      window.__mflPlayerFirstPaintRuntime?.renderPending?.(matchingContext);
    } else if (evaluationPageActive) {
      evaluationPanel.hidden = true;
      evaluationSearchResults.hidden = true;
    }

    syncHomeLoginButton();
  }

  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route, requestOptions = {}) {
  if (!pageNavigationIsCurrent(options)) return false;
  const inheritedTableLoadingRequestToken = Number(requestOptions.tableLoadingRequestToken || 0);
  const renderLoadingRequestToken = inheritedTableLoadingRequestToken
    || (!incrementalRouteIsCached(route, 1) || window.__mflTableLoadingRuntime?.requestActive?.()
      ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: requestOptions.loadingMode }) || 0
      : 0);
  const ownsRenderLoadingRequestToken = inheritedTableLoadingRequestToken === 0 && renderLoadingRequestToken !== 0;
  try {
    const payload = await requestIncrementalRoute(route, 1, {
      ...requestOptions,
      tableLoadingRequestToken: renderLoadingRequestToken,
      __mflNavigationTransition: options.__mflNavigationTransition || null,
    });
    if (!payload || !pageNavigationIsCurrent(options)) return false;
    if (tablePages.has(pageName) && pageName !== "club") {
      restoreSavedTableState(pageName, {
        view: route.view || options.view,
        path: options.path,
        replaceUrl: options.replaceUrl,
      });
    }
    state.dataAccess = currentDataAccess(pageName);
    state.incrementalApplying = true;
    try {
      const result = await renderPage.call(this, pageName, false, {
        ...options,
        replaceUrl: "",
        skipNavigationLoading: true,
      });
      return pageNavigationIsCurrent(options) ? result : false;
    } finally {
      state.incrementalApplying = false;
    }
  } finally {
    if (ownsRenderLoadingRequestToken) {
      window.__mflTableLoadingRuntime?.finishRequest?.(renderLoadingRequestToken);
    }
  }
}

function applyClubPresentationFromSharedView() {
  const owner = Reflect.get(window, "__mflApplyClubPresentation");
  if (typeof owner === "function") owner();
}

const setIncrementalView = async function setIncrementalView(viewName) {
    const pageName = state.currentPage;
    if (!tablePages.has(pageName) && pageName !== "club") {
      return applyTableViewOwner.apply(this, arguments);
    }
    const nextView = normalizeViewForPage(viewName, pageName);
    if (!allowedViewsForPage(pageName).includes(nextView)) return;

    const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;
    const routeOptions = {
      view: nextView,
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
      ...(clubTarget?.clubId ? { clubId: clubTarget.clubId } : {}),
    };
    const route = incrementalRouteTarget(pageName, routeOptions);
    if (!route) return applyTableViewOwner.call(this, nextView);

    const stagedTransition = takeStagedViewTransition(pageName, nextView);
    const pageKey = tablePageKey();
    const previousCurrentPage = stagedTransition?.previousCurrentPage || state.currentPage;
    const previousView = stagedTransition?.previousView || state.view;
    const previousPage = stagedTransition?.previousPage ?? state.page;
    const previousSortKey = stagedTransition?.previousSortKey || state.sortKey;
    const previousSortDirection = stagedTransition?.previousSortDirection || state.sortDirection;
    const previousPath = stagedTransition?.previousPath || currentNavigationPath();

    if (pageKey && pageName !== "club") {
      const existingPageState = state.tablePageStates[pageKey] || currentTablePageState();
      state.tablePageStates[pageKey] = {
        ...existingPageState,
        viewSortStates: {
          ...(existingPageState.viewSortStates || {}),
          [previousView]: {
            sortKey: previousSortKey,
            sortDirection: previousSortDirection,
          },
        },
      };
    }

    const targetSortState = tableSortStateForView(
      nextView,
      pageKey || pageName,
      { sortKey: previousSortKey, sortDirection: previousSortDirection },
    );
    if (stagedTransition) {
      state.sortKey = targetSortState.sortKey;
      state.sortDirection = targetSortState.sortDirection;
    } else {
      const transition = await runViewTransition(pageName, nextView, {
        ...routeOptions,
        sortKey: targetSortState.sortKey,
        sortDirection: targetSortState.sortDirection,
      });
      if (!transition) return;
    }

    if (pageName === "club" && state.clubProfile && ["info", "attributes", "contracts"].includes(nextView)) {
      state.page = 1;
      if (nextView === "info") {
        state.view = "info";
        updateViewButtons();
        applyClubPresentationFromSharedView();
        return true;
      }
      state.incrementalApplying = true;
      try {
        const result = await applyTableViewOwner.call(this, nextView);
        applyClubPresentationFromSharedView();
        return result;
      } finally {
        state.incrementalApplying = false;
      }
    }

    const viewLoadingRequestToken = (!incrementalRouteIsCached(route, 1) || window.__mflTableLoadingRuntime?.requestActive?.())
      ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0
      : 0;
    const loadAndRender = async () => {
      try {
        const payload = await requestIncrementalRoute(route, 1, {
          tableLoadingRequestToken: viewLoadingRequestToken,
        });
        if (!payload) return;
        state.incrementalApplying = true;
        try {
          if (pageName === "club" && nextView === "info") {
            state.view = "info";
            state.page = 1;
            updateViewButtons();
            applyClubPresentationFromSharedView();
            return true;
          }
          const result = await applyTableViewOwner.call(this, nextView);
          if (pageName === "club") applyClubPresentationFromSharedView();
          return result;
        } finally {
          state.incrementalApplying = false;
        }
      } catch (error) {
        state.currentPage = previousCurrentPage;
        state.view = previousView;
        state.page = previousPage;
        state.sortKey = previousSortKey;
        state.sortDirection = previousSortDirection;
        if (`${window.location.pathname}${window.location.search}` !== previousPath) {
          window.history.replaceState({}, "", previousPath);
        }
        updateViewButtons();
        showToast(error?.message || "Could not load this view.");
      } finally {
        window.__mflTableLoadingRuntime?.finishRequest?.(viewLoadingRequestToken);
      }
    };

    if (incrementalRouteIsCached(route, 1)) return loadAndRender();
    return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);
};

  const setIncrementalPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {
    resetTableSortSession(pageName, options);
    const navigationUpdatesHistory = options.__mflNavigationUpdatesHistory ?? updateHash;
    if (!options.skipNavigationTransition) {
      return runPageTransition(pageName, navigationUpdatesHistory, options, (navigationTransition) => setPage(pageName, false, {
        ...options,
        skipNavigationTransition: true,
        __mflNavigationTransition: navigationTransition,
        __mflNavigationUpdatesHistory: navigationUpdatesHistory,
      }));
    }
    const progressionLoadingRequestToken = pageName === "progression" && !routeDataCacheReady(pageName, options)
      ? window.__mflTableLoadingRuntime?.beginRequest?.("progression") || 0
      : 0;
    const navigationTransition = options.__mflNavigationTransition || null;
    const navigationOptions = navigationTransition
      ? { ...options, __mflNavigationTransition: navigationTransition }
      : options;
    if (!pageNavigationIsCurrent(navigationOptions)) {
      window.__mflTableLoadingRuntime?.finishRequest?.(progressionLoadingRequestToken);
      return null;
    }
    updateHash = false;

    const requestedMflView = pageName === "mfl"
      ? normalizeViewForPage(options.view, "mfl")
      : "";
    if (pageName === "mfl" && requestedMflView === "stats") {
      const route = prepareIncrementalRoute(pageName, {
        ...navigationOptions,
        view: "stats",
        ignoreCurrentClubRoute: navigationUpdatesHistory,
      });
      if (!route) {
        state.incrementalMode = false;
        return renderPage.call(this, "mflstats", false, {
          ...navigationOptions,
          replaceUrl: "",
          view: "stats",
          skipNavigationLoading: true,
        });
      }
      const statsLoadingRequestToken = (!incrementalRouteIsCached(route, 1) || window.__mflTableLoadingRuntime?.requestActive?.())
      ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0
      : 0;
    try {
      const payload = await requestIncrementalRoute(route, 1, {
        tableLoadingRequestToken: statsLoadingRequestToken,
        __mflNavigationTransition: navigationTransition,
      });
      if (!payload || !pageNavigationIsCurrent(navigationOptions)) return false;
      state.dataAccess = currentDataAccess(pageName);
      state.incrementalApplying = true;
      try {
        return await renderPage.call(this, "mflstats", false, {
          ...options,
          replaceUrl: "",
          view: "stats",
          skipNavigationLoading: true,
        });
      } finally {
        state.incrementalApplying = false;
      }
    } finally {
      window.__mflTableLoadingRuntime?.finishRequest?.(statsLoadingRequestToken);
    }
    }

    const requestedDatabaseView = pageName === "database"
      ? normalizeViewForPage(options.view, "database")
      : "";
    if (pageName === "database" && requestedDatabaseView === "stats") {
      state.incrementalMode = false;
      if (typeof window.__mflEnsureRouteRuntime === "function") {
        await window.__mflEnsureRouteRuntime("database", { view: "stats" });
      }
      if (!pageNavigationIsCurrent(navigationOptions)) return null;
      const statsOwner = window.__mflDatabaseStatsStateRuntime;
      if (typeof statsOwner?.render === "function") return statsOwner.render();
      if (typeof window.renderDatabaseStatsPage === "function") return window.renderDatabaseStatsPage(false);
      return;
    }

    const previousPage = state.currentPage;
    if (options.__mflPreviousTableStateSaved !== true) {
      const previousTablePage = tablePageKey();
      if (previousTablePage && previousTablePage !== "club") {
        state.tablePageStates[previousTablePage] = currentTablePageState();
        saveTableState();
      }
    }

    const route = prepareIncrementalRoute(pageName, {
      ...navigationOptions,
      ignoreCurrentClubRoute: navigationUpdatesHistory,
    });
    const shellFirst = shellFirstTablePages.has(pageName);
    if (shellFirst) {
      commitIncrementalLocation(pageName, updateHash, navigationOptions);
      renderTableDestinationShell(pageName, route);
    }
    if (!route) {
      window.__mflTableLoadingRuntime?.finishRequest?.(progressionLoadingRequestToken);
      state.incrementalMode = false;
      return renderPage.call(this, pageName, updateHash, navigationOptions);
    }

    if (!shellFirst) {
      commitIncrementalLocation(pageName, updateHash, navigationOptions);
    } else {
      globalThis.syncQuickFilterLabels?.();
      updateViewButtons();
      buildHeader();
    }
    const loadAndRender = async () => {
      try {
        const result = await renderLoadedIncrementalRoute.call(this, pageName, updateHash, navigationOptions, route, {
          tableLoadingRequestToken: progressionLoadingRequestToken,
        });
        if (result === false) return false;
        if (previousPage !== incrementalLoadingPageName(pageName, route)) {
          resetPageScroll();
        }
        return result;
      } catch (error) {
        showToast(error?.message || "Could not load this page.");
        return;
      } finally {
        window.__mflTableLoadingRuntime?.finishRequest?.(progressionLoadingRequestToken);
      }
    };

    if (route.scope === "empty" || incrementalRouteIsCached(route, 1)) {
      return loadAndRender();
    }

    return withInteractionBusy(loadAndRender);
  };

  const loadIncrementalRoutePage = async function loadIncrementalRoutePage(pageName, options = {}) {
    const route = prepareIncrementalRoute(pageName, options);
    if (!route) {
      return false;
    }
    const loadAndRender = async () => {
      const payload = await requestIncrementalRoute(route, 1);
      if (!payload) return false;
      const clubPage = pageName === "club";
      if (tablePages.has(pageName) && !clubPage) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
        syncRestoredTableControls(pageName);
      }
      if (clubPage) {
        state.currentPage = "club";
      }
      state.incrementalApplying = true;
      try {
        updateViewButtons();
        buildHeader();
        if (!clubPage) applyFilters.call(this, { save: false });
      } finally {
        state.incrementalApplying = false;
      }
      return true;
    };

    if (incrementalRouteIsCached(route, 1)) {
      return loadAndRender();
    }

    return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);
  };

window.mflLoadIncrementalRoutePage = loadIncrementalRoutePage;
