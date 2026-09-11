// @ts-check

const nativeFetch = window.fetch.bind(window);
const DEFAULT_TIMEOUT_MS = 60_000;

/** @param {string} phase @param {Record<string, unknown>} [detail] */
function recordClientTiming(phase, detail = {}) {
  const owner = Reflect.get(window, "__mflClientPerformance");
  if (!owner || typeof owner.record !== "function") return null;
  return owner.record(phase, detail);
}

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

/** @param {RequestInfo | URL} input @param {RequestInit} init */
function requestHeaders(input, init) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers || undefined).forEach((value, key) => headers.set(key, value));
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return headers;
}

/** @param {RequestInfo | URL} input @param {RequestInit} init @param {Headers} headers */
function canonicalRequestKey(input, init, headers) {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  const method = String(init.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
  const headerKey = Array.from(headers.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("\n");
  return `${method} ${url.href}\n${headerKey}`;
}

/** @param {AbortSignal | null} callerSignal @param {number} timeoutMs */
function composeRequestSignal(callerSignal, timeoutMs) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = window.setTimeout(() => controller.abort(new DOMException("Request timed out.", "TimeoutError")), timeoutMs);
  return Object.freeze({
    signal: controller.signal,
    release() {
      window.clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  });
}

/** @param {{timeoutMs?: number}} [configuration] */
function createDataClient({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const inFlight = new Map();
  const responseCache = new Map();

  /**
   * @param {RequestInfo | URL} input
   * @param {RequestInit} [init]
   * @param {{dedupe?: boolean, cacheTtlMs?: number, key?: string}} [options]
   */
  async function request(input, init = {}, options = {}) {
    if (!isSameOriginApiRequest(input)) return nativeFetch(input, init);

    const requestInit = { ...init };
    const headers = requestHeaders(input, requestInit);
    requestInit.headers = headers;
    const method = String(requestInit.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
    const callerSignal = requestInit.signal || (input instanceof Request ? input.signal : null);
    const timeout = composeRequestSignal(callerSignal, Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
    requestInit.signal = timeout.signal;

    const requestKey = String(options.key || canonicalRequestKey(input, requestInit, headers));
    const requestUrl = input instanceof Request ? input.url : String(input);
    const startedAt = performance.now();
    recordClientTiming("data-request", {
      key: requestKey,
      url: requestUrl,
      method,
    });
    const dedupe = method === "GET" && options.dedupe === true;
    const cacheTtlMs = method === "GET" ? Math.max(0, Number(options.cacheTtlMs) || 0) : 0;
    const cached = cacheTtlMs > 0 ? responseCache.get(requestKey) : null;
    if (cached?.expiresAt > Date.now()) {
      const response = cached.response.clone();
      recordClientTiming("data-response", {
        key: requestKey,
        url: requestUrl,
        method,
        duration: Math.max(0, performance.now() - startedAt),
        status: response.status,
        source: "memory-cache",
      });
      timeout.release();
      return response;
    }
    if (cached) responseCache.delete(requestKey);

    if (dedupe && inFlight.has(requestKey)) {
      const sharedRequest = inFlight.get(requestKey);
      timeout.release();
      return sharedRequest.then((response) => {
        recordClientTiming("data-response", {
          key: requestKey,
          url: requestUrl,
          method,
          duration: Math.max(0, performance.now() - startedAt),
          status: response.status,
          source: "in-flight",
        });
        return response.clone();
      });
    }

    const pending = (async () => {
      try {
        const response = await nativeFetch(input, requestInit);
        if (cacheTtlMs > 0 && response.ok) {
          responseCache.set(requestKey, {
            expiresAt: Date.now() + cacheTtlMs,
            response: response.clone(),
          });
        }
        const duration = Math.max(0, performance.now() - startedAt);
        recordClientTiming("data-response", {
          key: requestKey,
          url: requestUrl,
          method,
          duration,
          status: response.status,
          source: "network",
        });
        window.dispatchEvent(new CustomEvent("mfl:data-client-timing", {
          detail: Object.freeze({
            key: requestKey,
            url: requestUrl,
            duration,
            status: response.status,
          }),
        }));
        return response;
      } finally {
        timeout.release();
      }
    })();

    if (!dedupe) return pending;
    inFlight.set(requestKey, pending);
    try {
      return (await pending).clone();
    } finally {
      if (inFlight.get(requestKey) === pending) inFlight.delete(requestKey);
    }
  }

  return Object.freeze({
    fetch: request,
    clearCache() {
      responseCache.clear();
    },
    snapshot() {
      return Object.freeze({ inFlight: inFlight.size, cached: responseCache.size });
    },
  });
}

function runtimeResources() {
  const resources = Reflect.get(window, "__mflRuntimeResources");
  if (!resources
    || typeof resources.load !== "function"
    || typeof resources.loadGroup !== "function"
    || typeof resources.preload !== "function") {
    throw new Error("Canonical runtime resource loader is unavailable.");
  }
  return resources;
}

/** @param {string} path */
function loadClassicScript(path) {
  return runtimeResources().load(path);
}

/** @param {readonly string[]} paths */
function loadScriptGroup(paths) {
  return runtimeResources().loadGroup(paths);
}

/** @param {string} path */
function preloadClassicScript(path) {
  runtimeResources().preload(path);
}
const UNIVERSAL_RUNTIME_SCRIPTS = Object.freeze([
  "/static-ui-runtime.js",
  "/bug-report-runtime.js",
  "/control-interactions-runtime.js",
  "/global-search-runtime.js",
]);

const initialPathname = String(window.location.pathname || "/");

function routeConfig() {
  const routes = Reflect.get(window, "__mflAppConfig")?.routes;
  if (!routes
    || typeof routes.normalizePageName !== "function"
    || typeof routes.initialRequest !== "function"
    || typeof routes.routeDependencyPlan !== "function") {
    throw new Error("Canonical route configuration is unavailable.");
  }
  return routes;
}

/** @param {string} pageName */
function normalizeRoutePageName(pageName) {
  return String(routeConfig().normalizePageName(pageName) || "home");
}

/** @param {string} pageName @param {Record<string, unknown>} [options] */
function routeDependencyPlan(pageName, options = {}) {
  return routeConfig().routeDependencyPlan(pageName, options);
}

/** @param {readonly string[]} paths */
function uniqueScripts(paths) {
  return Array.from(new Set(paths));
}

function initialRouteRuntimeRequest() {
  const request = routeConfig().initialRequest(initialPathname);
  const options = request?.options && typeof request.options === "object" && !Array.isArray(request.options)
    ? request.options
    : {};
  return { pageName: normalizeRoutePageName(request?.pageName), options };
}
const initialRouteRuntime = Object.freeze(initialRouteRuntimeRequest());
const initialEvaluationParams = new URLSearchParams(window.location.search);
const plainEvaluationStartup = initialRouteRuntime.pageName === "evaluation"
  && !["player", "saved", "share"].some((key) => initialEvaluationParams.get(key));
const initialPreCoreRuntimeScripts = Object.freeze(uniqueScripts([
  ...UNIVERSAL_RUNTIME_SCRIPTS,
  ...routeDependencyPlan(initialRouteRuntime.pageName, initialRouteRuntime.options).preCore,
]));

/** @type {Window & {
 * __mflReleaseVersion?: string,
 * __mflCoreBuildId?: string,
 * __mflDataClient?: ReturnType<typeof createDataClient>,
 * __mflInteractionBusy?: { reason?: string, begin?: (reason?: string) => string, end?: (token?: string) => void, waitForRoutePaint?: () => Promise<void>, installCoreBridge?: () => void },
 * __mflTableLoadingRuntime?: { installCoreBridge?: () => void, sync?: () => void },
 * __mflFilterControlsRuntime?: { sync?: () => void },
 * __mflDatabaseStatsStateRuntime?: { sync?: () => void },
 * __mflDatabaseStatsRuntime?: { sync?: () => void },
 * __mflGlobalSearchRuntime?: { preload?: () => Promise<boolean>, flush?: () => boolean, focus?: () => void },
 * __mflEvaluationLayoutRuntime?: { sync?: () => void },
 * __mflEvaluationSearchStateRuntime?: { sync?: () => void, restoreEmptyRecentResults?: (force?: boolean) => Promise<boolean>, destroy?: () => void },
 * __mflSelectionStartupResetRuntime?: { rebind?: () => void },
 * __mflWatchlistMyPlayersRouteRuntime?: { install?: () => boolean },
 * __mflChangelogHistoryReady?: Promise<boolean>,
 * __mflAppStartPromise?: Promise<void>,
 * __mflInitialRouteRuntimeReadyPromise?: Promise<void>,
 * __mflEnsureRouteCore?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,
 * __mflEnsureRouteRuntime?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,
 * __mflIsRouteRuntimeReady?: (pageName: string, options?: Record<string, unknown>) => boolean,
 * __mflOpenClubPageRoute?: (clubId: string, view?: string) => unknown,
 * __mflRunPageTransition?: (pageName: string, updateHash?: boolean, options?: Record<string, unknown>, loader?: (() => unknown)) => Promise<unknown>,
 * __mflMarkApplicationCoreLoaded?: () => void,
 * mflOpenClubPage?: ((clubId: string, view?: string) => unknown) & { __mflRouteRuntimeGate?: boolean },
 * }} */
const runtimeWindow = window;
const dataClient = createDataClient();
runtimeWindow.__mflDataClient = dataClient;

// Start the exact ownership lookup while the route scripts are still loading.
// This is a one-use response, scoped to the full proof headers; it never renders UI.
function primeInitialMyClubsOwnership() {
  if (normalizeRoutePageName(initialRouteRuntime.pageName) !== "my-clubs") return;
  const path = "/api/data?mode=my-clubs";
  try {
    const wallet = String(localStorage.getItem("mfl-linked-wallet-v1") || "").trim().toLowerCase();
    const proof = JSON.parse(localStorage.getItem("mfl-linked-wallet-proof-v1") || "null");
    if (!wallet || String(proof?.address || "").trim().toLowerCase() !== wallet
        || proof?.message !== "MFL Front Office Dapper Opt-In"
        || !Array.isArray(proof?.signatures) || !proof.signatures.length) return;
    const headers = {
      Accept: "application/json",
      "x-dapper-wallet-address": wallet,
      "x-wallet-signing-address": proof.signingAddress || wallet,
      "x-wallet-message": proof.message,
      "x-wallet-proof-type": proof.type || "user-signature",
      "x-wallet-app-identifier": proof.appIdentifier || "MFL Front Office Dapper Opt-In",
      "x-wallet-nonce": proof.nonce || "",
      "x-wallet-signatures": JSON.stringify(proof.signatures),
    };
    const key = canonicalRequestKey(path, {}, new Headers(headers));
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    let available = true;
    const pending = dataClient.fetch(path, {
      cache: "no-store", headers, signal: controller.signal,
    }).then(
      (response) => ({ response, error: null }),
      (error) => ({ response: null, error }),
    ).finally(() => window.clearTimeout(timer));

    Reflect.set(window, "__mflMyClubsOwnershipPrefetch", Object.freeze({
      take(currentHeaders) {
        if (!available) return null;
        available = false;
        if (key !== canonicalRequestKey(path, {}, new Headers({ Accept: "application/json", ...currentHeaders }))) {
          controller.abort();
          return null;
        }
        return pending.then(({ response, error }) => {
          if (error) throw error;
          return response;
        });
      },
      clear() {
        available = false;
        controller.abort();
      },
    }));
  } catch {
    // Unavailable or invalid stored proof falls back to the normal route request.
  }
}

primeInitialMyClubsOwnership();


function releaseFromBootstrap() {
  const version = String(runtimeWindow.__mflReleaseVersion || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("The application bootstrap is missing a valid release version.");
  return Object.freeze({ version, description: "" });
}

const entryRelease = releaseFromBootstrap();
const PREBUILT_CORE_PATH = "/modules/app-core-runtime.js";
const PREBUILT_CORE_CACHE_QUERY = "mfl_core";
let applicationCoreLoaded = false;
/** @type {() => void} */
let applicationCoreLoadedResolve = () => {};
const applicationCoreLoadedPromise = new Promise((resolve) => {
  applicationCoreLoadedResolve = () => resolve(undefined);
});
/** @type {() => void} */
let initialRouteRuntimeReadyResolve = () => {};
/** @type {(reason?: unknown) => void} */
let initialRouteRuntimeReadyReject = () => {};
const initialRouteRuntimeReadyPromise = new Promise((resolve, reject) => {
  initialRouteRuntimeReadyResolve = () => resolve(undefined);
  initialRouteRuntimeReadyReject = reject;
});
initialRouteRuntimeReadyPromise.catch(() => {});
runtimeWindow.__mflInitialRouteRuntimeReadyPromise = initialRouteRuntimeReadyPromise;
const routeRuntimeEnsurePromises = new Map();
const routeRuntimeReadyKeys = new Set();
let evaluationRecentStateBridgeInstalled = false;
/** @type {Promise<unknown>} */
let initialGlobalSearchWarmupPromise = Promise.resolve();

function detachInitialGlobalSearchWarmupFromRoute() {
  const primeGlobalSearchIndexes = Reflect.get(runtimeWindow, "primeGlobalSearchIndexes");
  if (typeof primeGlobalSearchIndexes !== "function" || primeGlobalSearchIndexes.__mflInitialRouteDetached) return false;

  const detachedPrime = function (...args) {
    Reflect.set(runtimeWindow, "primeGlobalSearchIndexes", primeGlobalSearchIndexes);
    initialGlobalSearchWarmupPromise = Promise.resolve()
      .then(() => primeGlobalSearchIndexes.apply(runtimeWindow, args))
      .catch((error) => {
        console.warn("Initial Global Search warm-up failed after route loading was released.", error);
        return false;
      });
    return Promise.resolve();
  };
  Object.defineProperty(detachedPrime, "__mflInitialRouteDetached", { value: true });
  return Reflect.set(runtimeWindow, "primeGlobalSearchIndexes", detachedPrime);
}

function markApplicationCoreLoaded() {
  if (applicationCoreLoaded) return;
  detachInitialGlobalSearchWarmupFromRoute();
  applicationCoreLoaded = true;
  applicationCoreLoadedResolve();
  recordClientTiming("core-ready", {
    route: initialRouteRuntime.pageName,
  });
}

runtimeWindow.__mflMarkApplicationCoreLoaded = markApplicationCoreLoaded;

function assertApplicationCoreInitialized(sourceLabel) {
  if (applicationCoreLoaded && runtimeWindow.__mflAppStartPromise) return;
  throw new Error(`${sourceLabel} application core loaded without initializing startup.`);
}

function prebuiltApplicationCorePath() {
  const buildId = String(runtimeWindow.__mflCoreBuildId || "").trim();
  if (!/^[a-f0-9]{16}$/.test(buildId)) throw new Error("Application core build identity is unavailable.");
  const immutableRevision = `${entryRelease.version}-${buildId}`;
  return `${PREBUILT_CORE_PATH}?${PREBUILT_CORE_CACHE_QUERY}=${encodeURIComponent(immutableRevision)}`;
}

preloadClassicScript(prebuiltApplicationCorePath());

async function loadApplicationCore() {
  await loadClassicScript(prebuiltApplicationCorePath());
  assertApplicationCoreInitialized("Prebuilt");
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
  void runtimeWindow.__mflGlobalSearchRuntime?.preload?.();
  runtimeWindow.__mflGlobalSearchRuntime?.flush?.();
  installClubRouteRuntimeGate();
}

function installEvaluationRecentStateBridge() {
  if (evaluationRecentStateBridgeInstalled) return true;
  const contracts = Reflect.get(window, "__mflCoreContracts");
  const install = contracts && typeof contracts === "object"
    ? contracts.installEvaluationRecentStateOwnership
    : null;
  const installed = typeof install === "function" && Boolean(install());
  evaluationRecentStateBridgeInstalled = installed;
  return installed;
}

/** @param {string} clubId @param {string} view */
function clubRoutePath(clubId, view) {
  const appConfig = /** @type {{routes?: {clubPath?: (clubId: string, view?: string) => string}} | undefined} */ (Reflect.get(runtimeWindow, "__mflAppConfig"));
  const routeBuilder = appConfig?.routes?.clubPath;
  if (typeof routeBuilder !== "function") throw new Error("Canonical Club route configuration is unavailable.");
  return routeBuilder(clubId, view);
}

function installClubRouteRuntimeGate() {
  if (runtimeWindow.mflOpenClubPage?.__mflRouteRuntimeGate) return false;

  const gated = async function mflOpenClubPageWithRouteRuntime(clubId, view = "attributes") {
    const normalizedClubId = String(clubId || "").trim();
    if (!normalizedClubId) return;

    const loadClub = async (transition = null) => {
      const routeCorePromise = typeof runtimeWindow.__mflEnsureRouteCore === "function"
        ? runtimeWindow.__mflEnsureRouteCore("club", { view })
        : Promise.resolve();
      const routeRuntimePromise = ensureRouteRuntime("club", { view });
      await Promise.all([routeCorePromise, routeRuntimePromise]);

      const transitionIsCurrent = Reflect.get(runtimeWindow, "__mflNavigationTransitionIsCurrent");
      if (transition && typeof transitionIsCurrent === "function" && !transitionIsCurrent(transition)) return null;

      const routeOwner = runtimeWindow.__mflOpenClubPageRoute;
      if (typeof routeOwner !== "function") {
        throw new Error("Club route owner is unavailable.");
      }
      return await routeOwner.call(runtimeWindow, normalizedClubId, view);
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
  };
  Object.defineProperty(gated, "__mflRouteRuntimeGate", { value: true });
  runtimeWindow.mflOpenClubPage = gated;
  return true;
}

/** @param {string} page @param {Record<string, unknown>} [options] */
async function finalizeRouteRuntimeNow(page, options = {}) {
  if (!applicationCoreLoaded) await applicationCoreLoadedPromise;

  const plan = routeDependencyPlan(page, options);
  if (plan.pageName === "evaluation") installEvaluationRecentStateBridge();
  await loadScriptGroup(plan.postCore);

  if (plan.table) {
    runtimeWindow.__mflFilterControlsRuntime?.sync?.();
    runtimeWindow.__mflSelectionStartupResetRuntime?.rebind?.();
  }
  if (plan.watchlist) runtimeWindow.__mflWatchlistMyPlayersRouteRuntime?.install?.();
  if (plan.databaseStats) {
    runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
    runtimeWindow.__mflDatabaseStatsRuntime?.sync?.();
  }
  if (plan.pageName === "evaluation") {
    runtimeWindow.__mflEvaluationLayoutRuntime?.sync?.();
    runtimeWindow.__mflEvaluationSearchStateRuntime?.sync?.();
  }
  if (plan.pageName === "changelog" && runtimeWindow.__mflChangelogHistoryReady) await runtimeWindow.__mflChangelogHistoryReady;

  installCoreBridges();
}
/** @param {string} pageName @param {Record<string, unknown>} [options] */
async function ensureRouteRuntimeNow(pageName, options = {}) {
  const plan = routeDependencyPlan(pageName, options);
  await loadScriptGroup(plan.preCore);
  await finalizeRouteRuntimeNow(plan.pageName, options);
}
/** @param {string} page @param {Record<string, unknown>} [options] */
function routeRuntimeKey(page, options = {}) {
  return routeDependencyPlan(page, options).runtimeKey;
}
/** @param {string} key @param {Promise<void>} promise */
function trackRouteRuntimePromise(key, promise) {
  const pending = promise.then(() => {
    routeRuntimeReadyKeys.add(key);
    recordClientTiming("route-runtime-ready", { key });
  }).catch((error) => {
    routeRuntimeEnsurePromises.delete(key);
    routeRuntimeReadyKeys.delete(key);
    throw error;
  });
  routeRuntimeEnsurePromises.set(key, pending);
  return pending;
}

/** @param {string} pageName @param {Record<string, unknown>} [options] */
function routeRuntimeReady(pageName, options = {}) {
  return routeRuntimeReadyKeys.has(routeRuntimeKey(normalizeRoutePageName(pageName), options));
}

/** @param {string} pageName @param {Record<string, unknown>} [options] */
function ensureRouteRuntime(pageName, options = {}) {
  const page = normalizeRoutePageName(pageName);
  const key = routeRuntimeKey(page, options);
  const existing = routeRuntimeEnsurePromises.get(key);
  if (existing) return existing;
  return trackRouteRuntimePromise(key, ensureRouteRuntimeNow(page, options));
}

runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime;
runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady;
installClubRouteRuntimeGate();

async function start() {
  const release = entryRelease;
  window.__mflRelease = release;
  window.__mflAssetUrl = (path) => new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`).href;

  await loadScriptGroup(initialPreCoreRuntimeScripts);

  await loadApplicationCore();
  const initialRouteKey = routeRuntimeKey(initialRouteRuntime.pageName, initialRouteRuntime.options);
  try {
    await trackRouteRuntimePromise(
      initialRouteKey,
      finalizeRouteRuntimeNow(initialRouteRuntime.pageName, initialRouteRuntime.options),
    );
    initialRouteRuntimeReadyResolve();
  } catch (error) {
    initialRouteRuntimeReadyReject(error);
    throw error;
  }

  if (runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
  }

  if (plainEvaluationStartup) {
    await runtimeWindow.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false);
  }

  recordClientTiming("content-commit", {
    kind: "initial",
    route: initialRouteRuntime.pageName,
    key: initialRouteKey,
  });
  await runtimeWindow.__mflInteractionBusy?.waitForRoutePaint?.();
  recordClientTiming("route-visually-settled", {
    kind: "initial",
    route: initialRouteRuntime.pageName,
    key: initialRouteKey,
  });
  document.documentElement.dataset.mflRouteReady = "true";
  window.dispatchEvent(new CustomEvent("mfl:route-ready", { detail: release }));

  const globalSearchPreloadPromise = runtimeWindow.__mflGlobalSearchRuntime?.preload?.();
  await Promise.allSettled([
    initialGlobalSearchWarmupPromise,
    globalSearchPreloadPromise,
  ]);

  document.documentElement.dataset.mflReady = "true";
  window.dispatchEvent(new CustomEvent("mfl:ready", { detail: release }));
}

void start().catch(showStartupError);