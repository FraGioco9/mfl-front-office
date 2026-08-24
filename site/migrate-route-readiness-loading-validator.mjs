// Temporary one-shot validator migration; remove after the route-readiness validator commit.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const path = resolve(root, "validate-loading-ownership.mjs");
const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const before = `invariant(\n  bootstrapCore.includes('const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => run(callback, reason);'),\n  "The shared interaction-busy bridge must preserve explicit loading reasons from cache-aware request owners.",\n);`;
const after = `invariant(\n  bootstrapCore.includes('const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => {')\n    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")\n    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();")\n    && bootstrapCore.includes("return run(callback, normalizedReason);"),\n  "The shared interaction-busy bridge must preserve explicit reasons while reusing an active canonical route-loading lifecycle.",\n);`;
if (!source.includes(before)) throw new Error("Missing stale interaction-busy bridge validator assertion.");
await writeFile(path, source.replace(before, after));
console.log("Updated route-readiness loading validator ownership assertion.");
