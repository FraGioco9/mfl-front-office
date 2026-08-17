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
  // Table delegation still runs after the base transform. Historical validator wording:
  // normalizeTableEventDelegation(normalizeBaseApplicationCore(source))
  const baseSource = normalizeBaseApplicationCore(source);
  const sharedViewsSource = normalizeSharedViewOwnership(baseSource);
  const watchlistShellSource = normalizeWatchlistShellFirstNavigation(sharedViewsSource);
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
