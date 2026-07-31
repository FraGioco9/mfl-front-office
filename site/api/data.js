const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");
const fcl = require("@onflow/fcl");

fcl.config({ "accessNode.api": "https://rest-mainnet.onflow.org" });

const DATA_FILE_PATTERN = /^(manifest\.json|players_\d{4}\.json|players_public\.json|players_mfl_public\.json|players_progression\.json|players_search\.json|agents_search\.json)$/;
const PUBLIC_DATABASE_COLUMNS = [
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
  "next_overall",
  "next_overall_gap",
  "pace_to_next_overall",
  "shooting_to_next_overall",
  "passing_to_next_overall",
  "dribbling_to_next_overall",
  "defense_to_next_overall",
  "physical_to_next_overall",
  "goalkeeping_to_next_overall",
];
const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
const STAT_COLUMNS = ["overall", "pace", "shooting", "passing", "dribbling", "defense", "physical", "goalkeeping"];
const NUMBER_COLUMNS = new Set([
  "player_id",
  "age",
  "height",
  "retirement_years",
  "player_seasons",
  "owned_since",
  "active_contract_revenue_share",
  "active_contract_club_division",
  ...STAT_COLUMNS,
]);
const POSITION_ORDER = [
  "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "RM", "CM", "LM", "CAM", "RW", "CF", "LW", "ST",
];
const POSITION_RANK = new Map(POSITION_ORDER.map((position, index) => [position, index]));
const PUBLIC_CACHEABLE_DATA_FILES = new Set([
  "manifest.json",
  "players_public.json",
  "players_mfl_public.json",
  "players_search.json",
  "agents_search.json",
]);
const DATA_FILE_PATH_CACHE = new Map();
const DATA_JSON_CACHE = new Map();
const DATA_JSON_PROMISES = new Map();
const COLUMN_INDEX_CACHE = new WeakMap();
const MERGED_PROGRESSION_CACHE = new WeakMap();
const PUBLIC_RESPONSE_CACHE = new Map();
const WALLET_PERMISSION_CACHE = new Map();
const MAX_PUBLIC_RESPONSE_CACHE_ENTRIES = 75;
const PUBLIC_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const WALLET_PERMISSION_CACHE_TTL_MS = 60 * 1000;

function normalizeWalletAddress(address) {
  const value = String(address || "").trim().toLowerCase();
  return value ? (value.startsWith("0x") ? value : `0x${value}`) : "";
}

function signatureWalletAddresses(signatures) {
  return new Set((Array.isArray(signatures) ? signatures : [])
    .map((signature) => normalizeWalletAddress(signature?.addr || signature?.address))
    .filter(Boolean));
}
function walletAccessMessage() {
  return "MFL Front Office Dapper Opt-In";
}

function stringToHex(value) {
  return Buffer.from(value, "utf8").toString("hex");
}

function recordTiming(request, name, duration) {
  if (!request || !Number.isFinite(duration)) {
    return;
  }
  if (!request.mflDataTimings) {
    request.mflDataTimings = new Map();
  }
  request.mflDataTimings.set(name, (request.mflDataTimings.get(name) || 0) + duration);
}

function setBoundedCache(cache, key, value, maximumEntries) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  while (cache.size > maximumEntries) {
    cache.delete(cache.keys().next().value);
  }
}

function publicResponseCacheKey(request) {
  return String(request.url || request.originalUrl || "");
}

function getPublicResponseCache(request) {
  const key = publicResponseCacheKey(request);
  const cached = PUBLIC_RESPONSE_CACHE.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    PUBLIC_RESPONSE_CACHE.delete(key);
    return null;
  }
  PUBLIC_RESPONSE_CACHE.delete(key);
  PUBLIC_RESPONSE_CACHE.set(key, cached);
  return cached.data;
}

function setPublicResponseCache(request, data) {
  setBoundedCache(PUBLIC_RESPONSE_CACHE, publicResponseCacheKey(request), {
    data,
    expiresAt: Date.now() + PUBLIC_RESPONSE_CACHE_TTL_MS,
  }, MAX_PUBLIC_RESPONSE_CACHE_ENTRIES);
}

function requestHasWalletProof(request) {
  return Boolean(
    request.headers["x-dapper-wallet-address"]
    || request.headers["x-wallet-signing-address"]
    || request.headers["x-wallet-signatures"],
  );
}

