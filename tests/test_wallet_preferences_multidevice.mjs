import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const wallet = "0xwallet-data02";

function loadHandler(path, stubs) {
  const restored = [];
  for (const [file, exports] of Object.entries(stubs)) {
    const id = require.resolve(file);
    restored.push([id, require.cache[id]]);
    require.cache[id] = { id, filename: id, loaded: true, exports };
  }
  const id = require.resolve(path);
  restored.push([id, require.cache[id]]);
  delete require.cache[id];
  try {
    return require(path);
  } finally {
    for (const [key, previous] of restored) {
      if (previous) require.cache[key] = previous;
      else delete require.cache[key];
    }
  }
}

let row = {
  wallet_address: wallet,
  watchlists: [{ id: "aaaaaaaa", name: "Default", playerIds: ["1"] }],
  player_notes: { "1": "Initial note" },
  table_state: { recentSearchItems: ["player:1"], players: { page: 1 } },
  evaluation_settings: { mflPerUsd: 0.5 },
  settings: {
    receiveEmailsFor: [],
    emailAddress: "",
    dateFormat: "DMY",
    timeFormat: "24h",
    theme: "light",
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeRecent(incoming, current, limit = 5) {
  const values = [...(Array.isArray(incoming) ? incoming : []), ...(Array.isArray(current) ? current : [])];
  return [...new Set(values.map(String).filter(Boolean))].slice(0, limit);
}

function applyPatch(patch) {
  if (Object.prototype.hasOwnProperty.call(patch, "watchlists")) row.watchlists = clone(patch.watchlists);
  if (Object.prototype.hasOwnProperty.call(patch, "player_notes")) row.player_notes = clone(patch.player_notes);
  if (Object.prototype.hasOwnProperty.call(patch, "evaluation_settings")) row.evaluation_settings = clone(patch.evaluation_settings);
  if (Object.prototype.hasOwnProperty.call(patch, "settings")) row.settings = clone(patch.settings);
  if (Object.prototype.hasOwnProperty.call(patch, "table_state")) {
    const incoming = clone(patch.table_state || {});
    const current = clone(row.table_state || {});
    const merged = {
      ...current,
      ...Object.fromEntries(Object.entries(incoming).filter(([key]) =>
        key !== "recentSearchItems" && key !== "recentEvaluationPlayerIds")),
    };
    if (Object.prototype.hasOwnProperty.call(incoming, "recentSearchItems")) {
      merged.recentSearchItems = mergeRecent(incoming.recentSearchItems, current.recentSearchItems);
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "recentEvaluationPlayerIds")) {
      merged.recentEvaluationPlayerIds = mergeRecent(
        incoming.recentEvaluationPlayerIds,
        current.recentEvaluationPlayerIds,
      );
    }
    row.table_state = merged;
  }
}

const supabaseCalls = [];
async function supabaseRequest(resource, options = {}) {
  supabaseCalls.push({ resource, method: options.method || "GET", body: options.body || null });
  if (resource.startsWith("wallet_preferences?")) return [clone(row)];
  if (resource === "rpc/patch_wallet_preferences_atomic" && options.method === "POST") {
    const body = JSON.parse(options.body);
    assert.equal(body.p_wallet_address, wallet);
    applyPatch(body.p_patch || {});
    return [clone(row)];
  }
  throw new Error("Unexpected Supabase fixture request: " + resource);
}

const deps = {
  "../api/_wallet-auth.js": {
    signedWalletFromRequest: async (request) => request.wallet || null,
    normalizeWalletAddress: (value) => String(value || "").trim().toLowerCase(),
  },
  "../api/_request-origin.js": { requireSameOriginMutation: () => true },
  "../api/_supabase.js": { supabaseConfig: () => ({ url: "fixture" }), supabaseRequest },
  "../api/_request-body.js": {
    readJsonBody: async (request) => request.body,
    sendRequestBodyError: () => false,
  },
  "../api/_evaluation-payload.js": { normalizeLateSeasonRewardRates: (value) => value || {} },
  "../api/_wallet-presence.js": { touchWalletLastSeen: async () => null },
};

const handler = loadHandler("../api/_handler-wallet-preferences.js", deps);

async function call(method, body = undefined) {
  const response = {
    statusCode: 200,
    body: null,
    headers: new Map(),
    setHeader(key, value) { this.headers.set(String(key).toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ method, wallet, body, headers: {} }, response);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response;
}

// Device A and B hydrate the same initial server snapshot.
const deviceA = (await call("GET")).body;
const deviceB = (await call("GET")).body;
assert.equal(deviceA.settings.theme, "light");
assert.equal(deviceB.watchlists[0].playerIds[0], "1");

// Device A changes Settings. Only the Settings domain is sent.
const aSettings = await call("PUT", {
  settings: { ...deviceA.settings, theme: "dark" },
});
assert.equal(aSettings.statusCode, 200);
assert.equal(row.settings.theme, "dark");
assert.deepEqual(row.watchlists[0].playerIds, ["1"]);

// Device B is stale, but changes only Watchlists. Its old Settings snapshot is
// intentionally absent from the request, so the atomic domain patch preserves A.
const bWatchlists = await call("PUT", {
  watchlists: [{ id: "aaaaaaaa", name: "Default", playerIds: ["1", "2"] }],
});
assert.equal(bWatchlists.statusCode, 200);
assert.deepEqual(row.watchlists[0].playerIds, ["1", "2"]);
assert.equal(row.settings.theme, "dark", "Cross-domain stale state must not overwrite a newer Settings write");

// A third stale client changes player notes. Watchlists and Settings must survive.
await call("PUT", { playerNotes: { "1": "Initial note", "2": "Second-device note" } });
assert.equal(row.settings.theme, "dark");
assert.deepEqual(row.watchlists[0].playerIds, ["1", "2"]);
assert.equal(row.player_notes["2"], "Second-device note");

// tableState is the only preference domain with an intentional internal merge:
// recent lists keep incoming order first and preserve older distinct entries.
await call("PUT", {
  tableState: { recentSearchItems: ["player:2"], players: { page: 3 } },
});
assert.deepEqual(row.table_state.recentSearchItems, ["player:2", "player:1"]);
assert.equal(row.table_state.players.page, 3);
assert.equal(row.settings.theme, "dark");

// A later GET is the convergence point: another device sees the merged server state.
const converged = (await call("GET")).body;
assert.equal(converged.settings.theme, "dark");
assert.deepEqual(converged.watchlists[0].playerIds, ["1", "2"]);
assert.equal(converged.playerNotes["2"], "Second-device note");
assert.deepEqual(converged.tableState.recentSearchItems, ["player:2", "player:1"]);

// Same-domain writes deliberately do not use CAS today: the latest successful
// whole-domain write wins. DATA-02 documents this instead of pretending to offer
// real-time collaborative merging.
await call("PUT", { settings: { ...converged.settings, theme: "light" } });
await call("PUT", { settings: { ...deviceB.settings, theme: "dark" } });
assert.equal(row.settings.theme, "dark");

const apiSource = await readFile(new URL("../api/_handler-wallet-preferences.js", import.meta.url), "utf8");
const schemaSource = await readFile(new URL("../supabase-schema.sql", import.meta.url), "utf8");
assert.match(apiSource, /const hasDomain = \(key\) => Object\.prototype\.hasOwnProperty\.call\(incoming, key\);/);
assert.match(apiSource, /supabaseRequest\("rpc\/patch_wallet_preferences_atomic"/);
assert.match(schemaSource, /select \*[\s\S]*?for update;/);
assert.match(schemaSource, /when v_patch \? 'watchlists'/);
assert.match(schemaSource, /when v_patch \? 'settings'/);

const rpcWrites = supabaseCalls.filter((call) => call.resource === "rpc/patch_wallet_preferences_atomic");
assert.equal(rpcWrites.length, 6);
for (const write of rpcWrites) {
  const patch = JSON.parse(write.body).p_patch;
  assert(Object.keys(patch).length >= 1);
}

console.log("DATA02_MULTIDEVICE_RECONCILIATION_PASS " + JSON.stringify({
  crossDomainAtomicity: true,
  staleDifferentDomainPreserved: true,
  tableStateRecentMerge: true,
  convergenceOnHydration: true,
  sameDomainLastSuccessfulWriteWins: true,
  noLiveServices: true,
}));
