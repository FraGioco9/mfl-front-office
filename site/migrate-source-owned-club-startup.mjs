// Temporary one-shot Club startup source migration; remove before merge after the source rewrite commits.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

const lifecycle = await read("modules/app-core-club-startup-lifecycle.js");
function constantValue(name) {
  const marker = `const ${name} = `;
  const markerIndex = lifecycle.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing Club startup constant ${name}.`);
  const start = markerIndex + marker.length;
  const quote = lifecycle[start];
  if (quote !== "`" && quote !== '"' && quote !== "'") throw new Error(`Unsupported literal for ${name}.`);
  let raw = "";
  for (let index = start + 1; index < lifecycle.length; index += 1) {
    const char = lifecycle[index];
    if (char === "\\") {
      raw += char + lifecycle[index + 1];
      index += 1;
      continue;
    }
    if (char === quote) return Function(`"use strict"; return ${quote}${raw}${quote};`)();
    raw += char;
  }
  throw new Error(`Unterminated literal for ${name}.`);
}

const directReplacements = [
  ["CLUB_TITLE_READY_CALLBACK", "VERIFIED_CLUB_TITLE_READY_CALLBACK"],
  ["BLOCKING_TITLE_SETTLEMENT", "ROSTER_OWNED_TITLE_SETTLEMENT"],
  ["CLUB_FINAL_RENDER", "CLUB_FINAL_ROSTER_RENDER"],
  ["CLUB_APPLY_FILTER_OVERRIDE", null],
  ["RESTORE_STANDARD_CONTROLS", null],
  ["GENERIC_PREPARE_SAVED_PAGE_STATE", "CLUB_FREE_PREPARE_SAVED_PAGE_STATE"],
  ["GENERIC_INCREMENTAL_LOADING_FILTERS", "CLUB_FREE_INCREMENTAL_LOADING_FILTERS"],
  ["GENERIC_INCREMENTAL_PAYLOAD_RENDER", "CLUB_OWNED_INCREMENTAL_PAYLOAD_RENDER"],
  ["GENERIC_TABLE_LOADING_SHELL", "CLUB_AWARE_TABLE_LOADING_SHELL"],
  ["TABLE_CONTROL_SYNC_START", "CLUB_FREE_TABLE_CONTROL_SYNC_START"],
];

let core = await read("modules/app-core.js");
for (const [beforeName, afterName] of directReplacements) {
  core = replaceRequired(
    core,
    constantValue(beforeName),
    afterName ? constantValue(afterName) : "",
    `${beforeName} canonical source ownership`,
  );
}

const tableRestoreBefore = constantValue("TABLE_RESTORE_START").replace("tableRestoreSavedTableStateOwner", "restoreSavedTableState");
const tableRestoreAfter = constantValue("CLUB_FREE_TABLE_RESTORE_START").replace("tableRestoreSavedTableStateOwner", "restoreSavedTableState");
core = replaceRequired(core, tableRestoreBefore, tableRestoreAfter, "Club-free canonical table-state restore");

const tableApplyBefore = constantValue("TABLE_APPLY_FILTER_START").replace("tableApplyFiltersOwner", "applyFilters");
const tableApplyAfter = constantValue("CLUB_FILTER_FREE_TABLE_APPLY_START").replace("tableApplyFiltersOwner", "applyFilters");
core = replaceRequired(core, tableApplyBefore, tableApplyAfter, "Club filter-free canonical table render");

await writeFile(resolve(siteRoot, "modules/app-core.js"), core);

let build = await read("modules/app-core-build-normalizer.js");
build = replaceRequired(
  build,
  'import { normalizeClubStartupLifecycle } from "./app-core-club-startup-lifecycle.js";\n',
  "",
  "Club startup normalizer import",
);
build = replaceRequired(
  build,
  `  const watchlistArtifacts = splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);
  const clubStartupArtifacts = normalizeClubStartupLifecycle(watchlistArtifacts);
  const clubSortArtifacts = normalizeClubSortLifecycle(clubStartupArtifacts);`,
  `  const watchlistArtifacts = splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);
  const clubSortArtifacts = normalizeClubSortLifecycle(watchlistArtifacts);`,
  "Club startup build stage",
);
await writeFile(resolve(siteRoot, "modules/app-core-build-normalizer.js"), build);
await rm(resolve(siteRoot, "modules/app-core-club-startup-lifecycle.js"));

console.log("Moved 12 Club startup transformations into canonical source ownership.");
