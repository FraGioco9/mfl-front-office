const { signedWalletFromRequest, normalizeWalletAddress } = require("./_wallet-proof");
const { supabaseConfig, supabaseRequest } = require("./_supabase");
const { readJsonBody } = require("./_request-body");
const { normalizeLateSeasonRewardRates } = require("./_evaluation-payload");

const PLAYER_NOTE_MAX_LENGTH = 200;
const WATCHLIST_ID_LENGTH = 8;
const MAX_WATCHLISTS = 5;
const MAX_WATCHLIST_PLAYERS = 250;
const DEFAULT_WATCHLIST_NAME = "Default";

function emptyPreferences() {
  return { watchlists: [], playerNotes: {}, tableState: null, evaluationSettings: null, settings: null };
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

function normalizeSettingsDateFormat(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "MDY" || normalized === "MM/DD/YYYY" ? "MDY" : "DMY";
}

function normalizeSettingsTimeFormat(value) {
  return String(value || "").trim().toLowerCase() === "12h" ? "12h" : "24h";
}

function normalizeSettingsEmailAddress(value) {
  return String(value || "").trim().slice(0, 254);
}

function normalizeSettings(settings) {
  const data = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : null;
  const values = Array.isArray(data?.receiveEmailsFor) ? data.receiveEmailsFor : [];
  const receiveEmailsFor = [];

  values.forEach((value) => {
    const key = String(value || "").trim();
    if ((key === "myplayers" || /^watchlist-[a-zA-Z0-9_-]{1,40}$/.test(key)) && !receiveEmailsFor.includes(key)) {
      receiveEmailsFor.push(key);
    }
  });

  return {
    receiveEmailsFor,
    emailAddress: normalizeSettingsEmailAddress(data?.emailAddress ?? data?.email_address),
    dateFormat: normalizeSettingsDateFormat(data?.dateFormat ?? data?.date_format),
    timeFormat: normalizeSettingsTimeFormat(data?.timeFormat ?? data?.time_format),
  };
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
        ?? data.late_career_reward_rates,
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

function recentSearchItemsFromLegacy(tableState) {
  const playerIds = normalizeIdList(tableState?.recentSearchPlayerIds, 5);
  const agentWallets = normalizeIdList(tableState?.recentSearchAgentWallets, 5)
    .map(normalizeWalletAddress)
    .filter(Boolean);

  return [
    ...playerIds.map((playerId) => `player:${playerId}`),
    ...agentWallets.map((walletAddress) => `agent:${walletAddress}`),
  ];
}

function normalizeRecentSearchTableState(tableState) {
  const sanitized = stripWatchlistStateFromTableState(tableState);
  return {
    ...sanitized,
    recentSearchItems: mergeRecentIds(sanitized.recentSearchItems, recentSearchItemsFromLegacy(sanitized)),
  };
}

function mergeTableState(tableState, currentTableState) {
  const incoming = tableState && typeof tableState === "object" && !Array.isArray(tableState)
    ? normalizeRecentSearchTableState(tableState)
    : null;
  const current = normalizeRecentSearchTableState(currentTableState);

  if (!incoming) {
    return current;
  }

  return {
    ...current,
    ...incoming,
    recentSearchItems: mergeRecentIds(incoming.recentSearchItems, current.recentSearchItems),
    recentSearchPlayerIds: mergeRecentIds(incoming.recentSearchPlayerIds, current.recentSearchPlayerIds),
    recentSearchAgentWallets: mergeRecentIds(incoming.recentSearchAgentWallets, current.recentSearchAgentWallets),
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
    tableState: row.table_state && typeof row.table_state === "object" && !Array.isArray(row.table_state) ? normalizeRecentSearchTableState(row.table_state) : null,
    evaluationSettings: normalizeEvaluationSettings(row.evaluation_settings),
    settings: normalizeSettings(row.settings),
  };
}

async function readPreferences(wallet) {
  if (!supabaseConfig()) {
    return emptyPreferences();
  }

  const rows = await supabaseRequest(`wallet_preferences?select=watchlists,player_notes,table_state,evaluation_settings,settings&wallet_address=eq.${encodeURIComponent(wallet)}&limit=1`);
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

  const settings = preferences.settings
    ? normalizeSettings(preferences.settings)
    : currentPreferences.settings;

  const nextPreferences = { watchlists, playerNotes, tableState, evaluationSettings, settings };
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
      settings: settings || {},
    }]),
  });

  return preferencesFromRow(Array.isArray(rows) ? rows[0] : null);
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const wallet = await signedWalletFromRequest(request);

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
      const body = await readJsonBody(request);
      response.status(200).json(await writePreferences(wallet, body));
      return;
    }

    response.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.warn("Could not handle wallet preferences.", error);
    response.status(500).json({ error: "Could not save wallet preferences." });
  }
};
