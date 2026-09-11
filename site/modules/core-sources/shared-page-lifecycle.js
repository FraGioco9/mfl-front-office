function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  if (mainContent) {
    mainContent.scrollTop = 0;
  }
}

let evaluationPageCacheReady = false;

function preparePlainEvaluationReentry() {
  const routeParams = new URLSearchParams(window.location.search);
  const hadEvaluationSelection = Boolean(
    state.evaluationPlayerId
    || state.evaluationSavedId
    || state.evaluationShareId
    || (window.location.pathname === "/evaluation" && (
      routeParams.get("player")
      || routeParams.get("saved")
      || routeParams.get("share")
    ))
  );
  const clearSearchInput = evaluationPageCacheReady || hadEvaluationSelection;
  state.evaluationShareId = "";
  state.evaluationSavedId = "";
  state.evaluationPlayerId = null;
  state.evaluationOverallRows = {};
  state.evaluationSummaryPositions = {};
  if (clearSearchInput) {
    evaluationSearchInput.value = "";
  }
  const preserveInitialRecentLoading = isPlainEvaluationUrl()
    && document.documentElement.classList.contains("mflSingleRenderPending");
  if (preserveInitialRecentLoading) window.__mflSyncEvaluationRecentLoadingShell?.();
  renderEmptyEvaluationSelection(preserveInitialRecentLoading, true);
  syncEvaluationSearchClearButton();
}





let __mflTableTitleForPageOwner = null;
let __mflTableEnsureAgentPageTitleNameOwner = null;
let __mflTableBuildTableColGroupOwner = null;
let __mflTableBuildHeaderOwner = null;
let __mflTableUpdateSelectionHeaderOwner = null;
let __mflTableBuildOperatorSelectOwner = null;
let __mflTableRuleMatchesOwner = null;
let __mflTableAddFilterRuleOwner = null;
let __mflTableRestoreSavedTableStateOwner = null;
let __mflTableApplyFiltersOwner = null;
let __mflTableRenderTableOwner = null;
let __mflTableOpenFiltersOwner = null;
let __mflTableClearAdvancedFiltersOwner = null;
let __mflTableCloseFiltersOwner = null;
let __mflTableApplyAdvancedFiltersOwner = null;
let __mflTableClearSelectionOwner = null;
let __mflTableAddSelectedToWatchlistOwner = null;
let __mflTableMoveSelectedToWatchlistOwner = null;
let __mflTableOpenSelectedPlayerLinksOwner = null;
let __mflTableSetViewOwner = null;

const tableTitleForPage = function (pageName) {
  if (typeof __mflTableTitleForPageOwner === "function") {
    return __mflTableTitleForPageOwner.apply(this, arguments);
  }
  const fallback = Reflect.get(window, "__mflTableTitleForPageFallback");
  return typeof fallback === "function" ? fallback(pageName, window.location.href) : "Progression";
};

function ensureAgentPageTitleName(address) {
  return typeof __mflTableEnsureAgentPageTitleNameOwner === "function"
    ? __mflTableEnsureAgentPageTitleNameOwner.apply(this, arguments)
    : Promise.resolve(savedAgentNameForWallet(address));
}

function buildTableColGroup() {
  return typeof __mflTableBuildTableColGroupOwner === "function"
    ? __mflTableBuildTableColGroupOwner.apply(this, arguments)
    : undefined;
}

function buildHeader() {
  if (typeof __mflTableBuildHeaderOwner !== "function") return undefined;
  const context = typeof tableHeaderContext === "function" ? tableHeaderContext() : null;
  if (!context) return __mflTableBuildHeaderOwner.apply(this, arguments);

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

  const result = __mflTableBuildHeaderOwner.apply(this, arguments);
  head.dataset.mflHeaderSignature = signature;
  delete head.dataset.mflStaticHeader;
  return result;
}

function syncTableSelectionHeader() {
  return typeof __mflTableUpdateSelectionHeaderOwner === "function"
    ? __mflTableUpdateSelectionHeaderOwner.apply(this, arguments)
    : undefined;
}

function buildOperatorSelect() {
  return typeof __mflTableBuildOperatorSelectOwner === "function"
    ? __mflTableBuildOperatorSelectOwner.apply(this, arguments)
    : undefined;
}

function ruleMatches() {
  return typeof __mflTableRuleMatchesOwner === "function"
    ? __mflTableRuleMatchesOwner.apply(this, arguments)
    : false;
}

function addFilterRule() {
  return typeof __mflTableAddFilterRuleOwner === "function"
    ? __mflTableAddFilterRuleOwner.apply(this, arguments)
    : undefined;
}

