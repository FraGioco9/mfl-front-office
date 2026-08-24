// Temporary one-shot Club sort source migration; removed before merge.
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

const lifecycle = await read("modules/app-core-club-sort-lifecycle.js");
function constantValue(name) {
  const marker = `const ${name} = `;
  const markerIndex = lifecycle.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing Club sort constant ${name}.`);
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

const replacements = [
  ["CLUB_PREPARE_SHARED_SORT", "CLUB_PREPARE_LOCAL_SORT"],
  ["ROUTE_GATE_RUNTIME_READY", "ROUTE_GATE_RUNTIME_READY_WITH_STATE"],
  ["ROUTE_GATE_COMMITTED_OPTIONS", "ROUTE_GATE_COMMITTED_OPTIONS_WITH_STATE"],
  ["ROUTE_GATE_TRANSITION_OWNER", "ROUTE_GATE_TRANSITION_OWNER_WITH_STATE"],
  ["TOP_LEVEL_PREVIOUS_TABLE_SAVE", "TOP_LEVEL_PREVIOUS_TABLE_SAVE_GUARDED"],
  ["INCREMENTAL_PREVIOUS_TABLE_SAVE", "INCREMENTAL_PREVIOUS_TABLE_SAVE_GUARDED"],
  ["CLUB_CACHE_SHARED_SORT", "CLUB_CACHE_LOCAL_SORT"],
  ["CLUB_TRANSITION_SHARED_SORT", "CLUB_TRANSITION_LOCAL_SORT"],
  ["CLUB_RENDER_SHARED_SORT", "CLUB_RENDER_LOCAL_SORT"],
  ["CLUB_RESTORE_SHARED_SORT", "CLUB_RESTORE_LOCAL_SORT"],
  ["GENERIC_HEADER_SORT_STATE", "CLUB_AWARE_HEADER_SORT_STATE"],
  ["GENERIC_HEADER_SORT_CONTROL", "CLUB_AWARE_HEADER_SORT_CONTROL"],
];

let core = await read("modules/app-core.js");
for (const [beforeName, afterName] of replacements) {
  core = replaceRequired(core, constantValue(beforeName), constantValue(afterName), `${beforeName} source ownership`);
}
await writeFile(resolve(siteRoot, "modules/app-core.js"), core);

let build = await read("modules/app-core-build-normalizer.js");
build = replaceRequired(
  build,
  'import { normalizeClubSortLifecycle } from "./app-core-club-sort-lifecycle.js";\n',
  "",
  "Club sort normalizer import",
);
build = replaceRequired(
  build,
  `  const watchlistArtifacts = splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);\n  const clubSortArtifacts = normalizeClubSortLifecycle(watchlistArtifacts);\n  return clubSortArtifacts;`,
  `  const watchlistArtifacts = splitWatchlistRouteApplicationCoreRuntime(walletArtifacts);\n  return watchlistArtifacts;`,
  "Club sort build stage",
);
await writeFile(resolve(siteRoot, "modules/app-core-build-normalizer.js"), build);
await rm(resolve(siteRoot, "modules/app-core-club-sort-lifecycle.js"));

const validatorNames = (await readdir(siteRoot)).filter((name) => /^validate.*\.mjs$/.test(name));
for (const name of validatorNames) {
  const path = resolve(siteRoot, name);
  let source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
  const original = source;
  source = source.replaceAll("return clubSortArtifacts;", "return watchlistArtifacts;");
  source = source.replaceAll(
    "const clubSortArtifacts = normalizeClubSortLifecycle(watchlistArtifacts);",
    "return watchlistArtifacts;",
  );
  source = source.replaceAll(
    "Club sorting must consume the structural watchlist artifacts directly after Club entry and startup become source-owned.",
    "Build composition must return the structural watchlist artifacts directly after Club sort becomes source-owned.",
  );
  if (source !== original) await writeFile(path, source);
}

const clubEntryPath = resolve(siteRoot, "validate-club-entry-workflow.mjs");
let clubEntry = String(await readFile(clubEntryPath, "utf8")).replace(/\r\n?/g, "\n");
clubEntry = replaceRequired(
  clubEntry,
  `excludes(\n  buildNormalizer,\n  "clubStartupArtifacts",\n  "Build composition must not retain an intermediate Club startup rewrite artifact.",\n);\nincludes(`,
  `excludes(\n  buildNormalizer,\n  "clubStartupArtifacts",\n  "Build composition must not retain an intermediate Club startup rewrite artifact.",\n);\nexcludes(\n  buildNormalizer,\n  "normalizeClubSortLifecycle",\n  "Build normalization must not rewrite source-owned Club sort behavior.",\n);\nexcludes(\n  buildNormalizer,\n  "clubSortArtifacts",\n  "Build composition must not retain an intermediate Club sort rewrite artifact.",\n);\nincludes(`,
  "Club entry sort ownership assertions",
);
await writeFile(clubEntryPath, clubEntry);

const sortingPath = resolve(siteRoot, "validate-club-sorting.mjs");
let sorting = String(await readFile(sortingPath, "utf8")).replace(/\r\n?/g, "\n");
sorting = replaceRequired(
  sorting,
  `const [coreSource, dataPage] = await Promise.all([\n  read("./modules/app-core.js"),\n  read("./api/_data-page.js"),\n]);`,
  `const [coreSource, dataPage, buildNormalizer] = await Promise.all([\n  read("./modules/app-core.js"),\n  read("./api/_data-page.js"),\n  read("./modules/app-core-build-normalizer.js"),\n]);`,
  "Club sorting build ownership inputs",
);
sorting = replaceRequired(
  sorting,
  `console.log("Club sorting validation passed: fixed Position -> Overall ordering is visible and every committed page path preserves destination sort state after Club navigation.");`,
  `excludes(\n  buildNormalizer,\n  "normalizeClubSortLifecycle",\n  "Build composition must not rewrite source-owned Club sorting.",\n);\nexcludes(\n  buildNormalizer,\n  "clubSortArtifacts",\n  "The obsolete Club sort build artifact must stay removed.",\n);\nincludes(\n  buildNormalizer,\n  "return watchlistArtifacts;",\n  "Structural application-core splitting must return directly after watchlist route ownership.",\n);\n\nconsole.log("Club sorting validation passed: fixed Position -> Overall ordering is source-owned and every committed page path preserves destination sort state after Club navigation.");`,
  "Club sorting source ownership assertions",
);
await writeFile(sortingPath, sorting);

console.log(`Moved ${replacements.length} Club sort transformations into canonical source ownership and updated dependent validators.`);
