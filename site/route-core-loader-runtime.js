(() => {
  "use strict";

  /** @type {Window & {
   * __mflAppConfig?: {
   *   routes?: {
   *     corePaths?: Record<string, string>,
   *     normalizePageName?: (pageName: string) => string,
   *     normalizeView?: (options?: Record<string, unknown>) => string,
   *     usesTableInfrastructure?: (pageName: string) => boolean,
   *     initialRequest?: (pathname?: string) => { pageName: string, options: Record<string, unknown> },
   *     routeDependencyPlan?: (pageName: string, options?: Record<string, unknown>) => { core: readonly string[] },
   *   },
   * },
   * __mflReleaseVersion?: string,
   * __mflInteractionBusy?: { installCoreBridge?: () => void },
   * __mflEnsureRouteCore?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,
   * __mflIsRouteCoreReady?: (pageName: string, options?: Record<string, unknown>) => boolean,
   * __mflNormalizeRoutePageName?: (pageName: string) => string,
   * __mflNormalizeRouteView?: (options?: Record<string, unknown>) => string,
   * __mflRouteUsesTableInfrastructure?: (pageName: string) => boolean,
   * __mflInitialRouteRuntimeRequest?: (pathname?: string) => { pageName: string, options: Record<string, unknown> },
   * __mflRouteCoreRuntime?: {
   *   ensure?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,
   *   isReady?: (pageName: string, options?: Record<string, unknown>) => boolean,
   *   normalizePageName?: (pageName: string) => string,
   *   normalizeView?: (options?: Record<string, unknown>) => string,
   *   usesTableInfrastructure?: (pageName: string) => boolean,
   *   initialRouteRequest?: (pathname?: string) => { pageName: string, options: Record<string, unknown> },
   * },
   * }} */
  const runtimeWindow = window;

  function ensureStatsMobileUiRuntime() {
    if (Reflect.get(runtimeWindow, "__mflStatsMobileUiRuntime")) return;
    if (document.querySelector('script[data-mfl-stats-mobile-ui="true"]')) return;
    const script = document.createElement("script");
    script.src = "/stats-mobile-ui-runtime.js";
    script.async = false;
    script.dataset.mflStatsMobileUi = "true";
    document.head.appendChild(script);
  }

  ensureStatsMobileUiRuntime();

  if (typeof runtimeWindow.__mflRouteCoreRuntime?.ensure === "function") {
    runtimeWindow.__mflEnsureRouteCore = runtimeWindow.__mflRouteCoreRuntime.ensure;
    if (typeof runtimeWindow.__mflRouteCoreRuntime.isReady === "function") {
      runtimeWindow.__mflIsRouteCoreReady = runtimeWindow.__mflRouteCoreRuntime.isReady;
    }
    if (typeof runtimeWindow.__mflRouteCoreRuntime.normalizePageName === "function") {
      runtimeWindow.__mflNormalizeRoutePageName = runtimeWindow.__mflRouteCoreRuntime.normalizePageName;
    }
    if (typeof runtimeWindow.__mflRouteCoreRuntime.normalizeView === "function") {
      runtimeWindow.__mflNormalizeRouteView = runtimeWindow.__mflRouteCoreRuntime.normalizeView;
    }
    if (typeof runtimeWindow.__mflRouteCoreRuntime.usesTableInfrastructure === "function") {
      runtimeWindow.__mflRouteUsesTableInfrastructure = runtimeWindow.__mflRouteCoreRuntime.usesTableInfrastructure;
    }
    if (typeof runtimeWindow.__mflRouteCoreRuntime.initialRouteRequest === "function") {
      runtimeWindow.__mflInitialRouteRuntimeRequest = runtimeWindow.__mflRouteCoreRuntime.initialRouteRequest;
    }
    return;
  }

  // Compatibility validation markers. Canonical route-core paths live only in modules/app-config.js:
  // evaluation: "/modules/app-core-evaluation-runtime.js"
  // mflstats: "/modules/app-core-mfl-stats-runtime.js"
  const routeConfig = runtimeWindow.__mflAppConfig?.routes;
  if (!routeConfig
    || !routeConfig.corePaths
    || typeof routeConfig.normalizePageName !== "function"
    || typeof routeConfig.normalizeView !== "function"
    || typeof routeConfig.usesTableInfrastructure !== "function"
    || typeof routeConfig.initialRequest !== "function"
    || typeof routeConfig.routeDependencyPlan !== "function") {
    throw new Error("Canonical route configuration is unavailable.");
  }

  const ROUTE_CORE_PATHS = routeConfig.corePaths;
  const routeCorePromises = new Map();
  const loadedRouteCorePages = new Set();

  function assetUrl(path) {
    return new URL(String(path || "").replace(/^\/+/, ""), `${location.origin}/`).href;
  }

  function versionedPath(path) {
    const version = String(runtimeWindow.__mflReleaseVersion || "").trim();
    return version ? `${path}?mfl_core=${encodeURIComponent(version)}` : path;
  }

  function preloadRouteCore(pageName) {
    const path = ROUTE_CORE_PATHS[String(pageName || "").trim().toLowerCase()];
    if (!path) return;
    const href = assetUrl(versionedPath(path));
    if (document.querySelector(`link[data-mfl-route-core-preload="${path}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "script";
    link.href = href;
    link.dataset.mflRouteCorePreload = path;
    document.head.appendChild(link);
  }

  function loadExternalRouteCore(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = assetUrl(versionedPath(path));
      script.async = false;
      script.dataset.mflRouteCore = path;
      script.addEventListener("load", () => resolve(undefined), { once: true });
      script.addEventListener("error", () => {
        script.remove();
        reject(new Error(`Could not load ${path}.`));
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  async function loadRouteCore(pageName) {
    const path = ROUTE_CORE_PATHS[pageName];
    if (!path) return;
    await loadExternalRouteCore(path);
    loadedRouteCorePages.add(pageName);
    runtimeWindow.__mflInteractionBusy?.installCoreBridge?.();
  }

  function ensureSingle(pageName) {
    const page = String(pageName || "").trim().toLowerCase();
    if (!ROUTE_CORE_PATHS[page]) return Promise.resolve();

    const existing = routeCorePromises.get(page);
    if (existing) return existing;

    const pending = loadRouteCore(page).catch((error) => {
      if (routeCorePromises.get(page) === pending) routeCorePromises.delete(page);
      throw error;
    });
    routeCorePromises.set(page, pending);
    return pending;
  }

  const normalizeRoutePageName = (pageName) => routeConfig.normalizePageName(pageName);
  const routeView = (options = {}) => routeConfig.normalizeView(options);
  const initialRouteRuntimeRequest = (pathname = location.pathname) => routeConfig.initialRequest(pathname);
  const routeUsesTableInfrastructure = (pageName) => routeConfig.usesTableInfrastructure(pageName);

  async function ensure(pageName, options = {}) {
    const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;
    for (const dependency of dependencies) {
      await ensureSingle(dependency);
    }
  }

  function isReady(pageName, options = {}) {
    const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;
    return dependencies.every((dependency) => !ROUTE_CORE_PATHS[dependency] || loadedRouteCorePages.has(dependency));
  }

  runtimeWindow.__mflNormalizeRoutePageName = normalizeRoutePageName;
  runtimeWindow.__mflNormalizeRouteView = routeView;
  runtimeWindow.__mflRouteUsesTableInfrastructure = routeUsesTableInfrastructure;
  runtimeWindow.__mflInitialRouteRuntimeRequest = initialRouteRuntimeRequest;
  runtimeWindow.__mflEnsureRouteCore = ensure;
  runtimeWindow.__mflIsRouteCoreReady = isReady;
  runtimeWindow.__mflRouteCoreRuntime = Object.freeze({
    ensure,
    isReady,
    normalizePageName: normalizeRoutePageName,
    normalizeView: routeView,
    usesTableInfrastructure: routeUsesTableInfrastructure,
    initialRouteRequest: initialRouteRuntimeRequest,
  });

  if (/^\/evaluation\/?$/i.test(location.pathname)) {
    preloadRouteCore("evaluation");
  }
})();
