// @ts-check

const nativeFetch = window.fetch.bind(window);
const DEFAULT_TIMEOUT_MS = 60_000;

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
 * @param {string} path
 * @returns {Promise<void>}
 */
function loadClassicScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = assetUrl(path);
    script.async = false;
    script.dataset.mflRuntime = path;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Could not load ${path}.`)), { once: true });
    document.head.appendChild(script);
  });
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

const EARLY_RUNTIME_SCRIPTS = Object.freeze([
  "/loading-toast-runtime.js",
  "/mobile-ui-runtime.js",
  "/desktop-table-style-runtime.js",
  "/database-stats-tooltip-portal-runtime.js",
  "/static-ui-runtime.js",
  "/changelog-history-runtime.js",
  "/evaluation-layout-runtime.js",
  "/evaluation-discount-rate-display-runtime.js",
  "/evaluation-load-intent-runtime.js",
  "/mfl-stats-runtime.js",
  "/view-button-visibility-runtime.js",
  "/shared-table-ui-runtime.js",
  "/table-navigation-chrome-runtime.js",
  "/control-interactions-runtime.js",
  "/evaluation-mfl-usd-input-runtime.js",
  "/nationality-filter-options-runtime.js",
  "/global-search-runtime.js",
  "/evaluation-discount-rate-runtime.js",
  "/evaluation-discount-rate-ui-runtime.js",
  "/watchlist-route-ui-runtime.js",
  "/table-width-runtime.js",
  "/table-loading-runtime.js",
  "/table-blank-row-guard-runtime.js",
  "/database-stats-reload-bootstrap-runtime.js",
  "/database-stats-runtime.js",
  "/database-stats-state-runtime.js",
]);

const LATE_RUNTIME_SCRIPTS = Object.freeze([
  "/database-stats-custom-filter-runtime.js",
  "/selection-startup-reset-runtime.js",
  "/watchlist-myplayers-route-runtime.js",
  "/selection-stack-runtime.js",
]);

/** @type {Window & {
 * __mflReleaseVersion?: string,
 * __mflInteractionBusy?: { installCoreBridge?: () => void },
 * __mflTableLoadingRuntime?: { installCoreBridge?: () => void, sync?: () => void },
 * __mflTableWidthRuntime?: { takeOwnership?: () => boolean },
 * __mflDatabaseStatsReloadBootstrap?: { restoreRoute?: () => void, finalize?: () => void },
 * __mflDatabaseStatsStateRuntime?: { sync?: () => void },
 * __mflStatsRuntime?: { sync?: () => void, installCoreBridge?: () => void },
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
preloadClassicScript("/modules/app-core.js");
preloadClassicScript("/evaluation-search-state-runtime.js");

function primeEvaluationDiscountRatePlaceholder() {
  if (!/^\/evaluation\/?$/i.test(window.location.pathname)) return;
  const discountRate = document.getElementById("evaluationDiscountRate");
  if (!(discountRate instanceof HTMLElement)) return;
  if (!String(discountRate.textContent || "").trim()) discountRate.textContent = "-";
  discountRate.style.setProperty("visibility", "visible", "important");
}

primeEvaluationDiscountRatePlaceholder();

const ENTITY_ROUTE_VIEWS = Object.freeze({
  agents: Object.freeze({
    views: Object.freeze(["attributes", "contracts", "next", "current", "all"]),
    labels: Object.freeze({
      attributes: "Attributes",
      contracts: "Contracts",
      next: "Next Overall",
      current: "Current Season",
      all: "All Time",
    }),
    slugs: Object.freeze({
      attributes: "attributes",
      contracts: "contracts",
      "next-overall": "next",
      "current-season": "current",
      "all-time": "all",
    }),
  }),
  club: Object.freeze({
    views: Object.freeze(["attributes", "contracts", "current", "all"]),
    labels: Object.freeze({
      attributes: "Squad",
      contracts: "Contracts",
      current: "Current Season",
      all: "All Time",
    }),
    slugs: Object.freeze({
      squad: "attributes",
      attributes: "attributes",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }),
  }),
});

function currentEntityRouteView() {
  const parts = String(window.location.pathname || "").split("/").filter(Boolean);
  const root = String(parts[0] || "").toLowerCase();
  if (root === "agents" && parts[1]) {
    const config = ENTITY_ROUTE_VIEWS.agents;
    const slug = String(parts[2] || "attributes").toLowerCase();
    return { page: "agents", config, view: config.slugs[slug] || "attributes" };
  }
  if ((root === "clubs" || root === "club") && parts[1]) {
    const config = ENTITY_ROUTE_VIEWS.club;
    const slug = String(parts[2] || "squad").toLowerCase();
    return { page: "club", config, view: config.slugs[slug] || "attributes" };
  }
  return null;
}

function syncEntityRouteViews() {
  const route = currentEntityRouteView();
  if (!route) return;

  if (document.body?.dataset.page !== route.page) document.body.dataset.page = route.page;
  const views = document.querySelector("#progressionPage .views");
  if (!(views instanceof HTMLElement)) return;

  const allowed = new Set(route.config.views);
  const buttons = Array.from(views.querySelectorAll(":scope > .viewButton[data-view]"));
  buttons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const viewName = String(button.dataset.view || "");
    const visible = allowed.has(viewName);
    if (button.hidden === visible) button.hidden = !visible;
    if (button.hasAttribute("aria-hidden")) button.removeAttribute("aria-hidden");
    const label = route.config.labels[viewName];
    if (label && button.textContent !== label) button.textContent = label;
    const active = visible && viewName === route.view;
    if (button.classList.contains("active") !== active) button.classList.toggle("active", active);
    if (button.getAttribute("aria-pressed") !== String(active)) {
      button.setAttribute("aria-pressed", String(active));
    }
  });

  const switcher = document.getElementById("watchlistSwitcher");
  route.config.views.forEach((viewName) => {
    const button = views.querySelector(`:scope > .viewButton[data-view="${viewName}"]`);
    if (button) views.insertBefore(button, switcher || null);
  });
}

function installEntityRouteViewSync() {
  if (window.__mflEntityRouteViewSyncInstalled) return;
  window.__mflEntityRouteViewSyncInstalled = true;

  let frame = 0;
  const schedule = () => {
    syncEntityRouteViews();
    queueMicrotask(syncEntityRouteViews);
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      syncEntityRouteViews();
    });
  };

  const nativePushState = history.pushState;
  const nativeReplaceState = history.replaceState;
  history.pushState = function pushStateWithEntityViews(...args) {
    const result = nativePushState.apply(this, args);
    schedule();
    return result;
  };
  history.replaceState = function replaceStateWithEntityViews(...args) {
    const result = nativeReplaceState.apply(this, args);
    schedule();
    return result;
  };

  window.addEventListener("popstate", schedule);
  window.addEventListener("mfl:ready", schedule);

  const observer = new MutationObserver(() => {
    if (currentEntityRouteView()) schedule();
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-page"],
    });
  }
  const views = document.querySelector("#progressionPage .views");
  if (views instanceof HTMLElement) {
    observer.observe(views, {
      attributes: true,
      subtree: true,
      attributeFilter: ["hidden", "class", "aria-pressed"],
    });
  }

  schedule();
}

installEntityRouteViewSync();

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
  runtimeWindow.__mflStatsRuntime?.installCoreBridge?.();
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

      // app-core may have restored an old local table-state value synchronously
      // before this bridge is installed. Do not let that value reach Evaluation.
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

      // Evaluation recents persist through the account table state (Supabase),
      // never through the dedicated browser-storage recent-search key.
      persistRecentSearchStates = function persistSearchStatesWithoutEvaluationLocalStorage() {
        saveRecentIdsToStorage(RECENT_SEARCH_STORAGE_KEY, state.recentSearchPlayerIds);
        saveRecentIdsToStorage(RECENT_AGENT_SEARCH_STORAGE_KEY, state.recentSearchAgentWallets);
        saveRecentIdsToStorage(RECENT_MIXED_SEARCH_STORAGE_KEY, state.recentSearchItems);
      };

      // Keep recentEvaluationPlayerIds in the cloud payload while stripping it
      // from every locally saved table-state copy.
      const originalSaveTableStateLocally = saveTableStateLocally;
      saveTableStateLocally = function saveTableStateWithoutEvaluationRecents(tableState) {
        if (!tableState || typeof tableState !== "object" || Array.isArray(tableState)) {
          return originalSaveTableStateLocally(tableState);
        }
        const localState = { ...tableState };
        delete localState.recentEvaluationPlayerIds;
        return originalSaveTableStateLocally(localState);
      };

      // Evaluation empty search priming is exact recentEvaluationPlayerIds only.
      // The dedicated runtime starts this while wallet preferences are still loading.
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

      // Evaluation cannot leave its loading/readiness phase before the exact
      // Supabase recent players have been hydrated and rendered for an empty field.
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

  await responsiveStylesReady;
  installApiFetchPolicy();
  await loadScriptGroup(EARLY_RUNTIME_SCRIPTS);

  if (/^\/changelog\/?$/i.test(window.location.pathname)) {
    const changelogWindow = /** @type {Window & { __mflChangelogHistoryReady?: Promise<boolean> }} */ (window);
    if (changelogWindow.__mflChangelogHistoryReady) await changelogWindow.__mflChangelogHistoryReady;
  }

  await loadClassicScript("/modules/app-core.js");
  installEvaluationRecentStateBridge();
  // This owner must exist before startApp reaches Evaluation readiness. Supabase
  // can then trigger exact recent-player hydration while the page is still loading.
  await loadClassicScript("/evaluation-search-state-runtime.js");
  installCoreBridges();
  const evaluationStartup = /^\/evaluation\/?$/i.test(window.location.pathname);
  const homeStartup = /^\/(?:home)?\/?$/i.test(window.location.pathname);
  const playerStartup = /^\/players\/[^/]+\/?$/i.test(window.location.pathname);
  const tableStartup = /^\/(?:database|mfl|progression|watchlist|my-players|agents|clubs?|club)(?:\/|$)/i.test(window.location.pathname)
    && !/^\/(?:database|mfl)\/stats\/?$/i.test(window.location.pathname);
  if (evaluationStartup && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
    await runtimeWindow.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false);
  }
  runtimeWindow.__mflStatsRuntime?.sync?.();
  runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  runtimeWindow.__mflDatabaseStatsReloadBootstrap?.restoreRoute?.();
  await loadScriptGroup(LATE_RUNTIME_SCRIPTS);
  installCoreBridges();
  runtimeWindow.__mflDatabaseStatsReloadBootstrap?.finalize?.();
  runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  runtimeWindow.__mflStatsRuntime?.sync?.();
  promoteResponsiveStylesheet();

  if ((homeStartup || tableStartup || playerStartup) && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
  }

  promoteResponsiveStylesheet();
  document.documentElement.dataset.mflReady = "true";
  window.dispatchEvent(new CustomEvent("mfl:ready", { detail: release }));
}

void start().catch(showStartupError);
