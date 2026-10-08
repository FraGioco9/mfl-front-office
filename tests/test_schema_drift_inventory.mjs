import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(root, "supabase/migrations");
const ledger = JSON.parse(await readFile(resolve(root, "docs/schema-drift-ledger.json"), "utf8"));
const canonical = await readFile(resolve(root, "supabase-schema.sql"), "utf8");
const inventorySql = await readFile(resolve(root, "scripts/supabase/schema-drift-readonly-inventory.sql"), "utf8");
const plannerSave = await readFile(resolve(root, "api/_handler-planner-save.js"), "utf8");

function gitBlobSha1(content) {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(Buffer.from("blob " + bytes.length + "\0", "utf8"))
    .update(bytes)
    .digest("hex");
}

const migrationFiles = (await readdir(migrationsDir))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();
const ledgerFiles = ledger.migrations.map((entry) => entry.file).sort();
assert.deepEqual(ledgerFiles, migrationFiles, "Schema drift ledger must cover every versioned repository migration exactly once");

for (const entry of ledger.migrations) {
  const content = await readFile(resolve(migrationsDir, entry.file), "utf8");
  assert.equal(gitBlobSha1(content), entry.gitBlobSha1, "Migration fingerprint drift: " + entry.file);
  assert(
    ["normalized_match", "repo_history_only", "version_alias", "staged_release"].includes(entry.status),
    "Unknown Schema drift migration status: " + entry.status,
  );
}

const staged = ledger.migrations.filter((entry) => entry.status === "staged_release").map((entry) => entry.file);
assert.deepEqual(staged, [
  "20261001172000_restrict_application_grants.sql",
  "20261006183000_private_data_retention.sql",
  "20261006183001_planner_plan_capacity_guard.sql",
]);

const walletAuthAlias = ledger.migrations.find((entry) => entry.file === "20260914150000_wallet_auth_sessions.sql");
assert.equal(walletAuthAlias.status, "version_alias");
assert.equal(walletAuthAlias.liveVersion, "20260914202553");

for (const entry of ledger.liveOnlyMigrationHistory) {
  const keys = Object.keys(entry).sort();
  assert(keys.every((key) => ["name", "representedBy", "version"].includes(key)),
    "Live-only ledger must contain metadata only, never historical SQL payloads");
}

assert.equal(ledger.knownLegacySchemaDrift.canonicalOwner, "wallet_opt_ins.agent_name");
assert.deepEqual(
  ledger.knownLegacySchemaDrift.functions.sort(),
  ["fill_wallet_preferences_agent_name_from_opt_ins", "sync_wallet_preferences_agent_name_from_opt_ins"].sort(),
);
assert.deepEqual(
  ledger.knownLegacySchemaDrift.triggers.sort(),
  ["wallet_opt_ins_sync_preferences_agent_name", "wallet_preferences_fill_agent_name"].sort(),
);

const permissionsBlock = canonical.match(/create table if not exists public\.wallet_permissions \(([\s\S]*?)\n\);/i)?.[1] || "";
const preferencesBlock = canonical.match(/create table if not exists public\.wallet_preferences \(([\s\S]*?)\n\);/i)?.[1] || "";
const optInsBlock = canonical.match(/create table if not exists public\.wallet_opt_ins \(([\s\S]*?)\n\);/i)?.[1] || "";
assert(!/\bagent_name\b/i.test(permissionsBlock), "Canonical wallet_permissions must not duplicate agent_name");
assert(!/\bagent_name\b/i.test(preferencesBlock), "Canonical wallet_preferences must not duplicate agent_name");
assert(/\bagent_name\s+text\b/i.test(optInsBlock), "Canonical wallet_opt_ins must own agent_name");

for (const legacyName of [
  "sync_wallet_preferences_agent_name_from_opt_ins",
  "fill_wallet_preferences_agent_name_from_opt_ins",
  "wallet_opt_ins_sync_preferences_agent_name",
  "wallet_preferences_fill_agent_name",
]) {
  assert(!canonical.includes(legacyName), "Canonical schema must not restore legacy agent-name object " + legacyName);
}

const sqlWithoutComments = inventorySql.replace(/--[^\n]*/g, "");
const statements = sqlWithoutComments.split(";").map((value) => value.trim()).filter(Boolean);
assert(statements.length >= 8, "Schema drift live inventory must cover migrations, schema, grants, constraints, RPC and triggers");
for (const statement of statements) {
  assert(/^(show|select)\b/i.test(statement), "Schema drift live inventory must remain read-only: " + statement.slice(0, 60));
}
for (const forbidden of [
  /\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\balter\b/i,
  /\bcreate\b/i, /\bdrop\b/i, /\btruncate\b/i, /\bgrant\b/i, /\brevoke\b/i,
]) {
  assert(!forbidden.test(sqlWithoutComments), "Schema drift live inventory contains a write/DDL keyword: " + forbidden);
}

assert(canonical.includes("revision integer not null default 1"));
assert(canonical.includes("source_plan_id text references public.planner_plans(id) on delete cascade"));
assert(canonical.includes("create unique index if not exists planner_shares_wallet_source_idx on public.planner_shares (wallet_address, source_plan_id);"));
assert(plannerSave.includes("revision=eq." + "${expectedRevision}"));
assert(plannerSave.includes("revision: expectedRevision + 1"));
assert(plannerSave.includes('response.status(409).json({ error: "Saved plan changed. Reload it before saving." })'));
assert(plannerSave.includes('response.status(409).json({ error: "Saved plan changed. Reload it before deleting." })'));

console.log("SCHEMA_DRIFT_INVENTORY_PASS " + JSON.stringify({
  migrationFingerprints: ledger.migrations.length,
  liveOnlyHistoryMetadata: ledger.liveOnlyMigrationHistory.length,
  stagedReleaseMigrations: staged,
  legacyAgentNameDriftTracked: true,
  liveInventoryReadOnly: true,
  plannerCasContract: true,
}));
