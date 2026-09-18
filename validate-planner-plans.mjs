import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
const require = createRequire(import.meta.url);
const handler = require("./api/planner-plans.js");
const formations = require("./planner-formations.json");
const positions = new Set(["GK", "LB", "CB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"]);
assert.equal(formations.length, 5);
for (const formation of formations) {
  assert.equal(formation.slots.length, 11);
  assert.equal(new Set(formation.slots.map(slot => slot.id)).size, 11);
  for (const slot of formation.slots) {
    assert.ok(positions.has(slot.position), `Invalid position ${slot.position}`);
    assert.ok(slot.x >= 0 && slot.x <= 100 && slot.y >= 0 && slot.y <= 100);
  }
}
const owner = "0x1111111111111111";
const other = "0x2222222222222222";
const rows = new Map();
const originalFetch = globalThis.fetch;
const originalEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, origin: process.env.WALLET_CHALLENGE_ORIGIN };
process.env.SUPABASE_URL = "https://planner-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.WALLET_CHALLENGE_ORIGIN = "http://localhost:4000";
const payload = {
  name: "First XI",
  clubId: "123",
  formationId: "4-3-3",
  assignments: {},
  squadPlayerIds: ["42", "43", "44"],
};
let wallet = owner;
let failStore = false;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  const body = options.body ? JSON.parse(options.body) : null;
  if (url.pathname.endsWith("rpc/resolve_wallet_session")) {
    return Response.json(wallet ? [{ wallet_address: wallet, expires_at: new Date(Date.now() + 60000).toISOString() }] : []);
  }
  assert.equal(url.pathname, "/rest/v1/planner_plans");
  if (failStore) return new Response("storage failure", { status: 503 });
  const selected = [...rows.values()].filter(row => [...url.searchParams].every(([key, value]) => {
    if (["select", "order", "limit", "offset"].includes(key)) return true;
    assert.ok(value.startsWith("eq."), `Unexpected filter ${key}=${value}`);
    return String(row[key]) === value.slice(3);
  }));
  let result;
  if (options.method === "POST") {
    const row = { created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...body };
    assert.ok(!rows.has(row.id));
    rows.set(row.id, row);
    result = [row];
  } else if (options.method === "PATCH") {
    result = selected.map(row => { const updated = { ...row, ...body }; rows.set(row.id, updated); return updated; });
  } else if (options.method === "DELETE") {
    selected.forEach(row => rows.delete(row.id));
    result = selected;
  } else {
    const offset = Number(url.searchParams.get("offset") || 0);
    result = selected.slice(offset, offset + Number(url.searchParams.get("limit") || 50));
  }
  return Response.json(result);
};
async function call(method, query = "", body, extraHeaders = {}) {
  const request = Readable.from(body === undefined ? [] : [typeof body === "string" ? body : JSON.stringify(body)]);
  request.method = method;
  request.url = `/api/planner-plans${query}`;
  request.headers = { host: "localhost:4000", origin: "http://localhost:4000", "content-type": "application/json", cookie: `mfl_wallet_session=${"a".repeat(43)}`, ...extraHeaders };
  const response = { code: 0, headers: {}, body: null, setHeader(k,v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(request, response);
  assert.equal(response.headers["Cache-Control"], "no-store");
  return response;
}
try {
  const created = await call("POST", "", { ...payload, visibility: "unlisted", wallet_address: other });
  assert.equal(created.code, 201);
  const plan = created.body.plan;
  assert.equal(plan.visibility, "private");
  assert.equal(plan.canEdit, true);
  assert.equal(plan.revision, 1);
  assert.deepEqual(plan.assignments, payload.assignments);
  assert.deepEqual(plan.squadPlayerIds, payload.squadPlayerIds);
  assert.deepEqual(rows.get(plan.id).metadata, { squadPlayerIds: payload.squadPlayerIds });
  assert.equal(rows.get(plan.id).wallet_address, owner);
  assert.equal(plan.wallet_address, undefined);
  const query = `?id=${plan.id}`;
  wallet = other;
  assert.equal((await call("GET", query)).code, 404);
  assert.deepEqual((await call("GET")).body.plans, []);
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    const result = await call(method, query, { ...payload, revision: 1, shared: true });
    assert.equal(result.code, 404);
  }
  assert.equal((await call("POST", "", { sourceId: plan.id })).code, 404);
  wallet = null;
  assert.equal((await call("GET", query)).code, 404);
  assert.equal((await call("GET")).code, 401);
  assert.equal((await call("POST", "", payload)).code, 401);
  wallet = owner;
  const saved = await call("PUT", query, { ...payload, name: "Updated XI", revision: 1 });
  assert.equal(saved.code, 200);
  assert.equal(saved.body.plan.revision, 2);
  assert.equal((await call("PUT", query, { ...payload, revision: 1 })).code, 409);
  const shared = await call("PATCH", query, { shared: true, revision: 2 });
  assert.equal(shared.code, 200);
  assert.equal(shared.body.plan.visibility, "unlisted");
  wallet = null;
  const publicPlan = await call("GET", query);
  assert.equal(publicPlan.code, 200);
  assert.equal(publicPlan.body.plan.canEdit, false);
  assert.equal(publicPlan.body.plan.name, "Updated XI");
  assert.equal(JSON.stringify(publicPlan.body).includes(owner), false);
  wallet = other;
  const duplicate = await call("POST", "", { sourceId: plan.id });
  assert.equal(duplicate.code, 201);
  assert.notEqual(duplicate.body.plan.id, plan.id);
  assert.equal(duplicate.body.plan.visibility, "private");
  assert.deepEqual(duplicate.body.plan.assignments, payload.assignments);
  assert.deepEqual(duplicate.body.plan.squadPlayerIds, payload.squadPlayerIds);
  assert.equal(rows.get(duplicate.body.plan.id).wallet_address, other);
  assert.equal((await call("PATCH", query, { shared: false, revision: 3 })).code, 404);
  wallet = owner;
  assert.equal((await call("PATCH", query, { shared: false, revision: 3 })).code, 200);
  wallet = null;
  assert.equal((await call("GET", query)).code, 404);
  wallet = owner;
  for (const invalid of [
    null,
    [],
    { ...payload, name: " " },
    { ...payload, clubId: "-1" },
    { ...payload, formationId: "invalid" },
    { ...payload, assignments: { GK: "42", ST: "42" } },
    { ...payload, assignments: { NOPE: "42" } },
    { ...payload, assignments: [] },
    { ...payload, assignments: { GK: 0 } },
    { ...payload, squadPlayerIds: "42" },
    { ...payload, squadPlayerIds: ["42", "42"] },
    { ...payload, squadPlayerIds: ["0"] },
    { ...payload, squadPlayerIds: Array.from({ length: 51 }, (_, index) => String(index + 1)) },
  ]) {
    assert.equal((await call("POST", "", invalid)).code, 400);
  }
  assert.equal((await call("GET", "?id=bad")).code, 400);
  assert.equal((await call("GET", "?offset=-1")).code, 400);
  assert.equal((await call("POST", "", "{")).code, 400);
  assert.equal((await call("POST", "", { ...payload, name: "x".repeat(20000) })).code, 413);
  assert.equal((await call("POST", "", payload, { origin: "https://attacker.invalid" })).code, 403);
  assert.equal((await call("POST", "", payload, { "content-type": "text/plain" })).code, 415);
  assert.equal((await call("PATCH", query, { shared: "true", revision: 4 })).code, 400);
  assert.equal((await call("DELETE", query, { revision: 1 })).code, 409);
  assert.equal((await call("DELETE", query, { revision: 4 })).code, 200);
  assert.equal(rows.has(plan.id), false);
  assert.equal((await call("OPTIONS")).code, 405);
  failStore = true;
  const warn = console.warn;
  console.warn = () => {};
  try { assert.equal((await call("GET")).code, 500); } finally { console.warn = warn; }
  console.log("Planner persistence: private defaults, ownership, sharing/revocation, duplication, revisions and request validation passed.");
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of [["SUPABASE_URL", originalEnv.url], ["SUPABASE_SERVICE_ROLE_KEY", originalEnv.key], ["WALLET_CHALLENGE_ORIGIN", originalEnv.origin]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
