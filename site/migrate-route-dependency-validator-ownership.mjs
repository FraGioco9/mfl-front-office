// Temporary one-shot validator ownership migration; removed before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(root, path), "utf8")).replace(/\r\n?/g, "\n");
const write = async (path, source) => writeFile(resolve(root, path), source, "utf8");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

// validate.mjs: runtime script literals are now canonical app-config ownership.
{
  const path = "validate.mjs";
  let source = await read(path);
  source = replaceRequired(
    source,
    'const entry = await readSite("modules/app-entry.js");\nconst routeCoreLoader = await readSite("route-core-loader-runtime.js");',
    'const entry = await readSite("modules/app-entry.js");\nconst appConfig = await readSite("modules/app-config.js");\nconst routeCoreLoader = await readSite("route-core-loader-runtime.js");',
    "validate.mjs app-config source",
  );
  source = replaceRequired(
    source,
    'includes(entry, "\\\"/filter-controls-runtime.js\\\"", "app-entry.js must own route-scoped filter behavior.");\nincludes(entry, "\\\"/table-loading-runtime.js\\\"", "app-entry.js must load the canonical table-loading owner.");',
    'includes(appConfig, "\\\"/filter-controls-runtime.js\\\"", "Canonical app config must own route-scoped filter behavior.");\nincludes(appConfig, "\\\"/table-loading-runtime.js\\\"", "Canonical app config must own the table-loading dependency.");\nincludes(entry, "routeDependencyPlan(initialRouteRuntime.pageName, initialRouteRuntime.options).preCore", "app-entry.js must consume the canonical initial-route dependency plan.");',
    "validate.mjs route runtime ownership",
  );
  await write(path, source);
}

// validate-route-runtime.mjs: app-config owns route-specific groups; app-entry consumes the plan.
{
  const path = "validate-route-runtime.mjs";
  let source = await read(path);
  source = replaceRequired(
    source,
    'const entry = await read("./modules/app-entry.js");',
    'const entry = await read("./modules/app-entry.js");\nconst appConfig = await read("./modules/app-config.js");',
    "route-runtime app-config source",
  );
  const oldGroups = `for (const group of [
  "UNIVERSAL_RUNTIME_SCRIPTS",
  "TABLE_PRE_CORE_RUNTIME_SCRIPTS",
  "TABLE_POST_CORE_RUNTIME_SCRIPTS",
  "WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_PRE_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_POST_CORE_RUNTIME_SCRIPTS",
  "DATABASE_STATS_RUNTIME_SCRIPTS",
  "CHANGELOG_RUNTIME_SCRIPTS",
]) {
  includes(entry, \`const \${group}\`, \`app-entry.js must declare \${group}.\`);
}`;
  const newGroups = `includes(entry, "const UNIVERSAL_RUNTIME_SCRIPTS", "app-entry.js must retain the universal runtime group.");
includes(appConfig, "export const ROUTE_RUNTIME_SCRIPTS = Object.freeze({", "Canonical app config must own route-specific runtime groups.");
for (const group of [
  "tablePre:",
  "tablePost:",
  "watchlistMyPlayersPost:",
  "evaluationPre:",
  "evaluationPost:",
  "databaseStats:",
  "changelog:",
]) {
  includes(appConfig, group, \`Canonical app config must declare route runtime group \${group}.\`);
}
for (const retiredLocalOwner of [
  "TABLE_PRE_CORE_RUNTIME_SCRIPTS",
  "TABLE_POST_CORE_RUNTIME_SCRIPTS",
  "WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_PRE_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_POST_CORE_RUNTIME_SCRIPTS",
  "DATABASE_STATS_RUNTIME_SCRIPTS",
  "CHANGELOG_RUNTIME_SCRIPTS",
]) {
  excludes(entry, retiredLocalOwner, \`app-entry.js must not duplicate canonical route dependency ownership through \${retiredLocalOwner}.\`);
}`;
  source = replaceRequired(source, oldGroups, newGroups, "route-runtime group ownership");
  source = replaceRequired(
    source,
    'includes(entry, "preCoreScriptsForRoute", "Route-specific pre-core owners must be resolved explicitly.");\nincludes(entry, "postCoreScriptsForRoute", "Route-specific post-core owners must be resolved explicitly.");',
    'includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must resolve route-specific dependencies explicitly.");\nincludes(entry, "return routeConfig().routeDependencyPlan(pageName, options);", "app-entry.js must consume the canonical route dependency plan.");\nexcludes(entry, "function preCoreScriptsForRoute", "app-entry.js must not retain a second pre-core dependency resolver.");\nexcludes(entry, "function postCoreScriptsForRoute", "app-entry.js must not retain a second post-core dependency resolver.");',
    "route-runtime dependency resolver ownership",
  );
  source = replaceRequired(
    source,
    'includes(entry, "await loadScriptGroup(preCoreScriptsForRoute(page, options));\\n  await finalizeRouteRuntimeNow(page, options);", "Lazy SPA routes must still load their pre-core owners before finalization.");',
    'includes(entry, "await loadScriptGroup(plan.preCore);\\n  await finalizeRouteRuntimeNow(plan.pageName, options);", "Lazy SPA routes must load canonical pre-core dependencies before finalization.");\nincludes(entry, "await loadScriptGroup(plan.postCore);", "Route finalization must load canonical post-core dependencies.");\nincludes(entry, "return routeDependencyPlan(page, options).runtimeKey;", "Route runtime promise reuse must use the canonical dependency-plan cache key.");',
    "route-runtime plan execution",
  );
  source = replaceRequired(
    source,
    'includes(routeCoreLoader, \'evaluation: "/modules/app-core-evaluation-runtime.js"\', "The route-core loader must map Evaluation to its generated chunk.");\nincludes(routeCoreLoader, \'mflstats: "/modules/app-core-mfl-stats-runtime.js"\', "The route-core loader must map MFL Stats to its generated chunk.");',
    'includes(appConfig, \'evaluation: "/modules/app-core-evaluation-runtime.js"\', "Canonical app config must map Evaluation to its generated chunk.");\nincludes(appConfig, \'mflstats: "/modules/app-core-mfl-stats-runtime.js"\', "Canonical app config must map MFL Stats to its generated chunk.");\nincludes(routeCoreLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "Route-core loading must consume the canonical dependency plan.");\nexcludes(routeCoreLoader, "function routeCoreDependencies", "Route-core loading must not retain a duplicate dependency resolver.");',
    "route-runtime core-path ownership",
  );
  await write(path, source);
}

