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
preloadClassicScript("/evaluation-search-state-runtime.js");

function primeEvaluationDiscountRatePlaceholder() {
  if (!/^\/evaluation\/?$/i.test(window.location.pathname)) return;
  const discountRate = document.getElementById("evaluationDiscountRate");
  if (!(discountRate instanceof HTMLElement)) return;
  if (!String(discountRate.textContent || "").trim()) discountRate.textContent = "-";
  discountRate.style.setProperty("visibility", "visible", "important");
}

primeEvaluationDiscountRatePlaceholder();

function replaceCoreSourceIfPresent(source, beforeLines, afterLines, label) {
  const before = Array.isArray(beforeLines) ? beforeLines.join("\n") : String(beforeLines || "");
  const after = Array.isArray(afterLines) ? afterLines.join("\n") : String(afterLines || "");
  if (!before || !source.includes(before)) {
    console.warn(`Core permission scope pattern not found: ${label}.`);
    return source;
  }
  return source.replace(before, after);
}

function removeObsoleteAgentViewRestriction(source) {
  const normalized = String(source || "").replace(/\r\n?/g, "\n");
  const signature = 'const removedAgentViews = new Set(["current", "all"]);';
  const signatureIndex = normalized.indexOf(signature);
  if (signatureIndex < 0) return normalized;

  const blockStart = normalized.lastIndexOf("(() => {", signatureIndex);
  const nextSectionMarker = "/* Public progression table views */";
  const blockEnd = normalized.indexOf(nextSectionMarker, signatureIndex);
  if (blockStart < 0 || blockEnd < 0 || blockEnd <= blockStart) {
    console.warn("Could not remove the obsolete Agent view restriction from app-core.");
    return normalized;
  }

  const before = normalized.slice(0, blockStart).replace(/\n+$/, "\n\n");
  return `${before}${normalized.slice(blockEnd)}`;
}

function normalizeContextualAgentNavigation(source) {
  let nextSource = source;

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['  return normalizedWalletAddress ? pagePath("agents", { walletAddress: normalizedWalletAddress, view: preferredViewForPage("agents") }) : "#";'],
    ['  return normalizedWalletAddress ? pagePath("agents", { walletAddress: normalizedWalletAddress, view: "attributes" }) : "#";'],
    "contextual agent link default view",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['  setPage("agents", true, { walletAddress: normalizedWalletAddress });'],
    ['  setPage("agents", true, { walletAddress: normalizedWalletAddress, view: "attributes" });'],
    "contextual agent click default view",
  );

  return nextSource;
}

function normalizeWatchlistViewAuthority(source) {
  let nextSource = source;

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['function updateWatchlistUrl(replace = false, force = false) {'],
    ['function updateWatchlistUrl(replace = false, force = false, view = "") {'],
    "watchlist URL explicit view parameter",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['  const targetPath = pagePath("watchlist", { watchlistId: state.currentWatchlistId });'],
    [
      '  const targetPath = pagePath("watchlist", {',
      '    watchlistId: state.currentWatchlistId,',
      '    ...(view ? { view } : {}),',
      '  });',
    ],
    "watchlist URL explicit view ownership",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '    renderWatchlistSwitcher();',
      '    showToast("Watchlist not found.");',
      '    updateWatchlistUrl(true, true);',
      '    return;',
      '  }',
      '',
      '  const nextWatchlist = found || state.watchlists[0] || ensureDefaultWatchlist();',
      '  state.currentWatchlistId = nextWatchlist?.id || "";',
      '  setActiveWatchlistIds(nextWatchlist?.playerIds || []);',
      '  renderWatchlistSwitcher();',
      '  updateWatchlistUrl(!routeId, true);',
      '  queueCloudTableStateSave();',
    ],
    [
      '    renderWatchlistSwitcher();',
      '    showToast("Watchlist not found.");',
      '    updateWatchlistUrl(true, true, options.view);',
      '    return;',
      '  }',
      '',
      '  const nextWatchlist = found || state.watchlists[0] || ensureDefaultWatchlist();',
      '  state.currentWatchlistId = nextWatchlist?.id || "";',
      '  setActiveWatchlistIds(nextWatchlist?.playerIds || []);',
      '  renderWatchlistSwitcher();',
      '  updateWatchlistUrl(!routeId, true, options.view);',
      '  queueCloudTableStateSave();',
    ],
    "watchlist route resolution keeps requested view",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '    restoreSavedTableState = function restoreSavedTableStateWithRoute(pageName, options = {}) {',
      '      const routeView = routeViewFromPath();',
    ],
    [
      '    restoreSavedTableState = function restoreSavedTableStateWithRoute(pageName, options = {}) {',
      '      const routeView = pageName === "watchlist" && !options.view ? routeViewFromPath() : "";',
    ],
    "watchlist explicit view precedence during saved-state restore",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '    setPage = async function setPageWithWatchlistRoute(pageName, updateHash = true, options = {}) {',
      '      const routeView = pageName === "watchlist" ? routeViewFromPath() : "";',
      '      const nextOptions = routeView ? { ...options, view: routeView } : options;',
      '      const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);',
      '      keepSidebarExpanded();',
      '      if (pageName === "watchlist" && routeView) enforceWatchlistRouteView(true);',
      '      return result;',
      '    };',
    ],
    [
      '    setPage = async function setPageWithWatchlistRoute(pageName, updateHash = true, options = {}) {',
      '      const requestedView = pageName === "watchlist" ? String(options?.view || "") : "";',
      '      const routeView = pageName === "watchlist" && !requestedView ? routeViewFromPath() : "";',
      '      const nextOptions = routeView ? { ...options, view: routeView } : options;',
      '      const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);',
      '      keepSidebarExpanded();',
      '      if (pageName === "watchlist" && routeView) enforceWatchlistRouteView(true);',
      '      return result;',
      '    };',
    ],
    "watchlist explicit view precedence",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      'async function startApp() {',
      '  loadTheme();',
      '  setupChangelogSections();',
      '  const initialTarget = pageTargetFromPath(`${location.pathname}${location.search}`);',
      '  loadSavedTableState();',
    ],
    [
      'async function startApp() {',
      '  loadTheme();',
      '  setupChangelogSections();',
      '  loadSavedTableState();',
      '  const initialTarget = pageTargetFromPath(`${location.pathname}${location.search}`);',
    ],
    "startup route resolves after saved wallet state",
  );

  return nextSource;
}

