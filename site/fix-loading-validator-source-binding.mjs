// Temporary one-shot validator binding fix; removed by its workflow.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "validate-loading-ownership.mjs");
let source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const beforeList = "const [styles, loadingStyles, bootstrapCore, appEntry, routeLoader, loadingUi, tableLoading] = await Promise.all([";
const afterList = "const [styles, loadingStyles, bootstrapCore, appEntry, routeLoader, loadingUi, tableLoading, appCoreSource] = await Promise.all([";
if (!source.includes(beforeList)) throw new Error("Missing loading validator source list.");
source = source.replace(beforeList, afterList);
const beforeReads = '  read("./loading-toast-runtime.js"),\n  read("./table-loading-runtime.js"),\n]);';
const afterReads = '  read("./loading-toast-runtime.js"),\n  read("./table-loading-runtime.js"),\n  read("./modules/app-core.js"),\n]);';
if (!source.includes(beforeReads)) throw new Error("Missing loading validator read list.");
source = source.replace(beforeReads, afterReads);
await writeFile(path, source);
console.log("Added canonical app-core source binding to loading ownership validator.");
