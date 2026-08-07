const {
  PUBLIC_COLUMNS,
  SEARCH_PLAYER_COLUMNS,
  getGeneratedAt,
  normalizeSearchText,
  queryRows,
  queryOne,
  selectList,
  rowsAsArrays,
  tableExists,
} = require("./_database");
const { normalizeWalletAddress } = require("./_data-auth");
const {
  MFL_WALLET_ADDRESS,
  placeholders,
  qualifiedSelectList,
  appendCondition,
  mflCondition,
  hiddenMflJoinedDateCondition,
  manifestPayload,
} = require("./_data-query");
const { integerIds } = require("./_data-page");

function bootstrapData() {
  const manifest = manifestPayload();
  return {
    manifest,
    summary: {
      playerCount: manifest.row_count,
      walletCount: manifest.wallet_count,
      generatedAt: manifest.generated_at,
    },
    players: { columns: SEARCH_PLAYER_COLUMNS, rows: [] },
    agents: { columns: ["wallet_address", "wallet_name", "player_count"], rows: [] },
    clubs: [],
    searchMode: "sqlite-runtime",
  };
}

function csvValues(value, maximum = 50) {
  return [...new Set(String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean))]
    .slice(0, maximum);
}

function literalLikePattern(value, prefixOnly = false) {
  const escaped = String(value || "").replace(/[\\%_]/g, "\\$&");
  return prefixOnly ? `${escaped}%` : `%${escaped}%`;
}

function playerSearchRows(query, limit) {
  const columns = SEARCH_PLAYER_COLUMNS;
  const contains = literalLikePattern(query);
  const prefix = literalLikePattern(query, true);
  const useRuntimeSearch = tableExists("runtime_player_search");
  const fromSql = useRuntimeSearch
    ? "runtime_player_search s JOIN players p ON p.player_id = s.player_id"
    : "players p";
  const normalizedName = useRuntimeSearch ? "s.normalized_name" : "normalize_search(p.name)";
  const rows = queryRows(
    `SELECT ${qualifiedSelectList("p", columns)}
     FROM ${fromSql}
     WHERE CAST(p.player_id AS TEXT) LIKE ? ESCAPE '\\'
        OR ${normalizedName} LIKE ? ESCAPE '\\'
     ORDER BY CASE
       WHEN CAST(p.player_id AS TEXT) = ? OR ${normalizedName} = ? THEN 0
       WHEN CAST(p.player_id AS TEXT) LIKE ? ESCAPE '\\' THEN 1
       WHEN ${normalizedName} LIKE ? ESCAPE '\\' THEN 2
       ELSE 3
     END,
     p.overall DESC,
     p.player_id DESC
     LIMIT ?`,
    [contains, contains, query, query, prefix, prefix, limit],
  );
  return { columns, rows: rowsAsArrays(rows, columns) };
}

function agentSearchRows(query, limit) {
  const columns = ["wallet_address", "wallet_name", "player_count"];
  const contains = literalLikePattern(query);
  const prefix = literalLikePattern(query, true);
  let rows;

  if (tableExists("runtime_agents")) {
    rows = queryRows(
      `SELECT wallet_address, wallet_name, player_count
       FROM runtime_agents
       WHERE normalize_search(wallet_address) LIKE ? ESCAPE '\\'
          OR normalized_name LIKE ? ESCAPE '\\'
       ORDER BY CASE
         WHEN normalized_name = ? OR normalize_search(wallet_address) = ? THEN 0
         WHEN normalized_name LIKE ? ESCAPE '\\' THEN 1
         WHEN normalize_search(wallet_address) LIKE ? ESCAPE '\\' THEN 2
         ELSE 3
       END,
       player_count DESC,
       normalized_name,
       wallet_address
       LIMIT ?`,
      [contains, contains, query, query, prefix, prefix, limit],
    );
  } else {
    rows = queryRows(
      `SELECT
         w.wallet_address,
         w.name AS wallet_name,
         (SELECT count(*) FROM players p WHERE p.wallet_address = w.wallet_address) AS player_count
       FROM wallets w
       WHERE normalize_search(w.wallet_address) LIKE ? ESCAPE '\\'
          OR normalize_search(w.name) LIKE ? ESCAPE '\\'
       ORDER BY CASE
         WHEN normalize_search(w.name) = ? OR normalize_search(w.wallet_address) = ? THEN 0
         WHEN normalize_search(w.name) LIKE ? ESCAPE '\\' THEN 1
         WHEN normalize_search(w.wallet_address) LIKE ? ESCAPE '\\' THEN 2
         ELSE 3
       END,
       player_count DESC,
       normalize_search(w.name),
       w.wallet_address
       LIMIT ?`,
      [contains, contains, query, query, prefix, prefix, limit],
    );
  }
  return { columns, rows: rowsAsArrays(rows, columns) };
}

