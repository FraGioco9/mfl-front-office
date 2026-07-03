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
    return "";
  }

  if (!wallet || !signingWallet || message !== walletAccessMessage(wallet, signingWallet) || !Array.isArray(signatures) || !signatures.length) {
    return "";
  }

  try {
    if (proofType === "account-proof") {
      const verified = await fcl.AppUtils.verifyAccountProof(appIdentifier, {
        address: signingWallet,
        nonce,
        signatures,
      });

      if (verified) {
        return wallet;
      }

      if (signingWallet !== wallet) {
        const walletVerified = await fcl.AppUtils.verifyAccountProof(appIdentifier, {
          address: wallet,
          nonce,
          signatures,
        });

        return walletVerified ? wallet : "";
      }

      return "";
    }

    if (!signatureWalletAddresses(signatures).has(signingWallet)) {
      return "";
    }

    return (await fcl.AppUtils.verifyUserSignatures(stringToHex(message), signatures)) ? wallet : "";
  } catch (error) {
    console.warn("Could not verify Dapper wallet proof.", error);
    return "";
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

async function supabaseRequest(pathname, options = {}) {
  const config = supabaseConfig();

  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed with ${response.status}: ${await response.text()}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function emptyPreferences() {
  return { watchlistPlayerIds: [], playerNotes: {}, tableState: null };
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

function normalizeWatchlistIds(ids) {
  return Array.isArray(ids)
    ? [...new Set(ids.map((playerId) => String(playerId || "").trim()).filter(Boolean))]
    : [];
}

function preferencesFromRow(row) {
  if (!row) {
    return emptyPreferences();
  }

  return {
    watchlistPlayerIds: normalizeWatchlistIds(row.watchlist_player_ids),
    playerNotes: normalizePlayerNotes(row.player_notes),
    tableState: row.table_state && typeof row.table_state === "object" && !Array.isArray(row.table_state) ? row.table_state : null,
  };
}

async function readPreferences(wallet) {
  if (!supabaseConfig()) {
    return emptyPreferences();
  }

  const rows = await supabaseRequest(`wallet_preferences?select=watchlist_player_ids,player_notes,table_state&wallet_address=eq.${encodeURIComponent(wallet)}&limit=1`);
  return preferencesFromRow(Array.isArray(rows) ? rows[0] : null);
}

async function writePreferences(wallet, preferences) {
  const currentPreferences = await readPreferences(wallet);
  const watchlistPlayerIds = Array.isArray(preferences.watchlistPlayerIds)
    ? normalizeWatchlistIds(preferences.watchlistPlayerIds)
    : currentPreferences.watchlistPlayerIds;
  const playerNotes = preferences.playerNotes && typeof preferences.playerNotes === "object"
    ? normalizePlayerNotes(preferences.playerNotes)
    : currentPreferences.playerNotes;

  const tableState = preferences.tableState && typeof preferences.tableState === "object" && !Array.isArray(preferences.tableState)
    ? preferences.tableState
    : currentPreferences.tableState;

  const nextPreferences = { watchlistPlayerIds, playerNotes, tableState };
  if (!supabaseConfig()) {
    return nextPreferences;
  }

  const rows = await supabaseRequest("wallet_preferences?on_conflict=wallet_address", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([{
      wallet_address: wallet,
      watchlist_player_ids: watchlistPlayerIds,
      player_notes: playerNotes,
      table_state: tableState || {},
    }]),
  });

  return preferencesFromRow(Array.isArray(rows) ? rows[0] : null);
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const wallet = await verifyWalletProof(request);

  if (!wallet) {
    response.status(401).json({ error: "Invalid wallet proof." });
    return;
  }

  try {
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
  } catch (error) {
    console.warn("Could not handle wallet preferences.", error);
    response.status(500).json({ error: "Could not save wallet preferences." });
  }
};
