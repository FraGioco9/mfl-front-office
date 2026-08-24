// Temporary one-shot route dependency consolidation; removed before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(root, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

// Canonical dependency metadata + resolver.
const configPath = resolve(root, "modules/app-config.js");
let config = await read("modules/app-config.js");
config = replaceRequired(
  config,
  `export const TABLE_INFRASTRUCTURE_PAGES = Object.freeze([`,
  `export const ROUTE_RUNTIME_SCRIPTS = Object.freeze({
  tablePre: Object.freeze([
    "/filter-controls-runtime.js",
    "/desktop-table-style-runtime.js",
    "/shared-table-ui-runtime.js",
    "/nationality-filter-options-runtime.js",
    "/table-loading-runtime.js",
  ]),
  tablePost: Object.freeze([
    "/selection-startup-reset-runtime.js",
    "/selection-stack-runtime.js",
  ]),
  watchlistMyPlayersPost: Object.freeze([
    "/watchlist-myplayers-route-runtime.js",
  ]),
  evaluationPre: Object.freeze([
    "/evaluation-layout-runtime.js",
    "/evaluation-mfl-usd-input-runtime.js",
    "/evaluation-discount-rate-runtime.js",
    "/evaluation-discount-rate-ui-runtime.js",
  ]),
  evaluationPost: Object.freeze([
    "/evaluation-search-state-runtime.js",
  ]),
  databaseStats: Object.freeze([
    "/database-stats-state-runtime.js",
    "/database-stats-runtime.js",
  ]),
  changelog: Object.freeze([
    "/changelog-history-runtime.js",
  ]),
});

export const TABLE_INFRASTRUCTURE_PAGES = Object.freeze([`,
  "route runtime script manifest",
);
config = replaceRequired(
  config,
  `    corePaths: ROUTE_CORE_PATHS,\n    tableInfrastructurePages: TABLE_INFRASTRUCTURE_PAGES,`,
  `    corePaths: ROUTE_CORE_PATHS,\n    runtimeScripts: ROUTE_RUNTIME_SCRIPTS,\n    tableInfrastructurePages: TABLE_INFRASTRUCTURE_PAGES,`,
  "browser route runtime manifest",
);
const dependencyResolver = `  function uniqueDependencies(values) {
    return Array.from(new Set(values));
  }

  function routeDependencyPlan(pageName, options = {}) {
    const page = normalizePageName(pageName);
    const view = normalizeView(options);
    const table = tablePageSet.has(page) && !(page === "database" && view === "stats");
    const watchlist = page === "watchlist" || page === "myplayers";
    const databaseStats = page === "database" && view === "stats";
    const core = [];
    const preCore = [];
    const postCore = [];

    if (page === "mflstats" || (page === "mfl" && view === "stats")) {
      core.push("table", "mflstats");
    } else if (page === "club") {
      core.push("table", "club");
    } else if (page === "watchlist") {
      core.push("table", "watchlist");
    } else if (table) {
      core.push("table");
    } else if (data.routes.corePaths[page]) {
      core.push(page);
    }

    if (table) {
      preCore.push(...data.routes.runtimeScripts.tablePre);
      postCore.push(...data.routes.runtimeScripts.tablePost);
    }
    if (databaseStats) preCore.push(...data.routes.runtimeScripts.databaseStats);
    if (watchlist) postCore.push(...data.routes.runtimeScripts.watchlistMyPlayersPost);
    if (page === "evaluation") {
      preCore.push(...data.routes.runtimeScripts.evaluationPre);
      postCore.push(...data.routes.runtimeScripts.evaluationPost);
    }
    if (page === "changelog") {
      preCore.push(...data.routes.runtimeScripts.changelog);
      postCore.push(...data.routes.runtimeScripts.changelog);
    }

    return Object.freeze({
      pageName: page,
      view,
      core: Object.freeze(uniqueDependencies(core)),
      preCore: Object.freeze(uniqueDependencies(preCore)),
      postCore: Object.freeze(uniqueDependencies(postCore)),
      runtimeKey: \`\\${page}:\${view === "stats" ? "stats" : "default"}\`,
      table,
      watchlist,
      databaseStats,
    });
  }

`;
config = replaceRequired(
  config,
  `  function initialRequest(pathname = location.pathname) {`,
  `${dependencyResolver}  function initialRequest(pathname = location.pathname) {`,
  "generated route dependency resolver",
);
config = replaceRequired(
  config,
  `    canonicalRequest,\n    initialRequest,\n    usesTableInfrastructure,`,
  `    canonicalRequest,\n    initialRequest,\n    routeDependencyPlan,\n    usesTableInfrastructure,`,
  "generated route dependency API exposure",
);
await writeFile(configPath, config);

// Route-core loader consumes canonical core dependencies.
const coreLoaderPath = resolve(root, "route-core-loader-runtime.js");
let coreLoader = await read("route-core-loader-runtime.js");
coreLoader = replaceRequired(
  coreLoader,
  `     *     initialRequest?: (pathname?: string) => { pageName: string, options: Record<string, unknown> },`,
  `     *     initialRequest?: (pathname?: string) => { pageName: string, options: Record<string, unknown> },\n   *     routeDependencyPlan?: (pageName: string, options?: Record<string, unknown>) => { core: readonly string[] },`,
  "route-core config dependency type",
);
coreLoader = replaceRequired(
  coreLoader,
  `    || typeof routeConfig.initialRequest !== "function") {`,
  `    || typeof routeConfig.initialRequest !== "function"\n    || typeof routeConfig.routeDependencyPlan !== "function") {`,
  "route-core canonical config requirement",
);
const oldCoreDependencies = `  function routeCoreDependencies(pageName, options = {}) {
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

`;
coreLoader = replaceRequired(coreLoader, oldCoreDependencies, "", "local route-core dependency tree");
coreLoader = replaceRequired(
  coreLoader,
  `  async function ensure(pageName, options = {}) {\n    const dependencies = routeCoreDependencies(pageName, options);`,
  `  async function ensure(pageName, options = {}) {\n    const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;`,
  "route-core canonical dependency consumption",
);
await writeFile(coreLoaderPath, coreLoader);