function publicCacheableRequest(request, signedWallet, mode, fileName) {
  if (signedWallet || requestHasWalletProof(request)) {
    return false;
  }

  const accessMode = String(request.query.access || "");
  if (accessMode === "full-progression" || accessMode === "owned-progression") {
    return false;
  }

  if (mode === "bootstrap") {
    return true;
  }

  if (mode === "page") {
    const view = String(request.query.view || "attributes").toLowerCase();
    const scope = String(request.query.scope || "database").toLowerCase();
    return String(request.query.includeProgression || "") !== "1"
      && !["current", "all"].includes(view)
      && scope !== "myplayers";
  }

  return PUBLIC_CACHEABLE_DATA_FILES.has(fileName);
}

function responseGeneratedAt(data) {
  return String(
    data?.generatedAt
    || data?.generated_at
    || data?.manifest?.generated_at
    || "static",
  );
}

function responseEtag(request, data) {
  const seed = `${responseGeneratedAt(data)}|${publicResponseCacheKey(request)}`;
  return `"${crypto.createHash("sha1").update(seed).digest("base64url")}"`;
}

function setServerTiming(request, response, startedAt) {
  const timings = [];
  if (request?.mflDataTimings instanceof Map) {
    request.mflDataTimings.forEach((duration, name) => {
      const safeName = String(name).replace(/[^a-zA-Z0-9_-]/g, "_");
      timings.push(`${safeName};dur=${duration.toFixed(1)}`);
    });
  }
  timings.push(`total;dur=${Math.max(0, performance.now() - startedAt).toFixed(1)}`);
  response.setHeader("Server-Timing", timings.join(", "));
}

function sendJson(request, response, status, data, options = {}) {
  const cacheable = options.cacheable === true && status >= 200 && status < 300;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  setServerTiming(request, response, options.startedAt || performance.now());

  if (cacheable) {
    response.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
    response.setHeader("Vary", "x-dapper-wallet-address, x-wallet-signing-address, x-wallet-signatures");
    const etag = responseEtag(request, data);
    response.setHeader("ETag", etag);
    const requestEtags = String(request.headers["if-none-match"] || "")
      .split(",")
      .map((value) => value.trim());
    if (requestEtags.includes(etag) || requestEtags.includes("*")) {
      response.status(304).end();
      return;
    }
  } else {
    response.setHeader("Cache-Control", "private, no-store");
  }

  response.status(status).json(data);
}

async function findFile(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next possible Vercel/local path.
    }
  }

  return null;
}

async function findDataFile(fileName) {
  if (DATA_FILE_PATH_CACHE.has(fileName)) {
    return DATA_FILE_PATH_CACHE.get(fileName);
  }

  const lookup = findFile([
    path.join(__dirname, "data-files", fileName),
    path.join(__dirname, "..", "data", fileName),
    path.join(process.cwd(), "api", "data-files", fileName),
    path.join(process.cwd(), "data", fileName),
    path.join(process.cwd(), "site", "api", "data-files", fileName),
    path.join(process.cwd(), "site", "data", fileName),
  ]);
  DATA_FILE_PATH_CACHE.set(fileName, lookup);
  const filePath = await lookup;
  DATA_FILE_PATH_CACHE.set(fileName, filePath);
  return filePath;
}

function requestOrigin(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  if (!host) {
    return "";
  }

  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}

async function readDataJson(fileName, request) {
  const startedAt = performance.now();
  const filePath = await findDataFile(fileName);
  const origin = filePath ? "" : requestOrigin(request);

  if (!filePath && !origin) {
    throw new Error(`Data file not found: ${fileName}`);
  }

  const sourceKey = filePath
    ? `file:${filePath}`
    : `url:${origin}/data/${encodeURIComponent(fileName)}`;

  if (DATA_JSON_CACHE.has(sourceKey)) {
    recordTiming(request, "data_cache", performance.now() - startedAt);
    return DATA_JSON_CACHE.get(sourceKey);
  }

  let loadPromise = DATA_JSON_PROMISES.get(sourceKey);
  if (!loadPromise) {
    loadPromise = (async () => {
      if (filePath) {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
      }

      const staticResponse = await fetch(`${origin}/data/${encodeURIComponent(fileName)}`, {
        cache: "force-cache",
      });

      if (!staticResponse.ok) {
        throw new Error(`Data file not found: ${fileName}`);
      }

      return staticResponse.json();
    })()
      .then((data) => {
        DATA_JSON_CACHE.set(sourceKey, data);
        return data;
      })
      .finally(() => {
        DATA_JSON_PROMISES.delete(sourceKey);
      });
    DATA_JSON_PROMISES.set(sourceKey, loadPromise);
  }

  try {
    const data = await loadPromise;
    recordTiming(request, "data_read", performance.now() - startedAt);
    return data;
  } catch (error) {
    DATA_JSON_CACHE.delete(sourceKey);
    throw error;
  }
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

async function walletAllowed(wallet) {
  const normalizedWallet = normalizeWalletAddress(wallet).toLowerCase();
  const cached = WALLET_PERMISSION_CACHE.get(normalizedWallet);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowed;
  }

  const config = supabaseConfig();

  if (!config) {
    return false;
  }

  const response = await fetch(`${config.url}/rest/v1/wallet_permissions?select=wallet_address&wallet_address=eq.${encodeURIComponent(normalizedWallet)}&can_view_progression=eq.true&limit=1`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  });

  if (!response.ok) {
    console.warn(`Could not check wallet permissions: ${response.status} ${await response.text()}`);
    return false;
  }

  const rows = await response.json();
  const allowed = Array.isArray(rows) && rows.length > 0;
  WALLET_PERMISSION_CACHE.set(normalizedWallet, {
    allowed,
    expiresAt: Date.now() + WALLET_PERMISSION_CACHE_TTL_MS,
  });
  return allowed;
}

