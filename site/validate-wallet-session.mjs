import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const {
  createWalletSessionStore,
  WALLET_SESSION_TTL_MS,
} = require("./api/_wallet-session.js");

const migration = await readFile(
  new URL("../supabase/migrations/20260914150000_wallet_auth_sessions.sql", import.meta.url),
  "utf8",
);
const schema = await readFile(new URL("../supabase-schema.sql", import.meta.url), "utf8");

const wallet = "0x1111111111111111";
const issuedAt = Date.UTC(2026, 8, 14, 14);
const challengeLifetime = 5 * 60 * 1000;
let clientNow = issuedAt;
let databaseNow = issuedAt;
let randomCounter = 1;
const calls = [];
const consumed = new Set();
const sessions = new Map();

function random(size) {
  assert.equal(size, 32);
  const bytes = Buffer.alloc(32);
  bytes.writeUInt32BE(randomCounter++, 28);
  return bytes;
}

async function request(path, options = {}) {
  const body = JSON.parse(String(options.body || "{}"));
  calls.push({ path, body });

  if (path === "rpc/consume_wallet_challenge_and_create_session") {
    const challengeExpiresAt = Date.parse(body.p_challenge_expires_at);
    const sessionExpiresAt = Date.parse(body.p_session_expires_at);
    if (!Number.isFinite(challengeExpiresAt) || challengeExpiresAt <= databaseNow) return [];
    if (consumed.has(body.p_nonce)) return [];

    consumed.add(body.p_nonce);
    sessions.set(body.p_session_hash, {
      wallet_address: body.p_wallet_address,
      expires_at: new Date(sessionExpiresAt).toISOString(),
      revoked: false,
    });
    return [{
      wallet_address: body.p_wallet_address,
      expires_at: new Date(sessionExpiresAt).toISOString(),
    }];
  }

  if (path === "rpc/resolve_wallet_session") {
    const row = sessions.get(body.p_session_hash);
    if (!row || row.revoked || Date.parse(row.expires_at) <= databaseNow) return [];
    return [{ wallet_address: row.wallet_address, expires_at: row.expires_at }];
  }

  if (path === "rpc/revoke_wallet_session") {
    const row = sessions.get(body.p_session_hash);
    if (!row || row.revoked || Date.parse(row.expires_at) <= databaseNow) return false;
    row.revoked = true;
    return true;
  }

  throw new Error("Unexpected RPC path: " + path);
}

function store() {
  return createWalletSessionStore({
    request,
    now: () => clientNow,
    random,
  });
}

assert.equal(WALLET_SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000);

const challenge = {
  nonce: "ab".repeat(32),
  walletAddress: wallet,
  challengeExpiresAt: issuedAt + challengeLifetime,
};
const firstStore = store();
const session = await firstStore.consumeChallengeAndCreateSession(challenge);
assert.ok(session);
assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
assert.equal(session.walletAddress, wallet);
assert.equal(session.expiresAt, issuedAt + WALLET_SESSION_TTL_MS);

const createCall = calls.find((call) => call.path === "rpc/consume_wallet_challenge_and_create_session");
assert.ok(createCall);
assert.equal(createCall.body.p_nonce, challenge.nonce);
assert.equal(createCall.body.p_wallet_address, wallet);
assert.match(createCall.body.p_session_hash, /^[0-9a-f]{64}$/);
assert.notEqual(createCall.body.p_session_hash, session.token);
assert.equal(JSON.stringify(createCall.body).includes(session.token), false, "Raw session token must never reach durable storage.");
assert.equal([...sessions.keys()].includes(session.token), false, "Durable session rows must be keyed only by a one-way token hash.");

assert.deepEqual(await firstStore.resolveSession(session.token), {
  walletAddress: wallet,
  expiresAt: session.expiresAt,
});

// Replaying the same challenge cannot create another session, including from
// another process/service instance sharing the same durable database.
const secondStore = store();
assert.equal(await secondStore.consumeChallengeAndCreateSession(challenge), null);

// Two server instances racing the same fresh nonce must produce at most one session.
const raceChallenge = {
  nonce: "cd".repeat(32),
  walletAddress: wallet,
  challengeExpiresAt: issuedAt + challengeLifetime,
};
const [raceA, raceB] = await Promise.all([
  store().consumeChallengeAndCreateSession(raceChallenge),
  store().consumeChallengeAndCreateSession(raceChallenge),
]);
assert.equal([raceA, raceB].filter(Boolean).length, 1);

// Challenge expiry is checked before persistence and again by the durable RPC.
// Simulate proof verification finishing just as the database deadline passes.
const expiringChallenge = {
  nonce: "ef".repeat(32),
  walletAddress: wallet,
  challengeExpiresAt: issuedAt + 1_000,
};
const expiringStore = createWalletSessionStore({
  now: () => issuedAt,
  random,
  async request(path, options) {
    databaseNow = issuedAt + 1_000;
    return request(path, options);
  },
});
assert.equal(await expiringStore.consumeChallengeAndCreateSession(expiringChallenge), null);
databaseNow = issuedAt;

const callCountBeforeInvalid = calls.length;
for (const invalid of [
  { ...challenge, nonce: "invalid" },
  { ...challenge, walletAddress: "0x2" },
  { ...challenge, challengeExpiresAt: issuedAt },
]) {
  assert.equal(await store().consumeChallengeAndCreateSession(invalid), null);
}
assert.equal(calls.length, callCountBeforeInvalid, "Invalid challenge/session input must be rejected before Supabase.");

assert.equal(await firstStore.revokeSession(session.token), true);
assert.equal(await firstStore.resolveSession(session.token), null);
assert.equal(await firstStore.revokeSession(session.token), false);

const invalidTokenCalls = calls.length;
for (const token of ["", "x", "a".repeat(44), null, 42]) {
  assert.equal(await firstStore.resolveSession(token), null);
  assert.equal(await firstStore.revokeSession(token), false);
}
assert.equal(calls.length, invalidTokenCalls, "Malformed session tokens must never reach storage.");

for (const source of [migration, schema]) {
  assert.ok(source.includes("create table if not exists public.wallet_auth_consumed_challenges"));
  assert.ok(source.includes("create table if not exists public.wallet_auth_sessions"));
  assert.ok(source.includes("create or replace function public.consume_wallet_challenge_and_create_session("));
  assert.ok(source.includes("on conflict (nonce) do nothing;"));
  assert.ok(source.includes("get diagnostics v_inserted = row_count;"));
  assert.ok(source.indexOf("get diagnostics v_inserted = row_count;") < source.indexOf("insert into public.wallet_auth_sessions"));
  assert.ok(source.includes("p_challenge_expires_at <= v_now"));
  assert.ok(source.includes("p_session_expires_at > v_now + interval '8 days'"));
  assert.ok(source.includes("create or replace function public.resolve_wallet_session("));
  assert.ok(source.includes("sessions.revoked_at is null"));
  assert.ok(source.includes("create or replace function public.revoke_wallet_session("));
  assert.ok(source.includes("alter table public.wallet_auth_sessions enable row level security;"));
  assert.ok(source.includes("grant execute on function public.consume_wallet_challenge_and_create_session"));
  assert.ok(source.includes("to service_role;"));
}

console.log("Wallet session validation passed: hashed durable sessions, atomic single-use nonce consumption, expiry recheck, cross-instance replay rejection, resolution, and revocation.");
