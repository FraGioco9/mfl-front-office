const {
  getGeneratedAt,
  queryRows,
  tableExists,
} = require("./_database");
const {
  MFL_WALLET_ADDRESS,
  mflCondition,
  normalizedEpochSeconds,
} = require("./_data-query");

function liveMflStatsSummaryRows() {
  const overallSql = `CASE
    WHEN upper(trim(CASE WHEN instr(positions, ',') > 0 THEN substr(positions, 1, instr(positions, ',') - 1) ELSE positions END)) = 'GK'
      THEN CAST(goalkeeping AS INTEGER)
    ELSE CAST(overall AS INTEGER)
  END`;
  const joinedDateSql = `date(${normalizedEpochSeconds("owned_since")}, 'unixepoch')`;
  const categorySql = `CASE
    WHEN coalesce(${joinedDateSql} IN ('2025-10-09', '2025-10-10'), 0) = 1 THEN 'other'
    WHEN CAST(player_seasons AS INTEGER) = 1 THEN 'packable'
    WHEN CAST(player_seasons AS INTEGER) >= 2 THEN 'aged'
    ELSE 'other'
  END`;
  return queryRows(
    `SELECT
       ${overallSql} AS overall,
       CAST(age AS INTEGER) AS age,
       ${categorySql} AS category,
       count(*) AS count
     FROM players
     WHERE ${mflCondition()} AND ${overallSql} IS NOT NULL
     GROUP BY overall, age, category
     ORDER BY overall, age, category`,
    [MFL_WALLET_ADDRESS],
  );
}

function precomputedMflStatsSummaryRows() {
  return queryRows(
    `SELECT overall, age, category, player_count AS count
     FROM runtime_mfl_stats_summary
     ORDER BY overall, age, category`,
  );
}

function mflStatsSummaryData() {
  const precomputed = tableExists("runtime_mfl_stats_summary");
  const rows = precomputed
    ? precomputedMflStatsSummaryRows()
    : liveMflStatsSummaryRows();

  return {
    generatedAt: getGeneratedAt(),
    totalPlayers: rows.reduce((total, row) => total + Number(row.count || 0), 0),
    columns: ["overall", "age", "category", "count"],
    rows: rows.map((row) => [
      Number(row.overall),
      row.age === null || row.age === undefined ? null : Number(row.age),
      String(row.category || "other"),
      Number(row.count || 0),
    ]),
    source: precomputed
      ? "sqlite-runtime-precomputed-mfl-stats-summary"
      : "sqlite-runtime-live-mfl-stats-summary",
  };
}

module.exports = { mflStatsSummaryData };
