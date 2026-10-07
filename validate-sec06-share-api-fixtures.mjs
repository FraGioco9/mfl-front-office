import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const NOW = new Date("2026-10-01T18:00:00.000Z");
const FUTURE = "2027-01-01T00:00:00.000Z";
const PAST = "2026-09-01T00:00:00.000Z";
const walletA = "0xwallet-a";
const walletB = "0xwallet-b";
const planId = "bbbbbbbbbbbbbbbb";
const shareId = "aaaaaaaaaaaaaaaa";
const expiredId = "cccccccccccccccc";
const evalId = "12345678";

const plans = [{ id: planId, wallet_address: walletA }];
const shares = new Map([
  [shareId, {
    id: shareId, name: "A squad", wallet_address: walletA,
    source_plan_id: planId, club_id: "9001", payload: { clubId: "9001", formation: "442" },
    created_at: "2026-09-01T12:00:00.000Z", expires_at: FUTURE,
  }],
  [expiredId, {
    id: expiredId, name: "Old squad", wallet_address: walletA,
    source_plan_id: null, club_id: "9001", payload: { clubId: "9001", formation: "442" },
    created_at: "2026-01-01T12:00:00.000Z", expires_at: PAST,
  }],
]);
const evaluationShares = new Map([
  [evalId, { id: evalId, playerId: "99", payload: { playerId: "99", overallValues: [88] }, expiresAt: FUTURE }],
  ["87654321", { id: "87654321", playerId: "42", payload: { playerId: "42" }, expiresAt: PAST }],
]);

// Replace only handler dependencies and restore the module cache immediately.
// No network connection, Supabase credentials, wallets, or production data are used.
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

const queries = [];
async function mockSupabaseRequest(resource, options = {}) {
  queries.push({ resource, method: options.method || "GET" });
  const url = new URL(resource, "https://fixture.invalid/");
  const params = url.searchParams;
  const table = url.pathname.slice(1);
  const eq = (key, actual) => !params.has(key) || params.get(key) === "eq." + actual;
  const active = expires => !params.has("expires_at") || (
    params.get("expires_at")?.startsWith("gt.") && expires > params.get("expires_at").slice(3)
  );
  if (table === "planner_plans") {
    return plans.filter(row => eq("wallet_address", row.wallet_address) && eq("id", row.id));
  }
  if (table !== "planner_shares") throw new Error("Unexpected mock resource: " + resource);
  if (options.method === "DELETE") {
    const deleted = [];
    for (const [id, row] of shares) {
      if (eq("id", row.id) && eq("wallet_address", row.wallet_address)) {
        deleted.push(row);
        shares.delete(id);
      }
    }
    return deleted;
  }
  if (options.method === "POST") {
    const [row] = JSON.parse(options.body);
    const saved = { ...row, created_at: NOW.toISOString() };
    shares.set(saved.id, saved);
    return [saved];
  }
  return [...shares.values()]
    .filter(row => eq("wallet_address", row.wallet_address) && eq("id", row.id) && active(row.expires_at))
    .map(row => {
      if (!params.get("select")) return row;
      return Object.fromEntries(params.get("select").split(",").map(key => [key, row[key]]));
    });
}

const walletDeps = {
  "./api/_wallet-auth.js": { signedWalletFromRequest: async req => req.wallet || null },
  "./api/_request-origin.js": { requireSameOriginMutation: () => true },
  "./api/_request-body.js": { readJsonBody: async req => req.body, sendRequestBodyError: () => false },
  "./api/_supabase.js": { supabaseConfig: () => ({ url: "fixture" }), supabaseRequest: mockSupabaseRequest },
};
const planner = loadHandler("./api/_handler-planner-share.js", {
  ...walletDeps,
  "./api/_planner-persistence.js": { sendPlannerPersistenceUnavailable: () => false },
});
const evaluation = loadHandler("./api/_handler-evaluation-share.js", {
  ...walletDeps,
  "./api/_evaluation-share-preview.js": {
    readActiveEvaluationShare: async (id, player) => {
      const row = evaluationShares.get(id);
      return row && row.expiresAt > NOW.toISOString() && (!player || player === row.playerId)
        ? row : null;
    },
  },
  "./api/_handler-mfl-season-ratios-v2.js": { loadRatiosFromSupabase: async () => [] },
});