async function signedWalletFromRequest(request) {
  const wallet = normalizeWalletAddress(request.headers["x-dapper-wallet-address"]);
  const signingWallet = normalizeWalletAddress(request.headers["x-wallet-signing-address"] || wallet);
  const message = String(request.headers["x-wallet-message"] || "");
  const proofType = String(request.headers["x-wallet-proof-type"] || "user-signature");
  const appIdentifier = String(request.headers["x-wallet-app-identifier"] || walletAccessMessage());
  const nonce = String(request.headers["x-wallet-nonce"] || "");
  let signatures = [];

  try {
    signatures = JSON.parse(String(request.headers["x-wallet-signatures"] || "[]"));
  } catch {
    return "";
  }

  if (!wallet || !signingWallet || message !== walletAccessMessage(wallet, signingWallet) || !Array.isArray(signatures) || !signatures.length) {
    return "";
  }

  try {
    if (proofType === "account-proof") {
      const proofAddress = signingWallet || wallet;
      const verified = await fcl.AppUtils.verifyAccountProof(appIdentifier, {
        address: proofAddress,
        nonce,
        signatures,
      });

      if (verified) {
        return wallet;
      }

      if (proofAddress !== wallet) {
        return await fcl.AppUtils.verifyAccountProof(appIdentifier, {
          address: wallet,
          nonce,
          signatures,
        }) ? wallet : "";
      }

      return "";
    }

    if (!signatureWalletAddresses(signatures).has(signingWallet)) {
      return "";
    }

    return await fcl.AppUtils.verifyUserSignatures(stringToHex(message), signatures) ? wallet : "";
  } catch (error) {
    console.warn("Could not verify Dapper wallet proof.", error);

    if (proofType === "account-proof") {
      return nonce && signatures.length ? wallet : "";
    }

    return "";
  }
}

async function ownedPlayerIdsForWallet(request, wallet) {
  const manifest = await readDataJson("manifest.json", request);
  const publicFile = manifest?.files?.public?.file || manifest?.chunks?.[0]?.file || "players_public.json";
  const data = await readDataJson(publicFile, request);
  const playerIdIndex = data.columns?.indexOf("player_id") ?? -1;
  const walletAddressIndex = data.columns?.indexOf("wallet_address") ?? -1;

  if (!Array.isArray(data.rows) || playerIdIndex < 0 || walletAddressIndex < 0) {
    return new Set();
  }

  return new Set(data.rows
    .filter((row) => normalizeWalletAddress(row[walletAddressIndex]).toLowerCase() === wallet)
    .map((row) => String(row[playerIdIndex])));
}

async function verifyWalletProof(request) {
  const wallet = await signedWalletFromRequest(request);
  return Boolean(wallet && await walletAllowed(wallet));
}

function publicDataFile(manifest) {
  return manifest?.files?.public?.file || manifest?.chunks?.[0]?.file || "players_public.json";
}

function mflPublicDataFile(manifest) {
  return manifest?.files?.mfl_public?.file || "players_mfl_public.json";
}

function progressionDataFile(manifest) {
  return manifest?.files?.progression?.file || "players_progression.json";
}

function searchPlayersDataFile(manifest) {
  return manifest?.files?.search_players?.file || "players_search.json";
}

function searchAgentsDataFile(manifest) {
  return manifest?.files?.search_agents?.file || "agents_search.json";
}

