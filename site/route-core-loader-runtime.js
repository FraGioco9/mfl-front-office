(() => {
  "use strict";

  /** @type {Window & {
   * __mflReleaseVersion?: string,
   * __mflInteractionBusy?: { begin?: (reason?: string) => string, end?: (token?: string) => void, installCoreBridge?: () => void },
   * __mflEnsureRouteRuntime?: (pageName: string, options?: Record<string, unknown>) => Promise<void>,
   * __mflOpenClubPageRoute?: (clubId: string, view?: string) => unknown,
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

  const ROUTE_CORE_PATHS = Object.freeze({
    evaluation: "/modules/app-core-evaluation-runtime.js",
    mflstats: "/modules/app-core-mfl-stats-runtime.js",
    club: "/modules/app-core-club-runtime.js",
    settings: "/modules/app-core-settings-runtime.js",
    player: "/modules/app-core-player-runtime.js",
    table: "/modules/app-core-table-runtime.js",
    wallet: "/modules/app-core-wallet-runtime.js",
    watchlist: "/modules/app-core-watchlist-runtime.js",
  });
  const TABLE_INFRASTRUCTURE_PAGES = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"]);
  const routeCorePromises = new Map();
  let fallbackArtifactsPromise = null;

  function assetUrl(path) {
    return new URL(String(path || "").replace(/^\/+/, ""), `${location.origin}/`).href;
  }

  function versionedPath(path) {
    const version = String(runtimeWindow.__mflReleaseVersion || "").trim();
    return version ? `${path}?mfl_core=${encodeURIComponent(version)}` : path;
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

  function normalizeRoutePageName(pageName) {
    const page = String(pageName || "").trim().toLowerCase();
    if (page === "my-players") return "myplayers";
    if (page === "databasestats") return "database";
    if (page === "clubs") return "club";
    return page || "home";
  }

  function initialRouteRuntimeRequest(pathname = location.pathname) {
    const path = String(pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
    if (!path.startsWith("/")) return { pageName: "home", options: {} };

    const segments = path.split("/");
    const pageSegment = String(segments[1] || "").toLowerCase();
    if (pageSegment === "evaluation" && segments.length === 2) return { pageName: "evaluation", options: {} };
    if (pageSegment === "changelog" && segments.length === 2) return { pageName: "changelog", options: {} };
    if (pageSegment === "database") {
      if (segments.length === 3 && String(segments[2] || "").toLowerCase() === "stats") {
        return { pageName: "database", options: { view: "stats" } };
      }
      return { pageName: "database", options: {} };
    }
    if (pageSegment === "mfl") return { pageName: "mfl", options: {} };
    if (pageSegment === "progression") return { pageName: "progression", options: {} };
    if (pageSegment === "watchlist") return { pageName: "watchlist", options: {} };
    if (pageSegment === "my-players") return { pageName: "myplayers", options: {} };
    if (pageSegment === "agents") return { pageName: "agents", options: {} };
    if (pageSegment === "clubs" || pageSegment === "club") return { pageName: "club", options: {} };
    if (pageSegment === "players" && segments.length === 3 && segments[2]) return { pageName: "player", options: {} };
    if (pageSegment === "settings" && segments.length === 2) return { pageName: "settings", options: {} };
    return { pageName: "home", options: {} };
  }

  function routeView(options = {}) {
    return String(options?.view || "").trim().toLowerCase();
  }

  function routeUsesTableInfrastructure(pageName) {
    return TABLE_INFRASTRUCTURE_PAGES.has(normalizeRoutePageName(pageName));
  }

  function routeCoreDependencies(pageName, options = {}) {
    const page = normalizeRoutePageName(pageName);
    const view = routeView(options);
    if (page === "database" && view === "stats") return [];
    if (page === "mfl" && view === "stats") return ["mflstats"];
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

  function installClubRouteGate() {
    if (runtimeWindow.mflOpenClubPage?.__mflRouteRuntimeGate) return;

    const gated = async function mflOpenClubPageWithRouteCore(clubId, view = "attributes") {
      const normalizedClubId = String(clubId || "").trim();
      if (!normalizedClubId) return;

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
    void ensure("evaluation").catch((error) => console.warn("Could not prime the Evaluation application core.", error));
  }
})();