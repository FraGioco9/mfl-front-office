/* PERF-05D: read-only A/B of actual pagedData SQL on a pinned snapshot.
 * This is an experiment, not an application rewrite. Never print parameters,
 * player names, wallet addresses, prices or individual player records.
 */
"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { performance } = require("node:perf_hooks");

assert.ok(process.env.MFL_DATABASE_PATH, "Use an explicit local SQLite snapshot");
const dbApi = require("../../api/_database.js");
const db = dbApi.getDatabase();
db.exec("PRAGMA query_only = ON");
const repeat = Math.max(1, Math.min(5, Number(process.env.PERF05D_REPETITIONS) || 3));
const phases = ["A", "B", "B", "A"];
const playerCount = Number(db.prepare("SELECT count(*) AS n FROM players").get().n);
const metadata = Object.fromEntries(db.prepare(
  "SELECT key,value FROM runtime_metadata WHERE key IN ('generated_at','row_count','wallet_count')"
).all().map((row) => [row.key, row.value]));
assert.ok(playerCount > 0);

const ids = db.prepare(
  "SELECT player_id FROM players WHERE CAST(player_id AS INTEGER) % 53 = 0 LIMIT 9000"
).all().map((row) => Number(row.player_id));
if (!ids.length) ids.push(...db.prepare("SELECT player_id FROM players LIMIT 2")
  .all().map((row) => Number(row.player_id)));
const prices = Object.fromEntries(ids.map((id, index) => [String(id), 20 + index % 900]));
const priceIdArray = JSON.stringify(Object.keys(prices).map(Number));
const marketplace = require("../../api/_marketplace-state.js");
marketplace.marketplaceState = async () => ({
  prices, generatedAt: String(metadata.generated_at || ""), flowBlockHeight: 0,
});

