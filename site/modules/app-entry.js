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
  "/table-blank-row-guard-runtime.js",
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
  "/database-stats-custom-filter-runtime.js",
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
const CORE_RUNTIME_CACHE_KEY = `mfl-app-core-runtime:${entryRelease.version}:1`;
if (evaluationStartup) preloadClassicScript("/evaluation-search-state-runtime.js");

function primeEvaluationDiscountRatePlaceholder() {
  if (!evaluationStartup) return;
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

function removeLegacyTableWidthOwnership(source) {
  let normalized = String(source || "").replace(/\r\n?/g, "\n");

  const widthsStart = normalized.indexOf("const tableColumnWidths = {");
  const joinedAgencyStart = normalized.indexOf("\nfunction joinedAgencyPages()", widthsStart);
  if (widthsStart >= 0 && joinedAgencyStart > widthsStart) {
    normalized = `${normalized.slice(0, widthsStart)}${normalized.slice(joinedAgencyStart + 1)}`;
  }

  const applyWidthStart = normalized.indexOf("function applyTableColWidth(");
  const headerStart = normalized.indexOf("function buildHeader()", applyWidthStart);
  if (applyWidthStart >= 0 && headerStart > applyWidthStart) {
    const canonicalBuilder = `function buildTableColGroup() {\n  const fragment = document.createDocumentFragment();\n  const selectionCol = document.createElement("col");\n  selectionCol.className = "col-select";\n  fragment.appendChild(selectionCol);\n\n  currentViewColumns().forEach((column) => {\n    const col = document.createElement("col");\n    const columnClass = tableColumnClass(column);\n    if (columnClass) col.classList.add(...columnClass.split(" "));\n    fragment.appendChild(col);\n  });\n\n  tableColGroup.replaceChildren(fragment);\n  window.__mflTableWidthRuntime?.apply?.();\n}\n`;
    normalized = `${normalized.slice(0, applyWidthStart)}${canonicalBuilder}${normalized.slice(headerStart)}`;
  }

  const percentageStart = normalized.indexOf("  const tableColumnPercentages = {");
  const keepSidebarStart = normalized.indexOf("\n  function keepSidebarExpanded()", percentageStart);
  if (percentageStart >= 0 && keepSidebarStart > percentageStart) {
    normalized = `${normalized.slice(0, percentageStart)}${normalized.slice(keepSidebarStart + 1)}`;
  }

  const widthBlockStart = normalized.indexOf("/* Stable pinned layout and pre-reveal table widths */");
  const nextBlockStart = normalized.indexOf("/* Layout-centered feedback and transition-free shared views */", widthBlockStart);
  if (widthBlockStart >= 0 && nextBlockStart > widthBlockStart) {
    normalized = `${normalized.slice(0, widthBlockStart)}${normalized.slice(nextBlockStart)}`;
  }

  normalized = normalized.replace(
    '  let clubWidthUnlockTimer = null;\n  let clubWidthObserver = null;\n  let clubWidthLockStartedAt = 0;\n',
    "",
  );
  const clubWidthStart = normalized.indexOf("  function rebuildClubColumns() {");
  const clubStyleStart = normalized.indexOf('  const style = document.createElement("style");', clubWidthStart);
  if (clubWidthStart >= 0 && clubStyleStart > clubWidthStart) {
    normalized = `${normalized.slice(0, clubWidthStart)}${normalized.slice(clubStyleStart)}`;
  }

  const staleWidthOwners = [
    "tableColumnWidths",
    "tableColumnPercentages",
    "applyTableColWidth",
    "applySharedTableWidths",
    "buildHeaderWithSharedWidths",
    "buildTableColGroupWithSharedWidths",
    "renderTableWithSharedWidths",
    "updateViewButtonsWithSharedWidths",
    "clubWidthHardLock",
  ];
  const remainingOwner = staleWidthOwners.find((name) => normalized.includes(name));
  if (remainingOwner) {
    throw new Error(`Legacy table width owner still present after normalization: ${remainingOwner}.`);
  }

  return normalized;
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

function cachedApplicationCore() {
  try {
    return sessionStorage.getItem(CORE_RUNTIME_CACHE_KEY) || "";
  } catch {
    return "";
  }
}

function cacheApplicationCore(source) {
  if (!source) return;
  try {
    sessionStorage.setItem(CORE_RUNTIME_CACHE_KEY, source);
  } catch {
    // The application still starts normally if storage is unavailable or full.
  }
}

function executeApplicationCore(path, source) {
  const script = document.createElement("script");
  script.dataset.mflRuntime = path;
  script.textContent = `${source}\n//# sourceURL=${path}`;
  document.head.appendChild(script);
  script.remove();
}

async function loadApplicationCore() {
  const path = "/modules/app-core.js";
  const cachedSource = cachedApplicationCore();
  if (cachedSource) {
    executeApplicationCore(path, cachedSource);
    return;
  }

  const response = await nativeFetch(assetUrl(path), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${path}.`);
  }

  let source = removeObsoleteAgentViewRestriction(await response.text());
  source = removeLegacyTableWidthOwnership(source);
  source = replaceCoreSourceIfPresent(
    source,
    ['const contractColumns = ["overall", "active_contract_revenue_share", "active_contract_club_name", "active_contract_club_division"];'],
    ['const contractColumns = ["overall", "active_contract_club_name", "active_contract_club_division", "active_contract_revenue_share"];'],
    "Contracts column order",
  );
  source = source.replaceAll(
    'agents: ["attributes", "next", "contracts", "current", "all"]',
    'agents: ["attributes", "contracts", "next", "current", "all"]',
  );
  source = normalizeContextualAgentNavigation(source);
  source = normalizeWatchlistViewAuthority(source);
  source = scopeProgressionPermissionToProgressionPage(source);
  cacheApplicationCore(source);
  executeApplicationCore(path, source);
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

  await responsiveStylesReady;
  installApiFetchPolicy();

  const criticalScripts = criticalRuntimeScripts();
  const deferredScripts = deferredRuntimeScripts(criticalScripts);
  await loadScriptGroup(criticalScripts);

  if (changelogStartup) {
    const changelogWindow = /** @type {Window & { __mflChangelogHistoryReady?: Promise<boolean> }} */ (window);
    if (changelogWindow.__mflChangelogHistoryReady) await changelogWindow.__mflChangelogHistoryReady;
  }

  await loadApplicationCore();

  /* Route-irrelevant runtimes begin only after app-core has executed and started
   * the canonical route render. They are still guaranteed to be ready before
   * mfl:ready, so later SPA navigation keeps the same capabilities. */
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

  await Promise.all([deferredRuntimePromise, evaluationSearchRuntimePromise]);
  installCoreBridges();
  runtimeWindow.__mflDatabaseStatsReloadBootstrap?.finalize?.();
  runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  promoteResponsiveStylesheet();

  if ((homeStartup || tableStartup || playerStartup) && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
  }

  promoteResponsiveStylesheet();
  document.documentElement.dataset.mflReady = "true";
  window.dispatchEvent(new CustomEvent("mfl:ready", { detail: release }));
}

void start().catch(showStartupError);