/* PERF-05A — capture the real parameterized api/_data-page queries against a
 * local read-only runtime database. No raw player/wallet IDs or names are logged.
 * This is diagnostic instrumentation only, not a production server change.
 */
"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { DatabaseSync } = require("node:sqlite");

const path = process.env.MFL_DATABASE_PATH;
assert.ok(path, "MFL_DATABASE_PATH must identify a local pinned SQLite snapshot");
const repeat = Math.min(5, Math.max(1, Number(process.env.PERF05_REPETITIONS) || 3));
const dbApi = require("../../api/_database");
const database = dbApi.getDatabase();
const nativeSQLite = database.prepare("SELECT sqlite_version() AS version").get().version;
const provenance = Object.fromEntries(database.prepare(
  "SELECT key, value FROM runtime_metadata WHERE key IN ('generated_at', 'row_count', 'wallet_count')"
).all().map(x => [x.key, x.value]));
const rowCount = Number(database.prepare("SELECT count(*) AS n FROM players").get().n);
assert.ok(Number.isSafeInteger(rowCount) && rowCount > 0, "Empty runtime players table");
const walletAddress = database.prepare(
  "SELECT wallet_address FROM players WHERE wallet_address NOT IN (?, ?) " +
  "AND wallet_address IS NOT NULL GROUP BY wallet_address ORDER BY count(*) DESC LIMIT 1"
).get("0xff8d2bbed8164db0", "0x6fec8986261ecf49")?.wallet_address || "";
const clubId = database.prepare(
  "SELECT active_contract_club_id AS id FROM players " +
  "WHERE active_contract_club_id IS NOT NULL AND active_contract_club_id <> '' " +
  "GROUP BY active_contract_club_id ORDER BY count(*) DESC LIMIT 1"
).get()?.id || "";
const nationality = database.prepare(
  "SELECT nationality AS name FROM players WHERE nationality IS NOT NULL AND nationality <> '' " +
  "GROUP BY nationality ORDER BY count(*) DESC LIMIT 1"
).get()?.name || "";
const watchlist = database.prepare("SELECT player_id FROM players ORDER BY player_id LIMIT 5").all()
  .map(x => x.player_id);