function columnIndex(columns, column) {
  if (!Array.isArray(columns)) {
    return -1;
  }
  let indexes = COLUMN_INDEX_CACHE.get(columns);
  if (!indexes) {
    indexes = new Map(columns.map((name, index) => [name, index]));
    COLUMN_INDEX_CACHE.set(columns, indexes);
  }
  return indexes.has(column) ? indexes.get(column) : -1;
}

function valueFromRow(row, columns, column) {
  const index = columnIndex(columns, column);
  return index >= 0 ? row[index] : null;
}

function normalizeSearchText(value) {
  return String(value ?? "").trim().toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function isBlankValue(value) {
  return value === null || value === undefined || value === "" || String(value).toUpperCase() === "NULL";
}

function isDevelopmentCenterClubName(value) {
  return String(value || "").trim().toLowerCase() === "development center";
}

function rowHasActiveContract(row, columns) {
  const clubName = valueFromRow(row, columns, "active_contract_club_name");
  if (isDevelopmentCenterClubName(clubName)) {
    return false;
  }

  return !isBlankValue(clubName) || !isBlankValue(valueFromRow(row, columns, "active_contract_club_id"));
}

function contractStatusValue(row, columns) {
  const clubName = valueFromRow(row, columns, "active_contract_club_name");
  if (isDevelopmentCenterClubName(clubName)) {
    return "development_center";
  }

  return rowHasActiveContract(row, columns) ? "under_contract" : "free_agent";
}

function normalizedWalletFromRow(row, columns) {
  return normalizeWalletAddress(valueFromRow(row, columns, "wallet_address")).toLowerCase();
}

function rowIsMflWalletPlayer(row, columns) {
  const walletAddress = normalizedWalletFromRow(row, columns);
  const walletName = String(valueFromRow(row, columns, "wallet_name") || "").trim().toLowerCase();
  return walletAddress === MFL_WALLET_ADDRESS || walletName === "mfl";
}

function epochDay(value) {
  let numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    const parsedValue = Date.parse(String(value || ""));
    numericValue = Number.isFinite(parsedValue) ? parsedValue : NaN;
  }
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  if (Math.abs(numericValue) < 100000000000) {
    numericValue *= 1000;
  }
  const date = new Date(numericValue);
  return Number.isNaN(date.getTime()) ? null : Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
}

function filterDateDay(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

function rowHasHiddenMflJoinedAgencyDate(row, columns) {
  if (!rowIsMflWalletPlayer(row, columns)) {
    return false;
  }
  const joinedDay = epochDay(valueFromRow(row, columns, "owned_since"));
  return joinedDay !== null && [
    filterDateDay("2025-10-09"),
    filterDateDay("2025-10-10"),
  ].includes(joinedDay);
}

function safeJsonQuery(value, fallback) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function filterRuleMatches(row, columns, rule) {
  const column = String(rule?.column || "");
  const operator = String(rule?.operator || "");
  const filterValue = String(rule?.value ?? "");
  const rawValue = column === "contract_status"
    ? contractStatusValue(row, columns)
    : valueFromRow(row, columns, column);

  if (column === "contract_status") {
    return rawValue === filterValue;
  }

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return false;
  }

  if (column === "owned_since") {
    const rowDay = epochDay(rawValue);
    const fromDay = filterDateDay(filterValue);
    if (rowDay === null || fromDay === null) {
      return false;
    }
    if (operator === "before") return rowDay < fromDay;
    if (operator === "after") return rowDay > fromDay;
    if (operator === "during") {
      const toDay = filterDateDay(rule?.valueTo);
      if (toDay === null) return false;
      return rowDay >= Math.min(fromDay, toDay) && rowDay <= Math.max(fromDay, toDay);
    }
    return false;
  }

  if (column === "positions") {
    const positions = String(rawValue || "").split(",").map((position) => position.trim()).filter(Boolean);
    if (operator === "primary_is") return positions[0] === filterValue;
    if (operator === "can_play") return positions.includes(filterValue);
  }

  if (column === "nationality") {
    return String(rawValue) === filterValue;
  }

  const numericColumn = NUMBER_COLUMNS.has(column) || column.endsWith("_prog_all") || column.endsWith("_prog_current_season");
  if (numericColumn) {
    const rowNumber = Number(rawValue);
    const filterNumber = Number(filterValue);
    if (!Number.isFinite(rowNumber)) return false;
    if (operator === "between") {
      const filterNumberTo = Number(rule?.valueTo);
      if (!Number.isFinite(filterNumber) || !Number.isFinite(filterNumberTo)) return false;
      return rowNumber >= Math.min(filterNumber, filterNumberTo) && rowNumber <= Math.max(filterNumber, filterNumberTo);
    }
    if (!Number.isFinite(filterNumber)) return false;
    if (operator === "=") return rowNumber === filterNumber;
    if (operator === "!=") return rowNumber !== filterNumber;
    if (operator === "<") return rowNumber < filterNumber;
    if (operator === "<=") return rowNumber <= filterNumber;
    if (operator === ">") return rowNumber > filterNumber;
    if (operator === ">=") return rowNumber >= filterNumber;
    return false;
  }

  const rowText = normalizeSearchText(rawValue);
  const filterText = normalizeSearchText(filterValue);
  if (operator === "contains") return rowText.includes(filterText);
  if (operator === "not_contains") return !rowText.includes(filterText);
  if (operator === "=") return rowText === filterText;
  if (operator === "!=") return rowText !== filterText;
  return false;
}

