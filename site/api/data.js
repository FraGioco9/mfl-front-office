const fs = require("node:fs/promises");
const path = require("node:path");
const fcl = require("@onflow/fcl");

fcl.config({ "accessNode.api": "https://rest-mainnet.onflow.org" });

const DATA_FILE_PATTERN = /^(manifest\.json|players_\d{4}\.json|players_public\.json|players_progression\.json)$/;
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
  if (!host) {
    return "";
  }

  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}

async function readDataJson(fileName, request) {
  const filePath = await findDataFile(fileName);

  if (filePath) {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  }

  const origin = requestOrigin(request);
  if (!origin) {
    throw new Error(`Data file not found: ${fileName}`);
  }

  const staticResponse = await fetch(`${origin}/data/${encodeURIComponent(fileName)}`, {
    cache: "no-store",
  });

  if (!staticResponse.ok) {
    throw new Error(`Data file not found: ${fileName}`);
  }

  return staticResponse.json();
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
  const config = supabaseConfig();

  if (!config) {
    return false;
  }

  const response = await fetch(`${config.url}/rest/v1/wallet_permissions?select=wallet_address&wallet_address=eq.${encodeURIComponent(wallet)}&can_view_progression=eq.true&limit=1`, {
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
  return Array.isArray(rows) && rows.length > 0;
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

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  const accessMode = String(request.query.access || "");
  const signedWallet = await signedWalletFromRequest(request);
  const fullAccess = signedWallet ? await walletAllowed(signedWallet) : false;
  const ownedProgression = accessMode === "owned-progression" && Boolean(signedWallet);
  const publicDatabase = accessMode === "public-database" || (!fullAccess && !ownedProgression);
  const fileName = String(request.query.file || "");

  if (!DATA_FILE_PATTERN.test(fileName)) {
    response.status(400).json({ error: "Invalid data file." });
    return;
  }

  try {
    response.setHeader("Content-Type", "application/json; charset=utf-8");

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

      response.status(200).json({
        ...data,
        columns: publicDatabase ? publicColumns : fullColumns,
        publicAccess: publicDatabase ? "database" : undefined,
        ownedAccess: ownedProgression ? "progression" : undefined,
        partialAccess: !publicDatabase && requestedColumns.length ? "columns" : undefined,
      });
      return;
    }

    const dataColumns = Array.isArray(data.columns) ? data.columns : [];
    let dataRows = Array.isArray(data.rows) ? data.rows : [];

    if (ownedProgression && !fullAccess && fileName !== publicDataFile(await readDataJson("manifest.json", request))) {
      const ownedPlayerIds = await ownedPlayerIdsForWallet(request, signedWallet);
      const playerIdIndex = dataColumns.indexOf("player_id");
      dataRows = playerIdIndex >= 0
        ? dataRows.filter((row) => ownedPlayerIds.has(String(row[playerIdIndex])))
        : [];
    }

    const selectedColumns = publicDatabase
      ? PUBLIC_DATABASE_COLUMNS.filter((column) => dataColumns.includes(column))
      : (requestedColumns.length
        ? requestedColumns.filter((column) => dataColumns.includes(column))
        : dataColumns);
    const selectedColumnIndexes = selectedColumns.map((column) => dataColumns.indexOf(column));

    response.status(200).json({
      columns: selectedColumns,
      rows: dataRows.map((row) => selectedColumnIndexes.map((index) => row[index])),
    });
  } catch (error) {
    response.status(500).json({ error: `Could not read data file: ${error.message}` });
  }
};