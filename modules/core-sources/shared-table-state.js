function tablePageKey(pageName = state.currentPage) {
  return tablePages.has(pageName) ? pageName : null;
}

function allowedViewsForPage(pageName = tablePageKey() || "progression") {
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredOrder = viewConfig && typeof viewConfig === "object" && Array.isArray(viewConfig?.[pageName]?.order)
    ? Array.from(viewConfig[pageName].order)
    : null;
  return configuredOrder || pageViewOptions[pageName] || pageViewOptions.progression;
}

function defaultViewForPage(pageName = tablePageKey() || "progression") {
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredFallback = viewConfig && typeof viewConfig === "object"
    ? String(viewConfig?.[pageName]?.fallback || "")
    : "";
  return configuredFallback || defaultPageViews[pageName] || "current";
}

function normalizeViewForPage(viewName, pageName = tablePageKey() || "progression") {
  return allowedViewsForPage(pageName).includes(viewName) ? viewName : defaultViewForPage(pageName);
}

function pageNameForViewButton(button) {
  const currentPage = state.currentPage === "mflstats"
    ? "mfl"
    : state.currentPage === "club"
      ? "club"
      : tablePageKey();
  return currentPage || button?.dataset?.page || "progression";
}

function preferredViewForPage(pageName) {
  if (!tablePages.has(pageName)) {
    return "";
  }

  if (pageName === "mfl" && state.currentPage === "mflstats") {
    return "stats";
  }

  if (pageName === state.currentPage) {
    return normalizeViewForPage(state.view, pageName);
  }

  return normalizeViewForPage(state.tablePageStates?.[pageName]?.view, pageName);
}

function rememberMflStatsView() {
  const existingPageState = state.tablePageStates?.mfl || defaultTablePageState("mfl");
  state.tablePageStates.mfl = {
    ...existingPageState,
    view: "stats",
  };
  saveTableState();
}

function updateNavigationLinks() {
  navButtons.forEach((button) => {
    const pageName = button.dataset.page;
    if (!pageName || !tablePages.has(pageName)) {
      return;
    }

    button.href = pagePath(pageName, { view: preferredViewForPage(pageName) });
  });
}

function updateViewButtons() {
  const pageName = state.currentPage === "mflstats"
    ? "mfl"
    : state.currentPage === "club"
      ? "club"
      : (tablePageKey() || "progression");
  const activeView = state.currentPage === "mflstats" ? "stats" : state.view;
  window.__mflStaticUiRuntime?.syncTableViews?.(pageName, activeView);
  updateNavigationLinks();
}

function normalizeCurrentViewsAfterProgressionAccessLoss() {
  if (state.currentPage === "watchlist") {
    state.view = normalizeViewForPage(state.view, "watchlist");
    state.page = 1;
    removeUnavailableFilterRules("watchlist", state.view);
    populateAddFilterSelect("watchlist");
    refreshRuleColumnSelects("watchlist");
    updateViewButtons();
    buildHeader();
    applyFilters();
    return;
  }

  if (state.currentPage === "player") {
    renderPlayerPage(playerIdFromUrl());
  }
}
function defaultSortStateForView(
  viewName = defaultViewForPage(tablePageKey() || "progression"),
  pageName = tablePageKey() || state.currentPage || "progression",
) {
  if (pageName === "club") {
    return {
      sortKey: "positions",
      sortDirection: "asc",
    };
  }
  return {
    sortKey: "overall",
    sortDirection: "desc",
  };
}

function sortKeySupportedByView(
  sortKey,
  viewName = defaultViewForPage(tablePageKey() || "progression"),
  pageName = tablePageKey() || state.currentPage || "progression",
) {
  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  if (normalizedPageName === "club" && sortKey === "positions") return true;
  const normalizedView = normalizeViewForPage(viewName, normalizedPageName || "progression");
  const visibleColumns = (views[normalizedView]?.columns || [])
    .map((column) => displayColumnForPage(column, normalizedPageName));
  return sortableColumns.has(sortKey) && visibleColumns.includes(sortKey);
}

