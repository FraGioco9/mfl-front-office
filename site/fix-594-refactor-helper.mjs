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
  [
    '    const loader = new Promise((resolve, reject) => {',
    '    /** @type {Promise<void>} */\n    const loader = new Promise((resolve, reject) => {',
  ],
  [
    '  window.__mflRuntimeResources = Object.freeze({\n    load: loadRuntime,\n    loadGroup: loadRuntimeGroup,\n    preload: preloadRuntime,\n    url: runtimeResourceUrl,\n  });',
    '  Reflect.set(window, "__mflRuntimeResources", Object.freeze({\n    load: loadRuntime,\n    loadGroup: loadRuntimeGroup,\n    preload: preloadRuntime,\n    url: runtimeResourceUrl,\n  }));',
  ],
  [
    '  const resources = window.__mflRuntimeResources;',
    '  const resources = Reflect.get(window, "__mflRuntimeResources");',
  ],
  [
    '    const loader = runtimeWindow.__mflRuntimeResources;',
    '    const loader = Reflect.get(runtimeWindow, "__mflRuntimeResources");',
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error("Expected helper fragment was not found: " + before);
  source = source.replace(before, after);
}

await writeFile(url, source, "utf8");
console.log("Issue 594 refactor helper is ready for runtime ownership validation.");
