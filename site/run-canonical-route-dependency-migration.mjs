// Temporary wrapper that fixes migration-source template escaping before execution.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const scriptPath = resolve(import.meta.dirname, "migrate-canonical-route-dependency-plan.mjs");
let source = String(await readFile(scriptPath, "utf8")).replace(/\r\n?/g, "\n");
const before = '${page}:\\${view === "stats" ? "stats" : "default"}';
const after = '\\${page}:\\${view === "stats" ? "stats" : "default"}';
if (!source.includes(before)) throw new Error("Missing routeRuntimeKey migration escape target.");
source = source.replace(before, after);
await writeFile(scriptPath, source);
await import(`./migrate-canonical-route-dependency-plan.mjs?fixed=${Date.now()}`);
