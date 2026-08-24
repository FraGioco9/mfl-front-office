import { readFile, writeFile } from "node:fs/promises";

const validatorPath = new URL("./validate-static-route-ui.mjs", import.meta.url);
const before = `includes(tableLoading, "function show({ replaceExisting = false, forceRoute = false } = {}) {", "Table loading must remain available only after navigation commits.");`;
const after = `includes(tableLoading, "function show({", "Table loading must remain available only after navigation commits.");\nincludes(tableLoading, "preservePager = pagerPreservedDuringLoading(),", "Post-commit Table loading must own pager-preservation decisions instead of static route chrome.");`;

let source = await readFile(validatorPath, "utf8");
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error("Could not find the obsolete Table loading signature assertion.");
  source = source.replace(before, after);
  await writeFile(validatorPath, source);
}

console.log("Migrated static route pager validation ownership.");
