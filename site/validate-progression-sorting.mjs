import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const { orderSql } = require("./api/_data-page.js");
const core = fs.readFileSync(new URL("./modules/app-core.js", import.meta.url), "utf8");

assert.match(
  core,
  /if \(!state\.incrementalApplying\) \{\s*state\.filteredRows\.sort\(compareRows\);\s*\}/u,
  "Incremental payload application must preserve the API global sort order instead of sorting the page a second time.",
);
assert.match(
  core,
  /state\.currentPage === "progression"[\s\S]{0,220}getValue\(row, getProgressionColumn\(column\)\),[\s\S]{0,80}getValue\(row, column\),/u,
  "Progression client tuples must preserve missing values and use the matching raw Overall/stat as the tie-break.",
);

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE players (
    player_id INTEGER PRIMARY KEY,
    overall REAL,
    pace REAL,
    overall_prog_current_season REAL,
    pace_prog_current_season REAL,
    overall_prog_all REAL,
    pace_prog_all REAL
  );
`);
const insert = db.prepare(`
  INSERT INTO players (
    player_id, overall, pace,
    overall_prog_current_season, pace_prog_current_season,
    overall_prog_all, pace_prog_all
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);
[
  [1, 80, 70, 3, 5, 7, 2],
  [2, 90, 60, 3, 5, 7, 4],
  [3, 85, 95, 4, 1, 6, 4],
  [4, 95, 80, null, 6, null, null],
  [5, 70, 90, 1, null, 9, 5],
].forEach((row) => insert.run(...row));

function ids(view, key, direction) {
  const order = orderSql("progression", view, key, direction);
  return db.prepare(`SELECT player_id FROM players ORDER BY ${order}`).all().map((row) => Number(row.player_id));
}

assert.deepEqual(ids("current", "overall", "desc"), [3, 2, 1, 5, 4]);
assert.deepEqual(ids("current", "overall", "asc"), [5, 1, 2, 3, 4]);
assert.deepEqual(ids("current", "pace", "desc"), [4, 1, 2, 3, 5]);
assert.deepEqual(ids("current", "pace", "asc"), [3, 2, 1, 4, 5]);
assert.deepEqual(ids("all", "overall", "desc"), [5, 2, 1, 3, 4]);
assert.deepEqual(ids("all", "pace", "desc"), [5, 3, 2, 1, 4]);

console.log("Executable Progression sorting validation passed.");
