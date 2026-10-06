import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const backendDatabase = require("../api/_database.js");
const backendNormalize = backendDatabase.normalizeSearchText;

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

function functionBlock(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  assert.ok(start >= 0 && end > start, "Could not isolate " + startToken);
  return source.slice(start, end);
}

const sources = await Promise.all([
  read("../modules/core-sources/shared-personal-state.js"),
  read("../modules/core-sources/shared-global-search.js"),
  read("../modules/core-sources/shared-routing.js"),
  read("../api/_data-views.js"),
]);
const personalSource = sources[0];
const globalSource = sources[1];
const routingSource = sources[2];
const dataViewsSource = sources[3];

const frontendSandbox = {};
vm.createContext(frontendSandbox);
vm.runInContext(functionBlock(personalSource, "function normalizeSearchText(", "function loadRecentIdsFromStorage("), frontendSandbox);
const frontendNormalize = frontendSandbox.normalizeSearchText;

const scoreSandbox = {};
vm.createContext(scoreSandbox);
vm.runInContext(functionBlock(globalSource, "function searchMatchScore(", "function bestSearchResults("), scoreSandbox);
const searchMatchScore = scoreSandbox.searchMatchScore;

function createSearchFixture() {
  const db = new DatabaseSync(":memory:");
  db.function("normalize_search", { deterministic: true }, backendNormalize);
  db.exec("CREATE TABLE players (player_id TEXT PRIMARY KEY, name TEXT, overall REAL, age REAL, nationality TEXT, positions TEXT, retirement_years INTEGER, player_seasons INTEGER, active_contract_revenue_share REAL);" +
    "CREATE TABLE runtime_player_search (player_id TEXT PRIMARY KEY, normalized_name TEXT NOT NULL);" +
    "CREATE TABLE runtime_clubs (club_id TEXT PRIMARY KEY, name TEXT NOT NULL, division INTEGER, normalized_name TEXT NOT NULL);" +
    "CREATE TABLE runtime_agents (wallet_address TEXT PRIMARY KEY, wallet_name TEXT, player_count INTEGER, normalized_name TEXT NOT NULL);");

  const players = [
    ["101", "Nicolò D\'Angelo", 88, 24, "IT", "CM", 5, 4, 0.1],
    ["102", "Nicolo D Angelo", 84, 25, "IT", "CAM", 5, 3, 0.1],
    ["201", "Alex Smith", 82, 22, "US", "ST", 5, 2, 0.1],
    ["202", "Alex Smith", 91, 27, "GB", "CB", 5, 5, 0.1],
    ["301", "José Ángel", 86, 23, "ES", "LW", 5, 3, 0.1],
    ["302", "Rocket 🚀 Man", 80, 21, "FR", "RW", 5, 2, 0.1],
  ];
  const insertPlayer = db.prepare("INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertSearch = db.prepare("INSERT INTO runtime_player_search VALUES (?, ?)");
  for (const row of players) {
    insertPlayer.run(...row);
    insertSearch.run(row[0], backendNormalize(row[1]));
  }

  const insertClub = db.prepare("INSERT INTO runtime_clubs VALUES (?, ?, ?, ?)");
  for (const row of [["spaulo", "São Paulo Élite", 2], ["laquila", "L\'Aquila United", 3], ["rocket", "FC 🚀 Roma", 1]]) {
    insertClub.run(row[0], row[1], row[2], backendNormalize(row[1]));
  }
  const insertAgent = db.prepare("INSERT INTO runtime_agents VALUES (?, ?, ?, ?)");
  insertAgent.run("0xabc", "José Agent", 3, backendNormalize("José Agent"));

  const mocks = {
    "./_database": {
      PUBLIC_COLUMNS: [],
      SEARCH_PLAYER_COLUMNS: ["player_id", "name", "overall", "age", "nationality", "positions", "retirement_years", "player_seasons", "active_contract_revenue_share"],
      getGeneratedAt: () => "2026-10-05T00:00:00Z",
      normalizeSearchText: backendNormalize,
      queryRows: (sql, parameters = []) => db.prepare(sql).all(...parameters),
      queryOne: (sql, parameters = []) => db.prepare(sql).get(...parameters) || null,
      selectList: (columns) => columns.map((column) => "\"" + column + "\"").join(", "),
      rowsAsArrays: (rows, columns) => rows.map((row) => columns.map((column) => row[column] ?? null)),
      tableExists: (table) => Boolean(db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type=\'table\' AND name=? LIMIT 1").get(table)),
    },
    "./_data-auth": { normalizeWalletAddress: (value) => String(value || "").trim().toLowerCase() },
    "./_data-query": {
      MFL_WALLET_ADDRESS: "0x0",
      placeholders: (values) => values.map(() => "?").join(","),
      qualifiedSelectList: (alias, columns) => columns.map((column) => alias + ".\"" + column + "\"").join(", "),
      appendCondition() {},
      mflCondition: () => "1=1",
      hiddenMflJoinedDateCondition: () => "1=1",
      runtimeMetadataCount: () => null,
      manifestPayload: () => ({ row_count: 0, wallet_count: 0, generated_at: "2026-10-05T00:00:00Z" }),
    },
    "./_data-page": { integerIds: () => [] },
  };

  const sandbox = {
    module: { exports: {} },
    exports: {},
    require: (id) => { if (!(id in mocks)) throw new Error("Unexpected require: " + id); return mocks[id]; },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(dataViewsSource, sandbox, { filename: "api/_data-views.js" });
  return { db, searchData: sandbox.module.exports.searchData };
}

const normalizeCases = [
  ["Nicolò", "nicolo"],
  ["NICOLO\u0300", "nicolo"],
  ["  São   Paulo  ", "sao paulo"],
  ["José Ángel", "jose angel"],
  ["L\'Aquila", "l\'aquila"],
  ["Rocket 🚀 Man", "rocket 🚀 man"],
];

test("frontend and backend search normalization agree for EDGE-02 fixtures", () => {
  for (const pair of normalizeCases) {
    const value = pair[0];
    const expected = pair[1];
    assert.equal(frontendNormalize(value), expected, "frontend: " + value);
    assert.equal(backendNormalize(value).replace(/\s+/g, " ").trim(), expected, "backend: " + value);
  }
});

test("Global Search scoring remains accent-insensitive and keeps homonyms", () => {
  const query = frontendNormalize("Nicolò");
  assert.ok(searchMatchScore(query, frontendNormalize("Nicolò D\'Angelo")) > 0);
  assert.ok(searchMatchScore(query, frontendNormalize("Nicolo D Angelo")) > 0);
  const homonym = frontendNormalize("Alex Smith");
  assert.equal(searchMatchScore(homonym, frontendNormalize("Alex Smith")), 100);
  assert.equal(searchMatchScore(frontendNormalize("🚀"), frontendNormalize("Rocket 🚀 Man")), 50);
});

test("Table name filtering shares canonical Unicode normalization", () => {
  const tableMatches = (raw, query) => frontendNormalize(raw).includes(frontendNormalize(query));
  assert.equal(tableMatches("Nicolò D\'Angelo", "NICOLO"), true);
  assert.equal(tableMatches("José Ángel", "  jose   angel "), true);
  assert.equal(tableMatches("Rocket 🚀 Man", "🚀"), true);
  assert.equal(tableMatches("L\'Aquila", "l\'aquila"), true);
});

test("SQLite search covers diacritics, apostrophes, multiword queries, emoji and homonyms", () => {
  const fixture = createSearchFixture();
  try {
    const nico = fixture.searchData({ query: { q: "  NICOLÒ   ", type: "all", limit: "20" } });
    assert.deepEqual(Array.from(nico.players.rows, (row) => String(row[0])), ["101", "102"]);
    const apostrophe = fixture.searchData({ query: { q: "d\'angelo", type: "players", limit: "20" } });
    assert.deepEqual(Array.from(apostrophe.rows, (row) => String(row[0])), ["101"]);
    const multiword = fixture.searchData({ query: { q: "jose   angel", type: "players", limit: "20" } });
    assert.deepEqual(Array.from(multiword.rows, (row) => String(row[0])), ["301"]);
    const emoji = fixture.searchData({ query: { q: "🚀", type: "all", limit: "20" } });
    assert.deepEqual(Array.from(emoji.players.rows, (row) => String(row[0])), ["302"]);
    assert.deepEqual(Array.from(emoji.clubs, (club) => String(club.clubId)), ["rocket"]);
    const clubs = fixture.searchData({ query: { q: "sao elite", type: "clubs", limit: "20" } });
    assert.deepEqual(Array.from(clubs.results, (club) => String(club.clubId)), ["spaulo"]);
    const clubApostrophe = fixture.searchData({ query: { q: "l\'aquila", type: "clubs", limit: "20" } });
    assert.deepEqual(Array.from(clubApostrophe.results, (club) => String(club.clubId)), ["laquila"]);
    const homonyms = fixture.searchData({ query: { q: "alex smith", type: "players", limit: "20" } });
    assert.deepEqual(Array.from(homonyms.rows, (row) => String(row[0])), ["202", "201"]);
  } finally { fixture.db.close(); }
});

test("malformed percent-encoding cannot turn search input into a server exception", () => {
  const fixture = createSearchFixture();
  try {
    const parsed = new URLSearchParams("q=%E0%A4%A").get("q");
    assert.doesNotThrow(() => backendNormalize(parsed));
    const result = fixture.searchData({ query: { q: parsed, type: "all", limit: "20" } });
    assert.ok(Array.isArray(result.players.rows));
    assert.ok(Array.isArray(result.agents.rows));
    assert.ok(Array.isArray(result.clubs));
    const literal = fixture.searchData({ query: { q: "%E0%A4%A", type: "clubs", limit: "20" } });
    assert.deepEqual(Array.from(literal.results), []);
  } finally { fixture.db.close(); }
});

test("malformed encoded Player paths fail safe instead of throwing during route parsing", () => {
  const routeSandbox = { window: { location: { pathname: "/players/%E0%A4%A" } }, decodeURIComponent, String };
  vm.createContext(routeSandbox);
  vm.runInContext(functionBlock(routingSource, "function playerIdFromUrl(", "function evaluationPlayerIdFromUrl("), routeSandbox);
  assert.doesNotThrow(() => routeSandbox.playerIdFromUrl());
  assert.equal(routeSandbox.playerIdFromUrl(), "%E0%A4%A");
  assert.equal(routeSandbox.decodeRoutePartSafely("Nicol%C3%B2"), "Nicolò");
});

console.log("EDGE-02 Unicode/diacritic/homonym/search-encoding fixtures verified.");
