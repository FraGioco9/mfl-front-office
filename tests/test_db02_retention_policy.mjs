import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [migration, scheduler, schema, docs, plannerShare, evaluationPreview] = await Promise.all([
  fs.readFile(resolve(root, "supabase/migrations/20261006183000_private_data_retention.sql"), "utf8"),
  fs.readFile(resolve(root, "supabase/private-data-retention-scheduler.sql"), "utf8"),
  fs.readFile(resolve(root, "supabase-schema.sql"), "utf8"),
  fs.readFile(resolve(root, "SUPABASE_PERSISTENCE.md"), "utf8"),
  fs.readFile(resolve(root, "api/planner-share.js"), "utf8"),
  fs.readFile(resolve(root, "api/_evaluation-share-preview.js"), "utf8"),
]);

const expectedDeleteTargets = new Set([
  "evaluation_shares",
  "planner_shares",
  "wallet_auth_consumed_challenges",
  "wallet_auth_sessions",
  "wallet_auth_rate_limits",
  "private_data_retention_audit",
]);
const protectedTables = [
  "evaluation_saves",
  "planner_plans",
  "wallet_preferences",
  "wallet_opt_ins",
  "wallet_permissions",
  "bug_reports",
];

const deleteTargets = [...migration.matchAll(/delete\s+from\s+public\.([a-z0-9_]+)/gi)]
  .map((match) => match[1]);
assert.deepEqual(new Set(deleteTargets), expectedDeleteTargets);
for (const table of protectedTables) {
  assert(!deleteTargets.includes(table), "DB-02 must never delete from " + table);
}

for (const source of [migration, schema]) {
  assert(source.includes("create table if not exists public.private_data_retention_audit"));
  assert(source.includes("create or replace function public.run_private_data_retention()"));
  assert(source.includes("language plpgsql"));
  assert(source.includes("security invoker"));
  assert(source.includes("set search_path = ''"));
  assert(source.includes("revoke all on function public.run_private_data_retention()"));
  assert(source.includes("grant execute on function public.run_private_data_retention()"));
  assert(source.includes("where expires_at <= v_now"));
  assert(source.includes("revoked_at <= v_now - interval '1 day'"));
  assert(source.includes("where challenge_expires_at <= v_now"));
  assert(source.includes("where window_ends_at < v_now - interval '1 hour'"));
  assert(source.includes("where run_bucket < v_run_bucket - interval '90 days'"));
  assert(source.includes("on conflict (run_bucket) do update"));
}

const auditDefinition = migration.slice(
  migration.indexOf("create table if not exists public.private_data_retention_audit"),
  migration.indexOf("comment on table public.private_data_retention_audit"),
);
for (const forbidden of [
  "wallet_address",
  "player_id",
  "plan_id",
  "reporter_hash",
  "user_agent",
  "payload",
  "token",
  "nonce",
  "ip_address",
]) {
  assert(!auditDefinition.includes(forbidden), "Retention audit must not persist " + forbidden);
}

