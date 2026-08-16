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
 * Duplicate requests share one promise so deferred route groups can safely overlap.
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

const CORE_RUNTIME_SCRIPTS = Object.freeze([
  "/loading-toast-runtime.js",
  "/mobile-ui-runtime.js",
  "/desktop-table-style-runtime.js",
  "/static-ui-runtime.js",
  "/table-view-runtime.js",
  "/shared-table-ui-runtime.js",
  "/table-navigation-chrome-runtime.js",
  "/control-interactions-runtime.js",
  "/nationality-filter-options-runtime.js",
  "/global-search-runtime.js",
  "/watchlist-ui-runtime.js",
  "/table-loading-runtime.js",
]);

const EVALUATION_RUNTIME_SCRIPTS = Object.freeze([
  "/evaluation-layout-runtime.js",
  "/evaluation-discount-rate-display-runtime.js",
  "/evaluation-load-intent-runtime.js",
  "/evaluation-mfl-usd-input-runtime.js",
  "/evaluation-discount-rate-runtime.js",
  "/evaluation-discount-rate-ui-runtime.js",
]);

const DATABASE_STATS_RUNTIME_SCRIPTS = Object.freeze([
  "/database-stats-tooltip-portal-runtime.js",
  "/database-stats-reload-bootstrap-runtime.js",
  "/database-stats-runtime.js",
  "/database-stats-state-runtime.js",
  "/database-stats-custom-filter-runtime.js",
]);

const CHANGELOG_RUNTIME_SCRIPTS = Object.freeze([
  "/changelog-history-runtime.js",
]);

const SPECIALIZED_RUNTIME_SCRIPTS = Object.freeze([
  ...EVALUATION_RUNTIME_SCRIPTS,
  ...DATABASE_STATS_RUNTIME_SCRIPTS,
  ...CHANGELOG_RUNTIME_SCRIPTS,
]);

const LATE_RUNTIME_SCRIPTS = Object.freeze([
  "/selection-startup-reset-runtime.js",
  "/watchlist-myplayers-route-runtime.js",
  "/selection-stack-runtime.js",
]);

const initialPathname = String(window.location.pathname || "/");
const evaluationStartup = /^\/evaluation\/?$/i.test(initialPathname);
const databaseStatsStartup = /^\/database\/stats\/?$/i.test(initialPathname);
const changelogStartup = /^\/changelog\/?$/i.test(initialPathname);
const homeStartup = /^\/(?:home)?\/?$/i.test(initialPathname);
const playerStartup = /^\/players\/[^/]+\/?$/i.test(initialPathname);
const tableStartup = /^\/(?:database|mfl|progression|watchlist|my-players|agents|clubs?|club)(?:\/|$)/i.test(initialPathname)
  && !/^\/(?:database|mfl)\/stats\/?$/i.test(initialPathname);

function criticalRuntimeScripts() {
  const scripts = [...CORE_RUNTIME_SCRIPTS];
  if (evaluationStartup) scripts.push(...EVALUATION_RUNTIME_SCRIPTS);
  if (databaseStatsStartup) scripts.push(...DATABASE_STATS_RUNTIME_SCRIPTS);
  if (changelogStartup) scripts.push(...CHANGELOG_RUNTIME_SCRIPTS);
  return scripts;
}

function deferredRuntimeScripts(criticalScripts) {
  const critical = new Set(criticalScripts);
  return SPECIALIZED_RUNTIME_SCRIPTS.filter((path) => !critical.has(path));
}

const initialCriticalRuntimeScripts = Object.freeze(criticalRuntimeScripts());
initialCriticalRuntimeScripts.forEach(preloadClassicScript);

