import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const {
  createWalletRateLimiter,
  requestAddress,
  RATE_LIMITS,
} = require("./api/_wallet-rate-limit.js");
const { createWalletSessionHandler } = require("./api/wallet-session.js");

const source = await readFile(new URL("./supabase/migrations/20261001170000_wallet_auth_distributed_rate_limit.sql", import.meta.url), "utf8");
const schema = await readFile(new URL("./supabase-schema.sql", import.meta.url), "utf8");
for (const sql of [source, schema]) {
  assert.match(sql, /create table if not exists public.wallet_auth_rate_limits/);
  assert.match(sql, /create or replace function public.consume_wallet_auth_rate_limit/);
  assert.match(sql, /on conflict \(bucket_key\) do update/);
  assert.match(sql, /where buckets.window_ends_at <= v_now or buckets.hits < p_limit/);
  assert.match(sql, /alter table public.wallet_auth_rate_limits enable row level security/);
  assert.match(sql, /revoke all on function public.consume_wallet_auth_rate_limit/);
  assert.match(sql, /to service_role/);
}
assert.deepEqual(RATE_LIMITS, { issue: 20, exchange: 10, logout: 30 });

const testIp = "203.0.113.23";
const headers = {
  "x-vercel-forwarded-for": testIp,
  "x-forwarded-for": "192.0.2.123",
};
const remoteAddress = { socket: { remoteAddress: "127.0.0.1" }, headers };
assert.equal(requestAddress(remoteAddress, true), testIp, "Use Vercel's proxy-provided IP.");
assert.equal(requestAddress(remoteAddress, false), "127.0.0.1", "Ignore untrusted forwarding headers outside Vercel.");
assert.equal(requestAddress({ headers: {}, socket: {} }, false), "unknown");

let time = 1_730_000_000_000;
const durableCounters = new Map();
const observed = [];
async function rpc(path, options) {
  assert.equal(path, "rpc/consume_wallet_auth_rate_limit");
  const payload = JSON.parse(options.body);
  observed.push(payload);
  const current = durableCounters.get(payload.p_bucket_key);
  if (!current || current.until <= time) {
    durableCounters.set(payload.p_bucket_key, { hits: 1, until: time + payload.p_window_seconds * 1000 });
    return [{ allowed: true, retry_after_seconds: 0 }];
  }
  if (current.hits < payload.p_limit) {
    current.hits += 1;
    return [{ allowed: true, retry_after_seconds: 0 }];
  }
  return [{ allowed: false, retry_after_seconds: Math.max(1, Math.ceil((current.until - time) / 1000)) }];
}
const options = {
  request: rpc,
  config: () => ({ key: "fake-test-secret" }),
  now: () => time,
  vercel: true,
};
const regionA = createWalletRateLimiter(options);
const regionB = createWalletRateLimiter(options);
const twentyFive = await Promise.all(Array.from({ length: 25 }, (_, i) => (i % 2 ? regionB : regionA)("issue", remoteAddress)));
assert.equal(twentyFive.filter(v => v.allowed).length, 20, "Shared issuer quota across independent instances.");
assert.equal(twentyFive.filter(v => !v.allowed).length, 5);
assert.equal(durableCounters.size, 1);
assert.equal(observed[0].p_limit, 20);
assert.equal(observed[0].p_window_seconds, 60);
assert.match(observed[0].p_bucket_key, /^[0-9a-f]{64}$/);
assert.ok(!JSON.stringify(observed).includes(testIp), "Raw IP addresses must not be persisted.");
assert.equal((await regionB("exchange", remoteAddress)).allowed, true, "Exchange has its own quota bucket.");
const otherAddress = { headers: { "x-vercel-forwarded-for": "203.0.113.24" }, socket: {} };
assert.equal((await regionB("issue", otherAddress)).allowed, true, "Separate clients have separate quota.");
time += 60_010;
assert.equal((await regionA("issue", remoteAddress)).allowed, true, "Quota resets after expiry.");

const badStore = createWalletRateLimiter({
  ...options,
  async request() { throw new Error("Network unavailable"); },
});
assert.deepEqual(await badStore("issue", remoteAddress), { allowed: false, retryAfter: 30, unavailable: true }, "Shared store failure must fail closed.");
const noStore = createWalletRateLimiter({ ...options, config: () => null, buckets: new Map() });
for (let i = 0; i < 20; i += 1) assert.equal((await noStore("issue", remoteAddress)).allowed, true);
const localBlocked = await noStore("issue", remoteAddress);
assert.equal(localBlocked.allowed, false);
assert.equal(localBlocked.retryAfter, 60);

const logoutWithNoStore = createWalletRateLimiter({ ...options, async request() { throw new Error("Unavailable"); }, buckets: new Map() });
assert.equal((await logoutWithNoStore("logout", remoteAddress)).allowed, true, "Logout must not rely on the shared store.");

function response() {
  return {
    code: null,
    headers: {},
    status(code) { this.code = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(value) { this.value = value; return this; },
    end() { return this; },
  };
}
function request(method, origin = "https://wallet-test.example") {
  return { method, headers: { origin, host: "wallet-test.example" }, socket: { remoteAddress: testIp } };
}
let limiterCalls = 0;
const rejected = createWalletSessionHandler({
  origin: "https://wallet-test.example",
  rateLimiter: async () => { limiterCalls += 1; return { allowed: false, retryAfter: 17 }; },
});
const r429 = response();
await rejected(request("POST"), r429);
assert.equal(r429.code, 429);
assert.equal(r429.headers["Retry-After"], "17");
assert.equal(limiterCalls, 1);

const crossSite = response();
await rejected(request("POST", "https://attacker.example"), crossSite);
assert.equal(crossSite.code, 403);
assert.equal(limiterCalls, 1, "Invalid origins must not consume a legitimate quota.");
const unsupported = response();
await rejected(request("PATCH"), unsupported);
assert.equal(unsupported.code, 405);
assert.equal(limiterCalls, 1);

const failure = createWalletSessionHandler({
  origin: "https://wallet-test.example",
  rateLimiter: async () => ({ allowed: false, retryAfter: 30, unavailable: true }),
});
const r503 = response();
await failure(request("GET"), r503);
assert.equal(r503.code, 503);
assert.equal(r503.headers["Retry-After"], "30");
console.log("Distributed wallet authentication rate limit validation passed: cross-instance quotas, hashing, expiry, logout availability, 429, and 503.");
