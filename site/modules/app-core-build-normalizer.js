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

function normalizeSharedViewOwnership(source) {
  let text = String(source || "");

  text = replaceRequired(
    text,
    `function allowedViewsForPage(pageName = tablePageKey() || "progression") {
  if (pageName === "watchlist" && !hasProgressionAccess()) {
    return ["attributes", "next", "contracts"];
  }

  return pageViewOptions[pageName] || pageViewOptions.progression;
}`,
    `function allowedViewsForPage(pageName = tablePageKey() || "progression") {
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredOrder = viewConfig && typeof viewConfig === "object" && Array.isArray(viewConfig?.[pageName]?.order)
    ? Array.from(viewConfig[pageName].order)
    : null;
  const allowedViews = configuredOrder || pageViewOptions[pageName] || pageViewOptions.progression;
  if (pageName === "watchlist" && !hasProgressionAccess()) {
    return allowedViews.filter((viewName) => ["attributes", "next", "contracts"].includes(viewName));
  }
  return allowedViews;
}`,
    "canonical allowed view ownership",
  );

  text = replaceRequired(
    text,
    `function defaultViewForPage(pageName = tablePageKey() || "progression") {
  if (pageName === "watchlist" && !hasProgressionAccess()) {
    return "attributes";
  }

  return defaultPageViews[pageName] || "current";
}`,
    `function defaultViewForPage(pageName = tablePageKey() || "progression") {
  if (pageName === "watchlist" && !hasProgressionAccess()) {
    return "attributes";
  }
  const viewConfig = Reflect.get(window, "__mflTableViewConfig");
  const configuredFallback = viewConfig && typeof viewConfig === "object"
    ? String(viewConfig?.[pageName]?.fallback || "")
    : "";
  return configuredFallback || defaultPageViews[pageName] || "current";
}`,
    "canonical default view ownership",
  );

  text = replaceRequired(
    text,
    `function updateViewButtons() {
  viewButtons.forEach((button) => {
    const pageName = pageNameForViewButton(button);
    const allowedViews = allowedViewsForPage(pageName);
    const buttonView = button.dataset.view;
    const activeView = state.currentPage === "mflstats" && pageName === "mfl" ? "stats" : state.view;
    const allowed = allowedViews.includes(buttonView);
    button.hidden = !allowed;
    button.classList.toggle("active", allowed && buttonView === activeView);
  });
  updateNavigationLinks();
}`,
    `function updateViewButtons() {
  const pageName = state.currentPage === "mflstats"
    ? "mfl"
    : (tablePageKey() || "progression");
  const activeView = state.currentPage === "mflstats" ? "stats" : state.view;
  window.__mflStaticUiRuntime?.syncTableViews?.(pageName, activeView);
  updateNavigationLinks();
}`,
    "single loaded view-button owner",
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
  const sharedViewsSource = normalizeSharedViewOwnership(source);
  const watchlistShellSource = normalizeWatchlistShellFirstNavigation(sharedViewsSource);
  const tableEventsSource = normalizeTableEventDelegation(normalizeBaseApplicationCore(watchlistShellSource));
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
