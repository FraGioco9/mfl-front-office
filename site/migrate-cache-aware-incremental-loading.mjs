// Temporary one-shot Step 3 migration; removed by its workflow before PR creation.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const write = (path, source) => writeFile(resolve(siteRoot, path), source, "utf8");

let bootstrap = await read("bootstrap-core.js");
let core = await read("modules/app-core.js");
let bootstrapValidator = await read("validate-bootstrap-ownership.mjs");
let loadingValidator = await read("validate-loading-ownership.mjs");

const requestLiteralPattern = /^\s*"requestIncrementalRoute",\n/gm;
const bootstrapRequestLiteralCount = (bootstrap.match(requestLiteralPattern) || []).length;
if (bootstrapRequestLiteralCount !== 2) {
  throw new Error(`Expected two bootstrap requestIncrementalRoute loading literals, found ${bootstrapRequestLiteralCount}.`);
}
bootstrap = bootstrap.replace(requestLiteralPattern, "");

const oldBusyBridge = '        const wrappedWithInteractionBusy = (callback) => run(callback, "interaction-loading");';
const newBusyBridge = '        const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => run(callback, reason);';
if (!bootstrap.includes(oldBusyBridge)) throw new Error("Missing withInteractionBusy bridge owner.");
bootstrap = bootstrap.replace(oldBusyBridge, newBusyBridge);

const oldIncrementalBoundary = `    if (incrementalRouteIsCached(route, 1)) return loadAndRender();\n    return withInteractionBusy(loadAndRender);`;
const newIncrementalBoundary = `    if (incrementalRouteIsCached(route, 1)) return loadAndRender();\n    return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);`;
if (!core.includes(oldIncrementalBoundary)) throw new Error("Missing cache-aware incremental request boundary.");
core = core.replace(oldIncrementalBoundary, newIncrementalBoundary);

for (const [name, source] of [["validate-bootstrap-ownership.mjs", bootstrapValidator], ["validate-loading-ownership.mjs", loadingValidator]]) {
  const count = (source.match(requestLiteralPattern) || []).length;
  if (count !== 1) throw new Error(`Expected one requestIncrementalRoute ownership expectation in ${name}, found ${count}.`);
}
bootstrapValidator = bootstrapValidator.replace(requestLiteralPattern, "");
loadingValidator = loadingValidator.replace(requestLiteralPattern, "");

const bootstrapAssertionMarker = `includes(\n  bootstrapCore,\n  "].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));",\n  "Every page/view transition and direct Watchlist switch must enter canonical route loading.",\n);`;
const bootstrapAssertions = `${bootstrapAssertionMarker}\nexcludes(\n  bootstrapCore,\n  '\"requestIncrementalRoute\",',\n  "Incremental route requests must not receive a blanket outer route-loading wrapper.",\n);\nincludes(\n  bootstrapCore,\n  'const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => run(callback, reason);',\n  "The shared busy bridge must preserve an explicitly requested canonical loading reason.",\n);\nincludes(\n  appCoreSource,\n  "if (incrementalRouteIsCached(route, 1)) return loadAndRender();",\n  "Cached incremental route requests must bypass the busy boundary.",\n);\nincludes(\n  appCoreSource,\n  'return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);',\n  "Uncached incremental route requests must enter the controller-owned route-loading reason.",\n);`;
if (!bootstrapValidator.includes(bootstrapAssertionMarker)) throw new Error("Missing bootstrap loading wrapper assertion marker.");
bootstrapValidator = bootstrapValidator.replace(bootstrapAssertionMarker, bootstrapAssertions);

const loadingAssertionMarker = `invariant(\n  !routeLoader.includes(".begin?.("),\n  "The route-core dependency loader must not own interaction loading state after navigation ownership is consolidated in app-entry.",\n);`;
const loadingAssertions = `${loadingAssertionMarker}\ninvariant(\n  !bootstrapCore.includes('\"requestIncrementalRoute\",'),\n  "Incremental requests must not be blanket-wrapped outside their cache-aware request owner.",\n);\ninvariant(\n  bootstrapCore.includes('const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => run(callback, reason);'),\n  "The shared interaction-busy bridge must preserve explicit loading reasons from cache-aware request owners.",\n);`;
if (!loadingValidator.includes(loadingAssertionMarker)) throw new Error("Missing loading ownership assertion marker.");
loadingValidator = loadingValidator.replace(loadingAssertionMarker, loadingAssertions);

await Promise.all([
  write("bootstrap-core.js", bootstrap),
  write("modules/app-core.js", core),
  write("validate-bootstrap-ownership.mjs", bootstrapValidator),
  write("validate-loading-ownership.mjs", loadingValidator),
]);

console.log("Migrated incremental route loading to its cache-aware request boundary.");
