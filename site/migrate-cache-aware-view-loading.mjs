// Temporary one-shot migration for cache-aware view loading; removed by its workflow.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);

async function read(relative) {
  return String(await readFile(resolve(root, relative), "utf8")).replace(/\r\n?/g, "\n");
}

async function write(relative, source) {
  await writeFile(resolve(root, relative), source);
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing migration target: ${label}`);
  return source.replace(before, after);
}

let bootstrap = await read("bootstrap-core.js");
bootstrap = replaceRequired(
  bootstrap,
  '      "setPage",\n      "setView",\n      "switchWatchlist",',
  '      "setPage",\n      "switchWatchlist",',
  "setView route-loading alias",
);
bootstrap = replaceRequired(
  bootstrap,
  '        "setPage",\n        "setView",\n        "switchWatchlist",',
  '        "setPage",\n        "switchWatchlist",',
  "setView blanket loading wrapper",
);
await write("bootstrap-core.js", bootstrap);

let core = await read("modules/app-core.js");
core = replaceRequired(
  core,
  '      await withInteractionBusy(loadClubData);\n      if (!dataPayload) return;',
  '      if (!dataRoute || incrementalRouteIsCached(dataRoute, 1)) {\n        await loadClubData();\n      } else {\n        await withInteractionBusy(loadClubData, Reflect.get(window, "__mflInteractionBusy")?.reason);\n      }\n      if (!dataPayload) return;',
  "Club view cache-aware loading boundary",
);
await write("modules/app-core.js", core);

let bootstrapValidator = await read("validate-bootstrap-ownership.mjs");
bootstrapValidator = replaceRequired(
  bootstrapValidator,
  '  "startup",\n  "setPage",\n  "setView",\n  "switchWatchlist",',
  '  "startup",\n  "setPage",\n  "switchWatchlist",',
  "bootstrap validator setView legacy reason",
);
bootstrapValidator = replaceRequired(
  bootstrapValidator,
  'for (const name of ["setPage", "setView", "switchWatchlist", "ensureProgressionData"]) {',
  'for (const name of ["setPage", "switchWatchlist", "ensureProgressionData"]) {',
  "bootstrap validator blanket wrapper list",
);
bootstrapValidator = replaceRequired(
  bootstrapValidator,
  'excludes(\n  bootstrapCore,\n  \'"requestIncrementalRoute",\',\n  "Incremental route requests must not receive a blanket outer route-loading wrapper.",\n);',
  'excludes(\n  bootstrapCore,\n  \'"requestIncrementalRoute",\',\n  "Incremental route requests must not receive a blanket outer route-loading wrapper.",\n);\nexcludes(\n  bootstrapCore,\n  \'"setView",\',\n  "View transitions must not receive a blanket outer route-loading wrapper.",\n);',
  "bootstrap validator cache-aware view wrapper exclusion",
);
bootstrapValidator = replaceRequired(
  bootstrapValidator,
  'includes(\n  appCoreSource,\n  \'return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);\',\n  "Uncached incremental route requests must enter the controller-owned route-loading reason.",\n);',
  'includes(\n  appCoreSource,\n  \'return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);\',\n  "Uncached incremental route requests and table view transitions must enter the controller-owned route-loading reason.",\n);\nincludes(\n  appCoreSource,\n  "if (!dataRoute || incrementalRouteIsCached(dataRoute, 1)) {",\n  "Cached Club view transitions must bypass route loading.",\n);\nincludes(\n  appCoreSource,\n  \'await withInteractionBusy(loadClubData, Reflect.get(window, "__mflInteractionBusy")?.reason);\',\n  "Uncached Club view transitions must enter the controller-owned route-loading reason.",\n);',
  "bootstrap validator source-owned view loading assertions",
);
await write("validate-bootstrap-ownership.mjs", bootstrapValidator);

let loadingValidator = await read("validate-loading-ownership.mjs");
loadingValidator = replaceRequired(
  loadingValidator,
  '  "setPage",\n  "setView",\n  "switchWatchlist",',
  '  "setPage",\n  "switchWatchlist",',
  "loading validator setView alias",
);
loadingValidator = replaceRequired(
  loadingValidator,
  'invariant(\n  !bootstrapCore.includes(\'"requestIncrementalRoute",\'),\n  "Incremental requests must not be blanket-wrapped outside their cache-aware request owner.",\n);',
  'invariant(\n  !bootstrapCore.includes(\'"requestIncrementalRoute",\'),\n  "Incremental requests must not be blanket-wrapped outside their cache-aware request owner.",\n);\ninvariant(\n  !bootstrapCore.includes(\'"setView",\'),\n  "View transitions must not be blanket-wrapped outside their cache-aware transition owners.",\n);',
  "loading validator setView wrapper exclusion",
);
await write("validate-loading-ownership.mjs", loadingValidator);

let watchlistValidator = await read("validate-watchlist-route-core.mjs");
watchlistValidator = replaceRequired(
  watchlistValidator,
  'for (const reason of ["setPage", "setView", "switchWatchlist", "route-runtime", "ensureProgressionData"]) {',
  'for (const reason of ["setPage", "switchWatchlist", "route-runtime", "ensureProgressionData"]) {',
  "Watchlist validator setView alias",
);
watchlistValidator = replaceRequired(
  watchlistValidator,
  'includes(\n  bootstrapCore,\n  "].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));",\n  "The global loading bridge must wrap direct Watchlist switches as well as page and view owners with route loading.",\n);',
  'includes(\n  bootstrapCore,\n  "].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));",\n  "The global loading bridge must wrap direct Watchlist switches and remaining page owners with route loading.",\n);\nexcludes(\n  bootstrapCore,\n  \'"setView",\',\n  "Watchlist view transitions must use cache-aware source ownership instead of a blanket loading wrapper.",\n);\nincludes(\n  coreSource,\n  "if (!dataRoute || incrementalRouteIsCached(dataRoute, 1)) {",\n  "Cached Club views must bypass route loading at the source-owned view boundary.",\n);\nincludes(\n  coreSource,\n  \'await withInteractionBusy(loadClubData, Reflect.get(window, "__mflInteractionBusy")?.reason);\',\n  "Uncached Club views must enter canonical route loading at the source-owned view boundary.",\n);',
  "Watchlist validator cache-aware view ownership",
);
await write("validate-watchlist-route-core.mjs", watchlistValidator);

console.log("Migrated cache-aware view loading ownership and validators.");
