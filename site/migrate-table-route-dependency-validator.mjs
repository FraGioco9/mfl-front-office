// Temporary one-shot Table route dependency validator migration; removed before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "validate-table-route-core.mjs");
let source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const before = `includes(appConfig, 'table: "/modules/app-core-table-runtime.js"', "Canonical app config must map the Table chunk.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "The route-core loader must consume canonical route-core paths.");
includes(routeLoader, 'if (page === "club") return ["table", "club"];', "Club must load the Table core before the Club core.");
includes(routeLoader, 'if (page === "database" && view === "stats") return [];', "Database Stats must not load the Table core.");
includes(routeLoader, 'if (page === "mfl" && view === "stats") return ["table", "mflstats"];', "MFL Stats must load the shared Table core before its route renderer.");
includes(routeLoader, 'if (page === "mflstats") return ["table", "mflstats"];', "The internal MFL Stats route alias must retain the same Table-first dependency order.");
includes(routeLoader, "for (const dependency of dependencies)", "Route-core dependencies must execute in declared order.");

const routeNeedsTableStart = appEntry.indexOf("function routeNeedsTable(pageName, options = {}) {");
const routeNeedsTableEnd = appEntry.indexOf("function routeNeedsWatchlist(pageName)", routeNeedsTableStart);
invariant(routeNeedsTableStart >= 0 && routeNeedsTableEnd > routeNeedsTableStart, "app-entry must retain a stable Table runtime decision facade.");
const routeNeedsTableSection = appEntry.slice(routeNeedsTableStart, routeNeedsTableEnd);
includes(routeNeedsTableSection, 'Reflect.get(window, "__mflRouteUsesTableInfrastructure")', "app-entry must reuse central table-route membership.");
excludes(routeNeedsTableSection, '["mfl", "agents", "progression", "watchlist", "myplayers", "club"]', "app-entry must not duplicate the table-capable page list.");`;
const after = `includes(appConfig, 'table: "/modules/app-core-table-runtime.js"', "Canonical app config must map the Table chunk.");
includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must own Table route dependency decisions.");
includes(appConfig, 'core.push("table", "club");', "Club must load the Table core before the Club core.");
includes(appConfig, 'const table = tablePageSet.has(page) && !(page === "database" && view === "stats");', "Database Stats must not load the Table core.");
includes(appConfig, 'if (page === "mflstats" || (page === "mfl" && view === "stats")) {', "MFL Stats and its internal alias must share the same canonical Table-first dependency branch.");
includes(appConfig, 'core.push("table", "mflstats");', "MFL Stats must load the shared Table core before its route renderer.");
includes(routeLoader, "const ROUTE_CORE_PATHS = routeConfig.corePaths;", "The route-core loader must consume canonical route-core paths.");
includes(routeLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "The route-core loader must consume canonical Table dependencies.");
includes(routeLoader, "for (const dependency of dependencies)", "Route-core dependencies must execute in declared order.");
excludes(routeLoader, "function routeCoreDependencies", "The route-core loader must not duplicate Table dependency decisions.");

includes(appEntry, "function routeDependencyPlan(pageName, options = {})", "app-entry must retain a stable canonical route dependency facade.");
includes(appEntry, "return routeConfig().routeDependencyPlan(pageName, options);", "app-entry must reuse canonical Table route membership and runtime decisions.");
excludes(appEntry, "function routeNeedsTable", "app-entry must not retain a duplicate Table runtime decision facade.");`;
if (!source.includes(before)) throw new Error("Missing Table route dependency ownership assertion block.");
source = source.replace(before, after);
await writeFile(path, source, "utf8");
console.log("Updated Table route dependency ownership validation.");