assert(scheduler.includes("where jobname = 'mfl-private-data-retention-hourly'"));
assert(scheduler.includes("'41 * * * *'"));
assert(scheduler.includes("select public.run_private_data_retention();"));
assert.equal((scheduler.match(/select cron\.schedule\(/g) || []).length, 1);
assert.equal((scheduler.match(/select cron\.unschedule\(/g) || []).length, 1);
assert(!scheduler.includes("net.http_post"), "DB-02 cleanup must stay database-local");
assert(!scheduler.includes("vault."), "DB-02 cleanup must not need secrets");

assert(plannerShare.includes('request.method === "DELETE"'), "Planner explicit Revoke must remain available");
assert(plannerShare.includes("expires_at=gt."), "Planner lists/reads must keep excluding expired shares");
assert(evaluationPreview.includes("expires_at=gt."), "Evaluation public reads must keep excluding expired shares");

assert(docs.includes("no automatic TTL"));
assert(docs.includes("take/verify the normal database backup or PITR coverage"));
assert(docs.includes("Restoring deleted rows requires") && docs.includes("backup/PITR"));

const now = Date.parse("2026-10-06T16:00:00.000Z");
assert.equal(
  Date.parse("2026-10-06T18:00:00+02:00"),
  now,
  "Retention boundaries must represent the same instant across Europe/Rome offsets",
);

const initial = {
  evaluationShares: [
    { id: "eval-expired", expiresAt: now },
    { id: "eval-active", expiresAt: now + 1 },
  ],
  plannerShares: [
    { id: "plan-expired", expiresAt: now - 1 },
    { id: "plan-active", expiresAt: now + 86_400_000 },
  ],
  sessions: [
    { id: "session-expired", expiresAt: now - 1, revokedAt: null },
    { id: "session-revoked-old", expiresAt: now + 86_400_000, revokedAt: now - 86_400_001 },
    { id: "session-revoked-recent", expiresAt: now + 86_400_000, revokedAt: now - 86_399_999 },
    { id: "session-active", expiresAt: now + 86_400_000, revokedAt: null },
  ],
  challenges: [
    { id: "challenge-expired", expiresAt: now },
    { id: "challenge-active", expiresAt: now + 1 },
  ],
  rateLimits: [
    { id: "bucket-old", windowEndsAt: now - 3_600_001 },
    { id: "bucket-grace", windowEndsAt: now - 3_599_999 },
  ],
  protected: {
    evaluationSaves: [{ id: "saved-eval" }],
    plannerPlans: [{ id: "saved-plan" }],
    walletPreferences: [{ wallet: "wallet-a" }],
    bugReports: [{ id: "bug-1" }],
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function simulateRetention(state, timestamp) {
  const next = clone(state);
  const before = {
    evaluationShares: next.evaluationShares.length,
    plannerShares: next.plannerShares.length,
    sessions: next.sessions.length,
    challenges: next.challenges.length,
    rateLimits: next.rateLimits.length,
  };
  next.evaluationShares = next.evaluationShares.filter((row) => row.expiresAt > timestamp);
  next.plannerShares = next.plannerShares.filter((row) => row.expiresAt > timestamp);
  next.sessions = next.sessions.filter((row) => (
    row.expiresAt > timestamp
    && !(row.revokedAt !== null && row.revokedAt <= timestamp - 86_400_000)
  ));
  next.challenges = next.challenges.filter((row) => row.expiresAt > timestamp);
  next.rateLimits = next.rateLimits.filter((row) => row.windowEndsAt >= timestamp - 3_600_000);
  return {
    next,
    deleted: {
      evaluationShares: before.evaluationShares - next.evaluationShares.length,
      plannerShares: before.plannerShares - next.plannerShares.length,
      sessions: before.sessions - next.sessions.length,
      challenges: before.challenges - next.challenges.length,
      rateLimits: before.rateLimits - next.rateLimits.length,
    },
  };
}

const protectedSnapshot = JSON.stringify(initial.protected);
const first = simulateRetention(initial, now);
assert.deepEqual(first.deleted, {
  evaluationShares: 1,
  plannerShares: 1,
  sessions: 2,
  challenges: 1,
  rateLimits: 1,
});
assert.equal(JSON.stringify(first.next.protected), protectedSnapshot, "Protected user data changed during retention");
assert.deepEqual(first.next.evaluationShares.map((row) => row.id), ["eval-active"]);
assert.deepEqual(first.next.plannerShares.map((row) => row.id), ["plan-active"]);
assert.deepEqual(first.next.sessions.map((row) => row.id), ["session-revoked-recent", "session-active"]);
assert.deepEqual(first.next.challenges.map((row) => row.id), ["challenge-active"]);
assert.deepEqual(first.next.rateLimits.map((row) => row.id), ["bucket-grace"]);

const second = simulateRetention(first.next, now);
assert.deepEqual(second.deleted, {
  evaluationShares: 0,
  plannerShares: 0,
  sessions: 0,
  challenges: 0,
  rateLimits: 0,
}, "Repeated cleanup at the same instant must be deletion-idempotent");
assert.equal(JSON.stringify(second.next.protected), protectedSnapshot);

console.log("DB02_RETENTION_POLICY_PASS " + JSON.stringify({
  cleanupTargets: [...expectedDeleteTargets],
  protectedTables,
  schedule: "41 * * * *",
  timezoneBoundary: "PASS",
  repeatedCleanup: "PASS",
  protectedSnapshot: "PASS",
}));
