// @ts-check

import { normalizeApplicationCore as normalizeBaseApplicationCore } from "./app-core-normalizer.js";
import { splitPlayerApplicationCoreRuntime } from "./app-core-player-chunk.js";
import { normalizeRouteRequestCancellation } from "./app-core-route-request-normalizer.js";
import { splitApplicationCoreRuntime } from "./app-core-route-chunks.js";
import { normalizeRouteRuntimeGate } from "./app-core-route-runtime-normalizer.js";
import { splitSettingsApplicationCoreRuntime } from "./app-core-settings-chunk.js";
import { splitTableApplicationCoreRuntime } from "./app-core-table-chunk.js";
import { normalizeStartupDataDependencies } from "./app-core-startup-data-normalizer.js";
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

  const transitionOwner = `function commitViewTransition(pageName, viewName, options = {}) {
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

  if (Object.prototype.hasOwnProperty.call(options, "sortKey")) {
    state.sortKey = options.sortKey;
  }
  if (Object.prototype.hasOwnProperty.call(options, "sortDirection")) {
    state.sortDirection = options.sortDirection;
  }

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

  if (targetPath && \`\${window.location.pathname}\${window.location.search}\` !== targetPath) {
    window.history[options.replace ? "replaceState" : "pushState"]({}, "", targetPath);
  }

  updateViewButtons();
  return nextView;
}
Reflect.set(window, "__mflCommitViewTransition", commitViewTransition);

`;
  text = replaceRequired(
    text,
    "function resetPageScroll() {",
    `${transitionOwner}function resetPageScroll() {`,
    "canonical view transition owner",
  );

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
    commitViewTransition(pageName, nextView, {
      ...routeOptions,
      sortKey: targetSortState.sortKey,
      sortDirection: targetSortState.sortDirection,
    });`,
    "shared table view transition",
  );

  text = replaceFunction(
    text,
    "activateViewButton",
    `function activateViewButton(button) {
  if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;
  const pageName = pageNameForViewButton(button);
  const viewName = button.dataset.view;
  if (!viewName) return;

  if (pageName === "club") return;

  if (pageName === "mfl" && viewName === "stats") {
    commitViewTransition("mfl", "stats", { statePageName: "mflstats" });
    void setPage("mflstats", false, { skipNavigationLoading: true });
    return;
  }
  if (state.currentPage === "mflstats" && pageName === "mfl" && viewName === "attributes") {
    commitViewTransition("mfl", "attributes", { statePageName: "mfl" });
    void setPage("mfl", false, { view: "attributes", skipNavigationLoading: true });
    return;
  }
  if (pageName !== state.currentPage && tablePages.has(pageName)) {
    state.currentPage = pageName;
    document.body.dataset.page = pageName;
  }
  void setView(viewName);
}`,
    "MFL Stats shared view transition",
  );

  text = replaceFunction(
    text,
    "openClubImmediately",
    `function openClubImmediately(clubId, view = "attributes") {
    void openClubPage(clubId, view, true);
  }`,
    "Club route entry transition",
  );

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
      commitViewTransition(CLUB_PAGE, nextView, {
        statePageName: CLUB_PAGE,
        path: route,
        replace: !updateHistory,
        sortKey: "positions",
        sortDirection: "asc",
      });
      setClubSwitching(true);`,
    "Club page transition before loading",
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
    if (typeof updateViewButtons === "function") updateViewButtons();`,
    `    captureClubView(state.view);
    commitViewTransition(CLUB_PAGE, nextView, {
      statePageName: CLUB_PAGE,
      path: canonicalClubRoute(activeClubId, nextView),
      replace: true,
      sortKey: "positions",
      sortDirection: "asc",
    });
    if (restoreCachedClubView(nextView)) return;
    setClubSwitching(true);`,
    "Club view transition before loading",
  );

  return text;
}

function normalizeWatchlistShellFirstNavigation(source) {
  return replaceRequired(
    source,
    `  if (pageName === "watchlist" && hasWalletOptIn()) {
    state.currentPage = pageName;
    state.pendingWatchlistRouteId = options.watchlistId || watchlistIdFromUrl() || "";
    await ensureWatchlistRoute(options);
  }`,
    `  if (pageName === "watchlist" && hasWalletOptIn()) {
    state.currentPage = pageName;
    document.body.dataset.page = pageName;
    const primeTableChrome = Reflect.get(window, "__mflPrimeTableChrome");
    if (typeof primeTableChrome === "function") primeTableChrome("watchlist", window.location.href);
    const primeTableRows = Reflect.get(window, "__mflPrimeTableRows");
    if (typeof primeTableRows === "function") primeTableRows(true);
    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== progressionPage;
    });
    renderWatchlistSwitcher();
    state.pendingWatchlistRouteId = options.watchlistId || watchlistIdFromUrl() || "";
    await ensureWatchlistRoute(options);
  }`,
    "Watchlist destination shell before route data",
  );
}

function normalizeReleaseOwnership(source) {
  let text = String(source || "");
  text = text.replaceAll(
    'const VERSION = "1.122.0";',
    'const VERSION = String(window.__mflReleaseVersion || "");',
  );
  text = text.replaceAll(
    'const RELEASE_VERSION = "1.122.0";',
    'const RELEASE_VERSION = String(window.__mflReleaseVersion || "");',
  );
  text = text.replaceAll(
    'const VERSION = String(window.__mflReleaseVersion || "1.122.0");',
    'const VERSION = String(window.__mflReleaseVersion || "");',
  );

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
  const watchlistShellSource = normalizeWatchlistShellFirstNavigation(viewTransitionsSource);
  const tableEventsSource = normalizeTableEventDelegation(watchlistShellSource);
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