let captured = null;
const queryRows = dbApi.queryRows;
const queryOne = dbApi.queryOne;
function record(sql, parameters) {
  if (captured !== null && /^\s*SELECT\s/i.test(sql) && /\bFROM players\b/i.test(sql)) {
    captured.push({ sql, parameters: [...parameters],
      kind: /^\s*SELECT\s+count\(/i.test(sql) ? "count" : "page" });
  }
}
dbApi.queryRows = function (sql, parameters = []) {
  record(sql, parameters);
  return queryRows(sql, parameters);
};
dbApi.queryOne = function (sql, parameters = []) {
  record(sql, parameters);
  return queryOne(sql, parameters);
};
const { pagedData } = require("../../api/_data-page.js");

const rule = (column, operator, value) => ({ column, operator, value });
const jsonRules = (items) => JSON.stringify(items);
const scenarios = [
  { name: "name_contains_one", query: { filters: jsonRules([rule("name", "contains", "a")]) } },
  { name: "name_contains_word", query: { filters: jsonRules([rule("name", "contains", "mar")]) } },
  { name: "name_contains_diacritic", query: { filters: jsonRules([rule("name", "contains", "é")]) } },
  { name: "name_contains_unicode", query: { filters: jsonRules([rule("name", "contains", "İ")]) } },
  { name: "name_like_wildcards", query: { filters: jsonRules([rule("name", "contains", "%_")]) } },
  { name: "name_not_contains", query: { filters: jsonRules([rule("name", "not_contains", "er")]) } },
  { name: "name_equals", query: { filters: jsonRules([rule("name", "=", "marco")]) } },
  { name: "name_not_equals", query: { filters: jsonRules([rule("name", "!=", "marco")]) } },
  { name: "name_and_overall", query: { filters: jsonRules([
    rule("name", "contains", "a"), rule("overall", ">=", 75),
  ]) } },
  { name: "name_or_overall", query: { filters: jsonRules([
    rule("name", "contains", "mar"), { ...rule("overall", ">=", 90), connector: "or" },
  ]) } },
  { name: "listing_for_sale", query: { filters: jsonRules([rule("listing_price", "=", "for_sale")]) } },
  { name: "listing_price_asc_for_sale", query: {
    sortKey: "listing_price", sortDirection: "asc",
    filters: jsonRules([rule("listing_price", "=", "for_sale")]),
  } },
  { name: "listing_price_desc_for_sale", query: {
    sortKey: "listing_price", sortDirection: "desc",
    filters: jsonRules([rule("listing_price", "=", "for_sale")]),
  } },
  { name: "listing_price_asc_all", query: {
    sortKey: "listing_price", sortDirection: "asc",
  } },
  { name: "listing_price_desc_all", query: {
    sortKey: "listing_price", sortDirection: "desc",
  } },
];

const digest = (rows) => createHash("sha256").update(JSON.stringify(rows,
  (_key, value) => typeof value === "bigint" ? String(value) : value)).digest("hex");
const median = (samples) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
const millis = (n) => Number(n.toFixed(3));
function textCandidate(entry) {
  // Keep the original nonblank guard and SQL LIKE semantics (including % and _).
  // This tests a scan of the compact pre-normalized lookup table against the
  // canonical per-row normalize_search() UDF without touching the live query.
  const operators = [
    ["LIKE '%' || ? || '%'", "LIKE '%' || ? || '%'", "IN"],
    ["NOT LIKE '%' || ? || '%'", "LIKE '%' || ? || '%'", "NOT IN"],
    ["= ?", "= ?", "IN"],
    ["<> ?", "= ?", "NOT IN"],
  ];
  let sql = entry.sql;
  let replaced = false;
  for (const [expression, matchingExpression, inOp] of operators) {
    const oldExpression = "normalize_search(\"name\") " + expression;
    const newExpression = "player_id " + inOp +
      " (SELECT player_id FROM runtime_player_search WHERE normalized_name " + matchingExpression + ")";
    if (sql.includes(oldExpression)) {
      sql = sql.replaceAll(oldExpression, newExpression);
      replaced = true;
    }
  }
  return replaced ? { sql, parameters: entry.parameters, strategy: "normalized_name_subquery" } : null;
}
function listingCandidate(entry) {
  // Only a positive for-sale predicate has an exact, cheap candidate here.
  // Market prices are dynamic: an immutable price index would be incorrect.
  const predicate = "marketplace_price(player_id) IS NOT NULL";
  if (!entry.sql.includes(predicate)) return null;
  const sql = entry.sql.replaceAll(predicate,
    "player_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))");
  const isPage = entry.sql.includes(" LIMIT ? OFFSET ?");
  const parameters = [...entry.parameters];
  const position = isPage ? parameters.length - 2 : parameters.length;
  // These cases intentionally have just the hidden-MFL parameter ahead of the
  // listing rule; never inject a placeholder into an arbitrary filter shape.
  assert.equal(position, 1, "Unexpected listing filter parameter order");
  parameters.splice(position, 0, priceIdArray);
  return { sql, parameters, strategy: "json_each_dynamic_listing_ids" };
}
function profileStatement(original, candidate, scenario) {
  const a = db.prepare(original.sql);
  const b = candidate && db.prepare(candidate.sql);
  const execute = {
    A: () => original.kind === "count" ? [a.get(...original.parameters)] : a.all(...original.parameters),
    B: () => original.kind === "count" ? [b.get(...candidate.parameters)] : b.all(...candidate.parameters),
  };
  const control = execute.A();
  const baselineDigest = digest(control);
  if (b) assert.equal(digest(execute.B()), baselineDigest,
    "Candidate changed SQL results in " + scenario + " (" + original.kind + ")");
  const plans = {
    A: db.prepare("EXPLAIN QUERY PLAN " + original.sql)
      .all(...original.parameters).map((row) => row.detail),
    B: b ? db.prepare("EXPLAIN QUERY PLAN " + candidate.sql)
      .all(...candidate.parameters).map((row) => row.detail) : [],
  };
  const samples = { A: [], B: [] };
  for (const phase of (b ? phases : ["A", "A"])) {
    execute[phase]();
    const observations = [];
    for (let n = 0; n < repeat; n++) {
      const start = performance.now();
      const rows = execute[phase]();
      observations.push(performance.now() - start);
      assert.equal(digest(rows), baselineDigest, "Nonrepeatable SQL result: " + scenario);
    }
    samples[phase].push(millis(median(observations)));
  }
  const aMedian = millis(median(samples.A));
  const bMedian = b ? millis(median(samples.B)) : null;
  return {
    kind: original.kind,
    strategy: candidate?.strategy || "baseline_only",
    rowDigest: baselineDigest,
    identicalResults: Boolean(b),
    sampleRowCount: control.length,
    latencyMs: { A: aMedian, B: bMedian, pairedDeltaMs: b ? millis(bMedian - aMedian) : null },
    samplesMs: samples,
    plans,
  };
}
async function main() {
  assert.ok(db.prepare(
    "SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='runtime_player_search'"
  ).get(), "Pre-normalized lookup table must exist in the prepared runtime snapshot");
  const mismatch = Number(db.prepare(
    "SELECT count(*) AS n FROM players p LEFT JOIN runtime_player_search s " +
    "ON p.player_id=s.player_id WHERE s.player_id IS NULL OR s.normalized_name <> normalize_search(p.name)"
  ).get().n);
  // sqlite UDF and the Python offline builder are different runtimes. A mismatch
  // vetoes any claim that the compact name index is fully interchangeable.
  const results = [];
  for (const scenario of scenarios) {
    captured = [];
    const query = { scope: "database", view: "attributes", sortKey: "overall",
      page: 1, pageSize: 100, ...scenario.query };
    const response = await pagedData({ query }, "", true, false);
    const statements = captured;
    captured = null;
    const entryResults = [];
    for (const entry of statements) {
      const candidate = scenario.name.startsWith("name_")
        ? (mismatch === 0 ? textCandidate(entry) : null)
        : listingCandidate(entry);
      entryResults.push(profileStatement(entry, candidate, scenario.name));
    }
    results.push({
      scenario: scenario.name,
      responseDigest: digest(response.rows), totalRows: response.totalRows,
      page: response.page, totalPages: response.totalPages,
      statements: entryResults,
    });
  }
  const paired = results.flatMap((result) => result.statements.filter((s) => s.identicalResults));
  const output = {
    label: "PERF-05D exact-API offline SQL evidence (no runtime change)",
    sourceSha: process.env.GITHUB_SHA || "",
    snapshot: { playerCount, walletCount: Number(metadata.wallet_count || 0),
      generatedAt: metadata.generated_at },
    node: process.version, sqlite: db.prepare("SELECT sqlite_version() AS v").get().v,
    repetitions: repeat, sequence: phases, normalizedLookupMismatchRows: mismatch,
    syntheticListingCount: ids.length, scenarios: results,
    pairedStatements: paired.length,
    caveats: [
      "Prices are a deterministic synthetic fixture, NOT marketplace production prices.",
      "SQL-only timings are not network/UI/user latency.",
      "String matching retains SQLite LIKE wildcard behavior; mismatched normalization vetoes lookup substitution.",
      "No dynamic-price index or unproven all-player price-sort rewrite is applied.",
    ],
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
