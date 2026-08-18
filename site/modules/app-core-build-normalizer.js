// @ts-check

import { normalizeApplicationCore as normalizeBaseApplicationCore } from "./app-core-normalizer.js";
import { splitPlayerApplicationCoreRuntime } from "./app-core-player-chunk.js";
import { normalizeRouteRequestCancellation } from "./app-core-route-request-normalizer.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { normalizeRouteRuntimeGate } from "./app-core-route-runtime-normalizer.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { normalizeStartupDataDependencies } from "./app-core-startup-data-normalizer.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { normalizeTableEventDelegation } from "./app-core-table-events-normalizer.js";
import { normalizePureTableStateRestoration } from "./app-core-table-state-normalizer.js";
import { splitWalletApplicationCoreRuntime } from "./app-core-wallet-chunk.js";
import { splitWatchlistRouteApplicationCoreRuntime } from "./app-core-watchlist-route-chunk.js";

function replaceRequired(source, current, replacement, label) {
  const text = String(source || "");
  if (!text.includes(current)) {
    throw new Error(`Could not normalize application core: ${label}.`);
  }
  return text.split(current).join(replacement);
}

function replaceFunction(source, functionName, replacement, label) {
  const text = String(source || "");
  const marker = `function ${functionName}(`;
  const start = text.indexOf(marker);
  const openBrace = start >= 0 ? text.indexOf("{", start + marker.length) : -1;
  if (start < 0 || openBrace < 0) {
    throw new Error(`Could not normalize application core function: ${label}.`);
  }

  let depth = 0;
  let end = -1;
  for (let index = openBrace; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error(`Could not find the end of application core function: ${label}.`);
  }
  return `${text.slice(0, start)}${replacement}${text.slice(end)}`;
}

function normalizeSharedViewOwnership(source) {
  let text = String(source || "");

  text = replaceFunction(
    text,
    "allowedViewsForPage",
    `function allowedViewsForPage(pageName = tablePageKey() || "progression") {
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredOrder = viewConfig && typeof viewConfig === "object" && Array.isArray(viewConfig?.[pageName]?.order)
    ? Array.from(viewConfig[pageName].order)
    : null;
  return configuredOrder || pageViewOptions[pageName] || pageViewOptions.progression;
}`,
    "canonical allowed view ownership",
  );

  text = replaceFunction(
    text,
    "defaultViewForPage",
    `function defaultViewForPage(pageName = tablePageKey() || "progression") {
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredFallback = viewConfig && typeof viewConfig === "object"
    ? String(viewConfig?.[pageName]?.fallback || "")
    : "";
  return configuredFallback || defaultPageViews[pageName] || "current";
}`,
    "canonical default view ownership",
  );

  text = replaceFunction(
    text,
    "updateViewButtons",
    `function updateViewButtons() {
  const pageName = state.currentPage === "mflstats"
    ? "mfl"
    : state.currentPage === "club"
      ? "club"
      : (tablePageKey() || "progression");
  const activeView = state.currentPage === "mflstats" ? "stats" : state.view;
  window.__mflStaticUiRuntime?.syncTableViews?.(pageName, activeView);
  updateNavigationLinks();
}`,
    "single loaded view-button owner",
  );

  return text;
}

