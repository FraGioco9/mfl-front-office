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
   *     clubPath?: (clubId: string, view?: string) => string,
   *   },
   * },
   * __mflReleaseVersion?: string,
   * __mflInteractionBusy?: { begin?: (reason?: string) => string, end?: (token?: string) => void, installCoreBridge?: () => void },
   * __mflEnsureRouteRuntime?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,
   * __mflOpenClubPageRoute?: (clubId: string, view?: string) => unknown,
   * __mflRunPageTransition?: (pageName: string, updateHash?: boolean, options?: Record<string, unknown>, loader?: ((transition: unknown) => unknown)) => Promise<unknown>,
   * __mflEnsureRouteCore?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,
   * __mflNormalizeRoutePageName?: (pageName: string) => string,
   * __mflNormalizeRouteView?: (options?: Record<string, unknown>) => string,
   * __mflRouteUsesTableInfrastructure?: (pageName: string) => boolean,
   * __mflInitialRouteRuntimeRequest?: (pathname?: string) => { pageName: string, options: Record<string, unknown> },
   * __mflLoadFallbackApplicationCoreArtifacts?: () => Promise<{ core?: string, routeChunks?: Record<string, string> }>,
   * __mflRouteCoreRuntime?: {
   *   ensure?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,
   *   normalizePageName?: (pageName: string) => string,
   *   normalizeView?: (options?: Record<string, unknown>) => string,
   *   usesTableInfrastructure?: (pageName: string) => boolean,
   *   initialRouteRequest?: (pathname?: string) => { pageName: string, options: Record<string, unknown> },
   *   loadFallbackArtifacts?: () => Promise<{ core?: string, routeChunks?: Record<string, string> }>,
   * },
   * mflOpenClubPage?: ((clubId: string, view?: string) => unknown) & { __mflRouteRuntimeGate?: boolean },
   * }} */
  const runtimeWindow = window;

  if (typeof runtimeWindow.__mflRouteCoreRuntime?.ensure === "function") {
    runtimeWindow.__mflEnsureRouteCore = runtimeWindow.__mflRouteCoreRuntime.ensure;
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
    if (typeof runtimeWindow.__mflRouteCoreRuntime.loadFallbackArtifacts === "function") {
      runtimeWindow.__mflLoadFallbackApplicationCoreArtifacts = runtimeWindow.__mflRouteCoreRuntime.loadFallbackArtifacts;
    }
    return;
  }

  const routeConfig = runtimeWindow.__mflAppConfig?.routes;
  if (!routeConfig
    || !routeConfig.corePaths
    || typeof routeConfig.normalizePageName !== "function"
    || typeof routeConfig.normalizeView !== "function"
    || typeof routeConfig.usesTableInfrastructure !== "function"
    || typeof routeConfig.initialRequest !== "function"
    || typeof routeConfig.clubPath !== "function") {
    throw new Error("Canonical route configuration is unavailable.");
  }

  const ROUTE_CORE_PATHS = routeConfig.corePaths;
  const routeCorePromises = new Map();
  let fallbackArtifactsPromise = null;

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

  function executeRouteCore(path, source) {
    const script = document.createElement("script");
    script.dataset.mflRouteCore = path;
    script.textContent = `${source}\n//# sourceURL=${path}`;
    document.head.appendChild(script);
    script.remove();
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

  function loadFallbackApplicationCoreArtifacts() {
    if (fallbackArtifactsPromise) return fallbackArtifactsPromise;

    fallbackArtifactsPromise = (async () => {
      const normalizerPromise = import(assetUrl("/modules/app-core-build-normalizer.js"));
      const sourcePromise = fetch(assetUrl("/modules/app-core.js"), { cache: "no-store" });
      const [normalizer, response] = await Promise.all([normalizerPromise, sourcePromise]);
      if (!response.ok) throw new Error("Could not load the application core source fallback.");
      if (typeof normalizer.normalizeBuiltApplicationCoreArtifacts !== "function") {
        throw new Error("Application core artifact normalizer is unavailable.");
      }

      const rawSource = await response.text();
      return normalizer.normalizeBuiltApplicationCoreArtifacts(rawSource);
    })().catch((error) => {
      fallbackArtifactsPromise = null;
      throw error;
    });

    return fallbackArtifactsPromise;
  }

  async function loadFallbackRouteCore(pageName, path) {
    const artifacts = await loadFallbackApplicationCoreArtifacts();
    const source = String(artifacts?.routeChunks?.[pageName] || "").trim();
    if (!source) throw new Error(`The ${pageName} application core chunk is unavailable.`);
    executeRouteCore(path, source);
  }

  async function loadRouteCore(pageName) {
    const path = ROUTE_CORE_PATHS[pageName];
    if (!path) return;

    try {
      await loadExternalRouteCore(path);
    } catch (error) {
      console.warn(`Prebuilt ${pageName} application core is unavailable; using source fallback.`, error);
      await loadFallbackRouteCore(pageName, path);
    }

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

  function routeCoreDependencies(pageName, options = {}) {
    const page = normalizeRoutePageName(pageName);
    const view = routeView(options);
    if (page === "database" && view === "stats") return [];
    if (page === "mflstats") return ["table", "mflstats"];
    if (page === "mfl" && view === "stats") return ["table", "mflstats"];
    if (page === "club") return ["table", "club"];
    if (page === "watchlist") return ["table", "watchlist"];
    if (routeUsesTableInfrastructure(page)) return ["table"];
    return ROUTE_CORE_PATHS[page] ? [page] : [];
  }

  async function ensure(pageName, options = {}) {
    const dependencies = routeCoreDependencies(pageName, options);
    for (const dependency of dependencies) {
      await ensureSingle(dependency);
    }
  }

  function clubRoutePath(clubId, view = "attributes") {
    return routeConfig.clubPath(clubId, view);
  }

  function installClubRouteGate() {
    if (runtimeWindow.mflOpenClubPage?.__mflRouteRuntimeGate) return;

    const gated = async function mflOpenClubPageWithRouteCore(clubId, view = "attributes") {
      const normalizedClubId = String(clubId || "").trim();
      if (!normalizedClubId) return;

      const loadClub = async () => {
        const token = runtimeWindow.__mflInteractionBusy?.begin?.("route-runtime") || "";
        try {
          const routeCorePromise = ensure("club", { view });
          const routeRuntimePromise = typeof runtimeWindow.__mflEnsureRouteRuntime === "function"
            ? runtimeWindow.__mflEnsureRouteRuntime("club", { view })
            : Promise.resolve();
          await Promise.all([routeCorePromise, routeRuntimePromise]);

          const routeOwner = runtimeWindow.__mflOpenClubPageRoute;
          if (typeof routeOwner !== "function") {
            throw new Error("Club route owner is unavailable.");
          }
          return routeOwner.call(runtimeWindow, normalizedClubId, view);
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
    };
    Object.defineProperty(gated, "__mflRouteRuntimeGate", { value: true });
    runtimeWindow.mflOpenClubPage = gated;
  }

  runtimeWindow.__mflNormalizeRoutePageName = normalizeRoutePageName;
  runtimeWindow.__mflNormalizeRouteView = routeView;
  runtimeWindow.__mflRouteUsesTableInfrastructure = routeUsesTableInfrastructure;
  runtimeWindow.__mflInitialRouteRuntimeRequest = initialRouteRuntimeRequest;
  runtimeWindow.__mflLoadFallbackApplicationCoreArtifacts = loadFallbackApplicationCoreArtifacts;
  runtimeWindow.__mflEnsureRouteCore = ensure;
  runtimeWindow.__mflRouteCoreRuntime = Object.freeze({
    ensure,
    normalizePageName: normalizeRoutePageName,
    normalizeView: routeView,
    usesTableInfrastructure: routeUsesTableInfrastructure,
    initialRouteRequest: initialRouteRuntimeRequest,
    loadFallbackArtifacts: loadFallbackApplicationCoreArtifacts,
  });
  installClubRouteGate();

  if (/^\/evaluation\/?$/i.test(location.pathname)) {
    preloadRouteCore("evaluation");
  }
})();
