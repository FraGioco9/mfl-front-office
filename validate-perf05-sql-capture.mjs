// PERF-05A: run the exact API SQL capture against the tiny offline Next
// fixture in CI. This catches broken case construction without touching live DB.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "mfl-perf05-smoke-"));
const database = join(dir, "mfl_database.db");
function node(args, env = {}) {
  const child = spawnSync(process.execPath, args, {
    env: { ...process.env, ...env },
    encoding:"utf8", maxBuffer:16*1024*1024, timeout: 90000,
  });
  assert.equal(child.status, 0,
    "PERF-05A offline fixture capture failed: " + (child.stderr||child.stdout||"").slice(0,4000));
  return child.stdout;
}
try {
  node(["scripts/ci/create-next-sqlite-smoke-fixture.cjs", database]);
  const output = node(["scripts/performance/perf05-query-profile.cjs"], {
    MFL_DATABASE_PATH: database, PERF05_REPETITIONS:"1",
  });
  const report = JSON.parse(output);
  assert.equal(report.rowCount, 2);
  assert.ok(report.scenarios.length >= 10);
  for (const scenario of report.scenarios) {
    assert.ok(scenario.response.totalRows >= 0 && scenario.response.totalRows <= 2);
    assert.ok(scenario.statementCount >= 1, "Expected generated SQL: " + scenario.name);
    for (const statement of scenario.statements) {
      assert.ok(statement.sql.startsWith("SELECT"), scenario.name);
      assert.ok(statement.plan.length >= 1, "EXPLAIN missing: " + scenario.name);
      assert.ok(Number.isFinite(statement.medianMs) && statement.medianMs >= 0);
      assert.match(statement.rowDigest, /^[a-f0-9]{64}$/);
      assert.equal(statement.parameterCount, statement.paramTypes.length);
      assert.equal("parameters" in statement, false, "Raw private filter params must not be logged.");
    }
  }
  for (const required of [
    "database_first","database_last","numeric_range_sort","name_contains",
    "position_nationality","nationality_overall","listing_for_sale",
    "listing_price_sort","watchlist_sort","progression_current",
  ]) assert.ok(report.scenarios.some(x=>x.name===required), "Missing filter case: "+required);
  console.log(JSON.stringify({ test:"PERF-05A capture smoke",
    scenarios:report.scenarios.length, statements:report.scenarios.reduce((n,x)=>n+x.statementCount,0),
    privacy:"SQL placeholders only; all result values hashed", passed:true }));
} finally {
  await rm(dir, {recursive:true,force:true});
}