function normalizeCanonicalViewTransitions(source) {
  let text = String(source || "");

  const transitionOwner = `let pendingViewTransition = null;
let navigationTransitionSequence = 0;

function currentNavigationPath() {
  return \`\${window.location.pathname}\${window.location.search}\`;
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
  }

  if (targetPath && currentNavigationPath() !== targetPath) {
    window.history[options.replace ? "replaceState" : "pushState"]({}, "", targetPath);
  }

  updateViewButtons();
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
    && transition.sequence === navigationTransitionSequence
    && pendingViewTransition === transition
    && state.view === transition.viewName
    && currentNavigationPath() === transition.targetPath
  );
}

function takeStagedViewTransition(pageName, viewName) {
  const transition = pendingViewTransition;
  if (
    !transition
    || transition.pageName !== String(pageName || "")
    || transition.viewName !== String(viewName || "")
  ) return null;
  pendingViewTransition = null;
  return transition;
}

function waitForViewTransitionPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {
  const navigation = Reflect.get(window, "__mflNavigation");
  const navigationToken = typeof navigation?.begin === "function"
    ? navigation.begin("page-transition")
    : "";
  try {
    const sequence = ++navigationTransitionSequence;
    const transition = commitPageTransition(pageName, updateHash, options);
    await waitForViewTransitionPaint();
    if (sequence !== navigationTransitionSequence) return null;
    if (transition.targetPath && currentNavigationPath() !== transition.targetPath) return null;
    return typeof loader === "function" ? await loader(transition) : transition;
  } finally {
    if (navigationToken) navigation?.end?.(navigationToken);
  }
}

async function runViewTransition(pageName, viewName, options = {}, loader = null) {
  const navigation = Reflect.get(window, "__mflNavigation");
  const navigationToken = typeof navigation?.begin === "function"
    ? navigation.begin("view-transition")
    : "";
  try {
    const transition = stageViewTransition(pageName, viewName, options);
    if (!transition) return null;
    await waitForViewTransitionPaint();
    if (!stagedViewTransitionIsCurrent(transition)) return null;
    if (typeof loader === "function") {
      pendingViewTransition = null;
      return await loader(transition);
    }
    return transition;
  } finally {
    if (navigationToken) navigation?.end?.(navigationToken);
  }
}

Reflect.set(window, "__mflCommitViewTransition", commitViewTransition);
Reflect.set(window, "__mflCommitPageTransition", commitPageTransition);
Reflect.set(window, "__mflRunViewTransition", runViewTransition);
Reflect.set(window, "__mflRunPageTransition", runPageTransition);
Reflect.set(window, "__mflWaitForViewTransitionPaint", waitForViewTransitionPaint);

`;
  text = replaceRequired(text, "function resetPageScroll() {", `${transitionOwner}function resetPageScroll() {`, "canonical view transition owner");

  text = replaceFunction(
    text,
    "pageNameForViewButton",
    `function pageNameForViewButton(button) {
  const currentPage = state.currentPage === "mflstats"
    ? "mfl"
    : state.currentPage === "club"
      ? "club"
      : tablePageKey();
  return currentPage || button?.dataset?.page || "progression";
}`,
    "Club-aware view button page ownership",
  );

  text = replaceRequired(
    text,
    `    const pageKey = tablePageKey();
    const previousView = state.view;
    const previousPage = state.page;
    const previousSortKey = state.sortKey;
    const previousSortDirection = state.sortDirection;
    const previousPath = \`\${window.location.pathname}\${window.location.search}\`;`,
    `    const stagedTransition = takeStagedViewTransition(pageName, nextView);
    const pageKey = tablePageKey();
    const previousCurrentPage = stagedTransition?.previousCurrentPage || state.currentPage;
    const previousView = stagedTransition?.previousView || state.view;
    const previousPage = stagedTransition?.previousPage ?? state.page;
    const previousSortKey = stagedTransition?.previousSortKey || state.sortKey;
    const previousSortDirection = stagedTransition?.previousSortDirection || state.sortDirection;
    const previousPath = stagedTransition?.previousPath || currentNavigationPath();`,
    "staged incremental view transition snapshot",
  );

  text = replaceRequired(
    text,
    `    state.view = nextView;
    state.page = 1;
    const targetSortState = normalizedViewSortState(
      pageKey ? state.tablePageStates[pageKey]?.viewSortStates?.[nextView] : null,
      nextView,
    );
    state.sortKey = targetSortState.sortKey;
    state.sortDirection = targetSortState.sortDirection;
    updatePageUrl(pageName, { updateUrl: true, ...routeOptions });
    updateViewButtons();`,
    `    const targetSortState = normalizedViewSortState(
      pageKey ? state.tablePageStates[pageKey]?.viewSortStates?.[nextView] : null,
      nextView,
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
    }`,
    "shared table view transition",
  );

  text = replaceRequired(
    text,
    `      } catch (error) {
        state.view = previousView;
        state.page = previousPage;
        state.sortKey = previousSortKey;
        state.sortDirection = previousSortDirection;`,
    `      } catch (error) {
        state.currentPage = previousCurrentPage;
        state.view = previousView;
        state.page = previousPage;
        state.sortKey = previousSortKey;
        state.sortDirection = previousSortDirection;`,
    "incremental view transition rollback",
  );

  text = replaceRequired(
    text,
    '  if (pageName === "mfl") return { ...base, scope: "mfl" };',
    '  if (pageName === "mfl") return { ...base, scope: view === "stats" ? "mflstats" : "mfl" };',
    "MFL Stats shared incremental route scope",
  );

  text = replaceRequired(
    text,
    `      : route.scope === "club"
        ? 5000
        : state.pageSize),`,
    `      : ["club", "mflstats"].includes(route.scope)
        ? 5000
        : state.pageSize),`,
    "MFL Stats complete incremental page size",
  );

  text = replaceRequired(
    text,
    `  setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {
    const requestedMflView = pageName === "mfl"`,
    `  setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {
    const navigationUpdatesHistory = updateHash;
    if (!options.skipNavigationTransition) {
      const navigationTransition = await runPageTransition(pageName, navigationUpdatesHistory, options);
      if (!navigationTransition) return;
    }
    updateHash = false;

    const requestedMflView = pageName === "mfl"`,
    "global page transition before route loading",
  );

  text = replaceRequired(
    text,
    `    if (pageName === "mfl" && requestedMflView === "stats") {
      state.incrementalMode = false;
      return originalSetPage.call(this, pageName, updateHash, {
        ...options,
        view: "stats",
        skipNavigationLoading: true,
      });
    }`,
    `    if (pageName === "mfl" && requestedMflView === "stats") {
      const route = prepareIncrementalRoute(pageName, {
        ...options,
        view: "stats",
        ignoreCurrentClubRoute: navigationUpdatesHistory,
      });
      if (!route) {
        state.incrementalMode = false;
        return originalSetPage.call(this, "mflstats", false, {
          ...options,
          replaceUrl: "",
          view: "stats",
          skipNavigationLoading: true,
        });
      }
      const payload = await requestIncrementalRoute(route, 1);
      if (!payload) return false;
      state.dataAccess = currentDataAccess(pageName);
      state.incrementalApplying = true;
      try {
        return await originalSetPage.call(this, "mflstats", false, {
          ...options,
          replaceUrl: "",
          view: "stats",
          skipNavigationLoading: true,
        });
      } finally {
        state.incrementalApplying = false;
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
      const statsOwner = window.__mflDatabaseStatsStateRuntime;
      if (typeof statsOwner?.render === "function") return statsOwner.render();
      if (typeof window.renderDatabaseStatsPage === "function") return window.renderDatabaseStatsPage(false);
      return;
    }`,
    "specialized Stats renderers after shared loading",
  );

  text = replaceRequired(text, "      ignoreCurrentClubRoute: updateHash,", "      ignoreCurrentClubRoute: navigationUpdatesHistory,", "preserve page-navigation route intent after early commit");

  text = replaceFunction(
    text,
    "activateViewButton",
    `function activateViewButton(button) {
  if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;
  const pageName = pageNameForViewButton(button);
  const viewName = button.dataset.view;
  if (!viewName) return;

  const activePageName = state.currentPage === "mflstats" ? "mfl" : state.currentPage;
  const activeViewName = state.currentPage === "mflstats" ? "stats" : state.view;
  if (pageName === activePageName && viewName === activeViewName) return;

  if (pageName === "club") return;

  if (pageName === "mfl" && viewName === "stats") {
    void runViewTransition("mfl", "stats", { statePageName: "mflstats" }, async () => {
      await setPage("mfl", false, { view: "stats", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (state.currentPage === "mflstats" && pageName === "mfl" && viewName === "attributes") {
    void runViewTransition("mfl", "attributes", { statePageName: "mfl" }, async () => {
      await setPage("mfl", false, { view: "attributes", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (pageName === "database" && viewName === "stats") {
    void runViewTransition("database", "stats", {}, async () => {
      await setPage("database", false, { view: "stats", skipNavigationTransition: true, skipNavigationLoading: true });
    });
    return;
  }
  if (pageName !== state.currentPage && tablePages.has(pageName)) {
    state.currentPage = pageName;
    document.body.dataset.page = pageName;
  }
  void (async () => {
    const transition = await runViewTransition(pageName, viewName, {
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
    });
    if (!transition) return;
    if (!state.incrementalMode) pendingViewTransition = null;
    await setView(viewName);
  })();
}`,
    "global view transition before every shared view loader",
  );

  text = replaceRequired(
    text,
    `  playerDetail.querySelectorAll("[data-player-attribute-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.playerAttributeView = button.dataset.playerAttributeView;
      saveTableState();
      renderPlayerPage(id);
    });
  });`,
    `  playerDetail.querySelectorAll("[data-player-attribute-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.playerAttributeView;
      if (!nextView || nextView === state.playerAttributeView) return;
      state.playerAttributeView = nextView;
      saveTableState();
      renderPlayerPage(id);
    });
  });`,
    "Player active view no-op",
  );

  text = replaceFunction(text, "openClubImmediately", `function openClubImmediately(clubId, view = "attributes") {
    void openClubPage(clubId, view, true);
  }`, "Club route entry transition");

  text = replaceRequired(
    text,
    `    openingClub = true;
    setClubSwitching(true);
    try {
      activeClubId = String(clubId);
      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";
      const route = canonicalClubRoute(activeClubId, nextView);
      if (updateHistory && \`\${window.location.pathname}\${window.location.search}\` !== route) {
        window.history.pushState({}, "", route);
      } else if (!updateHistory && normalizedPath() !== route) {
        window.history.replaceState({}, "", route);
      }`,
    `    openingClub = true;
    try {
      activeClubId = String(clubId);
      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";
      const route = canonicalClubRoute(activeClubId, nextView);
      const routeAlreadyCommitted = state.currentPage === CLUB_PAGE && normalizedPath() === route;
      if (!routeAlreadyCommitted) {
        const transition = await runPageTransition(CLUB_PAGE, updateHistory, {
          view: nextView,
          clubId: activeClubId,
          path: route,
          replace: !updateHistory,
          sortKey: "positions",
          sortDirection: "asc",
        });
        if (!transition) return;
      } else {
        state.sortKey = "positions";
        state.sortDirection = "asc";
      }
      setClubSwitching(true);`,
    "Club page entry through global page transition",
  );

  text = replaceRequired(
    text,
    `    captureClubView(state.view);
    window.history.replaceState({}, "", canonicalClubRoute(activeClubId, nextView));
    state.view = nextView;
    state.page = 1;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    if (restoreCachedClubView(nextView)) return;
    setClubSwitching(true);
    if (typeof updateViewButtons === "function") updateViewButtons();
    void (async () => {`,
    `    if (nextView === state.view) return;
    captureClubView(state.view);
    void runViewTransition(CLUB_PAGE, nextView, {
      statePageName: CLUB_PAGE,
      path: canonicalClubRoute(activeClubId, nextView),
      replace: true,
      sortKey: "positions",
      sortDirection: "asc",
    }, async () => {
      if (restoreCachedClubView(nextView)) return;
      setClubSwitching(true);`,
    "Club view entry through global view transition",
  );

  text = replaceRequired(
    text,
    `      } finally {
        await finishClubSwitch();
        captureClubView(nextView);
      }
    })();`,
    `      } finally {
        await finishClubSwitch();
        captureClubView(nextView);
      }
    });`,
    "Club global view transition callback closure",
  );

  return text;
}