async function call(handler, method, url, wallet = null, body = undefined) {
  const headers = new Map();
  const response = {
    statusCode: 200, body: null,
    setHeader(k, v) { headers.set(k.toLowerCase(), v); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ method, url, wallet, body, headers: {} }, response);
  assert.equal(headers.get("cache-control"), "no-store", `${method} ${url} must never allow caching`);
  return { status: response.statusCode, body: response.body };
}

const ownA = await call(planner, "GET", "/api/planner-share?owned=1", walletA);
assert.equal(ownA.status, 200);
assert.equal(ownA.body.shares.length, 1);
assert.equal(ownA.body.shares[0].id, shareId);
assert.equal(ownA.body.shares[0].sourcePlanId, planId);
assert.equal((await call(planner, "GET", "/api/planner-share?owned=1", walletB)).body.shares.length, 0);
assert.equal((await call(planner, "GET", "/api/planner-share?owned=1")).status, 401);

const publicA = await call(planner, "GET", "/api/planner-share?id=" + shareId, walletB);
assert.equal(publicA.status, 200, "Unlisted bearer links should remain publicly readable.");
assert.equal(publicA.body.share.id, shareId);
assert.equal(Object.hasOwn(publicA.body.share, "sourcePlanId"), false, "Public share must exclude owner-only source plan.");
assert.equal(JSON.stringify(publicA.body).includes(walletA), false, "Public share must not include the creator wallet.");
assert.equal((await call(planner, "GET", "/api/planner-share?id=" + expiredId)).status, 404);
assert.equal((await call(planner, "GET", "/api/planner-share?id=not-an-id")).status, 400);
assert.equal((await call(planner, "GET", "/api/planner-share?id=dddddddddddddddd")).status, 404);

// A signed wallet may request revocation of someone else's ID, but the SQL
// write must be scoped to its own wallet and leave the other share unchanged.
assert.equal((await call(planner, "DELETE", "/api/planner-share?id=" + shareId, walletB)).status, 404);
assert.equal(shares.has(shareId), true, "Wallet B must not revoke wallet A's share.");
assert.ok(queries.some(q => q.method === "DELETE" && q.resource.includes("wallet_address=eq." + encodeURIComponent(walletB))));
assert.equal((await call(planner, "DELETE", "/api/planner-share?id=" + shareId)).status, 401);
assert.equal((await call(planner, "DELETE", "/api/planner-share?id=bad", walletA)).status, 400);

const planPayload = { clubId: "9001", formation: "442", squad: [], lineup: [] };
assert.equal((await call(planner, "POST", "/api/planner-share", walletB, {
  name: "Foreign saved plan", sourcePlanId: planId, payload: planPayload,
})).status, 404, "Wallet B must not publish from wallet A's saved plan.");
const created = await call(planner, "POST", "/api/planner-share", walletA, {
  name: "Owned saved plan", sourcePlanId: planId, payload: planPayload,
});
assert.equal(created.status, 200);
assert.equal(created.body.share.sourcePlanId, planId);
assert.equal((await call(planner, "DELETE", "/api/planner-share?id=" + shareId, walletA)).status, 200);
assert.equal((await call(planner, "GET", "/api/planner-share?id=" + shareId)).status, 404,
  "A revoked share must immediately be unavailable without public caching.");

assert.equal((await call(evaluation, "GET", "/api/evaluation-share?id=" + evalId, walletB)).status, 200);
const publicEval = await call(evaluation, "GET", "/api/evaluation-share?id=" + evalId);
assert.equal(publicEval.body.playerId, "99");
assert.equal(JSON.stringify(publicEval.body).includes("wallet"), false);
assert.equal((await call(evaluation, "GET", "/api/evaluation-share?id=87654321")).status, 404);
assert.equal((await call(evaluation, "GET", "/api/evaluation-share?id=" + evalId + "suffix")).status, 400);
assert.equal((await call(evaluation, "GET", "/api/evaluation-share?id=" + evalId + "&player=42")).status, 404);
assert.equal((await call(evaluation, "GET", "/api/evaluation-share?id=00000000")).status, 404);
assert.equal((await call(evaluation, "POST", "/api/evaluation-share")).status, 401);

console.log("SEC-06 fixture matrix passed: wallet A/B, public read-only, wrong owner, revoke, expiration, malformed IDs and cache isolation.");