function scopeProgressionPermissionToProgressionPage(source) {
  let nextSource = source;

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  if (pageName === "watchlist" && !hasProgressionAccess()) {',
      '    return ["attributes", "next", "contracts"];',
      '  }',
      '',
    ],
    [],
    "watchlist view availability",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  if (pageName === "watchlist" && !hasProgressionAccess()) {',
      '    return "attributes";',
      '  }',
      '',
    ],
    [],
    "watchlist default view",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  if (pageName === "player") {',
      '    if (hasProgressionAccess()) {',
      '      return "full";',
      '    }',
      '    return hasWalletOptIn() ? "owned" : "public";',
      '  }',
    ],
    [
      '  if (pageName === "player") {',
      '    return "public";',
      '  }',
    ],
    "player data access",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  if (pageName === "watchlist") {',
      '    return hasProgressionAccess() ? "full" : "public";',
      '  }',
    ],
    [
      '  if (pageName === "watchlist") {',
      '    return "public";',
      '  }',
    ],
    "watchlist data access",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['      access: currentDataAccess(["current", "all"].includes(clubTarget.view) ? "progression" : "database"),'],
    ['      access: "public",'],
    "club route access",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    ['  document.body.classList.toggle("guest", !hasProgressionAccess());'],
    ['  document.body.classList.toggle("guest", state.currentPage === "progression" && !hasProgressionAccess());'],
    "guest presentation scope",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '      if (PUBLIC_TABLE_PAGES.has(pageName) && PUBLIC_PROGRESSION_VIEWS.includes(state.view)) {',
      '        return originalCurrentDataAccess.call(this, "progression");',
      '      }',
    ],
    [
      '      if (PUBLIC_TABLE_PAGES.has(pageName) && PUBLIC_PROGRESSION_VIEWS.includes(state.view)) {',
      '        return "public";',
      '      }',
    ],
    "public progression table data access",
  );

  nextSource = replaceCoreSourceIfPresent(
    nextSource,
    [
      '  function incrementalLoadingPageName(pageName, route) {',
      '    return route.scope === "club" ? "club" : pageName;',
      '  }',
    ],
    [
      '  function incrementalLoadingPageName(pageName, route) {',
      '    if (route.scope === "club") return "club";',
      '    if (route.scope === "agent") return "agents";',
      '    return pageName;',
      '  }',
    ],
    "entity loading page ownership",
  );

  return nextSource;
}

async function loadApplicationCore() {
  const path = "/modules/app-core.js";
  const response = await nativeFetch(assetUrl(path), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${path}.`);
  }

  let source = removeObsoleteAgentViewRestriction(await response.text());
  source = source.replaceAll(
    'agents: ["attributes", "next", "contracts", "current", "all"]',
    'agents: ["attributes", "contracts", "next", "current", "all"]',
  );
  source = normalizeContextualAgentNavigation(source);
  source = normalizeWatchlistViewAuthority(source);
  source = scopeProgressionPermissionToProgressionPage(source);

  const script = document.createElement("script");
  script.dataset.mflRuntime = path;
  script.textContent = `${source}\n//# sourceURL=${path}`;
  document.head.appendChild(script);
  script.remove();
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

  await loadApplicationCore();
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
