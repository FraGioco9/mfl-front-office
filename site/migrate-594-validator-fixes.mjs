import { readFile, writeFile } from "node:fs/promises";

const validateUrl = new URL("./validate.mjs", import.meta.url);
let source = await readFile(validateUrl, "utf8");

const buildAssertionBefore = 'includes(buildCore, "modules/app-core-runtime.js", "The core build must write the generated shared runtime artifact.");';
const buildAssertionAfter = 'includes(buildCore, \'runtime: "app-core-runtime.js"\', "The core build must write the generated shared runtime artifact.");';
if (!source.includes(buildAssertionBefore)) throw new Error("Source-owned core runtime build assertion was not found.");
source = source.replace(buildAssertionBefore, buildAssertionAfter);

const coreAliasBefore = "const coreSource = canonicalSharedCore;";
const coreAliasAfter = `const coreSource = [
  canonicalSharedCore,
  await readSite("modules/core-sources/evaluation.js"),
  await readSite("modules/core-sources/mfl-stats.js"),
  await readSite("modules/core-sources/club.js"),
  await readSite("modules/core-sources/settings.js"),
  await readSite("modules/core-sources/player.js"),
  await readSite("modules/core-sources/table.js"),
  await readSite("modules/core-sources/wallet.js"),
  await readSite("modules/core-sources/watchlist.js"),
].join("\\n");`;
if (!source.includes(coreAliasBefore)) throw new Error("Shared-core validator alias was not found.");
source = source.replace(coreAliasBefore, coreAliasAfter);

const legacyHeaderAssertion = 'includes(coreSource, "buildHeader.__mflSingleRenderOwner", "Canonical app-core must make buildHeader the single persistent header owner.");\n';
if (!source.includes(legacyHeaderAssertion)) throw new Error("Legacy monolith-only header assertion was not found.");
source = source.replace(legacyHeaderAssertion, "");
await writeFile(validateUrl, source, "utf8");

async function rewrite(path, replacements) {
  const url = new URL(`./${path}`, import.meta.url);
  let text = await readFile(url, "utf8");
  for (const [before, after, label] of replacements) {
    if (!text.includes(before)) throw new Error(`${path}: ${label} was not found.`);
    text = text.replace(before, after);
  }
  await writeFile(url, text, "utf8");
}

await rewrite("validate-settings-route-core.mjs", [
  [
    'includes(buildCore, \'const settingsRuntimePath = resolve(siteRoot, "modules/app-core-settings-runtime.js");\', "The build must emit a generated Settings runtime.");',
    'includes(buildCore, \'runtime: "app-core-settings-runtime.js"\', "The build must emit a generated Settings runtime.");',
    "Settings runtime build assertion",
  ],
  [
    'includes(buildCore, "artifacts.routeChunks?.settings", "The build must consume the Settings artifact.");',
    'includes(buildCore, \'source: "settings.js"\', "The build must consume the canonical Settings source.");',
    "Settings source build assertion",
  ],
  [
    'const settingsBanner = "// Generated Settings core chunk from modules/app-core.js. Do not edit directly.\\n";',
    'const settingsBanner = "// Generated Settings core from modules/core-sources/settings.js. Do not edit directly.\\n";',
    "Settings generated banner",
  ],
]);

await rewrite("validate-player-route-core.mjs", [
  [
    '  \'const playerRuntimePath = resolve(siteRoot, "modules/app-core-player-runtime.js");\',\n  "artifacts.routeChunks?.player",',
    '  \'runtime: "app-core-player-runtime.js"\',\n  \'source: "player.js"\',',
    "Player generated build assertions",
  ],
  [
    'const playerBanner = "// Generated Player core chunk from modules/app-core.js. Do not edit directly.\\n";',
    'const playerBanner = "// Generated Player core from modules/core-sources/player.js. Do not edit directly.\\n";',
    "Player generated banner",
  ],
]);

await rewrite("validate-watchlist-route-core.mjs", [
  [
    'includes(buildCore, \'const watchlistRuntimePath = resolve(siteRoot, "modules/app-core-watchlist-runtime.js");\', "The build must emit a generated Watchlist runtime.");',
    'includes(buildCore, \'runtime: "app-core-watchlist-runtime.js"\', "The build must emit a generated Watchlist runtime.");',
    "Watchlist runtime build assertion",
  ],
  [
    'includes(buildCore, "artifacts.routeChunks?.watchlist", "The build must consume the Watchlist artifact.");',
    'includes(buildCore, \'source: "watchlist.js"\', "The build must consume the canonical Watchlist source.");',
    "Watchlist source build assertion",
  ],
  [
    'const watchlistBanner = "// Generated Watchlist core chunk from modules/app-core.js. Do not edit directly.\\n";',
    'const watchlistBanner = "// Generated Watchlist core from modules/core-sources/watchlist.js. Do not edit directly.\\n";',
    "Watchlist generated banner",
  ],
]);