function clubSearchRows(query, limit) {
  const contains = literalLikePattern(query);
  const prefix = literalLikePattern(query, true);

  if (tableExists("runtime_clubs")) {
    return queryRows(
      `SELECT club_id AS clubId, name, division
       FROM runtime_clubs
       WHERE normalize_search(club_id) LIKE ? ESCAPE '\\'
          OR normalized_name LIKE ? ESCAPE '\\'
       ORDER BY CASE
         WHEN normalized_name = ? OR normalize_search(club_id) = ? THEN 0
         WHEN normalized_name LIKE ? ESCAPE '\\' THEN 1
         WHEN normalize_search(club_id) LIKE ? ESCAPE '\\' THEN 2
         ELSE 3
       END,
       division,
       name
       LIMIT ?`,
      [contains, contains, query, query, prefix, prefix, limit],
    );
  }

  return queryRows(
    `SELECT
       active_contract_club_id AS clubId,
       max(active_contract_club_name) AS name,
       min(CAST(active_contract_club_division AS INTEGER)) AS division
     FROM players
     WHERE (normalize_search(active_contract_club_id) LIKE ? ESCAPE '\\'
        OR normalize_search(active_contract_club_name) LIKE ? ESCAPE '\\')
       AND normalize_search(active_contract_club_name) <> 'development center'
       AND coalesce(active_contract_club_id, '') <> ''
     GROUP BY active_contract_club_id
     ORDER BY CASE
       WHEN normalize_search(max(active_contract_club_name)) = ?
         OR normalize_search(active_contract_club_id) = ? THEN 0
       WHEN normalize_search(max(active_contract_club_name)) LIKE ? ESCAPE '\\' THEN 1
       WHEN normalize_search(active_contract_club_id) LIKE ? ESCAPE '\\' THEN 2
       ELSE 3
     END,
     division,
     name
     LIMIT ?`,
    [contains, contains, query, query, prefix, prefix, limit],
  );
}

function recentSearchData(request) {
  const playerIds = integerIds(request.query?.playerIds, 50);
  const walletAddresses = csvValues(request.query?.walletAddresses, 50)
    .map(normalizeWalletAddress)
    .filter(Boolean);
  const clubIds = csvValues(request.query?.clubIds, 50);
  const playerColumns = SEARCH_PLAYER_COLUMNS;
  const agentColumns = ["wallet_address", "wallet_name", "player_count"];

  const playerRows = playerIds.length
    ? queryRows(
      `SELECT ${selectList(playerColumns)}
       FROM players
       WHERE player_id IN (${placeholders(playerIds)})`,
      playerIds,
    )
    : [];

  let agentRows = [];
  if (walletAddresses.length) {
    if (tableExists("runtime_agents")) {
      agentRows = queryRows(
        `SELECT wallet_address, wallet_name, player_count
         FROM runtime_agents
         WHERE wallet_address IN (${placeholders(walletAddresses)})`,
        walletAddresses,
      );
    } else {
      agentRows = queryRows(
        `SELECT
           w.wallet_address,
           w.name AS wallet_name,
           (SELECT count(*) FROM players p WHERE p.wallet_address = w.wallet_address) AS player_count
         FROM wallets w
         WHERE w.wallet_address IN (${placeholders(walletAddresses)})`,
        walletAddresses,
      );
    }
  }

  let clubs = [];
  if (clubIds.length) {
    if (tableExists("runtime_clubs")) {
      clubs = queryRows(
        `SELECT club_id AS clubId, name, division
         FROM runtime_clubs
         WHERE club_id IN (${placeholders(clubIds)})`,
        clubIds,
      );
    } else {
      clubs = queryRows(
        `SELECT
           active_contract_club_id AS clubId,
           max(active_contract_club_name) AS name,
           min(CAST(active_contract_club_division AS INTEGER)) AS division
         FROM players
         WHERE active_contract_club_id IN (${placeholders(clubIds)})
           AND normalize_search(active_contract_club_name) <> 'development center'
         GROUP BY active_contract_club_id`,
        clubIds,
      );
    }
  }

  return {
    players: { columns: playerColumns, rows: rowsAsArrays(playerRows, playerColumns) },
    agents: { columns: agentColumns, rows: rowsAsArrays(agentRows, agentColumns) },
    clubs,
  };
}

function searchData(request) {
  const type = String(request.query?.type || "players").toLowerCase();
  if (type === "recent") return recentSearchData(request);

  const query = normalizeSearchText(request.query?.q);
  const limit = Math.max(1, Math.min(50, Math.trunc(Number(request.query?.limit) || 20)));
  if (!query) {
    if (type === "all") {
      return {
        players: { columns: SEARCH_PLAYER_COLUMNS, rows: [] },
        agents: { columns: ["wallet_address", "wallet_name", "player_count"], rows: [] },
        clubs: [],
      };
    }
    return { columns: [], rows: [], results: [] };
  }

  if (type === "all") {
    return {
      players: playerSearchRows(query, limit),
      agents: agentSearchRows(query, limit),
      clubs: clubSearchRows(query, limit),
    };
  }
  if (type === "agents") return agentSearchRows(query, limit);
  if (type === "clubs") return { results: clubSearchRows(query, limit) };
  return playerSearchRows(query, limit);
}

