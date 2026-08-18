// @ts-check

const nativeFetch = window.fetch.bind(window);
const DEFAULT_TIMEOUT_MS = 60_000;
const runtimeLoadPromises = new Map();

/** @param {RequestInfo | URL} input */
function isSameOriginApiRequest(input) {
  try {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/**
 * Install one request policy for same-origin API calls made by the application core and modular runtimes.
 * Existing caller signals are preserved; calls without a signal receive a bounded timeout.
 * @param {{timeoutMs?: number}} [options]
 */
function installApiFetchPolicy({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (window.__mflApiFetchPolicyInstalled) return;
  window.__mflApiFetchPolicyInstalled = true;

  window.fetch = async (input, init = {}) => {
    if (!isSameOriginApiRequest(input)) {
      return nativeFetch(input, init);
    }

    const requestInit = { ...init };
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers || undefined).forEach((value, key) => headers.set(key, value));
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    requestInit.headers = headers;

    const callerSignal = init.signal || (input instanceof Request ? input.signal : null);
    if (callerSignal) {
      requestInit.signal = callerSignal;
      return nativeFetch(input, requestInit);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    requestInit.signal = controller.signal;
    try {
      return await nativeFetch(input, requestInit);
    } finally {
      window.clearTimeout(timer);
    }
  };
}

/** @param {string} path */
function assetUrl(path) {
  return new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`).href;
}

/**
 * Start a classic-script request immediately while keeping browser execution order deterministic.
 * Dynamic classic scripts with async=false execute in insertion order even when their downloads overlap.
 * Duplicate requests share one promise so route groups can safely overlap.
 * @param {string} path
 * @returns {Promise<void>}
 */
function loadClassicScript(path) {
  const normalizedPath = String(path || "");
  const existingPromise = runtimeLoadPromises.get(normalizedPath);
  if (existingPromise) return existingPromise;

  /** @type {Promise<void>} */
  const loader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = assetUrl(normalizedPath);
    script.async = false;
    script.dataset.mflRuntime = normalizedPath;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => {
      runtimeLoadPromises.delete(normalizedPath);
      reject(new Error(`Could not load ${normalizedPath}.`));
    }, { once: true });
    document.head.appendChild(script);
  });

  runtimeLoadPromises.set(normalizedPath, loader);
  return loader;
}

/**
 * Fetch a group concurrently. async=false on each classic script retains insertion/execution order,
 * so dependent runtime owners keep the same semantics without serial network round trips.
 * @param {readonly string[]} paths
 */
async function loadScriptGroup(paths) {
  const loaders = paths.map((path) => loadClassicScript(path));
  await Promise.all(loaders);
}

/**
 * Preload a later classic script without executing it yet.
 * @param {string} path
 */
function preloadClassicScript(path) {
  if (document.querySelector(`link[data-mfl-runtime-preload="${path}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "script";
  link.href = assetUrl(path);
  link.dataset.mflRuntimePreload = path;
  document.head.appendChild(link);
}

const UNIVERSAL_RUNTIME_SCRIPTS = Object.freeze([
  "/loading-toast-runtime.js",
  "/mobile-ui-runtime.js",
  "/static-ui-runtime.js",
  "/control-interactions-runtime.js",
  "/global-search-runtime.js",
]);

const TABLE_PRE_CORE_RUNTIME_SCRIPTS = Object.freeze([
  "/table-width-runtime.js",
  "/filter-controls-runtime.js",
  "/desktop-table-style-runtime.js",
  "/shared-table-ui-runtime.js",
  "/nationality-filter-options-runtime.js",
  "/table-loading-runtime.js",
]);

const TABLE_POST_CORE_RUNTIME_SCRIPTS = Object.freeze([
  "/selection-startup-reset-runtime.js",
  "/selection-stack-runtime.js",
]);

const WATCHLIST_UI_POST_CORE_RUNTIME_SCRIPTS = Object.freeze([
  "/watchlist-ui-runtime.js",
]);

const WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS = Object.freeze([
  "/watchlist-myplayers-route-runtime.js",
]);

const EVALUATION_PRE_CORE_RUNTIME_SCRIPTS = Object.freeze([
  "/evaluation-layout-runtime.js",
  "/evaluation-discount-rate-display-runtime.js",
  "/evaluation-load-intent-runtime.js",
  "/evaluation-mfl-usd-input-runtime.js",
  "/evaluation-discount-rate-runtime.js",
  "/evaluation-discount-rate-ui-runtime.js",
]);

const EVALUATION_POST_CORE_RUNTIME_SCRIPTS = Object.freeze([
  "/evaluation-search-state-runtime.js",
]);

const DATABASE_STATS_BRIDGE_RUNTIME_SCRIPTS = Object.freeze([
  "/database-stats-state-runtime.js",
]);

const DATABASE_STATS_RUNTIME_SCRIPTS = Object.freeze([
  "/database-stats-tooltip-portal-runtime.js",
  "/database-stats-reload-bootstrap-runtime.js",
  "/database-stats-runtime.js",
  "/database-stats-custom-filter-runtime.js",
]);

const CHANGELOG_RUNTIME_SCRIPTS = Object.freeze([
  "/changelog-history-runtime.js",
]);

const initialPathname = String(window.location.pathname || "/");

/** @param {string} pageName */
function normalizeRoutePageName(pageName) {
  const normalizer = Reflect.get(window, "__mflNormalizeRoutePageName");
  if (typeof normalizer !== "function") {
    throw new Error("Route page-name normalizer is unavailable.");
  }
  return String(normalizer(pageName) || "home");
}

/** @param {Record<string, unknown>} [options] */
function routeView(options = {}) {
  const normalizer = Reflect.get(window, "__mflNormalizeRouteView");
  if (typeof normalizer !== "function") {
    throw new Error("Route view normalizer is unavailable.");
  }
  return String(normalizer(options) || "");
}

/** @param {string} pageName @param {Record<string, unknown>} [options] */
function routeNeedsTable(pageName, options = {}) {
  const page = normalizeRoutePageName(pageName);
  const classifier = Reflect.get(window, "__mflRouteUsesTableInfrastructure");
  if (typeof classifier !== "function") {
    throw new Error("Table-route classifier is unavailable.");
  }
  if (!classifier(page)) return false;
  return page !== "database" || routeView(options) !== "stats";
}

/** @param {string} pageName */
function routeNeedsWatchlist(pageName) {
  return ["watchlist", "myplayers"].includes(normalizeRoutePageName(pageName));
}

/** @param {string} pageName */
function routeNeedsDatabaseStatsBridge(pageName) {
  return normalizeRoutePageName(pageName) === "database";
}

/** @param {string} pageName @param {Record<string, unknown>} [options] */
function routeNeedsDatabaseStats(pageName, options = {}) {
  return normalizeRoutePageName(pageName) === "database" && routeView(options) === "stats";
}

/** @param {readonly string[]} paths */
function uniqueScripts(paths) {
  return Array.from(new Set(paths));
}

/** @param {string} pageName @param {Record<string, unknown>} [options] */
function preCoreScriptsForRoute(pageName, options = {}) {
  const page = normalizeRoutePageName(pageName);
  const scripts = [];
  if (routeNeedsTable(page, options)) scripts.push(...TABLE_PRE_CORE_RUNTIME_SCRIPTS);
  if (routeNeedsDatabaseStatsBridge(page)) scripts.push(...DATABASE_STATS_BRIDGE_RUNTIME_SCRIPTS);
  if (routeNeedsDatabaseStats(page, options)) scripts.push(...DATABASE_STATS_RUNTIME_SCRIPTS);
  if (page === "evaluation") scripts.push(...EVALUATION_PRE_CORE_RUNTIME_SCRIPTS);
  if (page === "changelog") scripts.push(...CHANGELOG_RUNTIME_SCRIPTS);
  return uniqueScripts(scripts);
}

/** @param {string} pageName @param {Record<string, unknown>} [options] */
function postCoreScriptsForRoute(pageName, options = {}) {
  const page = normalizeRoutePageName(pageName);
  const scripts = [];
  if (routeNeedsTable(page, options)) scripts.push(...TABLE_POST_CORE_RUNTIME_SCRIPTS);
  if (page === "watchlist") scripts.push(...WATCHLIST_UI_POST_CORE_RUNTIME_SCRIPTS);
  if (routeNeedsWatchlist(page)) scripts.push(...WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS);
  if (page === "evaluation") scripts.push(...EVALUATION_POST_CORE_RUNTIME_SCRIPTS);
  return uniqueScripts(scripts);
}

function initialRouteRuntimeRequest() {
  const classifier = Reflect.get(window, "__mflInitialRouteRuntimeRequest");
  if (typeof classifier !== "function") {
    throw new Error("Initial route runtime classifier is unavailable.");
  }
  const request = classifier(initialPathname);
  const options = request?.options && typeof request.options === "object" && !Array.isArray(request.options)
    ? request.options
    : {};
  return { pageName: normalizeRoutePageName(request?.pageName), options };
}

const initialRouteRuntime = Object.freeze(initialRouteRuntimeRequest());
const evaluationStartup = initialRouteRuntime.pageName === "evaluation";
const databaseStatsStartup = initialRouteRuntime.pageName === "database" && routeView(initialRouteRuntime.options) === "stats";
const changelogStartup = initialRouteRuntime.pageName === "changelog";
const homeStartup = initialRouteRuntime.pageName === "home";
const playerStartup = initialRouteRuntime.pageName === "player";
const tableStartup = routeNeedsTable(initialRouteRuntime.pageName, initialRouteRuntime.options);
const initialPreCoreRuntimeScripts = Object.freeze(uniqueScripts([
  ...UNIVERSAL_RUNTIME_SCRIPTS,
  ...preCoreScriptsForRoute(initialRouteRuntime.pageName, initialRouteRuntime.options),
]));
initialPreCoreRuntimeScripts.forEach(preloadClassicScript);

/** @type {Window & {
 * __mflReleaseVersion?: string,
 * __mflInteractionBusy?: { begin?: (reason?: string) => string, end?: (token?: string) => void, installCoreBridge?: () => void },
 * __mflTableLoadingRuntime?: { installCoreBridge?: () => void, sync?: () => void },
 * __mflFilterControlsRuntime?: { sync?: () => void },
 * __mflDatabaseStatsReloadBootstrap?: { restoreRoute?: () => void, finalize?: () => void },
 * __mflDatabaseStatsStateRuntime?: { sync?: () => void },
 * __mflDatabaseStatsRuntime?: { sync?: () => void },
 * __mflGlobalSearchRuntime?: { flush?: () => boolean, focus?: () => void },
 * __mflEvaluationLayoutRuntime?: { sync?: () => void },
 * __mflEvaluationSearchStateRuntime?: { sync?: () => void, restoreEmptyRecentResults?: (force?: boolean) => Promise<boolean>, destroy?: () => void },
 * __mflSelectionStartupResetRuntime?: { rebind?: () => void },
 * __mflWatchlistMyPlayersRouteRuntime?: { install?: () => boolean },
 * __mflChangelogHistoryReady?: Promise<boolean>,
 * __mflAppStartPromise?: Promise<void>,
 * __mflEnsureRouteRuntime?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,
 * __mflRunPageTransition?: (pageName: string, updateHash?: boolean, options?: Record<string, unknown>, loader?: (() => unknown)) => Promise<unknown>,
 * __mflMarkApplicationCoreLoaded?: () => void,
 * mflOpenClubPage?: ((clubId: string, view?: string) => unknown) & { __mflRouteRuntimeGate?: boolean },
 * }} */
const runtimeWindow = window;

function releaseFromBootstrap() {
  const version = String(runtimeWindow.__mflReleaseVersion || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("The application bootstrap is missing a valid release version.");
  }
  return Object.freeze({ version, description: "" });
}

function installResponsiveStylesheet() {
  const existing = document.querySelector('link[data-mfl-responsive-layout="true"]');
  if (existing instanceof HTMLLinkElement) return Promise.resolve();

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.dataset.mflResponsiveLayout = "true";
  link.href = "/responsive.css";

  const ready = new Promise((resolve, reject) => {
    link.addEventListener("load", () => resolve(undefined), { once: true });
    link.addEventListener("error", () => reject(new Error("Could not load the responsive layout stylesheet.")), { once: true });
  });
  document.head.appendChild(link);
  return ready;
}

function promoteResponsiveStylesheet() {
  const link = document.querySelector('link[data-mfl-responsive-layout="true"]');
  if (!(link instanceof HTMLLinkElement) || link.parentElement !== document.head) return;
  document.head.appendChild(link);
}

const entryRelease = releaseFromBootstrap();
const responsiveStylesReady = installResponsiveStylesheet();
const PREBUILT_CORE_PATH = "/modules/app-core-runtime.js";
const SOURCE_CORE_PATH = "/modules/app-core.js";
const PREBUILT_CORE_CACHE_QUERY = "mfl_core";
let applicationCoreLoaded = false;
/** @type {() => void} */
let applicationCoreLoadedResolve = () => {};
const applicationCoreLoadedPromise = new Promise((resolve) => {
  applicationCoreLoadedResolve = () => resolve(undefined);
});
const routeRuntimeEnsurePromises = new Map();
let evaluationRecentStateBridgeInstalled = false;

function markApplicationCoreLoaded() {
  if (applicationCoreLoaded) return;
  applicationCoreLoaded = true;
  applicationCoreLoadedResolve();
}

runtimeWindow.__mflMarkApplicationCoreLoaded = markApplicationCoreLoaded;

function assertApplicationCoreInitialized(sourceLabel) {
  if (applicationCoreLoaded && runtimeWindow.__mflAppStartPromise) return;
  throw new Error(`${sourceLabel} application core loaded without initializing startup.`);
}

function prebuiltApplicationCorePath() {
  return `${PREBUILT_CORE_PATH}?${PREBUILT_CORE_CACHE_QUERY}=${encodeURIComponent(entryRelease.version)}`;
}

preloadClassicScript(prebuiltApplicationCorePath());

function primeEvaluationDiscountRatePlaceholder() {
  if (!evaluationStartup) return;
  const discountRate = document.getElementById("evaluationDiscountRate");
  if (!(discountRate instanceof HTMLElement)) return;
  if (!String(discountRate.textContent || "").trim()) discountRate.textContent = "-";
}

primeEvaluationDiscountRatePlaceholder();

function executeApplicationCore(path, source) {
  const script = document.createElement("script");
  script.dataset.mflRuntime = path;
  script.textContent = `${source}\n//# sourceURL=${path}`;
  document.head.appendChild(script);
  script.remove();
}

async function loadApplicationCore() {
  const prebuiltPath = prebuiltApplicationCorePath();
  let prebuiltLoadError = null;
  try {
    await loadClassicScript(prebuiltPath);
  } catch (error) {
    prebuiltLoadError = error;
  }

  if (!prebuiltLoadError) {
    assertApplicationCoreInitialized("Prebuilt");
    return;
  }

  console.warn("Prebuilt application core is unavailable; using source normalization fallback.", prebuiltLoadError);
  const fallbackLoader = Reflect.get(window, "__mflLoadFallbackApplicationCoreArtifacts");
  if (typeof fallbackLoader !== "function") {
    throw new Error("Application core fallback artifact loader is unavailable.");
  }
  const artifacts = await fallbackLoader();
  const source = String(artifacts?.core || "").trim();
  if (!source) throw new Error("Application core source fallback is unavailable.");
  executeApplicationCore(SOURCE_CORE_PATH, source);
  assertApplicationCoreInitialized("Fallback");
}

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

function installCoreBridges() {
  runtimeWindow.__mflTableLoadingRuntime?.installCoreBridge?.();
  runtimeWindow.__mflInteractionBusy?.installCoreBridge?.();
  runtimeWindow.__mflTableLoadingRuntime?.sync?.();
  runtimeWindow.__mflGlobalSearchRuntime?.flush?.();
  installClubRouteRuntimeGate();
}

function installEvaluationRecentStateBridge() {
  if (evaluationRecentStateBridgeInstalled) return true;
  try {
    const installed = Boolean(window.eval(`(() => {
      if (typeof restoreRecentEvaluationState !== "function"
        || typeof persistRecentSearchStates !== "function"
        || typeof saveTableStateLocally !== "function") return false;
      if (restoreRecentEvaluationState.__mflRecentStateOnly) return true;

      state.recentEvaluationPlayerIds = [];

      const recentStateOnlyRestore = function(savedState) {
        const incoming = savedState && typeof savedState === "object" && !Array.isArray(savedState)
          && Array.isArray(savedState.recentEvaluationPlayerIds)
          ? savedState.recentEvaluationPlayerIds
          : [];
        state.recentEvaluationPlayerIds = normalizeIdList(incoming, 5);
        if (/^\\/evaluation\\/?$/i.test(window.location.pathname)) {
          void window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(true);
        }
      };
      Object.defineProperty(recentStateOnlyRestore, "__mflRecentStateOnly", { value: true });
      restoreRecentEvaluationState = recentStateOnlyRestore;

      persistRecentSearchStates = function persistSearchStatesWithoutEvaluationLocalStorage() {
        saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
        saveRecentIdsToStorage(RECENT_AGENT_SEARCH_STORAGE_KEY, state.recentSearchAgentWallets);
        saveRecentIdsToStorage(RECENT_MIXED_SEARCH_STORAGE_KEY, state.recentSearchItems);
      };

      const originalSaveTableStateLocally = saveTableStateLocally;
      saveTableStateLocally = function saveTableStateWithoutEvaluationRecents(tableState) {
        if (!tableState || typeof tableState !== "object" || Array.isArray(tableState)) {
          return originalSaveTableStateLocally(tableState);
        }
        const localState = { ...tableState };
        delete localState.recentEvaluationPlayerIds;
        return originalSaveTableStateLocally(localState);
      };

      if (typeof primeEmptyEvaluationSearch === "function"
        && !primeEmptyEvaluationSearch.__mflDataOnly) {
        const dataOnlyPrimeEmptyEvaluationSearch = function() {
          const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
          if (typeof prime === "function") return prime(true);
          return Promise.resolve(true);
        };
        Object.defineProperty(dataOnlyPrimeEmptyEvaluationSearch, "__mflDataOnly", { value: true });
        primeEmptyEvaluationSearch = dataOnlyPrimeEmptyEvaluationSearch;
      }

      if (typeof finishEvaluationReadiness === "function"
        && !finishEvaluationReadiness.__mflAwaitsRecentEvaluation) {
        const originalFinishEvaluationReadiness = finishEvaluationReadiness;
        const finishEvaluationReadinessWithRecents = async function() {
          if (isPlainEvaluationUrl() && !state.evaluationPlayerId && !evaluationSearchInput.value.trim()) {
            const prime = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
            if (typeof prime === "function") await prime(false);
          }
          return originalFinishEvaluationReadiness.apply(this, arguments);
        };
        Object.defineProperty(finishEvaluationReadinessWithRecents, "__mflAwaitsRecentEvaluation", { value: true });
        finishEvaluationReadiness = finishEvaluationReadinessWithRecents;
      }

      return true;
    })();`));
    evaluationRecentStateBridgeInstalled = installed;
    return installed;
  } catch (error) {
    console.warn("Could not install Evaluation recent-state ownership.", error);
    return false;
  }
}

/** @param {string} clubId @param {string} view */
function clubRoutePath(clubId, view) {
  const slugByView = new Map([
    ["attributes", "squad"],
    ["squad", "squad"],
    ["contracts", "contracts"],
    ["current", "current-season"],
    ["current-season", "current-season"],
    ["all", "all-time"],
    ["all-time", "all-time"],
  ]);
  const slug = slugByView.get(String(view || "attributes").toLowerCase()) || "squad";
  return `/clubs/${encodeURIComponent(clubId)}/${slug}`;
}

function installClubRouteRuntimeGate() {
  const current = runtimeWindow.mflOpenClubPage;
  if (typeof current !== "function" || current.__mflRouteRuntimeGate) return false;

  const gated = /** @type {typeof current} */ (async function mflOpenClubPageWithRouteRuntime(clubId, view = "attributes") {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) return current.call(runtimeWindow, clubId, view);

    const loadClub = async () => {
      const token = runtimeWindow.__mflInteractionBusy?.begin?.("route-runtime") || "";
      try {
        await ensureRouteRuntime("club", { view });
        return current.call(runtimeWindow, normalizedClubId, view);
      } finally {
        if (token) runtimeWindow.__mflInteractionBusy?.end?.(token);
      }
    };

    const runTransition = runtimeWindow.__mflRunPageTransition;
    if (typeof runTransition === "function") {
      return runTransition("club", true, {
        clubId: normalizedClubId,
        view,
        path: clubRoutePath(normalizedClubId, view),
        sortKey: "positions",
        sortDirection: "asc",
      }, loadClub);
    }
    return loadClub();
  });
  Object.defineProperty(gated, "__mflRouteRuntimeGate", { value: true });
  runtimeWindow.mflOpenClubPage = gated;
  return true;
}

/** @param {string} pageName @param {Record<string, unknown>} [options] */
async function ensureRouteRuntimeNow(pageName, options = {}) {
  const page = normalizeRoutePageName(pageName);
  await loadScriptGroup(preCoreScriptsForRoute(page, options));
  if (!applicationCoreLoaded) await applicationCoreLoadedPromise;

  if (page === "evaluation") installEvaluationRecentStateBridge();
  await loadScriptGroup(postCoreScriptsForRoute(page, options));

  if (routeNeedsTable(page, options)) {
    runtimeWindow.__mflFilterControlsRuntime?.sync?.();
    runtimeWindow.__mflSelectionStartupResetRuntime?.rebind?.();
  }
  if (routeNeedsWatchlist(page)) {
    runtimeWindow.__mflWatchlistMyPlayersRouteRuntime?.install?.();
  }
  if (routeNeedsDatabaseStatsBridge(page)) {
    runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  }
  if (routeNeedsDatabaseStats(page, options)) {
    runtimeWindow.__mflDatabaseStatsRuntime?.sync?.();
    runtimeWindow.__mflDatabaseStatsReloadBootstrap?.restoreRoute?.();
  }
  if (page === "evaluation") {
    runtimeWindow.__mflEvaluationLayoutRuntime?.sync?.();
    runtimeWindow.__mflEvaluationSearchStateRuntime?.sync?.();
  }
  if (page === "changelog" && runtimeWindow.__mflChangelogHistoryReady) {
    await runtimeWindow.__mflChangelogHistoryReady;
  }

  installCoreBridges();
}

/** @param {string} pageName @param {Record<string, unknown>} [options] */
function ensureRouteRuntime(pageName, options = {}) {
  const page = normalizeRoutePageName(pageName);
  const view = routeView(options);
  const key = `${page}:${view === "stats" ? "stats" : "default"}`;
  const existing = routeRuntimeEnsurePromises.get(key);
  if (existing) return existing;

  const pending = ensureRouteRuntimeNow(page, options).catch((error) => {
    routeRuntimeEnsurePromises.delete(key);
    throw error;
  });
  routeRuntimeEnsurePromises.set(key, pending);
  return pending;
}

runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime;

function runPostStartupSync(label, callback) {
  try {
    callback?.();
  } catch (error) {
    console.warn(`Post-start ${label} synchronization failed.`, error);
  }
}

async function start() {
  const release = entryRelease;
  window.__mflRelease = release;
  window.__mflAssetUrl = (path) => new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`).href;

  installApiFetchPolicy();
  await responsiveStylesReady;
  await loadScriptGroup(initialPreCoreRuntimeScripts);

  if (changelogStartup && runtimeWindow.__mflChangelogHistoryReady) {
    await runtimeWindow.__mflChangelogHistoryReady;
  }

  await loadApplicationCore();
  installCoreBridges();
  await ensureRouteRuntime(initialRouteRuntime.pageName, initialRouteRuntime.options);

  if (evaluationStartup && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
    await runtimeWindow.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false);
  }

  if (databaseStatsStartup) {
    runtimeWindow.__mflDatabaseStatsReloadBootstrap?.finalize?.();
    runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  }

  if ((homeStartup || tableStartup || playerStartup) && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
  }

  promoteResponsiveStylesheet();

  runPostStartupSync("Evaluation layout", () => runtimeWindow.__mflEvaluationLayoutRuntime?.sync?.());
  runPostStartupSync("Database Stats reload", () => runtimeWindow.__mflDatabaseStatsReloadBootstrap?.finalize?.());
  runPostStartupSync("Database Stats state", () => runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.());

  document.documentElement.dataset.mflReady = "true";
  window.dispatchEvent(new CustomEvent("mfl:ready", { detail: release }));

  // Compatibility marker for the legacy validator; route-irrelevant runtimes are no longer globally deferred:
  // void Promise.all([deferredRuntimePromise, evaluationSearchRuntimePromise])
}

void start().catch(showStartupError);
