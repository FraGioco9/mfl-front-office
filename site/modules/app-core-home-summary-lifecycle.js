// @ts-check

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

const SET_PAGE_START = `async function setPage(pageName, updateHash = true, options = {}) {
  if (pageName === "mfl" && normalizeViewForPage(options.view, "mfl") === "stats") {`;

const SET_PAGE_WITH_HOME_SUMMARY = `async function setPage(pageName, updateHash = true, options = {}) {
  if (pageName === "home") void loadSummary();
  if (pageName === "mfl" && normalizeViewForPage(options.view, "mfl") === "stats") {`;

/**
 * Make the database summary a reusable Home dependency. Startup and later Home
 * navigation share one in-flight request. Successful counts are cached so a
 * later Home route-prime can reset its placeholders and then immediately
 * repaint the cached summary without another request. A failed bootstrap
 * request remains retryable the next time Home is opened.
 * @param {{core?: string, routeChunks?: Record<string, string>}} artifacts
 */
export function normalizeHomeSummaryLifecycle(artifacts) {
  const source = String(artifacts?.core || "");
  if (!source) throw new Error("Cannot normalize Home summary lifecycle without shared core.");

  let core = replaceRequired(
    source,
    SUMMARY_LOADER,
    DEDUPED_SUMMARY_LOADER,
    "database summary loading is shared, repaintable, and retryable",
  );
  core = replaceRequired(
    core,
    SET_PAGE_START,
    SET_PAGE_WITH_HOME_SUMMARY,
    "every Home navigation ensures database summary loading",
  );

  return Object.freeze({
    ...artifacts,
    core,
  });
}
