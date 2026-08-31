import { readFile, writeFile } from "node:fs/promises";

const url = new URL("./refactor-594-runtime-ownership.mjs", import.meta.url);
let source = await readFile(url, "utf8");

const replacements = [
  [
    '    const url = new URL(normalizedPath.replace(/^\\\\/+/, ""), \\\\`${"${window.location.origin}"}/\\\\`);',
    '    const url = new URL(normalizedPath.replace(/^\\\\/+/, ""), window.location.origin + "/");',
  ],
  [
    '        reject(new Error(\\\\`Could not load ${"${path}"}.\\\\`));',
    '        reject(new Error("Could not load " + path + "."));',
  ],
  [
    '    if (document.querySelector(\\\\`link[data-mfl-runtime-resource-preload="${"${href}"}"]\\\\`)) return;',
    '    if (document.querySelector(\'link[data-mfl-runtime-resource-preload="\' + href + \'"]\')) return;',
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error("Expected malformed helper fragment was not found: " + before);
  source = source.replace(before, after);
}

await writeFile(url, source, "utf8");
console.log("Issue 594 refactor helper quoting fixed.");
