// Temporary one-shot migration for Club view splitter/loading ownership; removed by its workflow.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const read = async (relative) => String(await readFile(resolve(root, relative), "utf8")).replace(/\r\n?/g, "\n");
const write = async (relative, source) => writeFile(resolve(root, relative), source);

let core = await read("modules/app-core.js");
const loaderStart = core.indexOf("window.mflLoadIncrementalRoutePage = async function loadIncrementalRoutePage");
if (loaderStart < 0) throw new Error("Missing shared incremental route page loader.");
const loaderEnd = core.indexOf("\n  };", loaderStart);
if (loaderEnd < 0) throw new Error("Could not resolve shared incremental route page loader boundary.");
let loaderSection = core.slice(loaderStart, loaderEnd + 5);
const bareBusy = "return withInteractionBusy(loadAndRender);";
const explicitBusy = 'return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);';
if (loaderSection.includes(bareBusy)) {
  loaderSection = loaderSection.replace(bareBusy, explicitBusy);
  core = core.slice(0, loaderStart) + loaderSection + core.slice(loaderEnd + 5);
} else if (!loaderSection.includes(explicitBusy)) {
  throw new Error("Shared incremental route page loader has no recognized uncached loading boundary.");
}
await write("modules/app-core.js", core);

let chunks = await read("modules/app-core-route-chunks.js");
const oldClubLoadingMatch = `      await withInteractionBusy(loadClubData);\n      if (!dataPayload) return;`;
const newClubLoadingMatch = `      if (!dataRoute || incrementalRouteIsCached(dataRoute, 1)) {\n        await loadClubData();\n      } else {\n        await withInteractionBusy(loadClubData, Reflect.get(window, "__mflInteractionBusy")?.reason);\n      }\n      if (!dataPayload) return;`;
if (!chunks.includes(oldClubLoadingMatch)) throw new Error("Missing old Club splitter loading source match.");
chunks = chunks.replace(oldClubLoadingMatch, newClubLoadingMatch);
await write("modules/app-core-route-chunks.js", chunks);

let loadingValidator = await read("validate-loading-ownership.mjs");
const loadingAnchor = `invariant(\n  !bootstrapCore.includes('"setView",'),\n  "View transitions must not be blanket-wrapped outside their cache-aware transition owners.",\n);`;
const loadingAssertion = `${loadingAnchor}\ninvariant(\n  appCoreSource.includes('window.mflLoadIncrementalRoutePage = async function loadIncrementalRoutePage')\n    && appCoreSource.includes('return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);'),\n  "The shared incremental route-page loader must acquire canonical route loading only at its uncached request boundary.",\n);`;
if (!loadingValidator.includes(loadingAnchor)) throw new Error("Missing loading validator view-ownership anchor.");
loadingValidator = loadingValidator.replace(loadingAnchor, loadingAssertion);
await write("validate-loading-ownership.mjs", loadingValidator);

let watchlistValidator = await read("validate-watchlist-route-core.mjs");
const watchlistAnchor = `includes(\n  coreSource,\n  'await withInteractionBusy(loadClubData, Reflect.get(window, "__mflInteractionBusy")?.reason);',\n  "Uncached Club views must enter canonical route loading at the source-owned view boundary.",\n);`;
const watchlistAssertion = `${watchlistAnchor}\nincludes(\n  coreSource,\n  'return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);',\n  "The generated Club loader facade must preserve canonical route-loading ownership for uncached view data.",\n);`;
if (!watchlistValidator.includes(watchlistAnchor)) throw new Error("Missing Watchlist validator Club loading anchor.");
watchlistValidator = watchlistValidator.replace(watchlistAnchor, watchlistAssertion);
await write("validate-watchlist-route-core.mjs", watchlistValidator);

console.log("Updated Club structural split and shared cache-aware route loading ownership.");
