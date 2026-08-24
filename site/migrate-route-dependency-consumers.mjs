// Temporary one-shot Step 2 migration; removed by its workflow before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(root, path), "utf8")).replace(/\r\n?/g, "\n");
const write = async (path, source) => writeFile(resolve(root, path), source, "utf8");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};
const replaceFunction = (source, signature, replacement, label) => {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing ${label}.`);
  const end = source.indexOf("\n}\n", start);
  if (end < 0) throw new Error(`Missing end of ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end + 3);
};

// route-core-loader-runtime.js: consume canonical routeDependencyPlan for core ordering.
let loader = await read("route-core-loader-runtime.js");
loader = replaceRequired(
  loader,
  "   *     initialRequest?: (pathname?: string) => { pageName: string, options: Record<string, unknown> },",
  "   *     initialRequest?: (pathname?: string) => { pageName: string, options: Record<string, unknown> },\n   *     routeDependencyPlan?: (pageName: string, options?: Record<string, unknown>) => { core: readonly string[] },",
  "route-core routeDependencyPlan type",
);
loader = replaceRequired(
  loader,
  "    || typeof routeConfig.initialRequest !== \"function\") {",
  "    || typeof routeConfig.initialRequest !== \"function\"\n    || typeof routeConfig.routeDependencyPlan !== \"function\") {",
  "route-core canonical config requirement",
);
const dependencyFunction = `  function routeCoreDependencies(pageName, options = {}) {
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
loader = replaceRequired(loader, dependencyFunction, "", "local route-core dependency tree");
loader = replaceRequired(
  loader,
  "  async function ensure(pageName, options = {}) {\n    const dependencies = routeCoreDependencies(pageName, options);",
  "  async function ensure(pageName, options = {}) {\n    const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;",
  "route-core canonical dependency consumption",
);
await write("route-core-loader-runtime.js", loader);

// app-entry.js: keep universal scripts local, consume canonical route plan for route-specific owners.
let entry = await read("modules/app-entry.js");
const groupsStart = entry.indexOf("const TABLE_PRE_CORE_RUNTIME_SCRIPTS = Object.freeze([");
const groupsEnd = entry.indexOf("const initialPathname =", groupsStart);
if (groupsStart < 0 || groupsEnd <= groupsStart) throw new Error("Missing route-specific runtime script groups.");
entry = entry.slice(0, groupsStart) + entry.slice(groupsEnd);

const helpersStart = entry.indexOf("/** @param {string} pageName */\nfunction normalizeRoutePageName");
const helpersEnd = entry.indexOf("function initialRouteRuntimeRequest()", helpersStart);
if (helpersStart < 0 || helpersEnd <= helpersStart) throw new Error("Missing local route dependency helpers.");
const canonicalHelpers = `function routeConfig() {
  const routes = window.__mflAppConfig?.routes;
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

`;
entry = entry.slice(0, helpersStart) + canonicalHelpers + entry.slice(helpersEnd);

entry = replaceFunction(
  entry,
  "function initialRouteRuntimeRequest() {",
  `function initialRouteRuntimeRequest() {
  const request = routeConfig().initialRequest(initialPathname);
  const options = request?.options && typeof request.options === "object" && !Array.isArray(request.options)
    ? request.options
    : {};
  return { pageName: normalizeRoutePageName(request?.pageName), options };
}`,
  "initialRouteRuntimeRequest",
);
entry = replaceRequired(
  entry,
  "  ...preCoreScriptsForRoute(initialRouteRuntime.pageName, initialRouteRuntime.options),",
  "  ...routeDependencyPlan(initialRouteRuntime.pageName, initialRouteRuntime.options).preCore,",
  "initial route pre-core plan",
);
entry = replaceFunction(
  entry,
  "async function finalizeRouteRuntimeNow(page, options = {}) {",
  `async function finalizeRouteRuntimeNow(page, options = {}) {
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
}`,
  "finalizeRouteRuntimeNow",
);
entry = replaceFunction(
  entry,
  "async function ensureRouteRuntimeNow(pageName, options = {}) {",
  `async function ensureRouteRuntimeNow(pageName, options = {}) {
  const plan = routeDependencyPlan(pageName, options);
  await loadScriptGroup(plan.preCore);
  await finalizeRouteRuntimeNow(plan.pageName, options);
}`,
  "ensureRouteRuntimeNow",
);
entry = replaceFunction(
  entry,
  "function routeRuntimeKey(page, options = {}) {",
  `function routeRuntimeKey(page, options = {}) {
  return routeDependencyPlan(page, options).runtimeKey;
}`,
  "routeRuntimeKey",
);
await write("modules/app-entry.js", entry);

console.log("Route core and runtime consumers now share the canonical route dependency plan.");
