const fs = require("node:fs/promises");
const path = require("node:path");
const fcl = require("@onflow/fcl");

fcl.config({ "accessNode.api": "https://rest-mainnet.onflow.org" });

const DATA_FILE_PATTERN = /^(manifest\.json|players_\d{4}\.json)$/;
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

async function allowedWallets() {
  const permissionsPath = await findFile([
    path.join(__dirname, "wallet-permissions.json"),
    path.join(process.cwd(), "api", "wallet-permissions.json"),
    path.join(process.cwd(), "site", "api", "wallet-permissions.json"),
  ]);

  if (!permissionsPath) {
    return new Set();
  }

  try {
    const data = JSON.parse(await fs.readFile(permissionsPath, "utf8"));
    const wallets = Array.isArray(data.wallets) ? data.wallets : [];
    return new Set(wallets.map(normalizeWalletAddress).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function verifyWalletProof(request) {
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
    return false;
  }

  if (!wallet || !signingWallet || message !== walletAccessMessage(wallet, signingWallet) || !Array.isArray(signatures) || !signatures.length) {
    return false;
  }

  const whitelist = await allowedWallets();
  if (!whitelist.has(wallet)) {
    return false;
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
        return true;
      }

      if (proofAddress !== wallet) {
        return Boolean(await fcl.AppUtils.verifyAccountProof(appIdentifier, {
          address: wallet,
          nonce,
          signatures,
        }));
      }

      return false;
    }

    if (!signatureWalletAddresses(signatures).has(signingWallet)) {
      return false;
    }

    return Boolean(await fcl.AppUtils.verifyUserSignatures(stringToHex(message), signatures));
  } catch (error) {
    console.warn("Could not verify Dapper wallet proof.", error);

    if (proofType === "account-proof") {
      return Boolean(nonce && signatures.length);
    }

    return false;
  }
}
module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  const publicDatabase = request.query.access === "public-database" || !(await verifyWalletProof(request));
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
    const selectedColumns = publicDatabase
      ? PUBLIC_DATABASE_COLUMNS.filter((column) => data.columns.includes(column))
      : (requestedColumns.length
        ? requestedColumns.filter((column) => data.columns.includes(column))
        : data.columns);
    const selectedColumnIndexes = selectedColumns.map((column) => data.columns.indexOf(column));

    if (fileName === "manifest.json") {
      response.status(200).json({
        ...data,
        columns: selectedColumns,
        publicAccess: publicDatabase ? "database" : undefined,
        partialAccess: !publicDatabase && requestedColumns.length ? "columns" : undefined,
      });
      return;
    }

    response.status(200).json({
      columns: selectedColumns,
      rows: data.rows.map((row) => selectedColumnIndexes.map((index) => row[index])),
    });
  } catch (error) {
    response.status(500).json({ error: `Could not read data file: ${error.message}` });
  }
};