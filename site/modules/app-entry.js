// @ts-check

import { installApiFetchPolicy } from "./http.js";
import { loadClassicScript, loadScriptGroup } from "./runtime-loader.js";

const EARLY_RUNTIME_SCRIPTS = Object.freeze([
  "/database-stats-tooltip-portal-runtime.js",
  "/release-ui-runtime.js",
  "/changelog-history-runtime.js",
  "/evaluation-static-chrome-runtime.js",
  "/mfl-stats-first-paint-runtime.js",
  "/database-static-filter-runtime.js",
  "/global-search-runtime.js",
  "/startup-integrity-runtime.js",
  "/discount-tooltip-mouse-runtime.js",
  "/watchlist-route-ui-runtime.js",
  "/table-loading-runtime.js",
  "/database-stats-navigation-release-runtime.js",
  "/database-stats-runtime.js",
  "/database-stats-state-runtime.js",
]);

const LATE_RUNTIME_SCRIPTS = Object.freeze([
  "/database-stats-refinement-runtime.js",
  "/database-stats-view-button-runtime.js",
  "/selection-refresh-reset-runtime.js",
  "/watchlist-myplayers-route-runtime.js",
  "/selection-stack-runtime.js",
]);

/** @type {Window & {
 * __mflInteractionBusy?: { installLegacyBridge?: () => void },
 * __mflTableLoadingRuntime?: { installLegacyBridge?: () => void, sync?: () => void },
 * __mflDatabaseStatsReloadBootstrap?: { restoreRoute?: () => void, finalize?: () => void },
 * __mflDatabaseStatsStateRuntime?: { sync?: () => void },
 * __mflStatsFirstPaintRuntime?: { sync?: () => void, installLegacyBridge?: () => void },
 * __mflGlobalSearchRuntime?: { flush?: () => boolean, focus?: () => void },
 * __mflAppStartPromise?: Promise<void>,
 * }} */
const runtimeWindow = window;

function primeEvaluationDiscountRatePlaceholder() {
  if (!/^\/evaluation\/?$/i.test(window.location.pathname)) return;
  const discountRate = document.getElementById("evaluationDiscountRate");
  if (!(discountRate instanceof HTMLElement)) return;
  if (!String(discountRate.textContent || "").trim()) discountRate.textContent = "-";
  discountRate.style.setProperty("visibility", "visible", "important");
}

primeEvaluationDiscountRatePlaceholder();

function showStartupError(error) {
  console.error(error);
  document.documentElement.dataset.mflReady = "error";
  const existing = document.getElementById("mflStartupError");
  if (existing) return;

  const message = document.createElement("p");
  message.id = "mflStartupError";
  message.className = "emptyState";
  message.setAttribute("role", "alert");
  message.textContent = "Could not load MFL Front Office.";
  document.querySelector("main")?.prepend(message);
}

function releaseFromEntryUrl() {
  const version = new URL(import.meta.url).searchParams.get("v")?.trim() || "";
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("The application entry is missing a valid release version.");
  }
  return Object.freeze({ version, description: "" });
}

function installLegacyBridges() {
  runtimeWindow.__mflTableLoadingRuntime?.installLegacyBridge?.();
  runtimeWindow.__mflInteractionBusy?.installLegacyBridge?.();
  runtimeWindow.__mflStatsFirstPaintRuntime?.installLegacyBridge?.();
  runtimeWindow.__mflTableLoadingRuntime?.sync?.();
  runtimeWindow.__mflGlobalSearchRuntime?.flush?.();
}

async function start() {
  // app.js already fetched and validated release.json before importing this
  // versioned entry module. Reuse the version embedded in this module URL so
  // startup never performs a duplicate release-metadata request.
  const release = releaseFromEntryUrl();
  window.__mflRelease = release;
  window.__mflReleaseVersion = release.version;
  window.__mflAssetUrl = (path) => new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`).href;

  installApiFetchPolicy();
  await loadScriptGroup(EARLY_RUNTIME_SCRIPTS, release.version);

  if (/^\/changelog\/?$/i.test(window.location.pathname)) {
    const changelogWindow = /** @type {Window & { __mflChangelogHistoryReady?: Promise<boolean> }} */ (window);
    if (changelogWindow.__mflChangelogHistoryReady) await changelogWindow.__mflChangelogHistoryReady;
  }

  await loadClassicScript("/modules/legacy-core.js", release.version);
  installLegacyBridges();
  const evaluationStartup = /^\/evaluation\/?$/i.test(window.location.pathname);
  const tableStartup = /^\/(?:database|mfl|progression|watchlist|my-players|agents|clubs?|club)(?:\/|$)/i.test(window.location.pathname)
    && !/^\/(?:database|mfl)\/stats\/?$/i.test(window.location.pathname);
  if (evaluationStartup && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
  }
  runtimeWindow.__mflStatsFirstPaintRuntime?.sync?.();
  runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  runtimeWindow.__mflDatabaseStatsReloadBootstrap?.restoreRoute?.();
  await loadScriptGroup(LATE_RUNTIME_SCRIPTS, release.version);
  // Late compatibility runtimes can replace legacy functions. Reinstall every
  // bridge after they load so loading/cursor ownership and static table chrome
  // keep wrapping the functions that are actually active in the page.
  installLegacyBridges();
  runtimeWindow.__mflDatabaseStatsReloadBootstrap?.finalize?.();
  runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  runtimeWindow.__mflStatsFirstPaintRuntime?.sync?.();

  // Keep late runtimes such as selection bridges available as early as possible,
  // but do not expose pagination or release the startup loading state on player
  // table routes until the legacy table request has actually settled. Dedicated
  // Stats pages own their own readiness and therefore must not wait here.
  if (tableStartup && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
  }

  document.documentElement.dataset.mflReady = "true";
  window.dispatchEvent(new CustomEvent("mfl:ready", { detail: release }));
}

void start().catch(showStartupError);