function normalizedViewSortState(
  sortState,
  viewName = defaultViewForPage(tablePageKey() || "progression"),
  pageName = tablePageKey() || state.currentPage || "progression",
) {
  const defaultSortState = defaultSortStateForView(viewName, pageName);
  const sortKeyIsSupported = sortKeySupportedByView(sortState?.sortKey, viewName, pageName);
  const sortKey = sortKeyIsSupported ? sortState.sortKey : defaultSortState.sortKey;

  return {
    sortKey,
    sortDirection: sortKeyIsSupported && (sortState?.sortDirection === "asc" || sortState?.sortDirection === "desc")
      ? sortState.sortDirection
      : defaultSortState.sortDirection,
  };
}

function tableSortSessionKey(pageName = state.currentPage, options = {}) {
  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  if (normalizedPageName === "agents") {
    const walletAddress = normalizeWalletAddress(
      options.walletAddress || agentWalletAddressFromUrl() || state.currentAgentWalletAddress,
    ).toLowerCase();
    return `agents:${walletAddress || window.location.pathname}`;
  }
  if (normalizedPageName === "watchlist") {
    const watchlistId = String(
      options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "default",
    ).trim();
    return `watchlist:${watchlistId || "default"}`;
  }
  if (normalizedPageName === "club") {
    const clubRoute = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
    const clubId = String(options.clubId || clubRoute?.clubId || "").trim();
    return `club:${clubId || window.location.pathname}`;
  }
  return tablePages.has(normalizedPageName) ? normalizedPageName : "";
}

function tableSortStateForView(
  viewName = state.view,
  pageName = tablePageKey() || state.currentPage || "progression",
  fallbackSortState = null,
) {
  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  const normalizedView = normalizeViewForPage(viewName, normalizedPageName || "progression");
  const sourceSortState = state.tableSortSessionSortState || fallbackSortState;
  const sourceSortSupported = sortKeySupportedByView(sourceSortState?.sortKey, normalizedView, normalizedPageName);
  const resolvedSortState = normalizedViewSortState(
    sourceSortState,
    normalizedView,
    normalizedPageName,
  );
  if (!sourceSortSupported && state.tableSortSessionKey) {
    state.tableSortSessionSortState = resolvedSortState;
  }
  return resolvedSortState;
}

function rememberTableSortState(
  sortState = { sortKey: state.sortKey, sortDirection: state.sortDirection },
  viewName = state.view,
  pageName = tablePageKey() || state.currentPage || "progression",
) {
  if (!state.tableSortSessionKey) return false;
  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  const normalizedView = normalizeViewForPage(viewName, normalizedPageName || "progression");
  if (!sortKeySupportedByView(sortState?.sortKey, normalizedView, normalizedPageName)) return false;
  state.tableSortSessionSortState = normalizedViewSortState(sortState, normalizedView, normalizedPageName);
  return true;
}

function resetTableSortSession(pageName, options = {}) {
  const nextSessionKey = tableSortSessionKey(pageName, options);
  if (nextSessionKey === state.tableSortSessionKey) return false;
  state.tableSortSessionKey = nextSessionKey;
  state.tableSortSessionSortState = null;
  if (!nextSessionKey) return false;

  const normalizedPageName = pageName === "mflstats" ? "mfl" : String(pageName || "");
  const nextView = normalizeViewForPage(options.view, normalizedPageName || "progression");
  const defaultSortState = defaultSortStateForView(nextView, normalizedPageName);
  state.tableSortSessionSortState = defaultSortState;
  state.sortKey = defaultSortState.sortKey;
  state.sortDirection = defaultSortState.sortDirection;
  return true;
}

function defaultTablePageState(pageName = tablePageKey() || "progression") {
  const defaultView = defaultViewForPage(pageName);
  const defaultSortState = defaultSortStateForView(defaultView, pageName);

  return {
    hideRetired: true,
    hideRetiring: false,
    hideMflPlayers: pageName === "database",
    mflPackable: pageName === "mfl",
    newMints: false,
    pageSize: 100,
    view: defaultView,
    viewSortStates: {},
    sortKey: defaultSortState.sortKey,
    sortDirection: defaultSortState.sortDirection,
    rules: [],
    selectedPlayerIds: [],
  };
}
