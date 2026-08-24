// Temporary one-shot bootstrap validator migration; removed by its workflow before commit.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const path = resolve(root, "validate-bootstrap-ownership.mjs");
let source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");

const oldWrapperBlock = `for (const name of ["setPage", "switchWatchlist", "ensureProgressionData"]) {\n  includes(\n    bootstrapCore,\n    \`"\${name}"\`,\n    \`The Uniform Loading Workflow must wrap \${name} regardless of cache state.\`,\n  );\n}\nincludes(\n  bootstrapCore,\n  "].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));",\n  "Every page/view transition and direct Watchlist switch must enter canonical route loading.",\n);`;
const newWrapperBlock = `for (const name of ["switchWatchlist", "ensureProgressionData"]) {\n  includes(\n    bootstrapCore,\n    \`"\${name}"\`,\n    \`The remaining direct route-data owner \${name} must retain canonical route loading until its cache contract is migrated.\`,\n  );\n}\nincludes(\n  bootstrapCore,\n  "function routeDestinationReady(pageName, options = {}) {",\n  "The Uniform Loading Workflow must own one full destination-readiness predicate.",\n);\nincludes(\n  bootstrapCore,\n  "wrapRoutePageGlobal();",\n  "Page transitions must install the readiness-aware setPage loading owner.",\n);\nincludes(\n  bootstrapCore,\n  "if (routeDestinationReady(pageName, options) || routeLoadingActive()) {",\n  "Fully ready page destinations and nested page transitions must bypass duplicate route loading.",\n);\nincludes(\n  bootstrapCore,\n  "].forEach((name) => wrapBusyGlobal(name, ROUTE_LOADING_REASON));",\n  "Direct Watchlist/progression data owners must retain canonical route loading until their cache contracts are migrated.",\n);`;
if (!source.includes(oldWrapperBlock)) throw new Error("Missing stale blanket setPage wrapper validator block.");
source = source.replace(oldWrapperBlock, newWrapperBlock);

const oldBridge = `includes(\n  bootstrapCore,\n  'const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => run(callback, reason);',\n  "The shared busy bridge must preserve an explicitly requested canonical loading reason.",\n);`;
const newBridge = `includes(\n  bootstrapCore,\n  'const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => {',\n  "The shared busy bridge must retain explicit reason ownership.",\n);\nincludes(\n  bootstrapCore,\n  "if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();",\n  "Nested canonical route-loading owners must reuse the active page-transition lifecycle instead of stacking tokens.",\n);\nincludes(\n  bootstrapCore,\n  "return run(callback, normalizedReason);",\n  "Non-duplicate explicit loading reasons must still enter the shared busy controller.",\n);`;
if (!source.includes(oldBridge)) throw new Error("Missing stale shared busy bridge validator block.");
source = source.replace(oldBridge, newBridge);

await writeFile(path, source);
console.log("Updated readiness-aware bootstrap loading validator assertions.");