function summaryData() {
  return {
    playerCount: Number(queryOne("SELECT count(*) AS count FROM players")?.count || 0),
    walletCount: Number(queryOne("SELECT count(*) AS count FROM wallets")?.count || 0),
    generatedAt: getGeneratedAt(),
    source: "sqlite-runtime",
  };
}

function databaseStatsData() {
  const excludedWalletNames = ["mfl", "mfl wallet", "mfl trade"];
  const excludedWalletNamePlaceholders = placeholders(excludedWalletNames);
  const excludedSql = `
    lower(coalesce(wallet_address, '')) <> lower(?)
    AND lower(coalesce(wallet_address, '')) NOT IN (
      SELECT lower(wallet_address)
      FROM wallets
      WHERE coalesce(wallet_address, '') <> ''
        AND normalize_wallet_name(name) IN (${excludedWalletNamePlaceholders})
    )
    AND normalize_wallet_name(wallet_name) NOT IN (${excludedWalletNamePlaceholders})
  `;
  const parameters = [
    MFL_WALLET_ADDRESS,
    ...excludedWalletNames,
    ...excludedWalletNames,
  ];
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
     WHERE ${excludedSql} AND ${overallSql} IS NOT NULL
     GROUP BY overall, age, retirement_years
     ORDER BY overall, age, retirement_years`,
    parameters,
  );
  const totals = queryOne(
    `SELECT
       count(*) AS totalPlayers,
       sum(CASE WHEN coalesce(CAST(retirement_years AS INTEGER), -1) <> 0 THEN 1 ELSE 0 END) AS totalActivePlayers
     FROM players
     WHERE ${excludedSql} AND ${overallSql} IS NOT NULL`,
    parameters,
  );

  return {
    generatedAt: getGeneratedAt(),
    totalPlayers: Number(totals?.totalPlayers || 0),
    totalActivePlayers: Number(totals?.totalActivePlayers || 0),
    excludedWallets: ["MFL", "MFL Trade"],
    columns: ["overall", "age", "retirement_years", "count"],
    rows: rows.map((row) => [
      row.overall,
      row.age,
      row.retirement_years,
      Number(row.count),
    ]),
    source: "sqlite-runtime-live-stats",
  };
}

function mflStatsData(request, complete = false) {
  const columns = complete
    ? PUBLIC_COLUMNS
    : [
      "player_id",
      "wallet_address",
      "wallet_name",
      "age",
      "owned_since",
      "overall",
      "player_seasons",
    ];
  const conditions = [mflCondition()];
  const parameters = [MFL_WALLET_ADDRESS];

  if (!complete) {
    appendCondition(
      conditions,
      parameters,
      hiddenMflJoinedDateCondition(),
      MFL_WALLET_ADDRESS,
    );
  }

  const where = ` WHERE ${conditions.join(" AND ")}`;
  const totalRows = Number(queryOne(
    `SELECT count(*) AS count FROM players${where}`,
    parameters,
  )?.count || 0);

  if (!complete) {
    const rows = queryRows(
      `SELECT ${selectList(columns)} FROM players${where} ORDER BY overall DESC, player_id DESC`,
      parameters,
    );
    return {
      columns,
      rows: rowsAsArrays(rows, columns),
      page: 1,
      pageSize: rows.length,
      totalRows,
      sourceRows: totalRows,
      totalPages: 1,
      generatedAt: getGeneratedAt(),
      source: "sqlite-runtime",
    };
  }

  const requestedPageSize = Number(request.query?.pageSize);
  const pageSize = Math.max(
    1,
    Math.min(2500, Number.isFinite(requestedPageSize) ? Math.trunc(requestedPageSize) : 2000),
  );
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const requestedPage = Number(request.query?.page);
  const page = Math.max(
    1,
    Math.min(totalPages, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1),
  );
  const rows = queryRows(
    `SELECT ${selectList(columns)} FROM players${where} ORDER BY player_id LIMIT ? OFFSET ?`,
    [...parameters, pageSize, (page - 1) * pageSize],
  );
  return {
    columns,
    rows: rowsAsArrays(rows, columns),
    page,
    pageSize,
    totalRows,
    sourceRows: totalRows,
    totalPages,
    generatedAt: getGeneratedAt(),
    source: "sqlite-runtime",
  };
}


module.exports = {
  bootstrapData,
  searchData,
  summaryData,
  databaseStatsData,
  mflStatsData,
};
