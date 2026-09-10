function currentNavigationPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function commitViewTransition(pageName, viewName, options = {}) {
  const nextView = String(viewName || "");
  if (!nextView) return "";

  const statePageName = String(
    options.statePageName
    || (pageName === "mfl" && nextView === "stats" ? "mflstats" : pageName)
    || state.currentPage
  );

  state.currentPage = statePageName;
  state.view = nextView;
  state.page = 1;

  if (Object.prototype.hasOwnProperty.call(options, "sortKey")) state.sortKey = options.sortKey;
  if (Object.prototype.hasOwnProperty.call(options, "sortDirection")) state.sortDirection = options.sortDirection;

  let targetPath = String(options.path || "");
  if (!targetPath) {
    targetPath = pageName === "mfl" && nextView === "stats"
      ? "/mfl/stats"
      : pagePath(pageName, {
          ...options,
          view: nextView,
          walletAddress: options.walletAddress || state.currentAgentWalletAddress,
          watchlistId: options.watchlistId || state.currentWatchlistId,
        });

    const tableUrlState = Reflect.get(window, "__mflTableUrlState");
    const compatibleSearch = tablePages.has(statePageName)
      && typeof tableUrlState?.searchForCurrentControls === "function"
      ? tableUrlState.searchForCurrentControls(pageName, nextView)
      : "";
    if (compatibleSearch) targetPath += compatibleSearch;
  }

  if (targetPath && currentNavigationPath() !== targetPath) {
    window.history[options.replace ? "replaceState" : "pushState"]({}, "", targetPath);
  }

  updateViewButtons();
  if (tablePages.has(statePageName) || statePageName === "club") buildHeader();
  window.__mflStaticUiRuntime?.sync?.();
  return nextView;
}

function commitPageTransition(pageName, updateHash = true, options = {}) {
  const requestedPageName = String(pageName || "home");
  const routePageName = requestedPageName === "mflstats" ? "mfl" : requestedPageName;
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredViews = viewConfig && typeof viewConfig === "object" && Array.isArray(viewConfig?.[routePageName]?.order)
    ? viewConfig[routePageName].order
    : null;
  const nextView = requestedPageName === "mflstats"
    ? "stats"
    : configuredViews
      ? normalizeViewForPage(options.view || preferredViewForPage(routePageName), routePageName)
      : "";
  const statePageName = routePageName === "mfl" && nextView === "stats" ? "mflstats" : requestedPageName;

  pendingViewTransition = null;
  state.currentPage = statePageName;
  if (nextView) state.view = nextView;
  state.page = 1;
  if (Object.prototype.hasOwnProperty.call(options, "sortKey")) state.sortKey = options.sortKey;
  if (Object.prototype.hasOwnProperty.call(options, "sortDirection")) state.sortDirection = options.sortDirection;
  document.body.dataset.page = routePageName;
  if (tablePages.has(statePageName) || statePageName === "club") buildHeader();

  const targetPath = String(options.path || options.replaceUrl || pagePath(routePageName, {
    ...options,
    ...(nextView ? { view: nextView } : {}),
  }));
  const replaceRoute = Boolean(options.replace || options.replaceUrl);
  const currentPath = currentNavigationPath();
  if (targetPath && currentPath !== targetPath && (updateHash || replaceRoute)) {
    window.history[replaceRoute ? "replaceState" : "pushState"]({}, "", targetPath);
  }

  window.__mflStaticUiRuntime?.sync?.();
  return { pageName: routePageName, viewName: nextView, targetPath };
}

function stageViewTransition(pageName, viewName, options = {}) {
  const nextView = String(viewName || "");
  if (!nextView) return null;

  const transition = {
    kind: "view",
    sequence: ++navigationTransitionSequence,
    pageName: String(pageName || ""),
    viewName: nextView,
    previousCurrentPage: state.currentPage,
    previousView: state.view,
    previousPage: state.page,
    previousSortKey: state.sortKey,
    previousSortDirection: state.sortDirection,
    previousPath: currentNavigationPath(),
    targetPath: "",
  };
  pendingViewTransition = transition;
  commitViewTransition(pageName, nextView, options);
  transition.targetPath = currentNavigationPath();
  return transition;
}

function stagedViewTransitionIsCurrent(transition) {
  return Boolean(
    transition
    && transition.kind === "view"
    && transition.sequence === navigationTransitionSequence
    && pendingViewTransition === transition
    && state.view === transition.viewName
    && currentNavigationPath() === transition.targetPath
  );
}

function pageTransitionIsCurrent(transition) {
  return Boolean(
    transition
    && transition.kind === "page"
    && transition.sequence === navigationTransitionSequence
    && (!transition.targetPath || currentNavigationPath() === transition.targetPath)
  );
}

function navigationTransitionIsCurrent(transition) {
  if (!transition) return true;
  return transition.kind === "view"
    ? stagedViewTransitionIsCurrent(transition)
    : pageTransitionIsCurrent(transition);
}

function pageNavigationIsCurrent(options = {}) {
  const transition = options && typeof options === "object"
    ? options.__mflNavigationTransition
    : null;
  return !transition || navigationTransitionIsCurrent(transition);
}

function takeStagedViewTransition(pageName, viewName) {
  const transition = pendingViewTransition;
  if (
    !transition
    || transition.pageName !== String(pageName || "")
    || transition.viewName !== String(viewName || "")
  ) return null;
  return stagedViewTransitionIsCurrent(transition) ? transition : null;
}

function waitForViewTransitionPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

let evaluationReadinessBusyToken = "";

