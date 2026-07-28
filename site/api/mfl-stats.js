const fs = require("node:fs/promises");
const path = require("node:path");

const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
const STATS_COLUMNS = ["player_id", "wallet_address", "wallet_name", "age", "owned_since", "overall", "player_seasons"];
const HIDDEN_JOINED_DAYS = new Set([
  Date.UTC(2025, 9, 9) / 86400000,
  Date.UTC(2025, 9, 10) / 86400000,
]);

async function findFile(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next local or Vercel path.
    }
  }
  return null;
}

async function findDataFile(fileName) {
  return findFile([
    path.join(__dirname, "data-files", fileName),
    path.join(__dirname, "..", "data", fileName),
    path.join(process.cwd(), "api", "data-files", fileName),
    path.join(process.cwd(), "data", fileName),
    path.join(process.cwd(), "site", "api", "data-files", fileName),
    path.join(process.cwd(), "site", "data", fileName),
  ]);
}

function requestOrigin(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  if (!host) return "";
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}

async function readDataJson(fileName, request) {
  const filePath = await findDataFile(fileName);
  if (filePath) return JSON.parse(await fs.readFile(filePath, "utf8"));

  const origin = requestOrigin(request);
  if (!origin) throw new Error(`Data file not found: ${fileName}`);
  const response = await fetch(`${origin}/data/${encodeURIComponent(fileName)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Data file not found: ${fileName}`);
  return response.json();
}

function valueFromRow(row, columns, column) {
  const index = columns.indexOf(column);
  return index >= 0 ? row[index] : null;
}

function normalizeWalletAddress(address) {
  const value = String(address || "").trim().toLowerCase();
  return value ? (value.startsWith("0x") ? value : `0x${value}`) : "";
}

function isMflWalletPlayer(row, columns) {
  const wallet = normalizeWalletAddress(valueFromRow(row, columns, "wallet_address"));
  const walletName = String(valueFromRow(row, columns, "wallet_name") || "").trim().toLowerCase();
  return wallet === MFL_WALLET_ADDRESS || walletName === "mfl";
}

function epochDay(value) {
  let numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    const parsed = Date.parse(String(value || ""));
    numeric = Number.isFinite(parsed) ? parsed : NaN;
  }
  if (!Number.isFinite(numeric)) return null;
  if (Math.abs(numeric) < 100000000000) numeric *= 1000;
  const date = new Date(numeric);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
}

function hasHiddenJoinedDate(row, columns) {
  if (!isMflWalletPlayer(row, columns)) return false;
  const joinedDay = epochDay(valueFromRow(row, columns, "owned_since"));
  return joinedDay !== null && HIDDEN_JOINED_DAYS.has(joinedDay);
}

function compareOverallDescending(a, b, columns) {
  const aValue = Number(valueFromRow(a, columns, "overall"));
  const bValue = Number(valueFromRow(b, columns, "overall"));
  const aValid = Number.isFinite(aValue);
  const bValid = Number.isFinite(bValue);
  if (aValid && bValid && aValue !== bValue) return bValue - aValue;
  if (aValid !== bValid) return aValid ? -1 : 1;
  return Number(valueFromRow(b, columns, "player_id") || 0) - Number(valueFromRow(a, columns, "player_id") || 0);
}

module.exports = async function mflStatsHandler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const manifest = await readDataJson("manifest.json", request);
    const fileName = manifest?.files?.mfl_public?.file || "players_mfl_public.json";
    const data = await readDataJson(fileName, request);
    const columns = Array.isArray(data?.columns) ? data.columns : [];
    const sourceRows = Array.isArray(data?.rows) ? data.rows : [];
    const rows = sourceRows
      .filter((row) => isMflWalletPlayer(row, columns) && !hasHiddenJoinedDate(row, columns))
      .sort((a, b) => compareOverallDescending(a, b, columns));
    const selectedColumns = STATS_COLUMNS.filter((column) => columns.includes(column));
    const selectedIndexes = selectedColumns.map((column) => columns.indexOf(column));
    const selectedRows = rows.map((row) => selectedIndexes.map((index) => row[index]));

    response.status(200).json({
      columns: selectedColumns,
      rows: selectedRows,
      page: 1,
      pageSize: selectedRows.length,
      totalRows: selectedRows.length,
      sourceRows: selectedRows.length,
      totalPages: 1,
      generatedAt: manifest?.generated_at || null,
    });
  } catch (error) {
    response.status(500).json({
      error: `Could not load MFL wallet stats: ${error.message}`,
    });
  }
};