// App entry consumes the same dependency plan for runtime scripts, route flags, and cache keys.
const entryPath = resolve(root, "modules/app-entry.js");
let entry = await read("modules/app-entry.js");
const routeRuntimeGroupsStart = entry.indexOf("const TABLE_PRE_CORE_RUNTIME_SCRIPTS = Object.freeze([");
const routeRuntimeGroupsEnd = entry.indexOf("const initialPathname =", routeRuntimeGroupsStart);
if (routeRuntimeGroupsStart < 0 || routeRuntimeGroupsEnd <= routeRuntimeGroupsStart) throw new Error("Missing route-specific runtime script groups.");
entry = entry.slice(0, routeRuntimeGroupsStart) + entry.slice(routeRuntimeGroupsEnd);
const oldRouteHelpersStart = entry.indexOf("/** @param {string} pageName */\nfunction normalizeRoutePageName");
const oldRouteHelpersEnd = entry.indexOf("function initialRouteRuntimeRequest()", oldRouteHelpersStart);
if (oldRouteHelpersStart < 0 || oldRouteHelpersEnd <= oldRouteHelpersStart) throw new Error("Missing app-entry route helper block.");
const routeHelpers = `function routeConfig() {
  const routes = window.__mflAppConfig?.routes;
  if (!routes || typeof routes.normalizePageName !== "function" || typeof routes.initialRequest !== "function" || typeof routes.routeDependencyPlan !== "function") {
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

`;
entry = entry.slice(0, oldRouteHelpersStart) + routeHelpers + entry.slice(oldRouteHelpersEnd);
entry = replaceRequired(
  entry,
  `function initialRouteRuntimeRequest() {\n  const classifier = Reflect.get(window, "__mflInitialRouteRuntimeRequest");\n  if (typeof classifier !== "function") throw new Error("Initial route runtime classifier is unavailable.");\n  const request = classifier(initialPathname);`,
  `function initialRouteRuntimeRequest() {\n  const request = routeConfig().initialRequest(initialPathname);`,
  "initial route config consumption",
);
entry = replaceRequired(
  entry,
  `  ...preCoreScriptsForRoute(initialRouteRuntime.pageName, initialRouteRuntime.options),`,
  `  ...routeDependencyPlan(initialRouteRuntime.pageName, initialRouteRuntime.options).preCore,`,
  "initial dependency plan runtime preload",
);
const oldFinalize = `async function finalizeRouteRuntimeNow(page, options = {}) {
  if (!applicationCoreLoaded) await applicationCoreLoadedPromise;

  if (page === "evaluation") installEvaluationRecentStateBridge();
  await loadScriptGroup(postCoreScriptsForRoute(page, options));

  if (routeNeedsTable(page, options)) {
    runtimeWindow.__mflFilterControlsRuntime?.sync?.();
    runtimeWindow.__mflSelectionStartupResetRuntime?.rebind?.();
  }
  if (routeNeedsWatchlist(page)) runtimeWindow.__mflWatchlistMyPlayersRouteRuntime?.install?.();
  if (routeNeedsDatabaseStats(page, options)) {
    runtimeWindow.__mflDatabaseStatsStateRuntime?.sync?.();
    runtimeWindow.__mflDatabaseStatsRuntime?.sync?.();
  }
  if (page === "evaluation") {
    runtimeWindow.__mflEvaluationLayoutRuntime?.sync?.();
    runtimeWindow.__mflEvaluationSearchStateRuntime?.sync?.();
  }
  if (page === "changelog" && runtimeWindow.__mflChangelogHistoryReady) await runtimeWindow.__mflChangelogHistoryReady;

  installCoreBridges();
}`;
const newFinalize = `async function finalizeRouteRuntimeNow(page, options = {}) {
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
}`;
entry = replaceRequired(entry, oldFinalize, newFinalize, "canonical route runtime finalization");
entry = replaceRequired(
  entry,
  `async function ensureRouteRuntimeNow(pageName, options = {}) {\n  const page = normalizeRoutePageName(pageName);\n  await loadScriptGroup(preCoreScriptsForRoute(page, options));\n  await finalizeRouteRuntimeNow(page, options);\n}`,
  `async function ensureRouteRuntimeNow(pageName, options = {}) {\n  const plan = routeDependencyPlan(pageName, options);\n  await loadScriptGroup(plan.preCore);\n  await finalizeRouteRuntimeNow(plan.pageName, options);\n}`,
  "canonical route runtime ensure",
);
entry = replaceRequired(
  entry,
  `function routeRuntimeKey(page, options = {}) {\n  const view = routeView(options);\n  return \`${page}:\${view === "stats" ? "stats" : "default"}\`;\n}`,
  `function routeRuntimeKey(page, options = {}) {\n  return routeDependencyPlan(page, options).runtimeKey;\n}`,
  "canonical route runtime cache key",
);
await writeFile(entryPath, entry);

console.log("Centralized route core/runtime dependency decisions in the generated app configuration.");
