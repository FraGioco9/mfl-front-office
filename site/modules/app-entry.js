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
 * Install one request policy for same-origin API calls made by the legacy and modular clients.
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
  "/database-stats-tooltip-portal-runtime.js",
  "/release-ui-runtime.js",
  "/changelog-history-runtime.js",
  "/evaluation-static-chrome-runtime.js",
  "/evaluation-load-intent-runtime.js",
  "/mfl-stats-first-paint-runtime.js",
  "/view-button-visibility-runtime.js",
  "/database-static-filter-runtime.js",
  "/filter-add-focus-runtime.js",
  "/evaluation-mfl-usd-input-runtime.js",
  "/nationality-filter-options-runtime.js",
  "/global-search-runtime.js",
  "/startup-integrity-runtime.js",
  "/discount-tooltip-mouse-runtime.js",
  "/watchlist-route-ui-runtime.js",
  "/table-width-prime-runtime.js",
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
 * __mflReleaseVersion?: string,
 * __mflInteractionBusy?: { installLegacyBridge?: () => void },
 * __mflTableLoadingRuntime?: { installLegacyBridge?: () => void, sync?: () => void },
 * __mflTableWidthPrimeRuntime?: { takeOwnership?: () => boolean },
 * __mflDatabaseStatsReloadBootstrap?: { restoreRoute?: () => void, finalize?: () => void },
 * __mflDatabaseStatsStateRuntime?: { sync?: () => void },
 * __mflStatsFirstPaintRuntime?: { sync?: () => void, installLegacyBridge?: () => void },
 * __mflGlobalSearchRuntime?: { flush?: () => boolean, focus?: () => void },
 * __mflAppStartPromise?: Promise<void>,
 * __mflDynamicDiscountResult?: { rate?: number } | null,
 * __mflSupabaseDiscountRateFunction?: (() => number | null),
 * __mflEvaluationDiscountRateAuthority?: (() => number | null),
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
  document.head.append(link);
  return ready;
}

const entryRelease = releaseFromBootstrap();
const responsiveStylesReady = installResponsiveStylesheet();
preloadClassicScript("/modules/legacy-core.js");

let evaluationDiscountRateObserver = null;
let evaluationDiscountRouteActive = false;

function evaluationRouteActive() {
  const path = String(window.location.pathname || "").replace(/\/+$/, "") || "/";
  return path === "/evaluation" || document.body?.dataset.page === "evaluation";
}

function evaluationDiscountRateIsLive() {
  return document.documentElement.dataset.mflDiscountRateSource === "supabase-live-request";
}

function authoritativeEvaluationDiscountRateValue() {
  const resultRate = Number(runtimeWindow.__mflDynamicDiscountResult?.rate);
  if (Number.isFinite(resultRate)) return resultRate;

  const liveFunction = runtimeWindow.__mflSupabaseDiscountRateFunction;
  if (typeof liveFunction === "function" && liveFunction !== authoritativeEvaluationDiscountRateValue) {
    const liveRate = Number(liveFunction());
    if (Number.isFinite(liveRate)) return liveRate;
  }
  return null;
}

function authoritativeEvaluationDiscountRateLabel() {
  const rate = authoritativeEvaluationDiscountRateValue();
  return typeof rate === "number" && Number.isFinite(rate)
    ? `${(rate * 100).toFixed(2)}%`
    : "";
}

function clearNonAuthoritativeDiscountRate() {
  const discountRate = document.getElementById("evaluationDiscountRate");
  const advancedRate = document.getElementById("advancedDiscountRateValue");
  const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");

  if (discountRate instanceof HTMLElement && discountRate.textContent !== "-") {
    discountRate.textContent = "-";
  }
  if (advancedRate instanceof HTMLElement && advancedRate.textContent !== "-") {
    advancedRate.textContent = "-";
  }
  if (metric instanceof HTMLElement) {
    metric.removeAttribute("data-tooltip");
    metric.removeAttribute("aria-describedby");
  }
  document.body?.classList.remove("evaluationDiscountRateReady");
  document.documentElement.classList.remove("mflEvaluationRateResolved");
}

function paintAuthoritativeDiscountRate(label) {
  const discountRate = document.getElementById("evaluationDiscountRate");
  const advancedRate = document.getElementById("advancedDiscountRateValue");
  if (discountRate instanceof HTMLElement && discountRate.textContent !== label) {
    discountRate.textContent = label;
  }
  if (advancedRate instanceof HTMLElement && advancedRate.textContent !== label) {
    advancedRate.textContent = label;
  }
  if (document.documentElement.dataset.mflDiscountRate !== label) {
    document.documentElement.dataset.mflDiscountRate = label;
  }
}

function syncEvaluationDiscountRateAuthority() {
  const active = evaluationRouteActive();
  if (active && !evaluationDiscountRouteActive) {
    document.documentElement.dataset.mflDiscountRate = "-";
    document.documentElement.dataset.mflDiscountRateSource = "supabase-loading";
  }
  evaluationDiscountRouteActive = active;
  if (!active) return;

  const authoritativeLabel = authoritativeEvaluationDiscountRateLabel();
  if (!evaluationDiscountRateIsLive() || !authoritativeLabel) {
    clearNonAuthoritativeDiscountRate();
  } else {
    paintAuthoritativeDiscountRate(authoritativeLabel);
  }

  const discountRate = document.getElementById("evaluationDiscountRate");
  if (discountRate instanceof HTMLElement) {
    discountRate.style.setProperty("visibility", "visible", "important");
  }
}

