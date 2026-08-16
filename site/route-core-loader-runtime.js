(() => {
  "use strict";

  /** @type {Window & {
   * __mflReleaseVersion?: string,
   * __mflInteractionBusy?: { installCoreBridge?: () => void },
   * __mflEnsureRouteCore?: (pageName: string) => Promise<void>,
   * __mflRouteCoreRuntime?: { ensure?: (pageName: string) => Promise<void> },
   * }} */
  const runtimeWindow = window;

  if (typeof runtimeWindow.__mflRouteCoreRuntime?.ensure === "function") {
    runtimeWindow.__mflEnsureRouteCore = runtimeWindow.__mflRouteCoreRuntime.ensure;
    return;
  }

  const ROUTE_CORE_PATHS = Object.freeze({
    evaluation: "/modules/app-core-evaluation-runtime.js",
    mflstats: "/modules/app-core-mfl-stats-runtime.js",
  });
  const routeCorePromises = new Map();

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

  async function loadFallbackRouteCore(pageName, path) {
    const normalizerPromise = import(assetUrl("/modules/app-core-build-normalizer.js"));
    const sourcePromise = fetch(assetUrl("/modules/app-core.js"), { cache: "no-store" });
    const [normalizer, response] = await Promise.all([normalizerPromise, sourcePromise]);
    if (!response.ok) throw new Error("Could not load the application core source fallback.");
    if (typeof normalizer.normalizeBuiltApplicationCoreArtifacts !== "function") {
      throw new Error("Application core artifact normalizer is unavailable.");
    }

    const rawSource = await response.text();
    const artifacts = normalizer.normalizeBuiltApplicationCoreArtifacts(rawSource);
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

  function ensure(pageName) {
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

  runtimeWindow.__mflEnsureRouteCore = ensure;
  runtimeWindow.__mflRouteCoreRuntime = Object.freeze({ ensure });

  if (/^\/evaluation\/?$/i.test(location.pathname)) {
    void ensure("evaluation").catch((error) => console.warn("Could not prime the Evaluation application core.", error));
  }
})();
