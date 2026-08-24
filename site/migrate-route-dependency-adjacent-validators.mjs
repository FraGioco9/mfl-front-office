// Temporary one-shot adjacent validator ownership migration; removed before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(root, path), "utf8")).replace(/\r\n?/g, "\n");
const write = async (path, source) => writeFile(resolve(root, path), source, "utf8");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

{
  const path = "validate-watchlist-route-core.mjs";
  let source = await read(path);
  source = replaceRequired(
    source,
    'includes(appEntry, "const WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS = Object.freeze([", "Watchlist/My Players route coordination must remain shared between both pages.");\nincludes(appEntry, "if (routeNeedsWatchlist(page)) scripts.push(...WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS);", "Watchlist/My Players route coordination must still load on both pages.");',
    'includes(appConfig, "watchlistMyPlayersPost: Object.freeze([", "Watchlist/My Players route coordination must remain a canonical shared dependency group.");\nincludes(appConfig, \'const watchlist = page === "watchlist" || page === "myplayers";\', "The canonical route plan must classify both Watchlist and My Players for shared coordination.");\nincludes(appConfig, "if (watchlist) postCore.push(...data.routes.runtimeScripts.watchlistMyPlayersPost);", "Watchlist/My Players coordination must remain post-core on both pages.");\nincludes(appEntry, "await loadScriptGroup(plan.postCore);", "app-entry must consume canonical post-core Watchlist dependencies.");',
    "Watchlist post-core dependency ownership",
  );
  source = replaceRequired(
    source,
    'includes(routeLoader, \'if (page === "watchlist") return ["table", "watchlist"];\', "Watchlist routes must load Table before Watchlist UI ownership.");',
    'includes(appConfig, \'core.push("table", "watchlist");\', "Watchlist routes must load Table before Watchlist UI ownership.");\nincludes(routeLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "The route-core loader must consume canonical Watchlist dependencies.");',
    "Watchlist core dependency ownership",
  );
  await write(path, source);
}

{
  const path = "validate-database-stats-lazy-runtime.mjs";
  let source = await read(path);
  source = replaceRequired(
    source,
    'const entry = await read("./modules/app-entry.js");\nconst routeCoreLoader = await read("./route-core-loader-runtime.js");',
    'const entry = await read("./modules/app-entry.js");\nconst appConfig = await read("./modules/app-config.js");\nconst routeCoreLoader = await read("./route-core-loader-runtime.js");',
    "Database Stats app-config source",
  );
  source = replaceRequired(
    source,
    'const statsBlock = entry.match(/const DATABASE_STATS_RUNTIME_SCRIPTS = Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);/)?.[1] || "";',
    'const statsBlock = appConfig.match(/databaseStats: Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\),/)?.[1] || "";',
    "Database Stats canonical runtime group",
  );
  source = replaceRequired(
    source,
    `includes(
  entry,
  'return normalizeRoutePageName(pageName) === "database" && routeView(options) === "stats";',
  "Database Stats runtime loading must require the Stats view explicitly.",
);`,
    `includes(
  appConfig,
  'const databaseStats = page === "database" && view === "stats";',
  "Database Stats runtime loading must require the Stats view explicitly.",
);`,
    "Database Stats view classifier ownership",
  );
  source = replaceRequired(
    source,
    `includes(
  routeCoreLoader,
  'if (page === "database" && view === "stats") return [];',
  "Database Stats route-core dependency classification must preserve the canonical Stats view.",
);`,
    `includes(
  appConfig,
  'const table = tablePageSet.has(page) && !(page === "database" && view === "stats");',
  "Database Stats route-core dependency classification must preserve the canonical Stats view.",
);
includes(
  routeCoreLoader,
  "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;",
  "Database Stats route-core loading must consume the canonical dependency plan.",
);`,
    "Database Stats core dependency ownership",
  );
  await write(path, source);
}

console.log("Updated Watchlist and Database Stats route dependency ownership validators.");