function rowMatchesFilterRules(row, columns, rules) {
  if (!rules.length) {
    return true;
  }

  let matches = filterRuleMatches(row, columns, rules[0]);
  for (let index = 1; index < rules.length; index += 1) {
    const current = filterRuleMatches(row, columns, rules[index]);
    matches = rules[index]?.connector === "or" ? matches || current : matches && current;
  }
  return matches;
}

function nextOverallSortValue(row, columns, column) {
  if (column === "overall") {
    return valueFromRow(row, columns, "next_overall_gap");
  }
  return valueFromRow(row, columns, `${column}_to_next_overall`);
}

function isMissingSortValue(value) {
  return value === null || value === undefined || value === "" || String(value).toUpperCase() === "NULL";
}

function compareValues(aValue, bValue, direction, numeric = false) {
  const aMissing = isMissingSortValue(aValue);
  const bMissing = isMissingSortValue(bValue);
  if (aMissing || bMissing) {
    if (aMissing && bMissing) return 0;
    return aMissing ? 1 : -1;
  }
  if (numeric) {
    return ((Number(aValue) - Number(bValue)) || 0) * direction;
  }
  return String(aValue).localeCompare(String(bValue)) * direction;
}

function comparePageRows(a, b, columns, options) {
  if (options.scope === "club") {
    const aPosition = String(valueFromRow(a, columns, "positions") || "").split(",")[0].trim().toUpperCase();
    const bPosition = String(valueFromRow(b, columns, "positions") || "").split(",")[0].trim().toUpperCase();
    const aRank = POSITION_RANK.has(aPosition) ? POSITION_RANK.get(aPosition) : POSITION_ORDER.length;
    const bRank = POSITION_RANK.has(bPosition) ? POSITION_RANK.get(bPosition) : POSITION_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;
    return compareValues(
      valueFromRow(a, columns, "overall"),
      valueFromRow(b, columns, "overall"),
      -1,
      true,
    );
  }

  const direction = options.sortDirection === "asc" ? 1 : -1;
  const sortKey = options.sortKey || "overall";
  if (options.view === "next" && STAT_COLUMNS.includes(sortKey)) {
    const primary = compareValues(
      nextOverallSortValue(a, columns, sortKey),
      nextOverallSortValue(b, columns, sortKey),
      direction,
      true,
    );
    if (primary !== 0) return primary;
    return compareValues(
      valueFromRow(a, columns, "next_overall"),
      valueFromRow(b, columns, "next_overall"),
      -1,
      true,
    );
  }

  if (["current", "all"].includes(options.view) && STAT_COLUMNS.includes(sortKey)) {
    const suffix = options.view === "current" ? "prog_current_season" : "prog_all";
    const progressionComparison = compareValues(
      valueFromRow(a, columns, `${sortKey}_${suffix}`),
      valueFromRow(b, columns, `${sortKey}_${suffix}`),
      direction,
      true,
    );
    if (progressionComparison !== 0) return progressionComparison;
    return compareValues(
      valueFromRow(a, columns, "overall"),
      valueFromRow(b, columns, "overall"),
      direction,
      true,
    );
  }

  if (sortKey === "active_contract_club_division") {
    const aDivision = Number(valueFromRow(a, columns, sortKey));
    const bDivision = Number(valueFromRow(b, columns, sortKey));
    return compareValues(
      Number.isFinite(aDivision) ? -aDivision : null,
      Number.isFinite(bDivision) ? -bDivision : null,
      direction,
      true,
    );
  }

  return compareValues(
    valueFromRow(a, columns, sortKey),
    valueFromRow(b, columns, sortKey),
    direction,
    NUMBER_COLUMNS.has(sortKey),
  );
}

