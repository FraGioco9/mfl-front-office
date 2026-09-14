(() => {
  "use strict";

  const runtimeWindow = window;

  if (typeof runtimeWindow.__mflRouteCoreRuntime?.ensure === "function") {
    runtimeWindow.__mflEnsureRouteCore = runtimeWindow.__mflRouteCoreRuntime.ensure;
    runtimeWindow.__mflIsRouteCoreReady = runtimeWindow.__mflRouteCoreRuntime.isReady;
    runtimeWindow.__mflNormalizeRoutePageName = runtimeWindow.__mflRouteCoreRuntime.normalizePageName;
    runtimeWindow.__mflNormalizeRouteView = runtimeWindow.__mflRouteCoreRuntime.normalizeView;
    runtimeWindow.__mflRouteUsesTableInfrastructure = runtimeWindow.__mflRouteCoreRuntime.usesTableInfrastructure;
    runtimeWindow.__mflInitialRouteRuntimeRequest = runtimeWindow.__mflRouteCoreRuntime.initialRouteRequest;
    return;
  }

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
  const loadedRouteCorePages = new Set();

  function resources() {
    const loader = Reflect.get(runtimeWindow, "__mflRuntimeResources");
    if (!loader || typeof loader.load !== "function" || typeof loader.preload !== "function") {
      throw new Error("Canonical runtime resource loader is unavailable.");
    }
    return loader;
  }

  function preloadRouteCore(pageName) {
    const path = ROUTE_CORE_PATHS[String(pageName || "").trim().toLowerCase()];
    if (path) resources().preload(path, { versioned: true });
  }

  async function ensureSingle(pageName) {
    const page = String(pageName || "").trim().toLowerCase();
    const path = ROUTE_CORE_PATHS[page];
    if (!path || loadedRouteCorePages.has(page)) return;
    await resources().load(path, { versioned: true });
    loadedRouteCorePages.add(page);
    runtimeWindow.__mflInteractionBusy?.installCoreBridge?.();
  }

  const normalizeRoutePageName = (pageName) => routeConfig.normalizePageName(pageName);
  const routeView = (options = {}) => routeConfig.normalizeView(options);
  const initialRouteRuntimeRequest = (pathname = location.pathname) => routeConfig.initialRequest(pathname);
  const routeUsesTableInfrastructure = (pageName) => routeConfig.usesTableInfrastructure(pageName);

  async function ensure(pageName, options = {}) {
    const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;
    dependencies.forEach(preloadRouteCore);
    for (const dependency of dependencies) await ensureSingle(dependency);
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

  const initialRequest = routeConfig.initialRequest(location.pathname);
  if (routeConfig.normalizePageName(initialRequest?.pageName) === "evaluation") preloadRouteCore("evaluation");
})();
