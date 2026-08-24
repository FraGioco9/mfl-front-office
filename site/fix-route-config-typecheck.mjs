// Temporary one-shot typecheck correction; removed by its workflow before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "modules/app-entry.js");
let source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const before = '  const routes = window.__mflAppConfig?.routes;';
const after = '  const routes = Reflect.get(window, "__mflAppConfig")?.routes;';
if (!source.includes(before)) throw new Error("Missing routeConfig direct Window lookup.");
source = source.replace(before, after);
await writeFile(path, source, "utf8");
console.log("Route config lookup now uses the typed reflection path.");
