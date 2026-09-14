import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PLAYER_COLUMNS, PUBLIC_COLUMNS } = require("./api/_database");
const { projectedDatabaseColumns } = require("./api/_data-page");

const common = [
  "player_id",
  "wallet_address",
  "wallet_name",
  "name",
  "positions",
  "age",
  "nationality",
  "retirement_years",
  "owned_since",
  "player_seasons",
  "overall",
  "goalkeeping",
];
const attributes = projectedDatabaseColumns("database", "attributes", false, []);
const contracts = projectedDatabaseColumns("database", "contracts", false, []);
const current = projectedDatabaseColumns("progression", "current", true, []);
const allTime = projectedDatabaseColumns("progression", "all", true, []);
const next = projectedDatabaseColumns("watchlist", "next", false, []);

for (const column of common) {
  assert.ok(attributes.includes(column), `Attributes payload must retain ${column}.`);
  assert.ok(contracts.includes(column), `Contracts payload must retain ${column}.`);
}

for (const column of ["pace", "shooting", "passing", "dribbling", "defense", "physical"]) {
  assert.ok(attributes.includes(column), `Attributes payload must retain visible stat ${column}.`);
  assert.ok(current.includes(column), `Current payload must retain visible stat ${column}.`);
  assert.ok(allTime.includes(column), `All-time payload must retain visible stat ${column}.`);
  assert.ok(next.includes(column), `Next Overall payload must retain visible stat ${column}.`);
  assert.ok(!contracts.includes(column), `Contracts payload must omit unused stat ${column} without a filter.`);
}

for (const column of [
  "active_contract_revenue_share",
  "active_contract_revenue_share_penalty",
  "active_contract_nb_matches",
  "active_contract_club_id",
  "active_contract_club_name",
  "active_contract_club_division",
]) {
  assert.ok(contracts.includes(column), `Contracts payload must retain ${column}.`);
  assert.ok(!attributes.includes(column), `Attributes payload must omit unused contract column ${column}.`);
}

for (const column of [
  "overall_prog_current_season",
  "pace_prog_current_season",
  "shooting_prog_current_season",
  "passing_prog_current_season",
  "dribbling_prog_current_season",
  "defense_prog_current_season",
  "physical_prog_current_season",
  "goalkeeping_prog_current_season",
]) {
  assert.ok(current.includes(column), `Current payload must retain progression column ${column}.`);
  assert.ok(!allTime.includes(column), `All-time payload must omit current-only progression column ${column}.`);
}

for (const column of [
  "overall_prog_all",
  "pace_prog_all",
  "shooting_prog_all",
  "passing_prog_all",
  "dribbling_prog_all",
  "defense_prog_all",
  "physical_prog_all",
  "goalkeeping_prog_all",
]) {
  assert.ok(allTime.includes(column), `All-time payload must retain progression column ${column}.`);
  assert.ok(!current.includes(column), `Current payload must omit all-time-only progression column ${column}.`);
}

for (const column of [
  "next_overall",
  "next_overall_gap",
  "pace_to_next_overall",
  "shooting_to_next_overall",
  "passing_to_next_overall",
  "dribbling_to_next_overall",
  "defense_to_next_overall",
  "physical_to_next_overall",
  "goalkeeping_to_next_overall",
]) {
  assert.ok(next.includes(column), `Next Overall payload must retain ${column}.`);
  assert.ok(!attributes.includes(column), `Attributes payload must omit unused Next Overall column ${column}.`);
}

const hiddenStatFilter = projectedDatabaseColumns("database", "contracts", false, [
  { column: "pace", operator: ">=", value: "80" },
]);
assert.ok(hiddenStatFilter.includes("pace"), "A hidden advanced-filter column must remain in the response for the local post-load filter pass.");

const contractStatusFilter = projectedDatabaseColumns("database", "attributes", false, [
  { column: "contract_status", operator: "=", value: "under_contract" },
]);
assert.ok(contractStatusFilter.includes("active_contract_club_id"));
assert.ok(contractStatusFilter.includes("active_contract_club_name"));

assert.deepEqual(
  projectedDatabaseColumns("player", "attributes", false, []),
  PUBLIC_COLUMNS,
  "Player entity payloads must keep the complete public row contract.",
);
assert.deepEqual(
  projectedDatabaseColumns("evaluation", "attributes", true, []),
  PLAYER_COLUMNS,
  "Evaluation entity payloads must keep the complete progression row contract.",
);

assert.ok(attributes.length <= 20, `Attributes payload should remain compact; received ${attributes.length} database columns.`);
assert.ok(contracts.length <= 18, `Contracts payload should remain compact; received ${contracts.length} database columns.`);
assert.ok(current.length < PLAYER_COLUMNS.length, "Current progression payload must be smaller than the complete player row.");
assert.ok(allTime.length < PLAYER_COLUMNS.length, "All-time progression payload must be smaller than the complete player row.");

console.log("View-specific table payload projection validation passed.");