/** @type {Window & {
 * __mflReleaseVersion?: string,
 * __mflInteractionBusy?: { installCoreBridge?: () => void },
 * __mflTableLoadingRuntime?: { installCoreBridge?: () => void, sync?: () => void },
 * __mflTableWidthRuntime?: { takeOwnership?: () => boolean },
 * __mflDatabaseStatsReloadBootstrap?: { restoreRoute?: () => void, finalize?: () => void },
 * __mflDatabaseStatsStateRuntime?: { sync?: () => void },
 * __mflGlobalSearchRuntime?: { flush?: () => boolean, focus?: () => void },
 * __mflEvaluationSearchStateRuntime?: { sync?: () => void, restoreEmptyRecentResults?: (force?: boolean) => Promise<boolean>, destroy?: () => void },
 * __mflAppStartPromise?: Promise<void>,
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

function prebuiltApplicationCorePath() {
  return `${PREBUILT_CORE_PATH}?${PREBUILT_CORE_CACHE_QUERY}=${encodeURIComponent(entryRelease.version)}`;
}

preloadClassicScript(prebuiltApplicationCorePath());
if (evaluationStartup) preloadClassicScript("/evaluation-search-state-runtime.js");

function primeEvaluationDiscountRatePlaceholder() {
  if (!evaluationStartup) return;
  const discountRate = document.getElementById("evaluationDiscountRate");
  if (!(discountRate instanceof HTMLElement)) return;
  if (!String(discountRate.textContent || "").trim()) discountRate.textContent = "-";
  discountRate.style.setProperty("visibility", "visible", "important");
}

primeEvaluationDiscountRatePlaceholder();

function executeApplicationCore(path, source) {
  const script = document.createElement("script");
  script.dataset.mflRuntime = path;
  script.textContent = `${source}\n//# sourceURL=${path}`;
  document.head.appendChild(script);
  script.remove();
}

/** @returns {Promise<string>} */
async function fetchApplicationCoreSource(path) {
  const response = await nativeFetch(assetUrl(path), { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  return response.text();
}

async function loadApplicationCore() {
  const prebuiltPath = prebuiltApplicationCorePath();
  try {
    await loadClassicScript(prebuiltPath);
    return;
  } catch (error) {
    console.warn("Prebuilt application core is unavailable; using source normalization fallback.", error);
  }

  const normalizerPromise = import(assetUrl("/modules/app-core-build-normalizer.js"));
  const sourcePromise = fetchApplicationCoreSource(SOURCE_CORE_PATH);
  const [normalizer, rawSource] = await Promise.all([normalizerPromise, sourcePromise]);
  if (typeof normalizer.normalizeBuiltApplicationCore !== "function") {
    throw new Error("Application core build normalizer is unavailable.");
  }

  const source = normalizer.normalizeBuiltApplicationCore(rawSource);
  executeApplicationCore(SOURCE_CORE_PATH, source);
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
  runtimeWindow.__mflTableWidthRuntime?.takeOwnership?.();
}

function installEvaluationRecentStateBridge() {
  try {
    return Boolean(window.eval(`(() => {
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
  } catch (error) {
    console.warn("Could not install Evaluation recent-state ownership.", error);
    return false;
  }
}

async function start() {
  const release = entryRelease;
  window.__mflRelease = release;
  window.__mflAssetUrl = (path) => new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`).href;

  installApiFetchPolicy();
  const criticalScripts = initialCriticalRuntimeScripts;
  const deferredScripts = deferredRuntimeScripts(criticalScripts);

  await responsiveStylesReady;
  await loadScriptGroup(criticalScripts);

  if (changelogStartup) {
    const changelogWindow = /** @type {Window & { __mflChangelogHistoryReady?: Promise<boolean> }} */ (window);
    if (changelogWindow.__mflChangelogHistoryReady) await changelogWindow.__mflChangelogHistoryReady;
  }

  await loadApplicationCore();

  /* Start route-irrelevant runtimes after the canonical core render begins, but
   * do not keep the active route behind their completion. Initial-route runtimes
   * are still part of the critical group above. */
  const deferredRuntimePromise = loadScriptGroup(deferredScripts);

  installEvaluationRecentStateBridge();
  const evaluationSearchRuntimePromise = evaluationStartup
    ? loadClassicScript("/evaluation-search-state-runtime.js")
    : deferredRuntimePromise.then(() => loadClassicScript("/evaluation-search-state-runtime.js"));
  if (evaluationStartup) await evaluationSearchRuntimePromise;

  installCoreBridges();
  if (evaluationStartup && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
    await runtimeWindow.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false);
  }

  runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  runtimeWindow.__mflDatabaseStatsReloadBootstrap?.restoreRoute?.();
  await loadScriptGroup(LATE_RUNTIME_SCRIPTS);

  if (databaseStatsStartup) {
    runtimeWindow.__mflDatabaseStatsReloadBootstrap?.finalize?.();
    runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  }

  if ((homeStartup || tableStartup || playerStartup) && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
  }

  promoteResponsiveStylesheet();
  document.documentElement.dataset.mflReady = "true";
  window.dispatchEvent(new CustomEvent("mfl:ready", { detail: release }));

  void Promise.all([deferredRuntimePromise, evaluationSearchRuntimePromise])
    .then(() => {
      installCoreBridges();
      runtimeWindow.__mflDatabaseStatsReloadBootstrap?.finalize?.();
      runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
    })
    .catch((error) => console.warn("Could not finish deferred route runtimes.", error));
}

void start().catch(showStartupError);