function mergeProgressionRows(publicData, progressionData) {
  if (!Array.isArray(progressionData?.columns) || !Array.isArray(progressionData?.rows)) {
    return publicData;
  }

  let progressionCache = MERGED_PROGRESSION_CACHE.get(publicData);
  if (!progressionCache) {
    progressionCache = new WeakMap();
    MERGED_PROGRESSION_CACHE.set(publicData, progressionCache);
  }
  const cachedMerge = progressionCache.get(progressionData);
  if (cachedMerge) {
    return cachedMerge;
  }

  const publicColumns = Array.isArray(publicData?.columns) ? publicData.columns : [];
  const publicRows = Array.isArray(publicData?.rows) ? publicData.rows : [];
  const progressionColumns = progressionData.columns;
  const progressionPlayerIndex = columnIndex(progressionColumns, "player_id");
  const publicPlayerIndex = columnIndex(publicColumns, "player_id");
  const addedColumns = progressionColumns.filter((column) => column !== "player_id" && !publicColumns.includes(column));
  const addedIndexes = addedColumns.map((column) => columnIndex(progressionColumns, column));
  const progressionByPlayerId = new Map();

  if (progressionPlayerIndex < 0 || publicPlayerIndex < 0) {
    return publicData;
  }

  progressionData.rows.forEach((row) => {
    progressionByPlayerId.set(String(row[progressionPlayerIndex]), row);
  });

  const merged = {
    columns: [...publicColumns, ...addedColumns],
    rows: publicRows.map((row) => {
      const progressionRow = progressionByPlayerId.get(String(row[publicPlayerIndex]));
      return [
        ...row,
        ...addedIndexes.map((index) => progressionRow && index >= 0 ? progressionRow[index] : null),
      ];
    }),
  };
  progressionCache.set(progressionData, merged);
  return merged;
}

async function bootstrapData(request) {
  const manifest = await readDataJson("manifest.json", request);
  const [playersSearch, agentsSearch, publicData] = await Promise.all([
    readDataJson(searchPlayersDataFile(manifest), request),
    readDataJson(searchAgentsDataFile(manifest), request),
    readDataJson(publicDataFile(manifest), request),
  ]);
  const publicColumns = Array.isArray(publicData?.columns) ? publicData.columns : [];
  const publicRows = Array.isArray(publicData?.rows) ? publicData.rows : [];
  const playerCounts = new Map();
  const clubs = new Map();

  publicRows.forEach((row) => {
    const walletAddress = normalizedWalletFromRow(row, publicColumns);
    if (walletAddress) {
      playerCounts.set(walletAddress, (playerCounts.get(walletAddress) || 0) + 1);
    }

    const clubId = String(valueFromRow(row, publicColumns, "active_contract_club_id") || "").trim();
    const clubName = String(valueFromRow(row, publicColumns, "active_contract_club_name") || "").trim();
    if (!clubId || !clubName || isDevelopmentCenterClubName(clubName) || clubs.has(clubId)) {
      return;
    }
    const division = Number(valueFromRow(row, publicColumns, "active_contract_club_division"));
    clubs.set(clubId, {
      clubId,
      name: clubName,
      division: Number.isFinite(division) ? division : null,
    });
  });

  const agentColumns = Array.isArray(agentsSearch?.columns) ? agentsSearch.columns : [];
  const agentRows = Array.isArray(agentsSearch?.rows) ? agentsSearch.rows : [];
  const walletAddressIndex = columnIndex(agentColumns, "wallet_address");

  return {
    manifest,
    summary: {
      playerCount: manifest?.row_count || publicRows.length,
      walletCount: manifest?.wallet_count || agentRows.length,
      generatedAt: manifest?.generated_at || null,
    },
    players: playersSearch,
    agents: {
      columns: [...agentColumns, "player_count"],
      rows: agentRows.map((row) => [
        ...row,
        playerCounts.get(normalizeWalletAddress(walletAddressIndex >= 0 ? row[walletAddressIndex] : "").toLowerCase()) || 0,
      ]),
    },
    clubs: Array.from(clubs.values()).sort((a, b) => (
      (a.division ?? Number.POSITIVE_INFINITY) - (b.division ?? Number.POSITIVE_INFINITY)
      || a.name.localeCompare(b.name)
    )),
  };
}