function restoreSavedTableState() {
  return typeof __mflTableRestoreSavedTableStateOwner === "function"
    ? __mflTableRestoreSavedTableStateOwner.apply(this, arguments)
    : undefined;
}

function applyFilters(options = {}) {
  if (options.save !== false) {
    const tableUrlState = Reflect.get(window, "__mflTableUrlState");
    if (tableUrlState && typeof tableUrlState.syncFromControls === "function") {
      tableUrlState.syncFromControls();
    }
  }
  if (state.incrementalMode && !state.incrementalApplying && !options.localOnly) {
    state.page = 1;
    void reloadIncrementalPage(1, { save: options.save !== false, loadingMode: "blank" });
    return undefined;
  }
  return typeof __mflTableApplyFiltersOwner === "function"
    ? __mflTableApplyFiltersOwner.apply(this, arguments)
    : undefined;
}

function renderTable() {
  return typeof __mflTableRenderTableOwner === "function"
    ? __mflTableRenderTableOwner.apply(this, arguments)
    : undefined;
}

function openFilters() {
  return typeof __mflTableOpenFiltersOwner === "function"
    ? __mflTableOpenFiltersOwner.apply(this, arguments)
    : undefined;
}

function clearAdvancedFilters() {
  return typeof __mflTableClearAdvancedFiltersOwner === "function"
    ? __mflTableClearAdvancedFiltersOwner.apply(this, arguments)
    : undefined;
}

function closeFilters() {
  return typeof __mflTableCloseFiltersOwner === "function"
    ? __mflTableCloseFiltersOwner.apply(this, arguments)
    : undefined;
}

function applyAdvancedFilters() {
  return typeof __mflTableApplyAdvancedFiltersOwner === "function"
    ? __mflTableApplyAdvancedFiltersOwner.apply(this, arguments)
    : undefined;
}

function clearSelection() {
  return typeof __mflTableClearSelectionOwner === "function"
    ? __mflTableClearSelectionOwner.apply(this, arguments)
    : undefined;
}

function addSelectedToWatchlist() {
  return typeof __mflTableAddSelectedToWatchlistOwner === "function"
    ? __mflTableAddSelectedToWatchlistOwner.apply(this, arguments)
    : undefined;
}

function moveSelectedToWatchlist() {
  return typeof __mflTableMoveSelectedToWatchlistOwner === "function"
    ? __mflTableMoveSelectedToWatchlistOwner.apply(this, arguments)
    : undefined;
}

function openSelectedPlayerLinks() {
  return typeof __mflTableOpenSelectedPlayerLinksOwner === "function"
    ? __mflTableOpenSelectedPlayerLinksOwner.apply(this, arguments)
    : undefined;
}

function applyTableViewOwner() {
  return typeof __mflTableSetViewOwner === "function"
    ? __mflTableSetViewOwner.apply(this, arguments)
    : undefined;
}

function setView() {
  const pageName = state.currentPage;
  if (tablePages.has(pageName) || pageName === "club") {
    return setIncrementalView.apply(this, arguments);
  }
  return applyTableViewOwner.apply(this, arguments);
}

