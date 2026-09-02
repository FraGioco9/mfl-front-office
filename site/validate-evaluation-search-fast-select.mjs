import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const source = await Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n"));

const section = (startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return start >= 0 && end > start ? source.slice(start, end) : "";
};

const compactEntry = section(
  "function buildPlayerSearchEntryFromCompactRow(row, columns) {",
  "\nfunction playerSearchMetadataHtml(",
);
invariant(compactEntry, "Compact player search entry builder must exist.");
invariant(
  compactEntry.includes("row: [...row],") && compactEntry.includes("columns: [...columns],"),
  "Compact player search entries must retain their raw row and column mapping for Evaluation reuse.",
);

const fullEntry = section(
  "function buildPlayerSearchEntryFromRow(row) {",
  "\nfunction compactSearchValue(",
);
invariant(
  fullEntry.includes("row: [...row],") && fullEntry.includes("columns: [...state.columns],"),
  "Full-row player search entries must expose the same reusable row/column contract.",
);

const fastColumns = section(
  "const EVALUATION_SEARCH_FAST_COLUMNS = Object.freeze([",
  "]);\n\nfunction evaluationSearchRoutePayload",
);
for (const column of ["player_id", "name", "overall", "age", "positions", "retirement_years"]) {
  invariant(fastColumns.includes(`"${column}"`), `Evaluation fast selection must require ${column}.`);
}

const fastRender = section(
  "function renderEvaluationSearchEntryImmediately(entry, route) {",
  "\nfunction renderEvaluationSearchResults(options = {}) {",
);
invariant(fastRender, "Evaluation search must define an immediate render fast path.");
for (const required of [
  "evaluationSearchRoutePayload(entry)",
  "state.incrementalPayloadCache.set(cacheKey, payload);",
  "applyIncrementalPayload(route, payload);",
  "renderEvaluationTable(row);",
  "return true;",
]) {
  invariant(fastRender.includes(required), `Evaluation fast selection is missing ${required}.`);
}
invariant(
  !fastRender.includes("requestIncrementalRoute("),
  "The immediate Evaluation search fast path must not make a blocking route request.",
);

const rendererStart = source.indexOf("function renderEvaluationSearchResults(options = {}) {");
const rendererEnd = source.indexOf("function primeEmptyEvaluationSearch()", rendererStart);
const fastCall = source.indexOf("if (renderEvaluationSearchEntryImmediately(entry, route)) return;", rendererStart);
const fallbackRequest = source.indexOf("await requestIncrementalRoute(route, 1);", fastCall);
invariant(rendererStart >= 0 && rendererEnd > rendererStart, "Evaluation search result renderer must be discoverable.");
invariant(
  fastCall > rendererStart && fastCall < rendererEnd,
  "Evaluation result clicks must attempt the immediate search-data fast path.",
);
invariant(
  fallbackRequest > fastCall && fallbackRequest < rendererEnd,
  "The incremental player request must remain fallback-only after the fast path.",
);

invariant(
  source.includes("rows.map((row) => buildPlayerSearchEntryFromCompactRow(row, playerColumns))")
    && source.includes(".map((row) => buildPlayerSearchEntryFromCompactRow(row, columns))"),
  "Both typed search payloads and recent Evaluation payloads must build reusable compact search entries.",
);

console.log("Evaluation search fast-selection validation passed.");
