import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./validate-loading-ownership.mjs", import.meta.url);
let source = await readFile(path, "utf8");

const before = `invariant(\n  !loadingStyles.includes("html.mflNavigationPending #progressionPage nav.pager"),\n  "Pager loading visibility must be owned by the table loading runtime, not blanket navigation/busy CSS.",\n);`;
const after = `invariant(\n  loadingStyles.includes("html.mflNavigationPending #progressionPage nav.pager")\n    && !loadingStyles.includes("html.mflInteractionBusy #progressionPage nav.pager"),\n  "Table view navigation must hide nav.pager immediately while the Table runtime keeps it hidden through active data loading, without restoring global interaction-busy ownership.",\n);`;

const index = source.indexOf(before);
if (index < 0) throw new Error("Could not find the pager navigation ownership assertion.");
if (source.indexOf(before, index + before.length) >= 0) throw new Error("Found duplicate pager navigation ownership assertions.");
source = source.slice(0, index) + after + source.slice(index + before.length);
await writeFile(path, source);
console.log("Updated pager navigation/loading ownership validation.");