const sampleListingIds = database.prepare(
  "SELECT player_id FROM players WHERE player_id % 53 = 0 LIMIT 9000"
).all();
const prices = Object.fromEntries(sampleListingIds.map((x, n) => [String(x.player_id), 20 + n % 900]));
const marketplace = require("../../api/_marketplace-state");
marketplace.marketplaceState = async () => ({
  prices, generatedAt: String(provenance.generated_at || ""), flowBlockHeight: 0,
});
let active = null;
const originalRows = dbApi.queryRows;
const originalOne = dbApi.queryOne;
function capture(sql, parameters) {
  if (active && /^SELECT\s/i.test(sql) && /\bFROM\s+players\b/i.test(sql)) {
    active.statements.push({ sql, parameters: [...parameters], kind: /^\s*SELECT\s+count\(/i.test(sql) ? "count" : "page" });
  }
}
dbApi.queryRows = function (sql, parameters = []) {
  capture(sql, parameters);
  return originalRows(sql, parameters);
};
dbApi.queryOne = function (sql, parameters = []) {
  capture(sql, parameters);
  return originalOne(sql, parameters);
};
const { pagedData } = require("../../api/_data-page");

const rules = x => JSON.stringify(x);
const cases = [
  { name: "database_first", query: { scope: "database", view: "attributes", sortKey: "overall", page: 1, pageSize: 100 } },
  { name: "database_last", query: { scope: "database", view: "attributes", sortKey: "overall", page: 99999, pageSize: 100 } },
  { name: "numeric_range_sort", query: { scope: "database", sortKey: "age", sortDirection: "asc", hideRetired: "1",
    filters: rules([{column:"overall",operator:"between",value:70,valueTo:85},{column:"age",operator:">=",value:25}]) } },
  { name: "name_contains", query: { scope: "database", sortKey: "overall", filters: rules([{column:"name",operator:"contains",value:"a"}]) } },
  { name: "position_nationality", query: { scope: "database", sortKey: "overall", hideRetiring:"1",
    filters: rules([{column:"positions",operator:"can_play",value:"CM"},{column:"nationality",operator:"=",value:nationality}]) } },
  { name: "nationality_overall", query: { scope: "database", sortKey: "overall", sortDirection: "desc",
    filters: rules([{column:"nationality",operator:"=",value:nationality},{column:"overall",operator:"between",value:70,valueTo:85}]) } },
  { name: "listing_for_sale", query: { scope: "database", sortKey: "overall",
    filters: rules([{column:"listing_price",operator:"=",value:"for_sale"}]) } },
  { name: "listing_price_sort", query: { scope: "database", sortKey: "listing_price", sortDirection:"asc",
    filters: rules([{column:"listing_price",operator:"=",value:"for_sale"}]) } },
  { name: "progression_current", query: { scope: "progression", view: "current", sortKey:"overall", includeProgression:"1" } },
  { name: "watchlist_sort", query: { scope: "watchlist", playerIds: watchlist.join(","), sortKey: "age", pageSize:100 } },
];
if (walletAddress) {
  cases.push({ name: "agent_scoped", query: { scope:"agent", walletAddress, sortKey:"overall", pageSize:100 } });
  cases.push({ name: "owned_progression", query: { scope:"myplayers", view:"current", sortKey:"overall", includeProgression:"1", pageSize:100 },
    signedWallet:walletAddress, fullAccess:false, ownedProgression:true });
}
if (clubId) cases.push({ name: "club_positions", query: { scope:"club", clubId, sortKey:"positions", pageSize:5000 } });
const digest = rows => createHash("sha256").update(JSON.stringify(rows, (_key, value) =>
  typeof value === "bigint" ? value.toString() : value)).digest("hex");
const median = ns => {
  const sorted = [...ns].sort((a,b)=>a-b);
  return Number((sorted[Math.floor(sorted.length/2)] / 1e6).toFixed(3));
};
const results = [];
let responseCount = 0;
for (const scenario of cases) {
  active = { statements: [] };
  const response = await pagedData({ query: scenario.query }, scenario.signedWallet || "",
    scenario.fullAccess ?? true, scenario.ownedProgression ?? false);
  const recorded = active.statements;
  active = null;
  responseCount++;
  const statements = [];
  for (const entry of recorded) {
    // Data copy and SQL are only in-memory; output never includes bound values.
    const statement = database.prepare(entry.sql);
    const mode = entry.kind === "count" ? "get" : "all";
    const execute = () => mode === "get"
      ? [statement.get(...entry.parameters)] : statement.all(...entry.parameters);
    const plan = database.prepare("EXPLAIN QUERY PLAN " + entry.sql)
      .all(...entry.parameters).map(x => String(x.detail));
    execute(); // ignore one warm-up
    const times = [], hashed = [];
    for (let n=0;n<repeat;n++){
      const begin=performance.now();
      const rows = execute();
      times.push((performance.now()-begin)*1e6);
      hashed.push(digest(rows));
    }
    assert.equal(new Set(hashed).size, 1, "Nondeterministic query result: " + scenario.name);
    const result = {
      kind:entry.kind,
      sql:entry.sql,
      parameterCount:entry.parameters.length,
      paramTypes:entry.parameters.map(v=>typeof v),
      plan,
      fullPlayerScans:plan.filter(x=>/^SCAN players(?:$|\s)/.test(x) && !/USING (?:COVERING )?INDEX/.test(x)).length,
      temporarySorts:plan.filter(x=>/USE TEMP B-TREE/i.test(x)).length,
      indexNames:[...new Set(plan.flatMap(x=>[...x.matchAll(/USING (?:COVERING )?INDEX (\S+)/g)].map(z=>z[1])))],
      medianMs:median(times),
      samplesMs:times.map(x=>Number((x/1e6).toFixed(3))),
      rowDigest:hashed[0],
    };
    statements.push(result);
  }
  results.push({
    name:scenario.name, response:{totalRows:response.totalRows, sourceRows:response.sourceRows,
      page:response.page, totalPages:response.totalPages, returnedRows:response.rows?.length||0,
      columns:response.columns?.length||0, digest:digest(response.rows||[])},
    statementCount:statements.length, statements,
  });
}
const output = {
  label:"PERF-05A actual API-generated SQLite query plan capture",
  sourceSha:process.env.PERF05_SOURCE_SHA || "",
  input:"pinned local snapshot, read-only",
  generatedAt:provenance.generated_at,
  rowCount,
  walletCount:Number(provenance.wallet_count||0),
  node:process.version, sqlite:nativeSQLite, repetitions:repeat,
  syntheticMarketplaceSampleCount:sampleListingIds.length,
  sampleScopes:{hasWallet:Boolean(walletAddress),hasClub:Boolean(clubId),hasNationality:Boolean(nationality)},
  scenarios:results,
  caveat:"Same-runner query-only timings; no production RUM, marketplace fixture prices are synthetic. Parameter values deliberately excluded.",
};
process.stdout.write(JSON.stringify(output,null,2)+"\n");
