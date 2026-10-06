import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const {
  plannerPlanCapacityExceeded,
} = require("../api/_planner-persistence.js");

const [migration, schema, plannerSave, docs] = await Promise.all([
  readFile(new URL("../supabase/migrations/20261006183001_planner_plan_capacity_guard.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase-schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../api/planner-save.js", import.meta.url), "utf8"),
  readFile(new URL("../docs/db05-planner-saved-list.md", import.meta.url), "utf8"),
]);

assert.equal(
  plannerPlanCapacityExceeded(new Error("Supabase request failed with 400: planner_plan_limit_exceeded")),
  true,
);
assert.equal(plannerPlanCapacityExceeded(new Error("other error")), false);

for (const source of [migration, schema]) {
  assert(source.includes("create or replace function public.enforce_planner_plan_wallet_limit()"));
  assert(source.includes("pg_catalog.pg_advisory_xact_lock"));
  assert(source.includes("pg_catalog.hashtextextended(new.wallet_address, 1034)"));
  assert(source.includes("from public.planner_plans"));
  assert(source.includes("where wallet_address = new.wallet_address"));
  assert(source.includes("if v_plan_count >= 50 then"));
  assert(source.includes("message = 'planner_plan_limit_exceeded'"));
  assert(source.includes("create trigger planner_plans_wallet_limit_guard"));
  assert(source.includes("before insert on public.planner_plans"));
  assert(source.includes("security invoker"));
  assert(source.includes("set search_path = ''"));
  assert(source.includes("revoke all on function public.enforce_planner_plan_wallet_limit()"));
  assert(source.includes("grant execute on function public.enforce_planner_plan_wallet_limit()"));
}
assert.equal(
  schema.split(migration.trim()).length - 1,
  1,
  "Canonical schema must contain the exact DB-05 migration once",
);
assert.equal(
  /create\s+(?:unique\s+)?index/i.test(migration),
  false,
  "DB-05 must not add an index without workload evidence",
);

assert(plannerSave.includes("MAX_SAVED_PLANS_PER_WALLET = 50"));
assert(plannerSave.includes("await savedPlanCount(wallet) >= MAX_SAVED_PLANS_PER_WALLET"));
assert(plannerSave.includes("sendPlannerPlanCapacityExceeded(response, error, MAX_SAVED_PLANS_PER_WALLET)"));
assert(plannerSave.includes('trace.warn("capacity_limit", { status: 429 })'));
assert(plannerSave.includes("revision=eq." + "${expectedRevision}"));
assert(plannerSave.includes("revision: expectedRevision + 1"));

assert(docs.includes("35 calls"));
assert(docs.includes("0.342 ms"));
assert(docs.includes("0.539 ms"));
assert(docs.includes("49"));
assert(docs.includes("51"));
assert(docs.includes("No new index"));

console.log("DB05_PLANNER_CAPACITY_SOURCE_PASS");