// validate-route-core-startup-routing.mjs: move dependency matrix assertions to app-config.
{
  const path = "validate-route-core-startup-routing.mjs";
  let source = await read(path);
  source = replaceRequired(
    source,
    'const routeCoreLoader = await read("./route-core-loader-runtime.js");',
    'const routeCoreLoader = await read("./route-core-loader-runtime.js");\nconst appConfig = await read("./modules/app-config.js");',
    "startup-routing app-config source",
  );
  const start = source.indexOf('includes(routeCoreLoader, "function routeCoreDependencies(pageName, options = {})"');
  const endMarker = 'includes(routeCoreLoader, "function preloadRouteCore(pageName) {",';
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end <= start) throw new Error("Missing startup route dependency assertion block.");
  const replacement = `includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must remain the central dependency owner.");
includes(appConfig, 'const table = tablePageSet.has(page) && !(page === "database" && view === "stats");', "Database Stats must continue to skip Table core/runtime infrastructure.");
includes(appConfig, 'if (page === "mflstats" || (page === "mfl" && view === "stats")) {', "MFL Stats routes must share one canonical dependency branch.");
includes(appConfig, 'core.push("table", "mflstats");', "MFL Stats must resolve Table before its dedicated Stats core.");
includes(appConfig, 'core.push("table", "club");', "Club startup must preserve ordered Table and Club route-core dependencies.");
includes(appConfig, 'core.push("table", "watchlist");', "Watchlist startup must preserve ordered Table and Watchlist route-core dependencies.");
includes(routeCoreLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "The route-core loader must consume canonical core dependencies.");
excludes(routeCoreLoader, "function routeCoreDependencies", "The route-core loader must not retain a second dependency owner.");
`;
  source = source.slice(0, start) + replacement + source.slice(end);
  await write(path, source);
}

// validate-club-entry-workflow.mjs: Club dependency ordering belongs to app-config.
{
  const path = "validate-club-entry-workflow.mjs";
  let source = await read(path);
  source = replaceRequired(
    source,
    'const [coreSource, routeLoader, appEntry, buildNormalizer] = await Promise.all([\n  read("./modules/app-core.js"),\n  read("./route-core-loader-runtime.js"),\n  read("./modules/app-entry.js"),\n  read("./modules/app-core-build-normalizer.js"),\n]);',
    'const [coreSource, routeLoader, appEntry, buildNormalizer, appConfig] = await Promise.all([\n  read("./modules/app-core.js"),\n  read("./route-core-loader-runtime.js"),\n  read("./modules/app-entry.js"),\n  read("./modules/app-core-build-normalizer.js"),\n  read("./modules/app-config.js"),\n]);',
    "club-entry app-config source",
  );
  source = replaceRequired(
    source,
    `includes(
  routeLoader,
  "function routeCoreDependencies(pageName, options = {})",
  "The route-core loader must remain the single route-core dependency owner.",
);
includes(
  routeLoader,
  'if (page === "club") return ["table", "club"];',
  "Club startup must preserve ordered Table and Club route-core dependencies.",
);`,
    `includes(
  appConfig,
  "function routeDependencyPlan(pageName, options = {})",
  "Canonical app config must remain the single route dependency owner.",
);
includes(
  appConfig,
  'core.push("table", "club");',
  "Club startup must preserve ordered Table and Club route-core dependencies.",
);
includes(
  routeLoader,
  "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;",
  "The route-core loader must consume the canonical Club dependency plan.",
);`,
    "club-entry dependency ownership",
  );
  await write(path, source);
}

// validate-club-route-core.mjs: same ownership move, keep all Club gate behavior assertions.
{
  const path = "validate-club-route-core.mjs";
  let source = await read(path);
  source = replaceRequired(
    source,
    `includes(routeLoader, 'if (page === "club") return ["table", "club"];', "Club navigation must resolve Table before the Club route owner.");
includes(routeLoader, "function routeCoreDependencies(pageName, options = {})", "The route-core loader must retain dependency composition ownership.");`,
    `includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must own route dependency composition.");
includes(appConfig, 'core.push("table", "club");', "Club navigation must resolve Table before the Club route owner.");
includes(routeLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "The route-core loader must consume canonical Club dependencies.");
excludes(routeLoader, "function routeCoreDependencies", "The route-core loader must not retain dependency composition ownership.");`,
    "club-route dependency ownership",
  );
  await write(path, source);
}

console.log("Updated route dependency ownership assertions across five validators.");
