// Temporary one-shot validator migration; removed by its workflow before commit.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const files = [
  "validate-filter-popup-interactions.mjs",
  "validate-table-filter-selection-lifecycle.mjs",
];
const before = 'const storedPageState = !clubTarget && tablePages.has(pageName)';
const after = 'const storedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)';

for (const relative of files) {
  const path = resolve(root, relative);
  const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
  if (!source.includes(before)) throw new Error(`Missing stale Club stored-state assertion in ${relative}.`);
  await writeFile(path, source.replace(before, after));
}

console.log("Updated Club saved-table-state source assertions.");