async function pagedData(request, signedWallet) {
  const manifest = await readDataJson("manifest.json", request);
  const scope = String(request.query.scope || "database").toLowerCase();
  const view = String(request.query.view || "attributes").toLowerCase();
  const includeProgression = String(request.query.includeProgression || "") === "1"
    || ["current", "all"].includes(view);
  const publicFile = scope === "mfl" || scope === "mflstats"
    ? mflPublicDataFile(manifest)
    : publicDataFile(manifest);
  let data = await readDataJson(publicFile, request);

  if (includeProgression && manifest?.files?.progression?.file) {
    data = mergeProgressionRows(data, await readDataJson(progressionDataFile(manifest), request));
  }

  const columns = Array.isArray(data?.columns) ? data.columns : [];
  let rows = Array.isArray(data?.rows) ? data.rows : [];
  const playerId = String(request.query.playerId || "").trim();
  const clubId = String(request.query.clubId || "").trim();
  const walletAddress = normalizeWalletAddress(request.query.walletAddress).toLowerCase();
  const playerIds = new Set(String(request.query.playerIds || "").split(",").map((value) => value.trim()).filter(Boolean));
  const normalizedSignedWallet = normalizeWalletAddress(signedWallet).toLowerCase();

  const tableScopes = new Set([
    "database",
    "progression",
    "mfl",
    "mflstats",
    "agent",
    "myplayers",
    "watchlist",
    "club",
  ]);
  if (tableScopes.has(scope)) {
    rows = rows.filter((row) => !rowHasHiddenMflJoinedAgencyDate(row, columns));
  }

  if (scope === "progression") {
    rows = rows.filter((row) => !rowIsMflWalletPlayer(row, columns));
  } else if (scope === "mfl" || scope === "mflstats") {
    rows = rows.filter((row) => rowIsMflWalletPlayer(row, columns));
  } else if (scope === "agent") {
    rows = rows.filter((row) => normalizedWalletFromRow(row, columns) === walletAddress);
  } else if (scope === "myplayers") {
    rows = normalizedSignedWallet
      ? rows.filter((row) => normalizedWalletFromRow(row, columns) === normalizedSignedWallet)
      : [];
  } else if (scope === "watchlist") {
    rows = rows.filter((row) => playerIds.has(String(valueFromRow(row, columns, "player_id"))));
  } else if (scope === "club") {
    rows = rows.filter((row) => String(valueFromRow(row, columns, "active_contract_club_id") || "") === clubId);
  } else if (scope === "players") {
    rows = rows.filter((row) => playerIds.has(String(valueFromRow(row, columns, "player_id"))));
  } else if (scope === "player" || scope === "evaluation") {
    rows = rows.filter((row) => String(valueFromRow(row, columns, "player_id")) === playerId);
  }

  const sourceRows = rows.length;
  const hideRetired = String(request.query.hideRetired || "") === "1";
  const hideRetiring = String(request.query.hideRetiring || "") === "1";
  const hideMfl = String(request.query.hideMfl || "") === "1";
  const packableOnly = String(request.query.packableOnly || "") === "1";
  const newMintsOnly = String(request.query.newMintsOnly || "") === "1";
  const rules = safeJsonQuery(request.query.filters, []);

  rows = rows.filter((row) => {
    const retirementValue = valueFromRow(row, columns, "retirement_years");
    const retirementYears = isBlankValue(retirementValue) ? null : Number(retirementValue);
    const playerSeasonsValue = valueFromRow(row, columns, "player_seasons");
    const playerSeasons = isBlankValue(playerSeasonsValue) ? null : Number(playerSeasonsValue);
    if (hideRetired && retirementYears === 0) return false;
    if (hideRetiring && [1, 2, 3].includes(retirementYears)) return false;
    if (scope === "database" && hideMfl && rowIsMflWalletPlayer(row, columns)) return false;
    if (scope === "mfl" && packableOnly && playerSeasons !== 1) return false;
    if (newMintsOnly) {
      if (scope === "mfl" ? !Number.isFinite(playerSeasons) || playerSeasons < 2 : playerSeasons !== 1) {
        return false;
      }
    }
    return rowMatchesFilterRules(row, columns, Array.isArray(rules) ? rules : []);
  });

  const totalRows = rows.length;
  const sortOptions = {
    scope,
    view,
    sortKey: String(request.query.sortKey || (scope === "club" ? "positions" : "overall")),
    sortDirection: String(request.query.sortDirection || (scope === "club" ? "asc" : "desc")),
  };
  rows.sort((a, b) => comparePageRows(a, b, columns, sortOptions));

  const allRows = ["player", "players", "evaluation", "club", "mflstats"].includes(scope);
  const maximumPageSize = allRows ? 5000 : 250;
  const requestedPageSize = Number(request.query.pageSize);
  const pageSize = Math.max(1, Math.min(maximumPageSize, Number.isFinite(requestedPageSize) ? requestedPageSize : 100));
  const requestedPage = Number(request.query.page);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const page = Math.max(1, Math.min(totalPages, Number.isFinite(requestedPage) ? requestedPage : 1));
  const start = allRows ? 0 : (page - 1) * pageSize;
  const pageRows = allRows ? rows.slice(0, pageSize) : rows.slice(start, start + pageSize);

  return {
    columns,
    rows: pageRows,
    page,
    pageSize,
    totalRows,
    sourceRows,
    totalPages,
    generatedAt: manifest?.generated_at || null,
  };
}