function installEvaluationDiscountRateAuthorityGuard() {
  syncEvaluationDiscountRateAuthority();
  if (evaluationDiscountRateObserver) return;
  evaluationDiscountRateObserver = new MutationObserver(syncEvaluationDiscountRateAuthority);
  evaluationDiscountRateObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "class",
      "data-page",
      "data-tooltip",
      "data-mfl-discount-rate",
      "data-mfl-discount-rate-source",
    ],
  });
  window.addEventListener("popstate", syncEvaluationDiscountRateAuthority);
  window.addEventListener("mfl:season-ratios-ready", syncEvaluationDiscountRateAuthority);
}

function installEvaluationDiscountRateFunctionAuthority() {
  runtimeWindow.__mflEvaluationDiscountRateAuthority = authoritativeEvaluationDiscountRateValue;
  try {
    window.eval("evaluationDiscountRateValue = window.__mflEvaluationDiscountRateAuthority");
  } catch (error) {
    console.warn("Could not replace the legacy Evaluation Discount Rate fallback.", error);
  }
}

function primeEvaluationDiscountRatePlaceholder() {
  if (!/^\/evaluation\/?$/i.test(window.location.pathname)) return;
  clearNonAuthoritativeDiscountRate();
  document.documentElement.dataset.mflDiscountRate = "-";
  document.documentElement.dataset.mflDiscountRateSource = "supabase-loading";
  const discountRate = document.getElementById("evaluationDiscountRate");
  if (discountRate instanceof HTMLElement) {
    discountRate.style.setProperty("visibility", "visible", "important");
  }
}

primeEvaluationDiscountRatePlaceholder();
installEvaluationDiscountRateAuthorityGuard();

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

function installLegacyBridges() {
  runtimeWindow.__mflTableLoadingRuntime?.installLegacyBridge?.();
  runtimeWindow.__mflInteractionBusy?.installLegacyBridge?.();
  runtimeWindow.__mflStatsFirstPaintRuntime?.installLegacyBridge?.();
  runtimeWindow.__mflTableLoadingRuntime?.sync?.();
  runtimeWindow.__mflGlobalSearchRuntime?.flush?.();
  runtimeWindow.__mflTableWidthPrimeRuntime?.takeOwnership?.();
}

async function start() {
  const release = entryRelease;
  window.__mflRelease = release;
  window.__mflReleaseVersion = release.version;
  window.__mflAssetUrl = (path) => new URL(String(path || "").replace(/^\/+/, ""), `${window.location.origin}/`).href;

  await responsiveStylesReady;
  installApiFetchPolicy();
  await loadScriptGroup(EARLY_RUNTIME_SCRIPTS);

  if (/^\/changelog\/?$/i.test(window.location.pathname)) {
    const changelogWindow = /** @type {Window & { __mflChangelogHistoryReady?: Promise<boolean> }} */ (window);
    if (changelogWindow.__mflChangelogHistoryReady) await changelogWindow.__mflChangelogHistoryReady;
  }

  await loadClassicScript("/modules/legacy-core.js");
  installEvaluationDiscountRateFunctionAuthority();
  syncEvaluationDiscountRateAuthority();
  installLegacyBridges();
  const evaluationStartup = /^\/evaluation\/?$/i.test(window.location.pathname);
  const homeStartup = /^\/(?:home)?\/?$/i.test(window.location.pathname);
  const tableStartup = /^\/(?:database|mfl|progression|watchlist|my-players|agents|clubs?|club)(?:\/|$)/i.test(window.location.pathname)
    && !/^\/(?:database|mfl)\/stats\/?$/i.test(window.location.pathname);
  if (evaluationStartup && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
  }
  runtimeWindow.__mflStatsFirstPaintRuntime?.sync?.();
  runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  runtimeWindow.__mflDatabaseStatsReloadBootstrap?.restoreRoute?.();
  await loadScriptGroup(LATE_RUNTIME_SCRIPTS);
  // Late compatibility runtimes can replace legacy functions. Reinstall every
  // bridge after they load so loading/cursor ownership and static table chrome
  // keep wrapping the functions that are actually active in the page.
  installEvaluationDiscountRateFunctionAuthority();
  syncEvaluationDiscountRateAuthority();
  installLegacyBridges();
  runtimeWindow.__mflDatabaseStatsReloadBootstrap?.finalize?.();
  runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
  runtimeWindow.__mflStatsFirstPaintRuntime?.sync?.();

  // Keep late runtimes such as selection bridges available as early as possible,
  // but do not release the startup loading state on the homepage or player-table
  // routes until the legacy app startup has actually settled. Dedicated Stats
  // pages own their own readiness and therefore must not wait here.
  if ((homeStartup || tableStartup) && runtimeWindow.__mflAppStartPromise) {
    await runtimeWindow.__mflAppStartPromise;
  }

  document.documentElement.dataset.mflReady = "true";
  window.dispatchEvent(new CustomEvent("mfl:ready", { detail: release }));
}

void start().catch(showStartupError);