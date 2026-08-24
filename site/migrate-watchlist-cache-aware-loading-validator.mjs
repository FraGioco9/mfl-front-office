// Temporary one-shot validator migration; removed by its workflow.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "validate-watchlist-route-core.mjs");
let source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const before = 'for (const reason of ["setPage", "setView", "switchWatchlist", "route-runtime", "ensureProgressionData", "requestIncrementalRoute"]) {';
const after = 'for (const reason of ["setPage", "setView", "switchWatchlist", "route-runtime", "ensureProgressionData"]) {';
if (!source.includes(before)) throw new Error("Missing obsolete Watchlist incremental loading alias expectation.");
source = source.replace(before, after);
const marker = `includes(\n  bootstrapCore,\n  "return ROUTE_LOADING_ALIASES.has(normalizedReason) ? ROUTE_LOADING_REASON : normalizedReason;",\n  "Watchlist route aliases must publish only the canonical route-loading identity.",\n);`;
const replacement = `${marker}\nexcludes(\n  bootstrapCore,\n  '\"requestIncrementalRoute\",',\n  "Watchlist incremental requests must not receive a blanket outer route-loading wrapper.",\n);\nincludes(\n  coreSource,\n  "if (incrementalRouteIsCached(route, 1)) return loadAndRender();",\n  "Cached Watchlist incremental requests must reuse cached data without entering route loading.",\n);\nincludes(\n  coreSource,\n  'return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);',\n  "Uncached Watchlist incremental requests must still enter the controller-owned route-loading lifecycle.",\n);`;
if (!source.includes(marker)) throw new Error("Missing Watchlist route-loading ownership marker.");
source = source.replace(marker, replacement);
await writeFile(path, source, "utf8");
console.log("Watchlist loading validator now enforces the cache-aware incremental request boundary.");
