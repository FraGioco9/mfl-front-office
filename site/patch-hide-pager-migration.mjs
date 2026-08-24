import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./migrate-hide-pager-during-loading.mjs", import.meta.url);
let source = await readFile(path, "utf8");

const showBefore = `    const body = forceRoute\\n      ? elements().body\\n      : prepareLoadingSurface();`;
const showAfter = `    const body = forceRoute\\n      ? elements().body\\n      : prepareLoadingSurface({ preservePager });`;
if (!source.includes(showBefore)) throw new Error("Could not find pager migration show-source match.");
source = source.replace(showBefore, showAfter);

const assertionBefore = `  \"View transitions must explicitly preserve the rendered pager while the destination view loads.\"\\n);`;
const assertionAfter = `  \"View transitions must explicitly preserve the rendered pager while the destination view loads.\",\\n);`;
if (!source.includes(assertionBefore)) throw new Error("Could not find pager migration validator assertion match.");
source = source.replace(assertionBefore, assertionAfter);

await writeFile(path, source);
console.log("Corrected Table loading and validator source matches in the one-time pager migration.");
