import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261001172000_restrict_application_grants.sql");
const canonical = read("supabase-schema.sql");
const ratios = read("api/mfl-season-ratios-v2.js");

const tables = [
  "bug_reports", "evaluation_saves", "evaluation_shares", "mfl_season_ratios",
  "planner_plans", "planner_shares", "wallet_auth_consumed_challenges",
  "wallet_auth_rate_limits", "wallet_auth_sessions", "wallet_opt_ins",
  "wallet_permissions", "wallet_preferences",
];

assert.equal(tables.length, 12);
assert.equal(canonical.includes(migration), true,
  "Canonical SQL schema must retain the exact versioned grant-hardening migration.");
assert.equal(canonical.split(migration).length - 1, 1,
  "Canonical SQL schema must contain the SEC-05 migration exactly once.");
for (const name of tables) {
  const count = migration.match(new RegExp(`public\\.${name}(?=,|\\s|$)`, "g"))?.length || 0;
  assert.equal(count, 2, `Table ${name} must be included in revoke and service-role grant sections.`);
}
assert.match(migration, /revoke all privileges on table[\s\S]*?from public, anon, authenticated;/);
assert.match(migration, /grant select, insert, update, delete on table[\s\S]*?to service_role;/);
assert.match(migration, /revoke execute on function public\.set_updated_at\(\) from public, anon, authenticated;/);
assert.match(migration, /alter default privileges for role postgres in schema public/);
const sqlStatements = migration.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
assert.doesNotMatch(sqlStatements, /\b(?:drop table|delete from|truncate|disable row level security|create policy)\b/i,
  "SEC-05 must not remove rows/tables, disable RLS or add client policies.");
assert.doesNotMatch(sqlStatements, /\bgrant\s+(?:all|select)[^;]*\bto\s+(?:anon|authenticated)\b/i,
  "SEC-05 must not remove data, turn RLS off, add public policies, or grant client data access.");

assert.ok(ratios.includes("const config = supabaseConfig();"),
  "Historical season ratios must use the server service-role key.");
assert.ok(!ratios.includes("allowAnonKey"),
  "Historical ratio reader must not fall back to a browser/anon Supabase key.");
console.log("SEC-05 staged migration and canonical SQL parity passed; 12 private tables, service-role read boundary.");
