const fcl = require("@onflow/fcl");

fcl.config({ "accessNode.api": "https://rest-mainnet.onflow.org" });

const PLAYER_NOTE_MAX_LENGTH = 200;

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

  if (!signatureWalletAddresses(signatures).has(signingWallet)) {
    return false;
  }

  try {
    if (proofType === "account-proof") {
      return Boolean(await fcl.AppUtils.verifyAccountProof(appIdentifier, {
        address: signingWallet,
        nonce,
        signatures,
      }));
    }

    return Boolean(await fcl.AppUtils.verifyUserSignatures(stringToHex(message), signatures));
  } catch (error) {
    console.warn("Could not verify Dapper wallet proof.", error);
    return false;
  }
}
function preferenceKey(wallet) {
  return `mfl-front-office:wallet-preferences:${normalizeWalletAddress(wallet)}`;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function kvCommand(command) {
  const config = kvConfig();
  if (!config) {
    return null;
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`KV request failed with ${response.status}`);
  }

  return response.json();
}

async function readPreferences(wallet) {
  const result = await kvCommand(["GET", preferenceKey(wallet)]);
  if (!result?.result) {
    return { watchlistPlayerIds: [], playerNotes: {} };
  }

  try {
    const data = typeof result.result === "string" ? JSON.parse(result.result) : result.result;
    return {
      watchlistPlayerIds: Array.isArray(data.watchlistPlayerIds)
        ? data.watchlistPlayerIds.map((playerId) => String(playerId))
        : [],
      playerNotes: normalizePlayerNotes(data.playerNotes),
    };
  } catch {
    return { watchlistPlayerIds: [], playerNotes: {} };
  }
}

function normalizePlayerNotes(notes) {
  const normalized = {};
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
    return normalized;
  }

  Object.entries(notes).forEach(([playerId, note]) => {
    const key = String(playerId || "").trim();
    const text = String(note || "").replace(/\r\n/g, "\n").slice(0, PLAYER_NOTE_MAX_LENGTH).trim();
    if (key && text) {
      normalized[key] = text;
    }
  });

  return normalized;
}

async function writePreferences(wallet, preferences) {
  const currentPreferences = await readPreferences(wallet);
  const watchlistPlayerIds = Array.isArray(preferences.watchlistPlayerIds)
    ? [...new Set(preferences.watchlistPlayerIds.map((playerId) => String(playerId)).filter(Boolean))]
    : currentPreferences.watchlistPlayerIds;
  const playerNotes = preferences.playerNotes && typeof preferences.playerNotes === "object"
    ? normalizePlayerNotes(preferences.playerNotes)
    : currentPreferences.playerNotes;

  const nextPreferences = { watchlistPlayerIds, playerNotes };
  await kvCommand(["SET", preferenceKey(wallet), JSON.stringify(nextPreferences)]);
  return nextPreferences;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const wallet = await verifyWalletProof(request);

  if (!wallet) {
    response.status(401).json({ error: "Invalid wallet proof." });
    return;
  }

  if (request.method === "GET") {
    response.status(200).json(await readPreferences(wallet));
    return;
  }

  if (request.method === "PUT") {
    const rawBody = await readBody(request);
    const body = rawBody ? JSON.parse(rawBody) : {};
    response.status(200).json(await writePreferences(wallet, body));
    return;
  }

  response.status(405).json({ error: "Method not allowed." });
};