function releaseEvaluationReadinessBusy() {
  const token = evaluationReadinessBusyToken;
  evaluationReadinessBusyToken = "";
  if (token) window.__mflInteractionBusy?.end?.(token);
  return Boolean(token);
}

function syncMobileTablePageTransitionChrome(pageName) {
  if (!window.matchMedia("(max-width: 900px)").matches) return;
  const normalizePage = (value) => {
    const page = String(value || "").trim().toLowerCase();
    if (page === "mflstats") return "mfl";
    if (page === "my-players") return "myplayers";
    return page;
  };
  const targetPage = normalizePage(pageName);
  const currentPage = normalizePage(document.body.dataset.page || state.currentPage);

  if (targetPage && currentPage && targetPage !== currentPage) {
    const scroller = document.querySelector("#progressionPage .playerTableScroller");
    if (scroller instanceof HTMLElement) scroller.scrollLeft = 0;
  }

  const views = document.querySelector("#progressionPage .views");
  const switcher = document.getElementById("watchlistSwitcher");
  if (!(views instanceof HTMLElement) || !(switcher instanceof HTMLElement)) return;

  const showWatchlistSelector = targetPage === "watchlist"
    && document.documentElement.dataset.storedWalletOptIn === "true";
  switcher.hidden = !showWatchlistSelector;

  if (showWatchlistSelector) {
    const shell = views.parentElement instanceof HTMLElement
      && views.parentElement.classList.contains("viewsScrollerShell")
      ? views.parentElement
      : null;
    (shell || views).insertAdjacentElement("afterend", switcher);
    switcher.classList.add("mflMobileWatchlistSwitcher");
    return;
  }

  switcher.classList.remove("mflMobileWatchlistSwitcher");
  if (switcher.parentElement !== views) views.appendChild(switcher);
  const dropdown = document.getElementById("watchlistDropdown");
  if (dropdown instanceof HTMLElement) dropdown.hidden = true;
  const button = document.getElementById("watchlistButton");
  if (button instanceof HTMLButtonElement) button.setAttribute("aria-expanded", "false");
}

async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {
  if (!settingsConfirmNavigation(pageName, updateHash)) return null;
  syncMobileTablePageTransitionChrome(pageName);
  const navigation = Reflect.get(window, "__mflNavigation");
  const loadingController = Reflect.get(window, "__mflInteractionBusy");
  if (pageName !== "evaluation") {
    releaseEvaluationReadinessBusy();
    document.body.classList.remove("evaluationPageLoading");
  }
  const navigationToken = typeof navigation?.beginLatest === "function"
    ? navigation.beginLatest("page-transition")
    : typeof navigation?.begin === "function"
      ? navigation.begin("page-transition")
      : "";
  let loadingToken = "";
  try {
    const sequence = ++navigationTransitionSequence;
    window.__mflCancelIncrementalRouteRequest?.();
    const transition = {
      ...commitPageTransition(pageName, updateHash, options),
      kind: "page",
      sequence,
    };
    document.documentElement.classList.add("mflInitialRouteSuperseded");
    loadingToken = loadingController?.beginRouteTransition?.(pageName, options) || "";
    await waitForViewTransitionPaint();
    if (!pageTransitionIsCurrent(transition)) return null;
    const result = typeof loader === "function" ? await loader(transition) : transition;
    if (!pageTransitionIsCurrent(transition)) return null;
    if (loadingToken) await waitForViewTransitionPaint();
    return result;
  } finally {
    if (loadingToken) loadingController?.end?.(loadingToken);
    if (navigationToken) navigation?.end?.(navigationToken);
  }
}

async function runViewTransition(pageName, viewName, options = {}, loader = null) {
  const navigation = Reflect.get(window, "__mflNavigation");
  const loadingController = Reflect.get(window, "__mflInteractionBusy");
  const navigationToken = typeof navigation?.beginLatest === "function"
    ? navigation.beginLatest("view-transition")
    : typeof navigation?.begin === "function"
      ? navigation.begin("view-transition")
      : "";
  let loadingToken = "";
  try {
    window.__mflCancelIncrementalRouteRequest?.();
    const transition = stageViewTransition(pageName, viewName, options);
    if (!transition) return null;
    document.documentElement.classList.add("mflInitialRouteSuperseded");
    loadingToken = loadingController?.beginRouteTransition?.(pageName, {
      ...options,
      view: viewName,
    }) || "";
    await waitForViewTransitionPaint();
    if (!stagedViewTransitionIsCurrent(transition)) return null;
    if (typeof loader === "function") {
      try {
        const result = await loader(transition);
        if (!stagedViewTransitionIsCurrent(transition)) return null;
        if (loadingToken) await waitForViewTransitionPaint();
        return result;
      } finally {
        if (pendingViewTransition === transition) pendingViewTransition = null;
      }
    }
    if (loadingToken) await waitForViewTransitionPaint();
    return transition;
  } finally {
    if (loadingToken) loadingController?.end?.(loadingToken);
    if (navigationToken) navigation?.end?.(navigationToken);
  }
}

Reflect.set(window, "__mflCommitViewTransition", commitViewTransition);
Reflect.set(window, "__mflCommitPageTransition", commitPageTransition);
Reflect.set(window, "__mflRunViewTransition", runViewTransition);
Reflect.set(window, "__mflRunPageTransition", runPageTransition);
Reflect.set(window, "__mflNavigationTransitionIsCurrent", navigationTransitionIsCurrent);
Reflect.set(window, "__mflWaitForViewTransitionPaint", waitForViewTransitionPaint);
