import { readFile, writeFile } from "node:fs/promises";

const validatorPath = new URL("./validate-generated-view-transition.mjs", import.meta.url);
const before = `const request = incrementalView.indexOf("requestIncrementalRoute(route, 1)", stagedTake);`;
const after = `const request = incrementalView.indexOf("requestIncrementalRoute(route, 1, { preservePager: true })", stagedTake);`;

let source = await readFile(validatorPath, "utf8");
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error("Could not find the obsolete incremental view request assertion.");
  source = source.replace(before, after);
  await writeFile(validatorPath, source);
}

console.log("Migrated generated view pager validation.");
