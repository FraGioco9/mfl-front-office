const fs = require("node:fs/promises");
const path = require("node:path");

const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
const STATS_COLUMNS = ["player_id", "wallet_address", "wallet_name", "age", "owned_since", "overall", "player_seasons"];
const HIDDEN_JOINED_DAYS = new Set([
  Date.UTC(2025, 9, 9) / 86400000,
  Date.UTC(2025, 9, 10) / 86400000,
]);
const PLAYER_DATA_FILE = /^players_(?:\d{4}|public|mfl_public)\.json$/i;

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
  const normalizedName = path.basename(String(fileName || ""));
  const filePath = await findDataFile(normalizedName);
  if (filePath) return JSON.parse(await fs.readFile(filePath, "utf8"));

  const origin = requestOrigin(request);
  if (!origin) throw new Error(`Data file not found: ${normalizedName}`);
  const response = await fetch(`${origin}/data/${encodeURIComponent(normalizedName)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Data file not found: ${normalizedName}`);
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

function compareOverallDescending(a, b) {
  const aValue = Number(valueFromRow(a.row, a.columns, "overall"));
  const bValue = Number(valueFromRow(b.row, b.columns, "overall"));
  const aValid = Number.isFinite(aValue);
  const bValid = Number.isFinite(bValue);
  if (aValid && bValid && aValue !== bValue) return bValue - aValue;
  if (aValid !== bValid) return aValid ? -1 : 1;
  return Number(valueFromRow(b.row, b.columns, "player_id") || 0)
    - Number(valueFromRow(a.row, a.columns, "player_id") || 0);
}

function addManifestPlayerFiles(value, output) {
  if (typeof value === "string") {
    const fileName = path.basename(value.trim());
    if (PLAYER_DATA_FILE.test(fileName)) output.add(fileName);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => addManifestPlayerFiles(entry, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.values(value).forEach((entry) => addManifestPlayerFiles(entry, output));
}

function manifestDataFiles(manifest) {
  const files = new Set();
  addManifestPlayerFiles(manifest, files);

  const publicFile = path.basename(String(manifest?.files?.public?.file || "").trim());
  const mflFile = path.basename(String(manifest?.files?.mfl_public?.file || "").trim());
  if (PLAYER_DATA_FILE.test(publicFile)) files.add(publicFile);
  if (PLAYER_DATA_FILE.test(mflFile)) files.add(mflFile);
  files.add("players_public.json");
  files.add("players_mfl_public.json");

  const rowCount = Number(manifest?.row_count || manifest?.total_rows || 0);
  const hintedChunks = Number(manifest?.chunk_count || manifest?.chunks_count || 0);
  const estimatedChunks = Number.isFinite(rowCount) && rowCount > 0 ? Math.ceil(rowCount / 5000) : 0;
  const scanCount = Math.min(100, Math.max(hintedChunks, estimatedChunks));
  for (let index = 0; index <= scanCount; index += 1) {
    files.add(`players_${String(index).padStart(4, "0")}.json`);
  }

  return [...files];
}

module.exports = async function mflStatsHandler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const manifest = await readDataJson("manifest.json", request);
    const fileNames = manifestDataFiles(manifest);
    const settled = await Promise.allSettled(fileNames.map((fileName) => readDataJson(fileName, request)));
    const dataSets = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((data) => Array.isArray(data?.columns) && Array.isArray(data?.rows));

    if (!dataSets.length) throw new Error("No player data files were available.");

    const selectedColumns = STATS_COLUMNS.filter((column) => dataSets.some((data) => data.columns.includes(column)));
    const playersById = new Map();

    dataSets.forEach((data) => {
      const columns = data.columns;
      data.rows.forEach((row) => {
        if (!isMflWalletPlayer(row, columns) || hasHiddenJoinedDate(row, columns)) return;
        const playerId = String(valueFromRow(row, columns, "player_id") || "").trim();
        if (!playerId) return;

        const current = playersById.get(playerId);
        if (!current || columns.length > current.columns.length) {
          playersById.set(playerId, { row, columns });
        }
      });
    });

    const entries = Array.from(playersById.values()).sort(compareOverallDescending);
    const selectedRows = entries.map(({ row, columns }) => (
      selectedColumns.map((column) => valueFromRow(row, columns, column))
    ));

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
