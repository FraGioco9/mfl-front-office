import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./migrate-hide-pager-during-loading.mjs", import.meta.url);
let source = await readFile(path, "utf8");
const before = `    const body = forceRoute\\n      ? elements().body\\n      : prepareLoadingSurface();`;
const after = `    const body = forceRoute\\n      ? elements().body\\n      : prepareLoadingSurface({ preservePager });`;
if (!source.includes(before)) throw new Error("Could not find pager migration show-source match.");
source = source.replace(before, after);
await writeFile(path, source);
console.log("Corrected the Table loading show-source match in the one-time pager migration.");
