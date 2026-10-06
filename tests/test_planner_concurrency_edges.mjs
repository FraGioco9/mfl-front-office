import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const walletA = "0xwallet-a";
const planId = "bbbbbbbbbbbbbbbb";
const initialShareId = "aaaaaaaaaaaaaaaa";
const payload = { clubId: "9001", formation: "442", squad: [], lineup: [] };
const now = "2026-10-05T15:30:00.000Z";

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

const plans = new Map([[
  planId,
  {
    id: planId, wallet_address: walletA, club_id: "9001", name: "Original",
    payload, revision: 1, created_at: now, updated_at: now,
  },
]]);

const shares = new Map([[
  initialShareId,
  {
    id: initialShareId, wallet_address: walletA, source_plan_id: planId,
    club_id: "9001", name: "Original", payload, created_at: now,
    expires_at: "2027-10-05T15:30:00.000Z",
  },
]]);

function parseResource(resource) {
  const url = new URL(resource, "https://fixture.invalid/");
  const table = url.pathname.slice(1);
  const params = url.searchParams;
  const eq = (key, actual) => !params.has(key) || params.get(key) === "eq." + String(actual);
  return { url, table, params, eq };
}

async function mockSupabaseRequest(resource, options = {}) {
  const { table, params, eq } = parseResource(resource);
  const method = options.method || "GET";

  if (table === "planner_plans") {
    if (method === "POST") {
      const [incoming] = JSON.parse(options.body);
      const row = {
        ...incoming,
        revision: Number(incoming.revision || 1),
        created_at: now,
        updated_at: now,
      };
      plans.set(row.id, row);
      return [row];
    }
    if (method === "PATCH") {
      const body = JSON.parse(options.body);
      const changed = [];
      for (const [id, row] of plans) {
        if (!eq("id", row.id) || !eq("wallet_address", row.wallet_address) || !eq("revision", row.revision)) continue;
        const next = { ...row, ...body };
        plans.set(id, next);
        changed.push(next);
      }
      return changed;
    }
    if (method === "DELETE") {
      const deleted = [];
      for (const [id, row] of plans) {
        if (!eq("id", row.id) || !eq("wallet_address", row.wallet_address) || !eq("revision", row.revision)) continue;
        deleted.push(row);
        plans.delete(id);
      }
      return deleted;
    }
    return [...plans.values()].filter((row) => eq("id", row.id) && eq("wallet_address", row.wallet_address));
  }

  if (table === "planner_shares") {
    const active = (row) => !params.has("expires_at") || !params.get("expires_at").startsWith("gt.") || row.expires_at > params.get("expires_at").slice(3);
    if (method === "POST") {
      const [incoming] = JSON.parse(options.body);
      if (params.get("on_conflict") === "wallet_address,source_plan_id" && incoming.source_plan_id) {
        for (const [id, row] of shares) {
          if (row.wallet_address === incoming.wallet_address && row.source_plan_id === incoming.source_plan_id) shares.delete(id);
        }
      }
      const row = { ...incoming, created_at: now };
      shares.set(row.id, row);
      return [row];
    }
    if (method === "DELETE") {
      const deleted = [];
      for (const [id, row] of shares) {
        if (!eq("id", row.id) || !eq("wallet_address", row.wallet_address)) continue;
        deleted.push(row);
        shares.delete(id);
      }
      return deleted;
    }
    return [...shares.values()]
      .filter((row) => eq("id", row.id) && eq("wallet_address", row.wallet_address) && active(row))
      .map((row) => {
        const select = params.get("select");
        if (!select) return row;
        return Object.fromEntries(select.split(",").map((key) => [key, row[key]]));
      });
  }

  throw new Error("Unexpected mock resource: " + resource);
}

const deps = {
  "../api/_wallet-auth.js": { signedWalletFromRequest: async (request) => request.wallet || null },
  "../api/_request-origin.js": { requireSameOriginMutation: () => true },
  "../api/_request-body.js": { readJsonBody: async (request) => request.body, sendRequestBodyError: () => false },
  "../api/_supabase.js": { supabaseConfig: () => ({ url: "fixture" }), supabaseRequest: mockSupabaseRequest },
  "../api/_planner-persistence.js": { sendPlannerPersistenceUnavailable: () => false },
};

