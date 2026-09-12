import { includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const dataPage = await readValidationText("./api/_data-page.js", import.meta.url);

for (const token of [
  "function countRows(where, parameters) {",
  "function parametersEqual(left, right) {",
  "const sameResultSet = where === sourceWhere && parametersEqual(parameters, baseParameters);",
  'const totalRows = measureSync(timings, "sqlite", () => countRows(where, parameters));',
  'const sourceRows = sameResultSet\n    ? totalRows\n    : measureSync(timings, "sqlite", () => countRows(sourceWhere, baseParameters));',
  "totalRows,\n    sourceRows,",
]) {
  includes(dataPage, token, `Paged table count fast path is missing: ${token}`);
}

for (const token of [
  'const canonicalMflStatsSource = scope === "mflstats"',
  'sourceWhere === ` WHERE ${mflCondition()}`',
  'parametersEqual(baseParameters, [MFL_WALLET_ADDRESS])',
  'runtimeMetadataCount("mfl_stats_all_total_players")',
  "const totalRows = sameResultSet && precomputedSourceRows !== null",
  "precomputedSourceRows ?? measureSync(timings, \"sqlite\", () => countRows(sourceWhere, baseParameters))",
]) {
  includes(dataPage, token, `MFL Stats source-count reuse is missing: ${token}`);
}

excludes(
  dataPage,
  "const sourceRows = Number(queryOne(\n    `SELECT count(*) AS count FROM players${sourceWhere}`",
  "Paged reads must not unconditionally execute the source count before result filters are known.",
);

console.log("Paged table reads reuse the filtered count as sourceRows whenever the final predicate is unchanged, while filtered requests preserve separately timed source and result totals.");