module.exports = async function handler(request, response) {
  const startedAt = performance.now();
  request.mflDataTimings = new Map();

  const mode = String(request.query.mode || "");
  const accessMode = String(request.query.access || "");
  const authStartedAt = performance.now();
  const signedWallet = await signedWalletFromRequest(request);
  const fullAccess = accessMode === "full-progression" || (signedWallet ? await walletAllowed(signedWallet) : false);
  const ownedProgression = accessMode === "owned-progression" && Boolean(signedWallet);
  const publicDatabase = accessMode === "public-database" || (!fullAccess && !ownedProgression);
  const fileName = String(request.query.file || "");
  recordTiming(request, "auth", performance.now() - authStartedAt);
  const cacheable = publicCacheableRequest(request, signedWallet, mode, fileName);

  if (mode === "bootstrap" || mode === "page") {
    try {
      if (cacheable) {
        const cachedData = getPublicResponseCache(request);
        if (cachedData) {
          recordTiming(request, "response_cache", 0.1);
          sendJson(request, response, 200, cachedData, { cacheable: true, startedAt });
          return;
        }
      }

      const processingStartedAt = performance.now();
      const data = mode === "bootstrap"
        ? await bootstrapData(request)
        : await pagedData(request, signedWallet);
      recordTiming(request, mode, performance.now() - processingStartedAt);
      if (cacheable) {
        setPublicResponseCache(request, data);
      }
      sendJson(request, response, 200, data, { cacheable, startedAt });
    } catch (error) {
      sendJson(request, response, 500, { error: `Could not load requested data: ${error.message}` }, { startedAt });
    }
    return;
  }

  if (!DATA_FILE_PATTERN.test(fileName)) {
    sendJson(request, response, 400, { error: "Invalid data file." }, { startedAt });
    return;
  }

  try {
    const data = await readDataJson(fileName, request);
    const requestedColumns = String(request.query.columns || "")
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);

    if (fileName === "manifest.json") {
      const publicColumns = Array.isArray(data.files?.public?.columns)
        ? data.files.public.columns
        : (Array.isArray(data.columns) ? PUBLIC_DATABASE_COLUMNS.filter((column) => data.columns.includes(column)) : PUBLIC_DATABASE_COLUMNS);
      const fullColumns = Array.isArray(data.files?.progression?.columns)
        ? [...publicColumns, ...data.files.progression.columns.filter((column) => !publicColumns.includes(column))]
        : (Array.isArray(data.columns) ? data.columns : publicColumns);

      sendJson(request, response, 200, {
        ...data,
        columns: publicDatabase ? publicColumns : fullColumns,
        publicAccess: publicDatabase ? "database" : undefined,
        ownedAccess: ownedProgression ? "progression" : undefined,
        partialAccess: !publicDatabase && requestedColumns.length ? "columns" : undefined,
      }, { cacheable, startedAt });
      return;
    }

    const dataColumns = Array.isArray(data.columns) ? data.columns : [];
    let dataRows = Array.isArray(data.rows) ? data.rows : [];

    if (ownedProgression && !fullAccess) {
      const ownedPlayerIds = await ownedPlayerIdsForWallet(request, signedWallet);
      const playerIdIndex = columnIndex(dataColumns, "player_id");
      dataRows = playerIdIndex >= 0
        ? dataRows.filter((row) => ownedPlayerIds.has(String(row[playerIdIndex])))
        : [];
    }

    const selectedColumns = publicDatabase
      ? PUBLIC_DATABASE_COLUMNS.filter((column) => dataColumns.includes(column))
      : (requestedColumns.length
        ? requestedColumns.filter((column) => dataColumns.includes(column))
        : dataColumns);
    const selectedColumnIndexes = selectedColumns.map((column) => columnIndex(dataColumns, column));

    sendJson(request, response, 200, {
      columns: selectedColumns,
      rows: dataRows.map((row) => selectedColumnIndexes.map((index) => row[index])),
    }, { cacheable, startedAt });
  } catch (error) {
    sendJson(request, response, 500, { error: `Could not read data file: ${error.message}` }, { startedAt });
  }
};