const saveHandler = loadHandler("../api/planner-save.js", deps);
const shareHandler = loadHandler("../api/planner-share.js", deps);

async function call(handler, method, url, body) {
  const headers = new Map();
  const response = {
    statusCode: 200, body: null,
    setHeader(key, value) { headers.set(String(key).toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ method, url, wallet: walletA, body, headers: {} }, response);
  assert.equal(headers.get("cache-control"), "no-store");
  return { status: response.statusCode, body: response.body };
}

// Both tabs open revision 1 and the original share.
const tabAPlan = await call(saveHandler, "GET", "/api/planner-save?id=" + planId);
const tabBPlan = await call(saveHandler, "GET", "/api/planner-save?id=" + planId);
assert.equal(tabAPlan.body.plan.revision, 1);
assert.equal(tabBPlan.body.plan.revision, 1);
const tabAShares = await call(shareHandler, "GET", "/api/planner-share?owned=1");
const tabBShares = await call(shareHandler, "GET", "/api/planner-share?owned=1");
assert.equal(tabAShares.body.shares[0].id, initialShareId);
assert.equal(tabBShares.body.shares[0].id, initialShareId);

// Tab B replaces the unique source-plan share. The old public URL disappears.
const replacement = await call(shareHandler, "POST", "/api/planner-share", {
  name: "Original", sourcePlanId: planId, payload,
});
assert.equal(replacement.status, 200);
const replacementShareId = replacement.body.share.id;
assert.notEqual(replacementShareId, initialShareId);
assert.equal((await call(shareHandler, "GET", "/api/planner-share?id=" + initialShareId)).status, 404);
assert.equal((await call(shareHandler, "GET", "/api/planner-share?id=" + replacementShareId)).status, 200);

// Tab A still holds the stale old share ID. Revoke must not lie with 200.
const staleRevoke = await call(shareHandler, "DELETE", "/api/planner-share?id=" + initialShareId);
assert.equal(staleRevoke.status, 404);
assert.match(staleRevoke.body.error, /changed or was already revoked/i);
const afterStaleRevoke = await call(shareHandler, "GET", "/api/planner-share?owned=1");
assert.equal(afterStaleRevoke.body.shares.length, 1);
assert.equal(afterStaleRevoke.body.shares[0].id, replacementShareId, "stale revoke must not remove the replacement share");

// Tab B renames revision 1. Tab A then tries the same stale revision and gets 409.
const renameB = await call(saveHandler, "POST", "/api/planner-save", {
  id: planId, name: "Renamed in tab B", payload, expectedRevision: tabBPlan.body.plan.revision,
});
assert.equal(renameB.status, 200);
assert.equal(renameB.body.plan.revision, 2);
const staleRenameA = await call(saveHandler, "POST", "/api/planner-save", {
  id: planId, name: "Stale rename from tab A", payload, expectedRevision: tabAPlan.body.plan.revision,
});
assert.equal(staleRenameA.status, 409);
const latestPlan = await call(saveHandler, "GET", "/api/planner-save?id=" + planId);
assert.equal(latestPlan.body.plan.name, "Renamed in tab B");
assert.equal(latestPlan.body.plan.revision, 2);

// Revoking the live replacement works once. A second tab reopening the old action gets 404.
assert.equal((await call(shareHandler, "DELETE", "/api/planner-share?id=" + replacementShareId)).status, 200);
assert.equal((await call(shareHandler, "GET", "/api/planner-share?id=" + replacementShareId)).status, 404);
assert.equal((await call(shareHandler, "DELETE", "/api/planner-share?id=" + replacementShareId)).status, 404);

const plannerSource = await readFile(new URL("../modules/core-sources/planner.js", import.meta.url), "utf8");
assert.match(plannerSource, /if\(Number\(error\?\.status\)===404\)\{[\s\S]*?openPlansModal\(\)[\s\S]*?refreshActivePlannerShare\(\)/);
assert.match(plannerSource, /if\(Number\(error\?\.status\)===409&&plansModal instanceof HTMLElement&&!plansModal\.hidden\)await openPlansModal\(\);/);
assert.match(plannerSource, /const shares=Array\.isArray\(shareData\?\.shares\)\?shareData\.shares:\[\];[\s\S]*?activeShareId=String\(active\?\.id\|\|""\);/);

console.log("EDGE-03 Planner two-tab share/revoke/rename concurrency fixtures verified.");
