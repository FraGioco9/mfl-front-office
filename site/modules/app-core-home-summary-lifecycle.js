// @ts-check

import { splitHomeApplicationCoreRuntime } from "./app-core-home-chunk.js";
import { replaceRequired } from "./app-core-splitter-utils.js";

const SUMMARY_LOADER = `async function loadSummary() {
  try {
    const response = await fetch("/api/data?mode=bootstrap", { cache: "no-store", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load the database summary.");
    state.manifest = data.manifest || null;
    const summary = data.summary || {};
    updateSummaryCounts(summary.playerCount, summary.walletCount);
    updateStatusDate(summary.generatedAt);
    return true;
  } catch (error) {
    console.error(error?.message || "Could not load the database summary.");
    updateSummaryCounts(0, 0);
    return false;
  }
}`;

const DEDUPED_SUMMARY_LOADER = `let summaryLoadPromise = null;
let summaryLoaded = false;
let summarySnapshot = null;

function homeSummaryCacheReady() {
  return summaryLoaded && Boolean(summarySnapshot);
}

Reflect.set(globalThis, "__mflHomeSummaryCache", Object.freeze({
  isReady: homeSummaryCacheReady,
}));

async function loadSummary() {
  if (summaryLoaded && summarySnapshot) {
    updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);
    return true;
  }
  if (summaryLoadPromise) return summaryLoadPromise;

  summaryLoadPromise = (async () => {
    try {
      const response = await fetch("/api/data?mode=bootstrap", { cache: "no-store", headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load the database summary.");
      state.manifest = data.manifest || null;
      const summary = data.summary || {};
      summarySnapshot = Object.freeze({
        playerCount: summary.playerCount,
        walletCount: summary.walletCount,
      });
      updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);
      updateStatusDate(summary.generatedAt);
      summaryLoaded = true;
      return true;
    } catch (error) {
      console.error(error?.message || "Could not load the database summary.");
      updateSummaryCounts(0, 0);
      return false;
    }
  })();

  const result = await summaryLoadPromise;
  summaryLoadPromise = null;
  return result;
}`;

const INCREMENTAL_CACHE_PREDICATE = `function incrementalRouteIsCached(route, page = 1) {
  return Boolean(cachedIncrementalPayload(route, page));
}`;

const ROUTE_CACHE_CONTRACT = `function incrementalRouteIsCached(route, page = 1) {
  return Boolean(cachedIncrementalPayload(route, page));
}

function databaseStatsDataCacheReady() {
  const total = document.getElementById("databaseStatsTotalPlayers");
  if (!(total instanceof HTMLElement)) return false;
  const value = String(total.textContent || "").trim();
  return Boolean(value) && value !== "-";
}

function settingsDataCacheReady() {
  if (typeof hasWalletOptIn !== "function" || !hasWalletOptIn()) return true;
  return state.walletPreferencesLoaded === true && state.walletSettingsLoaded === true;
}

function routeDataCacheReady(pageName, options = {}) {
  const page = String(pageName || "home");
  const routeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};

  if (page === "home") return homeSummaryCacheReady();
  if (page === "notfound" || page === "changelog") return true;
  if (page === "settings") return settingsDataCacheReady();
  if (page === "database" && normalizeViewForPage(routeOptions.view, "database") === "stats") {
    return databaseStatsDataCacheReady();
  }

  const route = incrementalRouteTarget(page, routeOptions);
  if (!route) return false;
  return route.scope === "empty" || incrementalRouteIsCached(route, 1);
}

function currentRouteDataCacheReady() {
  if (!document.documentElement.classList.contains("mflInitialRouteResolved")) return false;
  const target = pageTargetFromPath(window.location.pathname + window.location.search);
  if (!target?.pageName) return false;
  return routeDataCacheReady(target.pageName, target.options || {});
}

Reflect.set(globalThis, "__mflRouteDataCache", Object.freeze({
  isReady: routeDataCacheReady,
  isCurrentRouteReady: currentRouteDataCacheReady,
}));`;

const SET_PAGE_START = `async function setPage(pageName, updateHash = true, options = {}) {
  if (pageName === "mfl" && normalizeViewForPage(options.view, "mfl") === "stats") {`;

const SET_PAGE_WITH_HOME_SUMMARY = `async function setPage(pageName, updateHash = true, options = {}) {
  if (pageName === "home") void loadSummary();
  if (pageName === "mfl" && normalizeViewForPage(options.view, "mfl") === "stats") {`;

/**
 * Make route-data cache readiness explicit. Home owns one shared summary cache,
 * incremental routes reuse their existing payload cache, Database Stats reuses
 * its already-rendered in-memory payload, and static/cached routes expose the
 * same readiness contract to shared loading UI. A failed Home bootstrap request
 * remains retryable the next time Home is opened.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeHomeSummaryLifecycle(artifacts) {
  const source = String(artifacts?.core || "");
  if (!source) throw new Error("Cannot normalize route cache lifecycle without shared core.");

  let core = replaceRequired(
    source,
    SUMMARY_LOADER,
    DEDUPED_SUMMARY_LOADER,
    "database summary loading is shared, repaintable, cache-aware, and retryable",
  );
  core = replaceRequired(
    core,
    INCREMENTAL_CACHE_PREDICATE,
    ROUTE_CACHE_CONTRACT,
    "all route data caches expose one shared readiness contract",
  );
  core = replaceRequired(
    core,
    SET_PAGE_START,
    SET_PAGE_WITH_HOME_SUMMARY,
    "every Home navigation ensures database summary loading",
  );

  return splitHomeApplicationCoreRuntime(Object.freeze({
    ...artifacts,
    core,
  }));
}
