import { readFile, writeFile, rm } from "node:fs/promises";

const file = (path) => new URL(`./${path}`, import.meta.url);
async function read(path) { return readFile(file(path), "utf8"); }
async function write(path, content) { return writeFile(file(path), content, "utf8"); }
function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} not found.`);
  return source.replace(before, after);
}

// One canonical classic-script network owner lives in Bootstrap and is reused everywhere else.
{
  let source = await read("bootstrap.js");
  const start = source.indexOf("  function loadRuntime(path) {");
  const endMarker = "\n\n  void (async () => {";
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error("Bootstrap runtime loader block not found.");
  const replacement = `  const runtimeResourcePromises = new Map();

  function runtimeResourceUrl(path, options = {}) {
    const normalizedPath = String(path || "").trim();
    if (!normalizedPath) throw new Error("Runtime resource path is required.");
    const url = new URL(normalizedPath.replace(/^\\/+/, ""), window.location.origin + "/");
    if (options.versioned) {
      const version = String(window.__mflReleaseVersion || STATIC_RELEASE_VERSION || "").trim();
      if (version) url.searchParams.set("mfl_core", version);
    }
    return url.href;
  }

  function loadRuntime(path, options = {}) {
    const href = runtimeResourceUrl(path, options);
    const existingPromise = runtimeResourcePromises.get(href);
    if (existingPromise) return existingPromise;

    /** @type {Promise<void>} */
    const loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = href;
      script.async = false;
      script.dataset.mflRuntimeResource = String(path || "");
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => {
        runtimeResourcePromises.delete(href);
        script.remove();
        reject(new Error("Could not load " + path + "."));
      }, { once: true });
      document.head.appendChild(script);
    });
    runtimeResourcePromises.set(href, loader);
    return loader;
  }

  async function loadRuntimeGroup(paths, options = {}) {
    await Promise.all(Array.from(new Set(paths)).map((path) => loadRuntime(path, options)));
  }

  function preloadRuntime(path, options = {}) {
    const href = runtimeResourceUrl(path, options);
    if (document.querySelector('link[data-mfl-runtime-resource-preload="' + href + '"]')) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "script";
    link.href = href;
    link.dataset.mflRuntimeResourcePreload = href;
    document.head.appendChild(link);
  }

  Reflect.set(window, "__mflRuntimeResources", Object.freeze({
    load: loadRuntime,
    loadGroup: loadRuntimeGroup,
    preload: preloadRuntime,
    url: runtimeResourceUrl,
  }));`;
  source = source.slice(0, start) + replacement + source.slice(end);
  await write("bootstrap.js", source);
}

// app-entry owns route orchestration only; network dedupe/preload is delegated to Bootstrap.
{
  let source = await read("modules/app-entry.js");
  source = source.replace("const runtimeLoadPromises = new Map();\n", "");
  const start = source.indexOf("/** @param {string} path */\nfunction assetUrl(path) {");
  const end = source.indexOf("\nconst UNIVERSAL_RUNTIME_SCRIPTS", start);
  if (start < 0 || end < 0) throw new Error("app-entry classic-script loader block not found.");
  const replacement = `function runtimeResources() {
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
}`;
  source = source.slice(0, start) + replacement + source.slice(end);
  source = replaceRequired(
    source,
    '  "/global-search-runtime.js",\n  "/shared-table-ui-runtime.js",\n',
    '  "/global-search-runtime.js",\n',
    "Universal Shared Table UI runtime",
  );
  await write("modules/app-entry.js", source);
}

// Route-core loading retains semantic readiness only; the canonical resource loader owns requests/dedupe.
await write("route-core-loader-runtime.js", `(() => {
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
`);

// Shared Table UI and Stats mobile behavior are loaded only where route dependencies require them.
{
  let source = await read("modules/app-config.js");
  source = replaceRequired(
    source,
    `  tablePost: Object.freeze([\n    "/selection-startup-reset-runtime.js",\n    "/selection-stack-runtime.js",\n  ]),\n`,
    `  tablePost: Object.freeze([\n    "/selection-startup-reset-runtime.js",\n    "/selection-stack-runtime.js",\n  ]),\n  statsPre: Object.freeze([\n    "/shared-table-ui-runtime.js",\n    "/stats-mobile-ui-runtime.js",\n  ]),\n`,
    "Stats route runtime group",
  );
  source = replaceRequired(
    source,
    `    const watchlist = page === "watchlist" || page === "myplayers";\n    const databaseStats = page === "database" && view === "stats";\n`,
    `    const watchlist = page === "watchlist" || page === "myplayers";\n    const databaseStats = page === "database" && view === "stats";\n    const stats = databaseStats || page === "mflstats" || (page === "mfl" && view === "stats");\n`,
    "Stats route classification",
  );
  source = replaceRequired(
    source,
    `    if (table) {\n      preCore.push(...data.routes.runtimeScripts.tablePre);\n      postCore.push(...data.routes.runtimeScripts.tablePost);\n    }\n    if (databaseStats) preCore.push(...data.routes.runtimeScripts.databaseStats);\n`,
    `    if (table) {\n      preCore.push(...data.routes.runtimeScripts.tablePre);\n      postCore.push(...data.routes.runtimeScripts.tablePost);\n    }\n    if (stats) preCore.push(...data.routes.runtimeScripts.statsPre);\n    if (databaseStats) preCore.push(...data.routes.runtimeScripts.databaseStats);\n`,
    "Stats route dependency loading",
  );
  source = replaceRequired(
    source,
    `      table,\n      watchlist,\n      databaseStats,\n`,
    `      table,\n      watchlist,\n      databaseStats,\n      stats,\n`,
    "Stats route plan metadata",
  );
  await write("modules/app-config.js", source);
}

// Obsolete post-authoring split/normalization stack is no longer a source of runtime behavior.
for (const path of [
  "modules/app-core.js",
]) {
  await rm(file(path), { force: true });
}

console.log("Issue 594 runtime resource ownership refactor applied.");
