const {
  PLAYER_COLUMNS,
  PUBLIC_COLUMNS,
  VALID_PLAYER_COLUMNS,
  getGeneratedAt,
  normalizeSearchText,
  queryRows,
  queryOne,
  quoteIdentifier,
  rowsAsArrays,
  setMarketplacePrices,
} = require("./_database");
const { normalizeWalletAddress } = require("./_data-auth");
const { marketplaceState } = require("./_marketplace-state");
const {
  MFL_WALLET_ADDRESS,
  STAT_COLUMNS,
  NUMBER_COLUMNS,
  POSITION_ORDER,
  TABLE_SCOPES,
  placeholders,
  appendCondition,
  mflCondition,
  hiddenMflJoinedDateCondition,
} = require("./_data-query");

const LISTING_COLUMN = "listing_price";
const LISTING_PRICE_SQL = "marketplace_price(player_id)";

function columnsWithListing(columns) {
  const next = [...columns];
  const nameIndex = next.indexOf("name");
  if (nameIndex >= 0) next.splice(nameIndex + 1, 0, LISTING_COLUMN);
  else next.push(LISTING_COLUMN);
  return next;
}

function selectListWithListing(columns) {
  return columns
    .map((column) => column === LISTING_COLUMN
      ? `${LISTING_PRICE_SQL} AS "${LISTING_COLUMN}"`
      : quoteIdentifier(column))
    .join(", ");
}

