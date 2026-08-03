const fs = require("node:fs/promises");
const path = require("node:path");

const CACHE_TTL_MS = 5 * 60 * 1000;
const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
const EXCLUDED_WALLET_NAMES = new Set(["mfl", "mfl wallet", "mfl trade"]);
let cachedPayload = null;
let cachedAt = 0;
let payloadPromise = null;

async function findFile(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next Vercel or local data location.
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

async function readDataJson(fileName) {
  const filePath = await findDataFile(fileName);
  if (!filePath) {
    throw new Error(`Data file not found: ${fileName}`);
  }
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function displayedOverall(row, indexes) {
  const positions = String(row[indexes.positions] || "");
  const primaryPosition = positions.split(",")[0].trim().toUpperCase();
  const rawValue = primaryPosition === "GK"
    ? row[indexes.goalkeeping]
    : row[indexes.overall];
  const value = Number(rawValue);
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

function nullableInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function normalizeWalletAddress(value) {
  const address = String(value || "").trim().toLowerCase();
  if (!address) return "";
  return address.startsWith("0x") ? address : `0x${address}`;
}

function normalizeWalletName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function isExcludedWallet(row, indexes) {
  const walletAddress = normalizeWalletAddress(row[indexes.walletAddress]);
  const walletName = normalizeWalletName(row[indexes.walletName]);
  return walletAddress === MFL_WALLET_ADDRESS || EXCLUDED_WALLET_NAMES.has(walletName);
}

async function buildPayload() {
  const manifest = await readDataJson("manifest.json");
  const publicFile = manifest?.files?.public?.file
    || manifest?.chunks?.[0]?.file
    || "players_public.json";
  const data = await readDataJson(publicFile);
  const columns = Array.isArray(data?.columns) ? data.columns : [];
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const indexes = {
    positions: columns.indexOf("positions"),
    overall: columns.indexOf("overall"),
    goalkeeping: columns.indexOf("goalkeeping"),
    age: columns.indexOf("age"),
    retirementYears: columns.indexOf("retirement_years"),
    walletAddress: columns.indexOf("wallet_address"),
    walletName: columns.indexOf("wallet_name"),
  };

  if (Object.values(indexes).some((index) => index < 0)) {
    throw new Error("Database stats columns are unavailable.");
  }

  const groups = new Map();
  let totalPlayers = 0;
  let totalActivePlayers = 0;
  for (const row of rows) {
    if (!Array.isArray(row) || isExcludedWallet(row, indexes)) continue;
    const overall = displayedOverall(row, indexes);
    if (overall === null) continue;
    const age = nullableInteger(row[indexes.age]);
    const retirementYears = nullableInteger(row[indexes.retirementYears]);
    const key = `${overall}|${age === null ? "" : age}|${retirementYears === null ? "" : retirementYears}`;
    const current = groups.get(key);
    if (current) {
      current[3] += 1;
    } else {
      groups.set(key, [overall, age, retirementYears, 1]);
    }
    totalPlayers += 1;
    if (retirementYears !== 0) totalActivePlayers += 1;
  }

  return {
    generatedAt: data.generated_at || data.generatedAt || manifest.generated_at || manifest.generatedAt || null,
    totalPlayers,
    totalActivePlayers,
    excludedWallets: ["MFL", "MFL Trade"],
    columns: ["overall", "age", "retirement_years", "count"],
    rows: Array.from(groups.values()).sort((left, right) => (
      left[0] - right[0]
      || (left[1] ?? -1) - (right[1] ?? -1)
      || (left[2] ?? -1) - (right[2] ?? -1)
    )),
  };
}

async function databaseStatsPayload() {
  if (cachedPayload && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedPayload;
  }
  if (!payloadPromise) {
    payloadPromise = buildPayload()
      .then((payload) => {
        cachedPayload = payload;
        cachedAt = Date.now();
        return payload;
      })
      .finally(() => {
        payloadPromise = null;
      });
  }
  return payloadPromise;
}

module.exports = async function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const payload = await databaseStatsPayload();
    response.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
    response.status(200).json(payload);
  } catch (error) {
    console.error("Could not build Database Stats.", error);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(500).json({ error: error?.message || "Could not load Database Stats." });
  }
};
