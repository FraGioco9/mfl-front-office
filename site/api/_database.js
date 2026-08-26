const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DATABASE_FILE = "mfl_database.db";
const DATABASE_CANDIDATES = [
  path.join(__dirname, "data-files", DATABASE_FILE),
  path.join(process.cwd(), "api", "data-files", DATABASE_FILE),
  path.join(process.cwd(), "site", "api", "data-files", DATABASE_FILE),
  path.join(process.cwd(), DATABASE_FILE),
];

const PLAYER_COLUMNS = Object.freeze([
  "player_id",
  "wallet_address",
  "wallet_name",
  "name",
  "positions",
  "age",
  "nationality",
  "preferred_foot",
  "height",
  "retirement_years",
  "owned_since",
  "active_contract_revenue_share",
  "active_contract_club_id",
  "active_contract_club_name",
  "active_contract_club_division",
  "overall",
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defense",
  "physical",
  "goalkeeping",
  "player_seasons",
  "overall_prog_all",
  "pace_prog_all",
  "shooting_prog_all",
  "passing_prog_all",
  "dribbling_prog_all",
  "defense_prog_all",
  "physical_prog_all",
  "goalkeeping_prog_all",
  "overall_prog_current_season",
  "pace_prog_current_season",
  "shooting_prog_current_season",
  "passing_prog_current_season",
  "dribbling_prog_current_season",
  "defense_prog_current_season",
  "physical_prog_current_season",
  "goalkeeping_prog_current_season",
  "next_overall",
  "next_overall_gap",
  "pace_to_next_overall",
  "shooting_to_next_overall",
  "passing_to_next_overall",
  "dribbling_to_next_overall",
  "defense_to_next_overall",
  "physical_to_next_overall",
  "goalkeeping_to_next_overall",
]);

const PROGRESSION_COLUMNS = Object.freeze([
  "player_id",
  "overall_prog_all",
  "pace_prog_all",
  "shooting_prog_all",
  "passing_prog_all",
  "dribbling_prog_all",
  "defense_prog_all",
  "physical_prog_all",
  "goalkeeping_prog_all",
  "overall_prog_current_season",
  "pace_prog_current_season",
  "shooting_prog_current_season",
  "passing_prog_current_season",
  "dribbling_prog_current_season",
  "defense_prog_current_season",
  "physical_prog_current_season",
  "goalkeeping_prog_current_season",
]);

const PUBLIC_COLUMNS = Object.freeze(PLAYER_COLUMNS.filter((column) => (
  column === "player_id" || !PROGRESSION_COLUMNS.includes(column)
)));
const SEARCH_PLAYER_COLUMNS = Object.freeze([
  "player_id",
  "name",
  "overall",
  "nationality",
  "positions",
  "retirement_years",
]);
const VALID_PLAYER_COLUMNS = new Set(PLAYER_COLUMNS);

let database = null;
let databasePath = "";
let generatedAt = "";
let marketplacePrices = Object.freeze({});
const TABLE_EXISTS_CACHE = new Map();

function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizeWalletName(value) {
  return normalizeSearchText(value).replace(/[\s_-]+/g, " ");
}

function resolveDatabasePath() {
  if (databasePath && fs.existsSync(databasePath)) return databasePath;
  databasePath = DATABASE_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || "";
  if (!databasePath) {
    throw new Error(`Database not found. Expected ${DATABASE_FILE} in api/data-files.`);
  }
  return databasePath;
}

function setMarketplacePrices(prices) {
  const next = {};
  if (prices && typeof prices === "object" && !Array.isArray(prices)) {
    Object.entries(prices).forEach(([playerId, value]) => {
      const numericPlayerId = Number(playerId);
      const price = Number(value);
      if (!Number.isSafeInteger(numericPlayerId) || numericPlayerId <= 0 || !Number.isFinite(price) || price < 0) return;
      next[String(numericPlayerId)] = price;
    });
  }
  marketplacePrices = Object.freeze(next);
}

function marketplacePrice(playerId) {
  const numericPlayerId = Number(playerId);
  if (!Number.isSafeInteger(numericPlayerId) || numericPlayerId <= 0) return null;
  const value = marketplacePrices[String(numericPlayerId)];
  return Number.isFinite(value) ? value : null;
}

function getDatabase() {
  if (database) return database;

  const filePath = resolveDatabasePath();
  database = new DatabaseSync(filePath, { readOnly: true });
  database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON;");
  database.function("normalize_search", { deterministic: true }, normalizeSearchText);
  database.function("normalize_wallet_name", { deterministic: true }, normalizeWalletName);
  database.function("marketplace_price", marketplacePrice);

  const tables = new Set(
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String(row.name)),
  );
  for (const requiredTable of ["players", "wallets", "runtime_metadata"]) {
    if (!tables.has(requiredTable)) {
      throw new Error(`Database is incomplete: missing ${requiredTable} table.`);
    }
  }

  const availablePlayerColumns = new Set(
    database.prepare("PRAGMA table_info(players)").all().map((row) => String(row.name)),
  );
  const missingColumns = PLAYER_COLUMNS.filter((column) => !availablePlayerColumns.has(column));
  if (missingColumns.length) {
    throw new Error(`Database is incomplete: missing player columns ${missingColumns.join(", ")}.`);
  }

  const generatedAtRow = database.prepare(
    "SELECT value FROM runtime_metadata WHERE key = ? LIMIT 1",
  ).get("generated_at");
  generatedAt = String(generatedAtRow?.value || "").trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("Database is incomplete: missing valid runtime_metadata generated_at value.");
  }
  return database;
}

function getGeneratedAt() {
  getDatabase();
  return generatedAt;
}

function tableExists(tableName) {
  const name = String(tableName || "");
  if (!/^[a-zA-Z0-9_]+$/.test(name)) return false;
  if (TABLE_EXISTS_CACHE.has(name)) return TABLE_EXISTS_CACHE.get(name);
  const exists = Boolean(queryOne(
    "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    [name],
  ));
  TABLE_EXISTS_CACHE.set(name, exists);
  return exists;
}

function quoteIdentifier(value) {
  const name = String(value || "");
  if (!VALID_PLAYER_COLUMNS.has(name)) {
    throw new Error(`Unsupported player column: ${name}`);
  }
  return `"${name}"`;
}

function selectList(columns) {
  return columns.map(quoteIdentifier).join(", ");
}

function rowsAsArrays(rows, columns) {
  return rows.map((row) => columns.map((column) => row[column] ?? null));
}

function queryRows(sql, parameters = []) {
  return getDatabase().prepare(sql).all(...parameters);
}

function queryOne(sql, parameters = []) {
  return getDatabase().prepare(sql).get(...parameters) || null;
}

module.exports = {
  DATABASE_FILE,
  PLAYER_COLUMNS,
  PROGRESSION_COLUMNS,
  PUBLIC_COLUMNS,
  SEARCH_PLAYER_COLUMNS,
  VALID_PLAYER_COLUMNS,
  getDatabase,
  getGeneratedAt,
  normalizeSearchText,
  normalizeWalletName,
  tableExists,
  quoteIdentifier,
  selectList,
  rowsAsArrays,
  setMarketplacePrices,
  queryRows,
  queryOne,
};
