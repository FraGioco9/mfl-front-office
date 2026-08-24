// Temporary one-shot validator migration; removed by its workflow.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "validate-bootstrap-ownership.mjs");
let source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const before = 'for (const name of ["setPage", "setView", "switchWatchlist", "ensureProgressionData", "requestIncrementalRoute"]) {';
const after = 'for (const name of ["setPage", "setView", "switchWatchlist", "ensureProgressionData"]) {';
if (!source.includes(before)) throw new Error("Missing obsolete unconditional incremental loading validator loop.");
source = source.replace(before, after);
await writeFile(path, source, "utf8");
console.log("Bootstrap validator now excludes cache-aware incremental requests from blanket wrapping.");