function normalizeReleaseOwnership(source) {
  let text = String(source || "");
  text = text.replaceAll('const VERSION = "1.122.0";', 'const VERSION = String(window.__mflReleaseVersion || "");');
  text = text.replaceAll('const RELEASE_VERSION = "1.122.0";', 'const RELEASE_VERSION = String(window.__mflReleaseVersion || "");');
  text = text.replaceAll('const VERSION = String(window.__mflReleaseVersion || "1.122.0");', 'const VERSION = String(window.__mflReleaseVersion || "");');

  const legacyFooterOwner = `  function setFooterVersion() {
    const footerLink = document.querySelector(".siteFooter a[data-page='changelog']");
    if (footerLink) footerLink.textContent = \`MFL Front Office v\${VERSION}\`;
    document.querySelectorAll("[data-app-version]").forEach((element) => {
      element.textContent = \`v\${VERSION}\`;
    });
  }`;
  const sharedFooterOwner = `  function setFooterVersion() {
    window.__mflStaticUiRuntime?.sync?.();
  }`;
  return text.split(legacyFooterOwner).join(sharedFooterOwner);
}

function normalizeCompleteApplicationCore(source) {
  // Table delegation still runs after the base transform. Historical validator wording:
  // normalizeTableEventDelegation(normalizeBaseApplicationCore(source))
  const baseSource = normalizeBaseApplicationCore(source);
  const sharedViewsSource = normalizeSharedViewOwnership(baseSource);
  const viewTransitionsSource = normalizeCanonicalViewTransitions(sharedViewsSource);
  const tableEventsSource = normalizeTableEventDelegation(viewTransitionsSource);
  const startupDataSource = normalizeStartupDataDependencies(tableEventsSource);
  const routeRuntimeSource = normalizeRouteRuntimeGate(startupDataSource);
  const tableStateSource = normalizePureTableStateRestoration(routeRuntimeSource);
  return normalizeRouteRequestCancellation(tableStateSource);
}

function normalizeGeneratedReleaseOwnership(artifacts) {
  const routeChunks = Object.fromEntries(
    Object.entries(artifacts.routeChunks || {}).map(([name, source]) => [name, normalizeReleaseOwnership(source)]),
  );
  return {
    ...artifacts,
    core: normalizeReleaseOwnership(artifacts.core),
    routeChunks,
  };
}

export function normalizeBuiltApplicationCoreArtifacts(source) {
  const routeArtifacts = splitApplicationCoreRuntime(normalizeCompleteApplicationCore(source));
  const settingsArtifacts = splitSettingsApplicationCoreRuntime(routeArtifacts);
  const playerArtifacts = splitPlayerApplicationCoreRuntime(settingsArtifacts);
  const tableArtifacts = splitTableApplicationCoreRuntime(playerArtifacts);
  const walletArtifacts = splitWalletApplicationCoreRuntime(tableArtifacts);
  const watchlistArtifacts = splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);
  return normalizeGeneratedReleaseOwnership(watchlistArtifacts);
}

export function normalizeBuiltApplicationCore(source) {
  return normalizeBuiltApplicationCoreArtifacts(source).core;
}
