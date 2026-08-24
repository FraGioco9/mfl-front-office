// Temporary one-shot source migration; remove before merge.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

const lifecycle = await read("modules/app-core-evaluation-load-lifecycle.js");

function constantValue(name) {
  const marker = `const ${name} = `;
  const markerIndex = lifecycle.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing Evaluation Load constant ${name}.`);
  const start = markerIndex + marker.length;
  const quote = lifecycle[start];
  if (quote !== "`" && quote !== '"' && quote !== "'") throw new Error(`Unsupported literal for ${name}.`);
  let raw = "";
  for (let index = start + 1; index < lifecycle.length; index += 1) {
    const char = lifecycle[index];
    if (char === "\\") {
      if (index + 1 >= lifecycle.length) throw new Error(`Unterminated escape in ${name}.`);
      raw += char + lifecycle[index + 1];
      index += 1;
      continue;
    }
    if (char === quote) {
      return Function(`"use strict"; return ${quote}${raw}${quote};`)();
    }
    raw += char;
  }
  throw new Error(`Unterminated literal for ${name}.`);
}

const replacements = [
  ["EVALUATION_LOAD_FACADE", "EVALUATION_LOAD_FACADE_WITH_BUSY"],
  ["EVALUATION_LOAD_CLOSE_BINDING", "EVALUATION_LOAD_CLOSE_BINDING_WITH_ESCAPE"],
  ["EVALUATION_CREATE_SAVED_START", "EVALUATION_CREATE_SAVED_START_WITH_CACHE"],
  ["EVALUATION_LOAD_LIST_NAME", "EVALUATION_LOAD_LIST_NAME_WITH_CACHE"],
  ["EVALUATION_LOAD_LIST_HANDLER", "EVALUATION_LOAD_LIST_HANDLER_WITH_HYDRATION"],
  ["EVALUATION_LOAD_MODAL_START", "EVALUATION_LOAD_MODAL_START_WITH_CACHE"],
  ["EVALUATION_LOAD_RENDER", "EVALUATION_LOAD_RENDER_WITH_CACHE"],
  ["EVALUATION_SAVED_LOAD_REQUEST", "EVALUATION_SAVED_LOAD_REQUEST_WITH_CACHE"],
  ["EVALUATION_MISSING_PLAYER_PAYLOAD", "EVALUATION_MISSING_PLAYER_PAYLOAD_WITH_RECOVERY"],
  ["EVALUATION_UNRESOLVED_PLAYER_ROUTE", "EVALUATION_UNRESOLVED_PLAYER_ROUTE_WITH_RECOVERY"],
  ["EVALUATION_UNRESOLVED_PLAYER_ROUTE", "EVALUATION_UNRESOLVED_PLAYER_ROUTE_WITH_RECOVERY"],
  ["EVALUATION_INVALID_LINK_RECOVERY", "EVALUATION_INVALID_LINK_RECOVERY_WITH_PLAIN_RESET"],
  ["EVALUATION_SAVE_SUCCESS", "EVALUATION_SAVE_SUCCESS_WITH_INVALIDATION"],
  ["EVALUATION_DELETE_SUCCESS", "EVALUATION_DELETE_SUCCESS_WITH_INVALIDATION"],
];

let core = await read("modules/app-core.js");
replacements.forEach(([beforeName, afterName], index) => {
  core = replaceRequired(
    core,
    constantValue(beforeName),
    constantValue(afterName),
    `Evaluation Load source replacement ${index + 1}: ${beforeName}`,
  );
});
await writeFile(resolve(siteRoot, "modules/app-core.js"), core);

let build = await read("modules/app-core-build-normalizer.js");
build = replaceRequired(
  build,
  'import { normalizeEvaluationLoadLifecycle } from "./app-core-evaluation-load-lifecycle.js";\n',
  "",
  "Evaluation Load normalizer import",
);
build = replaceRequired(
  build,
  `  const clubSortArtifacts = normalizeClubSortLifecycle(clubStartupArtifacts);
  const evaluationLoadArtifacts = normalizeEvaluationLoadLifecycle(clubSortArtifacts);
  return normalizeEvaluationSavedValuationCache(evaluationLoadArtifacts);`,
  `  const clubSortArtifacts = normalizeClubSortLifecycle(clubStartupArtifacts);
  return normalizeEvaluationSavedValuationCache(clubSortArtifacts);`,
  "Evaluation Load build stage",
);
await writeFile(resolve(siteRoot, "modules/app-core-build-normalizer.js"), build);

await rm(resolve(siteRoot, "modules/app-core-evaluation-load-lifecycle.js"));
console.log(`Canonical Evaluation Load migration applied with ${replacements.length} source transformations.`);
