// Temporary one-shot source correction; removed by its workflow before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "modules/app-config.js");
let source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const before = '      runtimeKey: `\\${page}:\\${view === "stats" ? "stats" : "default"}`,';
const after = '      runtimeKey: page + ":" + (view === "stats" ? "stats" : "default"),';
if (!source.includes(before)) throw new Error("Missing generated route runtime-key syntax target.");
source = source.replace(before, after);
await writeFile(path, source, "utf8");
console.log("Replaced nested generated route runtime-key template with concatenation.");
