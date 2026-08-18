const {
  PUBLIC_COLUMNS,
  PROGRESSION_COLUMNS,
  SEARCH_PLAYER_COLUMNS,
  getGeneratedAt,
  queryOne,
  quoteIdentifier,
} = require("./_database");

const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
const STAT_COLUMNS = new Set([
  "overall", "pace", "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping",
]);
const NUMBER_COLUMNS = new Set([
  "player_id", "age", "height", "retirement_years", "player_seasons", "owned_since",
  "active_contract_revenue_share", "active_contract_club_division",
  "next_overall", "next_overall_gap", "pace_to_next_overall", "shooting_to_next_overall",
  "passing_to_next_overall", "dribbling_to_next_overall", "defense_to_next_overall",
  "physical_to_next_overall", "goalkeeping_to_next_overall", ...STAT_COLUMNS,
]);
const POSITION_ORDER = [
  "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "RM", "CM", "LM", "CAM", "RW", "CF", "LW", "ST",
];
const TABLE_SCOPES = new Set([
  "database", "progression", "mfl", "agent", "myplayers", "watchlist",
]);

function placeholders(values) {
  return values.map(() => "?").join(", ");
}

function qualifiedSelectList(alias, columns) {
  return columns
    .map((column) => `${alias}.${quoteIdentifier(column)} AS ${quoteIdentifier(column)}`)
    .join(", ");
}

function appendCondition(conditions, parameters, sql, ...values) {
  conditions.push(`(${sql})`);
  parameters.push(...values);
}

function mflCondition(alias = "") {
  return `${alias ? `${alias}.` : ""}wallet_address = ?`;
}

function normalizedEpochSeconds(column = "owned_since") {
  return `(CASE WHEN abs(${column}) < 100000000000 THEN ${column} ELSE ${column} / 1000 END)`;
}

function hiddenMflJoinedDateCondition(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  const joinedDate = `date(${normalizedEpochSeconds(`${prefix}owned_since`)}, 'unixepoch')`;
  return `NOT (${mflCondition(alias)} AND coalesce(${joinedDate} IN ('2025-10-09', '2025-10-10'), 0) = 1)`;
}

function manifestPayload() {
  const playerCount = Number(queryOne("SELECT count(*) AS count FROM players")?.count || 0);
  const walletCount = Number(queryOne("SELECT count(*) AS count FROM wallets")?.count || 0);
  return {
    generated_at: getGeneratedAt(),
    row_count: playerCount,
    wallet_count: walletCount,
    source: "sqlite-runtime",
    columns: PUBLIC_COLUMNS,
    progression_columns: PROGRESSION_COLUMNS,
    search_player_columns: SEARCH_PLAYER_COLUMNS,
  };
}

module.exports = {
  MFL_WALLET_ADDRESS,
  STAT_COLUMNS,
  NUMBER_COLUMNS,
  POSITION_ORDER,
  TABLE_SCOPES,
  placeholders,
  qualifiedSelectList,
  appendCondition,
  mflCondition,
  normalizedEpochSeconds,
  hiddenMflJoinedDateCondition,
  manifestPayload,
};
