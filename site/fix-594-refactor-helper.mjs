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
  ['  "modules/app-core-build-normalizer.js",\n', ''],
  ['  "modules/app-core-evaluation-chunk.js",\n', ''],
  ['  "modules/app-core-player-chunk.js",\n', ''],
  ['  "modules/app-core-route-chunks.js",\n', ''],
  ['  "modules/app-core-settings-chunk.js",\n', ''],
  ['  "modules/app-core-splitter-utils.js",\n', ''],
  ['  "modules/app-core-stats-route-ownership.js",\n', ''],
  ['  "modules/app-core-table-chunk.js",\n', ''],
  ['  "modules/app-core-wallet-chunk.js",\n', ''],
  ['  "modules/app-core-watchlist-route-chunk.js",\n', ''],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error("Expected helper fragment was not found: " + before);
  source = source.replace(before, after);
}

await writeFile(url, source, "utf8");

const joinedAgencyUrl = new URL("./validate-progression-joined-agency-filter.mjs", import.meta.url);
let joinedAgencySource = await readFile(joinedAgencyUrl, "utf8");
const retiredJoinedAgencyRead = 'const app = readFileSync(new URL("./modules/app-core.js", import.meta.url), "utf8");';
const canonicalJoinedAgencyRead = `const app = [
  "./modules/core-sources/shared.js",
  "./modules/core-sources/evaluation.js",
  "./modules/core-sources/mfl-stats.js",
  "./modules/core-sources/club.js",
  "./modules/core-sources/settings.js",
  "./modules/core-sources/player.js",
  "./modules/core-sources/table.js",
  "./modules/core-sources/wallet.js",
  "./modules/core-sources/watchlist.js",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\\n");`;
if (joinedAgencySource.includes(retiredJoinedAgencyRead)) {
  joinedAgencySource = joinedAgencySource.replace(retiredJoinedAgencyRead, canonicalJoinedAgencyRead);
  await writeFile(joinedAgencyUrl, joinedAgencySource, "utf8");
} else if (!joinedAgencySource.includes("./modules/core-sources/shared.js")) {
  throw new Error("Expected Joined Agency validator read was not found.");
}

console.log("Issue 594 staged runtime ownership refactor is ready for Global Search validation.");
