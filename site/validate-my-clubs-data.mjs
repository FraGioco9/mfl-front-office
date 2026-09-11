import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const { PLAYER_COLUMNS } = require("./api/_database");

const directory = mkdtempSync(join(tmpdir(), "mfl-my-clubs-"));
const databasePath = join(directory, "mfl_database.db");
const db = new DatabaseSync(databasePath);
try {
  const playerColumns = PLAYER_COLUMNS.map((column) => `"${column}" TEXT`).join(", ");
  db.exec(`
    CREATE TABLE players (${playerColumns});
    CREATE TABLE wallets (wallet_address TEXT);
    CREATE TABLE runtime_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE runtime_clubs (
      club_id INTEGER PRIMARY KEY,
      name TEXT,
      city TEXT,
      country TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      current_competition_ids TEXT,
      division INTEGER,
      logo_version TEXT,
      owner_wallet_address TEXT
    );
    CREATE TABLE clubs (
      club_id TEXT PRIMARY KEY,
      name TEXT,
      city TEXT,
      country TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      status TEXT,
      division INTEGER,
      owner_wallet_address TEXT,
      owner_name TEXT,
      current_competition_ids TEXT
    );
    CREATE INDEX runtime_clubs_owner_index ON runtime_clubs(owner_wallet_address, division, club_id);
    CREATE TABLE competitions (
      competition_id INTEGER PRIMARY KEY,
      root_competition_id INTEGER,
      season_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT '',
      subtype TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE competition_standings (
      competition_id INTEGER NOT NULL,
      stage_order INTEGER NOT NULL,
      group_order INTEGER NOT NULL,
      club_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      goals INTEGER NOT NULL DEFAULT 0,
      goals_against INTEGER NOT NULL DEFAULT 0,
      points REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE competition_stages (
      competition_id INTEGER NOT NULL,
      stage_order INTEGER NOT NULL,
      stage_type TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE competition_rounds (
      competition_id INTEGER NOT NULL,
      stage_order INTEGER NOT NULL,
      group_order INTEGER NOT NULL,
      round_order INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE competition_matches (
      match_id INTEGER PRIMARY KEY,
      competition_id INTEGER NOT NULL,
      stage_order INTEGER NOT NULL,
      group_order INTEGER NOT NULL,
      round_order INTEGER NOT NULL,
      start_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      home_club_id INTEGER,
      away_club_id INTEGER,
      home_score INTEGER,
      away_score INTEGER,
      home_penalty_score INTEGER,
      away_penalty_score INTEGER
    );
  `);
  db.prepare("INSERT INTO runtime_metadata (key, value) VALUES (?, ?)").run("generated_at", "2026-09-11T00:00:00.000Z");
  const insertClub = db.prepare(`
    INSERT INTO runtime_clubs (
      club_id, name, city, country, primary_color, secondary_color,
      current_competition_ids, division, logo_version, owner_wallet_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertClub.run(101, "Owner One A", "Rome", "ITALY", "#111111", "#222222", "[1,8]", 4, "1", "0xaaaaaaaaaaaaaaaa");
  insertClub.run(102, "Owner One B", "Milan", "ITALY", "#333333", "#444444", "[]", 6, "1", "0xaaaaaaaaaaaaaaaa");
  db.prepare(`
    INSERT INTO clubs (
      club_id, name, city, country, primary_color, secondary_color, status,
      division, owner_wallet_address, owner_name, current_competition_ids
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("101", "Owner One A", "Rome", "ITALY", "#111111", "#222222", "FOUNDED", 4, "0xaaaaaaaaaaaaaaaa", "Owner One", "[1,8]");
  insertClub.run(202, "Owner Two", "Paris", "FRANCE", "#555555", "#666666", "[]", 3, "1", "0xbbbbbbbbbbbbbbbb");

  const insertCompetition = db.prepare(
    "INSERT INTO competitions (competition_id, root_competition_id, season_id, type, subtype, name, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  insertCompetition.run(1001, 488, 25, "LEAGUE", "", "Diamond League", "ACTIVE");
  insertCompetition.run(1002, 488, 25, "LEAGUE", "", "Unrelated Diamond League", "ACTIVE");
  insertCompetition.run(2001, 777, 25, "CUP", "", "Titans Cup", "ACTIVE");

  const insertMatch = db.prepare(
    "INSERT INTO competition_matches (match_id, competition_id, stage_order, group_order, round_order, start_date, status, home_club_id, away_club_id, home_score, away_score, home_penalty_score, away_penalty_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertMatch.run(1, 1001, 0, 0, 0, "2026-09-01", "ENDED", 101, 301, 2, 0, null, null);
  insertMatch.run(2, 1001, 0, 0, 1, "2026-09-02", "ENDED", 302, 101, 1, 1, null, null);
  insertMatch.run(3, 1001, 0, 0, 1, "2026-09-02", "ENDED", 301, 302, 3, 0, null, null);
  insertMatch.run(4, 1002, 0, 0, 0, "2026-09-01", "ENDED", 401, 402, 1, 0, null, null);
  insertMatch.run(5, 2001, 0, -1, 0, "2026-09-10", "PLANNED", 101, 501, null, null, null, null);
  db.prepare("INSERT INTO competition_stages (competition_id, stage_order, stage_type, name) VALUES (?, ?, ?, ?)").run(2001, 0, "TREE", "Knockout");
  db.prepare("INSERT INTO competition_rounds (competition_id, stage_order, group_order, round_order, name) VALUES (?, ?, ?, ?, ?)").run(2001, 0, -1, 0, "Quarter-final");
} finally {
  db.close();
}

process.env.MFL_DATABASE_PATH = databasePath;
try {
  const database = require("./api/_database");
  const queryRows = database.queryRows;
  let ownershipPlan = [];
  database.queryRows = (sql, params) => {
    if (sql.includes("FROM runtime_clubs") && sql.includes("WHERE owner_wallet_address = ?")) {
      ownershipPlan = queryRows("EXPLAIN QUERY PLAN " + sql, params);
    }
    return queryRows(sql, params);
  };
  delete require.cache[require.resolve("./api/_clubs")];
  const { clubProfileData, myClubsData, myClubsCompetitionsData } = require("./api/_clubs");

  const ownerOne = myClubsData("0xAAAAAAAAAAAAAAAA");
  assert.deepEqual(ownerOne.clubs.map((club) => Number(club.clubId)), [101, 102]);
  assert.ok(ownershipPlan.some((row) => String(row.detail).includes("SEARCH runtime_clubs USING INDEX runtime_clubs_owner_index")),
    "Ownership lookup must use the existing normalized-wallet index rather than scan all clubs.");
  assert.ok(ownerOne.clubs.every((club) => !Object.prototype.hasOwnProperty.call(club, "competitions")),
    "Base My Clubs response must not block on competition enrichment.");

  const profile = clubProfileData("101");
  assert.equal(profile?.name, "Owner One A");
  assert.equal(profile?.city, "Rome");
  assert.equal(profile?.nation, "ITALY");
  assert.equal(profile?.primaryColor, "#111111");
  assert.equal(profile?.secondaryColor, "#222222");
  assert.equal(profile?.status, "FOUNDED",
    "Club profile must supplement metadata missing from an older runtime_clubs projection using canonical clubs data.");
  assert.equal(profile?.ownerWalletAddress, "0xaaaaaaaaaaaaaaaa");
  assert.equal(profile?.ownerName, "Owner One");
  assert.match(profile?.logoUrl || "", /\/u\/clubs\/101\/logo\.webp\?v=1$/u,
    "Club profile must use the same canonical MFL logo source as My Clubs.");

  const ownerTwo = myClubsData("0xbbbbbbbbbbbbbbbb");
  assert.deepEqual(ownerTwo.clubs.map((club) => Number(club.clubId)), [202]);

  const enrichment = myClubsCompetitionsData("101,202");
  assert.deepEqual(Object.keys(enrichment.competitionsByClub), ["101", "202"],
    "Public competition enrichment must resolve exactly the requested club IDs without a second wallet-proof dependency.");
  const competitions = enrichment.competitionsByClub["101"];
  assert.deepEqual(competitions.map((competition) => competition.name), ["Diamond League", "Titans Cup"],
    "Current PlayMFL competitions must come from actual club participation, not unrelated Flow membership IDs.");
  assert.equal(competitions[0].seasonNumber, 15);
  assert.equal(competitions[0].standing?.position, 1,
    "League standing must fall back to completed match results when the standings table exists but has no rows.");
  assert.equal(competitions[1].stage, "Quarter-final",
    "Cup stage must resolve from the club's current scheduled round.");

  const dataHandler = require("./api/data");
  const headers = {};
  let statusCode = 0;
  let responseBody = "";
  const response = {
    setHeader(name, value) { headers[String(name).toLowerCase()] = String(value); },
    status(value) { statusCode = Number(value); return this; },
    end(value = "") { responseBody = String(value); return this; },
  };
  await dataHandler({
    method: "GET",
    query: { mode: "my-clubs-competitions", clubIds: "101,202" },
    headers: {},
    url: "/api/data?mode=my-clubs-competitions&clubIds=101%2C202",
  }, response);
  assert.equal(statusCode, 200, "Public competition API handler must succeed without wallet-proof headers.");
  const apiPayload = JSON.parse(responseBody);
  assert.deepEqual(Object.keys(apiPayload.competitionsByClub), ["101", "202"]);
  assert.equal(apiPayload.competitionsByClub["101"][0].name, "Diamond League");
  assert.ok(String(headers["server-timing"] || "").includes("query;dur="),
    "Real data handler integration must expose competition-query timing.");
} finally {
  delete process.env.MFL_DATABASE_PATH;
  rmSync(directory, { recursive: true, force: true });
}

console.log("My Clubs SQLite ownership and split base/enrichment validation passed.");
