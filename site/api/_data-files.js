const {
  PLAYER_COLUMNS,
  PROGRESSION_COLUMNS,
  PUBLIC_COLUMNS,
  SEARCH_PLAYER_COLUMNS,
  VALID_PLAYER_COLUMNS,
  getGeneratedAt,
  queryRows,
  queryOne,
  quoteIdentifier,
  selectList,
  rowsAsArrays,
} = require("./_database");
const { normalizeWalletAddress } = require("./_data-auth");

const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
const STAT_COLUMNS = new Set([
  "overall",
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defense",
  "physical",
  "goalkeeping",
]);
const NUMBER_COLUMNS = new Set([
  "player_id",
  "age",
  "height",
  "retirement_years",
  "player_seasons",
  "owned_since",
  "active_contract_revenue_share",
  "active_contract_club_division",
  "next_overall",
  "next_overall_gap",
  "pace_to_next_overall",
  "shooting_to_next_overall",
  "passing_to_next_overall",
  "dribbling_to_next_overall",
  "defense_to_next_overall",
  "physical_to_next_overall",
  "goalkeeping_to_next_overall",
  ...STAT_COLUMNS,
]);
const POSITION_ORDER = [
  "GK",
  "RB",
  "CB",
  "LB",
  "RWB",
  "LWB",
  "CDM",
  "RM",
  "CM",
  "LM",
  "CAM",
  "RW",
  "CF",
  "LW",
  "ST",
];
const TABLE_SCOPES = new Set([
  "database",
  "progression",
  "mfl",
  "mflstats",
  "agent",
  "myplayers",
  "watchlist",
  "club",
]);
const DATA_FILE_PATTERN = /^(manifest\.json|players_\d{4}\.json|players_public\.json|players_mfl_public\.json|players_progression\.json|players_search\.json|agents_search\.json|wallets\.json)$/;
function placeholders(values) {
  return values.map(() => "?").join(", ");
}

function qualifiedSelectList(alias, columns) {
  return columns.map((column) => `${alias}.${quoteIdentifier(column)} AS ${quoteIdentifier(column)}`).join(", ");
}

function appendCondition(conditions, parameters, sql, ...values) {
  conditions.push(`(${sql})`);
  parameters.push(...values);
}

function mflCondition(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}wallet_address = ?`;
}

function normalizedEpochSeconds(column = "owned_since") {
  return `(CASE WHEN abs(${column}) < 100000000000 THEN ${column} ELSE ${column} / 1000 END)`;
}

function hiddenMflJoinedDateCondition(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  const mfl = mflCondition(alias);
  const joinedDate = `date(${normalizedEpochSeconds(`${prefix}owned_since`)}, 'unixepoch')`;
  return `NOT (${mfl} AND coalesce(${joinedDate} IN ('2025-10-09', '2025-10-10'), 0) = 1)`;
}

function manifestPayload() {
  const playerCount = Number(queryOne("SELECT count(*) AS count FROM players")?.count || 0);
  const walletCount = Number(queryOne("SELECT count(*) AS count FROM wallets")?.count || 0);
  const mflCount = Number(queryOne(
    `SELECT count(*) AS count FROM players WHERE ${mflCondition()}`,
    [MFL_WALLET_ADDRESS],
  )?.count || 0);
  const generatedAt = getGeneratedAt();

  return {
    generated_at: generatedAt,
    row_count: playerCount,
    wallet_count: walletCount,
    source: "sqlite-runtime",
    files: {
      public: {
        file: "players_public.json",
        rows: playerCount,
        columns: PUBLIC_COLUMNS,
        virtual: true,
      },
      progression: {
        file: "players_progression.json",
        rows: playerCount,
        columns: PROGRESSION_COLUMNS,
        virtual: true,
      },
      mfl_public: {
        file: "players_mfl_public.json",
        rows: mflCount,
        columns: PUBLIC_COLUMNS,
        virtual: true,
      },
      search_players: {
        file: "players_search.json",
        rows: playerCount,
        columns: SEARCH_PLAYER_COLUMNS,
        virtual: true,
      },
      search_agents: {
        file: "agents_search.json",
        rows: walletCount,
        columns: ["wallet_address", "wallet_name"],
        virtual: true,
      },
    },
  };
}

function requestedColumns(request, fullAccess, ownedProgression) {
  const requested = String(request.query?.columns || "")
    .split(",")
    .map((column) => column.trim())
    .filter((column) => VALID_PLAYER_COLUMNS.has(column));
  if (fullAccess || ownedProgression) {
    return requested.length ? requested : PLAYER_COLUMNS;
  }
  return requested.length
    ? requested.filter((column) => PUBLIC_COLUMNS.includes(column))
    : PUBLIC_COLUMNS;
}

function filePayload(fileName, request, fullAccess, ownedProgression, signedWallet) {
  if (fileName === "manifest.json") {
    const manifest = manifestPayload();
    return {
      ...manifest,
      columns: fullAccess || ownedProgression ? PLAYER_COLUMNS : PUBLIC_COLUMNS,
      publicAccess: fullAccess || ownedProgression ? undefined : "database",
      ownedAccess: ownedProgression && !fullAccess ? "progression" : undefined,
    };
  }

  if (fileName === "agents_search.json" || fileName === "wallets.json") {
    const columns = ["wallet_address", "wallet_name"];
    const rows = queryRows(
      "SELECT wallet_address, name AS wallet_name FROM wallets ORDER BY wallet_address",
    );
    return {
      columns,
      rows: rowsAsArrays(rows, columns),
      generatedAt: getGeneratedAt(),
      source: "sqlite-runtime",
    };
  }

  if (fileName === "players_search.json") {
    const rows = queryRows(
      `SELECT ${selectList(SEARCH_PLAYER_COLUMNS)} FROM players ORDER BY player_id`,
    );
    return {
      columns: SEARCH_PLAYER_COLUMNS,
      rows: rowsAsArrays(rows, SEARCH_PLAYER_COLUMNS),
      generatedAt: getGeneratedAt(),
      source: "sqlite-runtime",
    };
  }

  const columns = fileName === "players_progression.json"
    ? PROGRESSION_COLUMNS
    : requestedColumns(request, fullAccess, ownedProgression);
  const conditions = [];
  const parameters = [];

  if (fileName === "players_mfl_public.json") {
    appendCondition(conditions, parameters, mflCondition(), MFL_WALLET_ADDRESS);
  }
  if (ownedProgression && !fullAccess) {
    appendCondition(
      conditions,
      parameters,
      "wallet_address = ?",
      normalizeWalletAddress(signedWallet),
    );
  }
  if (fileName === "players_progression.json" && !fullAccess && !ownedProgression) {
    throw new Error("Progression access is required.");
  }

  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const rows = queryRows(
    `SELECT ${selectList(columns)} FROM players${where} ORDER BY player_id`,
    parameters,
  );
  return {
    columns,
    rows: rowsAsArrays(rows, columns),
    generatedAt: getGeneratedAt(),
    source: "sqlite-runtime",
  };
}


module.exports = {
  MFL_WALLET_ADDRESS,
  STAT_COLUMNS,
  NUMBER_COLUMNS,
  POSITION_ORDER,
  TABLE_SCOPES,
  DATA_FILE_PATTERN,
  placeholders,
  qualifiedSelectList,
  appendCondition,
  mflCondition,
  normalizedEpochSeconds,
  hiddenMflJoinedDateCondition,
  manifestPayload,
  requestedColumns,
  filePayload,
};