async function renderPage(pageName, updateHash = true, options = {}) {
  const myClubsRoutePage = document.getElementById("myClubsPage");
  const lockedOptOutRoute = (pageName === "myplayers" || pageName === "my-clubs" || pageName === "watchlist" || pageName === "settings") && !hasWalletOptIn();
  resetTableSortSession(pageName, options);
  if (!pageNavigationIsCurrent(options)) return null;
  const plainEvaluationEntry = pageName === "evaluation" && (options.plain || isPlainEvaluationUrl());
  if (plainEvaluationEntry) preparePlainEvaluationReentry();
  if (pageName === "home") void loadSummary();
  if (pageName === "mfl" && normalizeViewForPage(options.view, "mfl") === "stats") {
    await renderPage("mflstats", updateHash, { ...options, replaceUrl: options.replaceUrl || "/mfl/stats" });
    return;
  }

  const previousPage = state.currentPage;
  const shouldResetScroll = previousPage !== pageName && options.preserveScroll !== true;
  if (previousPage === "settings" && pageName !== "settings") {
    discardSettingsEmailAddressDraftSilently();
  }
  if (pageName === "agents") {
    state.currentAgentWalletAddress = normalizeWalletAddress(options.walletAddress || agentWalletAddressFromUrl()).toLowerCase();
  }
  const agentTitleReady = pageName === "agents"
    ? ensureAgentPageTitleName(state.currentAgentWalletAddress, options.agentName)
    : Promise.resolve("");
  if (options.replaceUrl && `${window.location.pathname}${window.location.search}` !== options.replaceUrl) {
    const historyState = window.history.state && typeof window.history.state === "object" && !Array.isArray(window.history.state)
      ? window.history.state
      : {};
    window.history.replaceState(historyState, "", options.replaceUrl);
  }
  document.body.dataset.page = pageName;
  updatePageUrl(pageName, { ...options, updateUrl: updateHash && !options.replaceUrl });

  if (pageRequiresProgressionPermission(pageName) && !hasProgressionAccess()) {
    return showUnauthorizedProgressionRedirect();
  }

  if (lockedOptOutRoute) {
    state.currentPage = pageName;
    homePage.hidden = true;
    progressionPage.hidden = true;
    mflStatsPage.hidden = true;
    if (myClubsRoutePage) myClubsRoutePage.hidden = true;
    myPlayersLockedPage.hidden = false;
    evaluationPage.hidden = true;
    playerPage.hidden = true;
    settingsPage.hidden = true;
    changelogPage.hidden = true;
    privacyPage.hidden = true;
    if (optInLockedTitle) {
      optInLockedTitle.textContent = pageName === "watchlist" ? "Watchlist" : pageName === "settings" ? "Settings" : pageName === "my-clubs" ? "My Clubs" : "My Players";
    }
    if (optInLockedMessage) {
      optInLockedMessage.textContent = pageName === "watchlist"
        ? "In order to use the watchlist, you need to opt in."
        : pageName === "settings"
          ? "In order to view settings, you need to opt in."
          : pageName === "my-clubs"
            ? "In order to see your clubs, you need to opt in."
            : "In order to see your players, you need to opt in.";
    }
    syncHomeLoginButton();
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }
    if (!pageNavigationIsCurrent(options)) return null;
    if (shouldResetScroll) {
      resetPageScroll();
    }
    return;
  }

  const tablePage = tablePages.has(pageName);
  const mflStatsActive = pageName === "mflstats";
  const myClubsPageActive = pageName === "my-clubs";
  const playerPageActive = pageName === "player";
  const evaluationPageActive = pageName === "evaluation";
  const settingsPageActive = pageName === "settings";
  if (options.__mflPreviousTableStateSaved !== true) {
    const previousTablePage = tablePageKey();
    if (previousTablePage) {
      state.tablePageStates[previousTablePage] = currentTablePageState();
      saveTableState();
    }
  }


  if ((tablePage || mflStatsActive || playerPageActive || evaluationPageActive) && !state.dataLoaded) {
    state.currentPage = pageName;
    homePage.hidden = true;
    progressionPage.hidden = !tablePage;
    mflStatsPage.hidden = !mflStatsActive;
    if (myClubsRoutePage) myClubsRoutePage.hidden = true;
    myPlayersLockedPage.hidden = true;
    evaluationPage.hidden = !evaluationPageActive;
    playerPage.hidden = !playerPageActive;
    settingsPage.hidden = true;
    changelogPage.hidden = true;
    privacyPage.hidden = true;

    if (tablePage) {
      renderTableLoadingShell(pageName);
    }


    const loaded = await ensureProgressionData();

    if (!pageNavigationIsCurrent(options)) return null;


    if (!loaded) {
      return;
    }
  }

  if (pageName === "watchlist" && hasWalletOptIn()) {
    state.currentPage = pageName;
    state.pendingWatchlistRouteId = options.watchlistId || watchlistIdFromUrl() || "";
    await ensureWatchlistRoute(options);
    if (!pageNavigationIsCurrent(options)) return null;
  }

  if (!pageNavigationIsCurrent(options)) return null;
  state.currentPage = pageName;
  homePage.hidden = pageName !== "home";
  progressionPage.hidden = !tablePage;
  mflStatsPage.hidden = !mflStatsActive;
  if (myClubsRoutePage) myClubsRoutePage.hidden = !myClubsPageActive;
  myPlayersLockedPage.hidden = true;
  evaluationPage.hidden = !evaluationPageActive;
  playerPage.hidden = !playerPageActive;
  settingsPage.hidden = !settingsPageActive;
  changelogPage.hidden = pageName !== "changelog";
  privacyPage.hidden = pageName !== "privacy";
  if (pageName === "agents") {
    await agentTitleReady;
    if (!pageNavigationIsCurrent(options)) return null;
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else {
    tablePageTitle.textContent = tableTitleForPage(pageName);
  }
  renderWatchlistSwitcher();
  if (tablePage) {
    restoreSavedTableState(pageName, {
      view: options.view,
      path: options.path,
      replaceUrl: options.replaceUrl,
    });
    syncRestoredTableControls(pageName);
    updateViewButtons();
    buildHeader();
  }
  globalThis.syncQuickFilterLabels?.();

  if (myClubsPageActive) {
    const renderMyClubsPage = Reflect.get(window, "__mflRenderMyClubsPageOwner");
    if (typeof renderMyClubsPage !== "function") throw new Error("My Clubs route core is unavailable.");
    const myClubsRouteEntry = Boolean(options.__mflNavigationTransition);
    await renderMyClubsPage({ force: options.force === true || myClubsRouteEntry });
    if (!pageNavigationIsCurrent(options)) return null;
    const finishMyClubsLoading = Reflect.get(window, "finishLoading");
    if (document.body.classList.contains("loading") && typeof finishMyClubsLoading === "function") {
      await finishMyClubsLoading();
    }
    if (!pageNavigationIsCurrent(options)) return null;
    syncHomeLoginButton();
    if (shouldResetScroll) resetPageScroll();
    return;
  }

  if (mflStatsActive) {
    state.view = "stats";
    rememberMflStatsView();
    updateViewButtons();
    renderMflStatsPage();
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }
    if (!pageNavigationIsCurrent(options)) return null;

    syncHomeLoginButton();
    if (shouldResetScroll) {
      resetPageScroll();
    }

    return;
  }

  if (settingsPageActive) {
    primeSettingsFreshFirstPaint();
    await waitForViewTransitionPaint();
    if (!pageNavigationIsCurrent(options)) return null;
    renderSettingsIdentity();
    await settingsPrepareCommittedForEntry();
    if (!pageNavigationIsCurrent(options)) return null;
    renderSettingsPage();
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }
    if (!pageNavigationIsCurrent(options)) return null;

    syncHomeLoginButton();
    if (shouldResetScroll) {
      resetPageScroll();
    }

    return;
  }

  if (evaluationPageActive) {
    const plainEvaluationRoute = options.plain || isPlainEvaluationUrl();
    const cachedEvaluationReentry = plainEvaluationRoute
      && options.reuseCachedRoute === true
      && evaluationPageCacheReady;
    const evaluationBusyToken = cachedEvaluationReentry
      ? ""
      : window.__mflInteractionBusy?.begin?.("evaluation-loading");
    if (evaluationBusyToken) evaluationReadinessBusyToken = evaluationBusyToken;
    if (!cachedEvaluationReentry) {
      document.documentElement.classList.remove("mflEvaluationReady");
      document.body.classList.add("evaluationPageLoading");
    }
    try {
      await renderEvaluationPage();
      if (!pageNavigationIsCurrent(options)) return null;
      if (!cachedEvaluationReentry) {
        await finishEvaluationReadiness();
      if (!pageNavigationIsCurrent(options)) return null;
      }
      if (document.body.classList.contains("loading")) {
        await finishLoading();
      }
      if (!pageNavigationIsCurrent(options)) return null;

      syncHomeLoginButton();
      if (shouldResetScroll) {
        resetPageScroll();
      }
      evaluationPageCacheReady = true;
      document.documentElement.classList.add("mflEvaluationReady");
      window.dispatchEvent(new CustomEvent("mfl:evaluation-ready"));
      return;
    } finally {
      const evaluationStillCurrent = pageNavigationIsCurrent(options)
        && state.currentPage === "evaluation"
        && window.location.pathname === "/evaluation";
      if (evaluationStillCurrent) {
        document.body.classList.remove("evaluationPageLoading");
        if (!document.documentElement.classList.contains("mflEvaluationReady")) {
          document.documentElement.classList.add("mflEvaluationReady");
        }
      }
      if (evaluationBusyToken && evaluationReadinessBusyToken === evaluationBusyToken) {
        releaseEvaluationReadinessBusy();
      }
    }
  }

  if (playerPageActive) {
    const playerId = options.playerId || playerIdFromUrl();
    renderPlayerPage(playerId);
    if (document.body.classList.contains("loading")) {
      await finishLoading();
    }
    if (!pageNavigationIsCurrent(options)) return null;

    syncHomeLoginButton();
    if (shouldResetScroll) {
      resetPageScroll();
    }

    return;
  }
  if (tablePage) {
    state.page = 1;
    applyFilters({ save: false });
  }

  if (document.body.classList.contains("loading")) {
    await finishLoading();
  }
  if (!pageNavigationIsCurrent(options)) return null;

  if (shouldResetScroll) {
    resetPageScroll();
  }

  syncHomeLoginButton();
}

async function setPage(pageName, updateHash = true, options = {}) {
  const featureOwner = Reflect.get(window, "__mflSetPageFeatureOwner");
  if (typeof featureOwner === "function") {
    return featureOwner.call(this, pageName, updateHash, options);
  }
  return setPageWithRouteRuntime.call(this, pageName, updateHash, options);
}