function safeRules(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ruleSql(rule, parameters) {
  const column = String(rule?.column || "");
  const operator = String(rule?.operator || "");
  const value = rule?.value;

  if (column === "contract_status") {
    if (value === "development_center") {
      return "normalize_search(active_contract_club_name) = 'development center'";
    }
    if (value === "under_contract") {
      return "normalize_search(active_contract_club_name) <> 'development center' AND (coalesce(active_contract_club_name, '') <> '' OR coalesce(active_contract_club_id, '') <> '')";
    }
    if (value === "free_agent") {
      return "normalize_search(active_contract_club_name) <> 'development center' AND coalesce(active_contract_club_name, '') = '' AND coalesce(active_contract_club_id, '') = ''";
    }
    return "0";
  }

  if (column === LISTING_COLUMN) {
    if (value === "for_sale") return `${LISTING_PRICE_SQL} IS NOT NULL`;
    if (value === "not_for_sale") return `${LISTING_PRICE_SQL} IS NULL`;
    return "0";
  }

  if (!VALID_PLAYER_COLUMNS.has(column)) return "0";
  const quotedColumn = quoteIdentifier(column);

  if (column === "positions") {
    parameters.push(String(value || ""));
    if (operator === "primary_is") {
      return `trim(CASE WHEN instr(${quotedColumn}, ',') > 0 THEN substr(${quotedColumn}, 1, instr(${quotedColumn}, ',') - 1) ELSE ${quotedColumn} END) = ?`;
    }
    if (operator === "can_play") {
      return `(',' || replace(coalesce(${quotedColumn}, ''), ' ', '') || ',') LIKE '%,' || replace(?, ' ', '') || ',%'`;
    }
    return "0";
  }

  if (column === "nationality") {
    parameters.push(String(value || ""));
    return `${quotedColumn} = ?`;
  }


if (column === "owned_since") {
  const fallbackStart = Date.parse(`${String(value || "")}T00:00:00Z`) / 1000;
  if (!Number.isFinite(fallbackStart)) return "0";

  const suppliedStart = rule?.valueDayStartEpochSeconds;
  const suppliedNext = rule?.valueNextDayStartEpochSeconds;
  const fromStart = suppliedStart !== null
    && suppliedStart !== undefined
    && Number.isFinite(Number(suppliedStart))
    ? Number(suppliedStart)
    : fallbackStart;
  const fromNext = suppliedNext !== null
    && suppliedNext !== undefined
    && Number.isFinite(Number(suppliedNext))
    ? Number(suppliedNext)
    : fallbackStart + 86400;

  if (operator === "during") {
    const fallbackToStart = Date.parse(`${String(rule?.valueTo || "")}T00:00:00Z`) / 1000;
    if (!Number.isFinite(fallbackToStart)) return "0";
    const suppliedToStart = rule?.valueToDayStartEpochSeconds;
    const suppliedToNext = rule?.valueToNextDayStartEpochSeconds;
    const toStart = suppliedToStart !== null
      && suppliedToStart !== undefined
      && Number.isFinite(Number(suppliedToStart))
      ? Number(suppliedToStart)
      : fallbackToStart;
    const toNext = suppliedToNext !== null
      && suppliedToNext !== undefined
      && Number.isFinite(Number(suppliedToNext))
      ? Number(suppliedToNext)
      : fallbackToStart + 86400;
    parameters.push(Math.min(fromStart, toStart), Math.max(fromNext, toNext));
    return `${normalizedEpochSeconds(quotedColumn)} >= ? AND ${normalizedEpochSeconds(quotedColumn)} < ?`;
  }

  if (!["before", "after"].includes(operator)) return "0";
  parameters.push(fromStart);
  return `${normalizedEpochSeconds(quotedColumn)} ${operator === "before" ? "<" : ">="} ?`;
}

  const numeric = NUMBER_COLUMNS.has(column)
    || column.includes("_prog_")
    || column.includes("_to_next_overall");
  if (numeric) {
    const number = Number(value);
    if (operator === "between") {
      const numberTo = Number(rule?.valueTo);
      if (!Number.isFinite(number) || !Number.isFinite(numberTo)) return "0";
      parameters.push(Math.min(number, numberTo), Math.max(number, numberTo));
      return `${quotedColumn} BETWEEN ? AND ?`;
    }
    if (!Number.isFinite(number) || !["=", "!=", "<", "<=", ">", ">="].includes(operator)) {
      return "0";
    }
    parameters.push(number);
    return `${quotedColumn} ${operator} ?`;
  }

  const normalizedValue = normalizeSearchText(value);
  parameters.push(normalizedValue);
  const nonBlank = `${quotedColumn} IS NOT NULL AND CAST(${quotedColumn} AS TEXT) <> ''`;
  if (operator === "contains") {
    return `${nonBlank} AND normalize_search(${quotedColumn}) LIKE '%' || ? || '%'`;
  }
  if (operator === "not_contains") {
    return `${nonBlank} AND normalize_search(${quotedColumn}) NOT LIKE '%' || ? || '%'`;
  }
  if (operator === "=") {
    return `${nonBlank} AND normalize_search(${quotedColumn}) = ?`;
  }
  if (operator === "!=") {
    return `${nonBlank} AND normalize_search(${quotedColumn}) <> ?`;
  }
  return "0";
}

function normalizedEpochSeconds(quotedColumn) {
  return `(CASE WHEN CAST(${quotedColumn} AS REAL) > 100000000000 THEN CAST(${quotedColumn} AS REAL) / 1000.0 ELSE CAST(${quotedColumn} AS REAL) END)`;
}

function appendAdvancedRules(conditions, parameters, rules) {
  if (!rules.length) return;

  let expression = "";
  rules.forEach((rule, index) => {
    const current = `(${ruleSql(rule, parameters)})`;
    if (index === 0) {
      expression = current;
      return;
    }
    const connector = String(rule?.connector || "and").toLowerCase() === "or"
      ? "OR"
      : "AND";
    expression = `(${expression} ${connector} ${current})`;
  });
  if (expression) conditions.push(`(${expression})`);
}

function orderSql(scope, view, sortKey, sortDirection) {
  if (scope === "club") {
    const primaryPosition = "upper(trim(CASE WHEN instr(positions, ',') > 0 THEN substr(positions, 1, instr(positions, ',') - 1) ELSE positions END))";
    const positionCases = POSITION_ORDER
      .map((position, index) => `WHEN '${position}' THEN ${index}`)
      .join(" ");
    return `CASE ${primaryPosition} ${positionCases} ELSE ${POSITION_ORDER.length} END ASC, overall DESC, player_id DESC`;
  }

  const direction = String(sortDirection).toLowerCase() === "asc" ? "ASC" : "DESC";
  const requestedKey = String(sortKey || "");
  if (requestedKey === LISTING_COLUMN) {
    return `${LISTING_PRICE_SQL} IS NULL, ${LISTING_PRICE_SQL} ${direction}, player_id DESC`;
  }
  const key = VALID_PLAYER_COLUMNS.has(requestedKey) ? requestedKey : "overall";

  if (view === "next" && STAT_COLUMNS.has(key)) {
    const derived = key === "overall" ? "next_overall_gap" : `${key}_to_next_overall`;
    const gapDirection = direction === "DESC" ? "ASC" : "DESC";
    const currentValue = key === "overall" ? "next_overall" : key;
    return `${quoteIdentifier(derived)} IS NULL, ${quoteIdentifier(derived)} ${gapDirection}, ${quoteIdentifier(currentValue)} ${direction}, player_id DESC`;
  }

  if (["current", "all"].includes(view) && STAT_COLUMNS.has(key)) {
    const derived = `${key}_${view === "current" ? "prog_current_season" : "prog_all"}`;
    return `${quoteIdentifier(derived)} IS NULL, ${quoteIdentifier(derived)} ${direction}, ${quoteIdentifier(key)} ${direction}, player_id DESC`;
  }

  if (key === "active_contract_club_division") {
    return `CAST(active_contract_club_division AS INTEGER) ${direction === "ASC" ? "DESC" : "ASC"}, player_id DESC`;
  }

  const quotedKey = quoteIdentifier(key);
  if (NUMBER_COLUMNS.has(key)) {
    return `${quotedKey} IS NULL, ${quotedKey} ${direction}, player_id DESC`;
  }
  return `${quotedKey} IS NULL, ${quotedKey} COLLATE NOCASE ${direction}, player_id DESC`;
}

function integerIds(value, maximum = 5000) {
  const values = String(value || "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isSafeInteger(entry) && entry > 0);
  return [...new Set(values)].slice(0, maximum);
}

function progressionActivityCondition(view) {
  if (!["current", "all"].includes(view)) return "";
  const suffix = view === "current" ? "prog_current_season" : "prog_all";
  return `(${Array.from(STAT_COLUMNS)
    .map((column) => `coalesce(${quoteIdentifier(`${column}_${suffix}`)}, 0) > 0`)
    .join(" OR ")})`;
}

async function pagedData(request, signedWallet, fullAccess, ownedProgression) {
  const query = request.query || {};
  const scope = String(query.scope || "database").toLowerCase();
  const view = String(query.view || "attributes").toLowerCase();
  const progressionRequested = String(query.includeProgression || "") === "1"
    || ["current", "all"].includes(view);
  const includeProgression = progressionRequested && (fullAccess || ownedProgression);
  const databaseColumns = includeProgression ? PLAYER_COLUMNS : PUBLIC_COLUMNS;
  const columns = columnsWithListing(databaseColumns);
  const marketplace = await marketplaceState();
  setMarketplacePrices(marketplace.prices);
  const baseConditions = [];
  const baseParameters = [];
  const playerIds = integerIds(query.playerIds);

  if (ownedProgression && !fullAccess) {
    appendCondition(
      baseConditions,
      baseParameters,
      "wallet_address = ?",
      normalizeWalletAddress(signedWallet),
    );
  }

  if (scope === "progression") {
    appendCondition(baseConditions, baseParameters, `NOT ${mflCondition()}`, MFL_WALLET_ADDRESS);
    const activityCondition = progressionActivityCondition(view);
    if (activityCondition) baseConditions.push(activityCondition);
  } else if (["mfl", "mflstats"].includes(scope)) {
    appendCondition(baseConditions, baseParameters, mflCondition(), MFL_WALLET_ADDRESS);
  } else if (scope === "agent") {
    appendCondition(
      baseConditions,
      baseParameters,
      "wallet_address = ?",
      normalizeWalletAddress(query.walletAddress),
    );
  } else if (scope === "myplayers") {
    if (signedWallet) {
      appendCondition(
        baseConditions,
        baseParameters,
        "wallet_address = ?",
        normalizeWalletAddress(signedWallet),
      );
    } else {
      baseConditions.push("0");
    }
  } else if (["watchlist", "players"].includes(scope)) {
    if (playerIds.length) {
      appendCondition(
        baseConditions,
        baseParameters,
        `player_id IN (${placeholders(playerIds)})`,
        ...playerIds,
      );
    } else {
      baseConditions.push("0");
    }
  } else if (scope === "club") {
    appendCondition(
      baseConditions,
      baseParameters,
      "active_contract_club_id = ?",
      String(query.clubId || ""),
    );
  } else if (["player", "evaluation"].includes(scope)) {
    const playerId = Number(query.playerId);
    if (Number.isSafeInteger(playerId) && playerId > 0) {
      appendCondition(baseConditions, baseParameters, "player_id = ?", playerId);
    } else {
      baseConditions.push("0");
    }
  }

  if (TABLE_SCOPES.has(scope)) {
    appendCondition(
      baseConditions,
      baseParameters,
      hiddenMflJoinedDateCondition(),
      MFL_WALLET_ADDRESS,
    );
  }

  const sourceWhere = baseConditions.length
    ? ` WHERE ${baseConditions.join(" AND ")}`
    : "";
  const sourceRows = Number(queryOne(
    `SELECT count(*) AS count FROM players${sourceWhere}`,
    baseParameters,
  )?.count || 0);

  const conditions = [...baseConditions];
  const parameters = [...baseParameters];

  if (String(query.hideRetired || "") === "1") {
    conditions.push("coalesce(retirement_years, -1) <> 0");
  }
  if (String(query.hideRetiring || "") === "1") {
    conditions.push("coalesce(retirement_years, -1) NOT IN (1, 2, 3)");
  }
  if (scope === "database" && String(query.hideMfl || "") === "1") {
    appendCondition(conditions, parameters, `NOT ${mflCondition()}`, MFL_WALLET_ADDRESS);
  }
  if (scope === "mfl" && String(query.packableOnly || "") === "1") {
    conditions.push("player_seasons = 1");
  }
  if (String(query.newMintsOnly || "") === "1") {
    conditions.push(scope === "mfl" ? "player_seasons >= 2" : "player_seasons = 1");
  }
  appendAdvancedRules(conditions, parameters, safeRules(query.filters));

  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const totalRows = Number(queryOne(
    `SELECT count(*) AS count FROM players${where}`,
    parameters,
  )?.count || 0);

  const allRows = ["player", "players", "evaluation", "club", "mflstats"].includes(scope);
  const maximumPageSize = allRows ? 5000 : 250;
  const requestedPageSize = Number(query.pageSize);
  const pageSize = scope === "mflstats"
    ? Math.max(1, totalRows)
    : Math.max(
      1,
      Math.min(
        maximumPageSize,
        Number.isFinite(requestedPageSize) ? Math.trunc(requestedPageSize) : 100,
      ),
    );
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const requestedPage = Number(query.page);
  const page = Math.max(
    1,
    Math.min(
      totalPages,
      Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1,
    ),
  );
  const offset = allRows ? 0 : (page - 1) * pageSize;
  const order = orderSql(
    scope,
    view,
    String(query.sortKey || (scope === "club" ? "positions" : "overall")),
    String(query.sortDirection || (scope === "club" ? "asc" : "desc")),
  );
  const rows = queryRows(
    `SELECT ${selectListWithListing(columns)} FROM players${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...parameters, pageSize, offset],
  );

  return {
    columns,
    rows: rowsAsArrays(rows, columns),
    page,
    pageSize,
    totalRows,
    sourceRows,
    totalPages,
    generatedAt: getGeneratedAt(),
    marketplaceGeneratedAt: marketplace.generatedAt,
    marketplaceFlowBlockHeight: marketplace.flowBlockHeight,
    source: "sqlite-runtime+flow-marketplace",
  };
}


module.exports = {
  LISTING_COLUMN,
  columnsWithListing,
  ruleSql,
  orderSql,
  integerIds,
  pagedData,
};
