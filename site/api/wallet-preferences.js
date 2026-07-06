const fcl = require("@onflow/fcl");

fcl.config({ "accessNode.api": "https://rest-mainnet.onflow.org" });

const PLAYER_NOTE_MAX_LENGTH = 200;
const WATCHLIST_ID_LENGTH = 8;
const MAX_WATCHLISTS = 5;
const MAX_WATCHLIST_PLAYERS = 250;
const DEFAULT_WATCHLIST_NAME = "Default";

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
  return { watchlists: [], playerNotes: {}, tableState: null, evaluationSettings: null };
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

function normalizeIdList(ids, limit = Infinity) {
  if (!Array.isArray(ids)) {
    return [];
  }

  const normalized = [];
  ids.forEach((playerId) => {
    const key = String(playerId || "").trim();
    if (key && !normalized.includes(key)) {
      normalized.push(key);
    }
  });

  return Number.isFinite(limit) ? normalized.slice(0, limit) : normalized;
}

function normalizeWatchlistIds(ids) {
  return normalizeIdList(ids, MAX_WATCHLIST_PLAYERS);
}

function normalizeWatchlistName(name, fallback = DEFAULT_WATCHLIST_NAME) {
  const value = String(name || "").trim().replace(/\s+/g, " ").slice(0, 20);
  return value || fallback;
}

function normalizeWatchlists(watchlists) {
  const normalized = [];
  const source = Array.isArray(watchlists) ? watchlists : [];

  source.forEach((watchlist) => {
    const id = String(watchlist?.id || "").trim().slice(0, WATCHLIST_ID_LENGTH);
    const name = normalizeWatchlistName(watchlist?.name, DEFAULT_WATCHLIST_NAME);
    if (!id || normalized.some((item) => item.id === id) || normalized.length >= MAX_WATCHLISTS) {
      return;
    }

    normalized.push({
      id,
      name,
      playerIds: normalizeWatchlistIds(watchlist?.playerIds ?? watchlist?.player_ids ?? watchlist?.watchlistPlayerIds),
    });
  });

  return normalized;
}


function parsePositiveTwoDecimal(value) {
  const parsedValue = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue * 100) / 100 : null;
}

function parseRatePercent(value) {
  const parsedValue = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 100 ? Math.round(parsedValue * 100) / 100 : null;
}

function normalizeLateSeasonRewardRates(value) {
  const defaults = [80, 80, 60];
  const source = Array.isArray(value) ? value : [];
  return defaults.map((defaultRate, index) => {
    const parsedRate = parseRatePercent(source[index]);
    return parsedRate === null ? defaultRate : parsedRate;
  });
}

function normalizeEvaluationSettings(settings) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : null;

  if (!data) {
    return null;
  }

  return {
    mflPerUsd: parsePositiveTwoDecimal(data.mflPerUsd ?? data.mfl_per_usd) || 400,
    ignoreDiscountRate: Boolean(data.ignoreDiscountRate ?? data.ignore_discount_rate),
    ignoreFirstSeason: Boolean(data.ignoreFirstSeason ?? data.ignore_first_season),
    lateSeasonRewardRates: normalizeLateSeasonRewardRates(
      data.lateSeasonRewardRates
        ?? data.late_season_reward_rates
        ?? data.lateCareerRewardRates
        ?? data.late_career_reward_rates
    ),
  };
}

function mergeRecentIds(incomingIds, currentIds) {
  return normalizeIdList([...(Array.isArray(incomingIds) ? incomingIds : []), ...(Array.isArray(currentIds) ? currentIds : [])], 5);
}

function stripWatchlistStateFromTableState(tableState) {
  if (!tableState || typeof tableState !== "object" || Array.isArray(tableState)) {
    return {};
  }

  const sanitized = { ...tableState };
  delete sanitized.watchlistPlayerIds;
  delete sanitized.watchlists;
  delete sanitized.currentWatchlistId;
  return sanitized;
}

function mergeTableState(tableState, currentTableState) {
  const incoming = tableState && typeof tableState === "object" && !Array.isArray(tableState) ? stripWatchlistStateFromTableState(tableState) : null;
  const current = stripWatchlistStateFromTableState(currentTableState);

  if (!incoming) {
    return current;
  }

  return {
    ...current,
    ...incoming,
    recentSearchPlayerIds: mergeRecentIds(incoming.recentSearchPlayerIds, current.recentSearchPlayerIds),
    recentEvaluationPlayerIds: mergeRecentIds(incoming.recentEvaluationPlayerIds, current.recentEvaluationPlayerIds),
  };
}

function preferencesFromRow(row) {
  if (!row) {
    return emptyPreferences();
  }

  return {
    watchlists: normalizeWatchlists(row.watchlists),
    playerNotes: normalizePlayerNotes(row.player_notes),
    tableState: row.table_state && typeof row.table_state === "object" && !Array.isArray(row.table_state) ? stripWatchlistStateFromTableState(row.table_state) : null,
    evaluationSettings: normalizeEvaluationSettings(row.evaluation_settings),
  };
}

async function readPreferences(wallet) {
  if (!supabaseConfig()) {
    return emptyPreferences();
  }

  const rows = await supabaseRequest(`wallet_preferences?select=watchlists,player_notes,table_state,evaluation_settings&wallet_address=eq.${encodeURIComponent(wallet)}&limit=1`);
  return preferencesFromRow(Array.isArray(rows) ? rows[0] : null);
}

async function writePreferences(wallet, preferences) {
  const currentPreferences = await readPreferences(wallet);

  const watchlists = Array.isArray(preferences.watchlists)
    ? normalizeWatchlists(preferences.watchlists)
    : normalizeWatchlists(currentPreferences.watchlists);

  const playerNotes = preferences.playerNotes && typeof preferences.playerNotes === "object"
    ? normalizePlayerNotes(preferences.playerNotes)
    : currentPreferences.playerNotes;

  const tableState = mergeTableState(preferences.tableState, currentPreferences.tableState);
  const evaluationSettings = preferences.evaluationSettings
    ? normalizeEvaluationSettings(preferences.evaluationSettings)
    : currentPreferences.evaluationSettings;

  const nextPreferences = { watchlists, playerNotes, tableState, evaluationSettings };
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
      watchlists,
      player_notes: playerNotes,
      table_state: tableState || {},
      evaluation_settings: evaluationSettings || {},
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
