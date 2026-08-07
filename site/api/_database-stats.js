const {
  getGeneratedAt,
  queryRows,
  queryOne,
} = require("./_database");

const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
const MFL_TRADE_WALLET_ADDRESS = "0x6fec8986261ecf49";
const EXCLUDED_WALLET_ADDRESSES = Object.freeze([
  MFL_WALLET_ADDRESS,
  MFL_TRADE_WALLET_ADDRESS,
]);

function databaseStatsData() {
  const excludedOwnershipSql = `lower(coalesce(wallet_address, '')) NOT IN (?, ?)`;
  const ownershipParameters = EXCLUDED_WALLET_ADDRESSES.map((address) => address.toLowerCase());
  const activeSql = "coalesce(CAST(retirement_years AS INTEGER), -1) <> 0";
  const retiredSql = "coalesce(CAST(retirement_years AS INTEGER), -1) = 0";
  const overallSql = `CASE
    WHEN upper(trim(CASE WHEN instr(positions, ',') > 0 THEN substr(positions, 1, instr(positions, ',') - 1) ELSE positions END)) = 'GK'
      THEN CAST(goalkeeping AS INTEGER)
    ELSE CAST(overall AS INTEGER)
  END`;

  const rows = queryRows(
    `SELECT
       ${overallSql} AS overall,
       CAST(age AS INTEGER) AS age,
       CAST(retirement_years AS INTEGER) AS retirement_years,
       count(*) AS count
     FROM players
     WHERE ${excludedOwnershipSql}
       AND ${overallSql} IS NOT NULL
     GROUP BY overall, age, retirement_years
     ORDER BY overall, age, retirement_years`,
    ownershipParameters,
  );

  const totals = queryOne(
    `SELECT
       count(*) AS totalPlayers,
       sum(CASE WHEN ${activeSql} THEN 1 ELSE 0 END) AS totalActivePlayers
     FROM players
     WHERE ${excludedOwnershipSql}`,
    ownershipParameters,
  );

  const retiredTotals = queryOne(
    `SELECT count(*) AS totalRetiredPlayers
     FROM players
     WHERE ${retiredSql}`,
  );

  return {
    generatedAt: getGeneratedAt(),
    totalPlayers: Number(totals?.totalPlayers || 0),
    totalActivePlayers: Number(totals?.totalActivePlayers || 0),
    totalRetiredPlayers: Number(retiredTotals?.totalRetiredPlayers || 0),
    excludedWallets: ["MFL", "MFL Trade"],
    excludedWalletAddresses: [...EXCLUDED_WALLET_ADDRESSES],
    columns: ["overall", "age", "retirement_years", "count"],
    rows: rows.map((row) => [
      row.overall,
      row.age,
      row.retirement_years,
      Number(row.count),
    ]),
    source: "sqlite-runtime-database-stats",
  };
}

module.exports = {
  MFL_WALLET_ADDRESS,
  MFL_TRADE_WALLET_ADDRESS,
  EXCLUDED_WALLET_ADDRESSES,
  databaseStatsData,
};
