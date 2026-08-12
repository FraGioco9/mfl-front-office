const { getGeneratedAt, queryRows } = require("./_database");

function filterOptionsData() {
  const nationalities = queryRows(
    `SELECT DISTINCT CAST(nationality AS TEXT) AS nationality
     FROM players
     WHERE nationality IS NOT NULL
       AND trim(CAST(nationality AS TEXT)) <> ''
     ORDER BY nationality COLLATE NOCASE`,
  ).map((row) => String(row.nationality));

  return {
    nationalities,
    generatedAt: getGeneratedAt(),
    source: "sqlite-runtime",
  };
}

module.exports = { filterOptionsData };
