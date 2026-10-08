import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const table = read("./modules/core-sources/table.js");
const firstPaint = read("./html-sources/first-paint.html");
const bootstrap = read("./bootstrap.js");
const browser = read("./validation/browser-routing-regression.mjs");

const begin = table.indexOf("const TABLE_URL_QUICK_FILTER_KEYS =");
const end = table.indexOf("function replaceTableUrlForState(", begin);
assert.ok(begin > 0 && end > begin, "The canonical Table URL parser must remain source-owned.");

const initial = page => ({
  pageName: page, view: "attributes", hideRetired: true,
  hideRetiring: false, hideMflPlayers: page === "database",
  mflPackable: page === "mfl", newMints: false,
  rules: [], sortKey: "overall", sortDirection: "desc",
  pageSize: 25, selectedPlayerIds: [],
});
const numeric = new Set(["age", "overall"]);
const supportedSort = new Set(["overall", "age", "name"]);
const context = {
  URLSearchParams,
  tablePages: new Set(["database", "mfl", "progression", "watchlist"]),
  defaultTablePageState: initial,
  defaultSortStateForView: () => ({ sortKey: "overall", sortDirection: "desc" }),
  availableFilterColumns: () => ["name", "age", "overall", "positions", "nationality"],
  filterOperatorsForColumn: column => numeric.has(column)
    ? [[">="], ["<="], ["between"], ["="]]
    : column === "positions" ? [["primary_is"], ["can_play"]]
      : column === "nationality" ? [["="]] : [["contains"]],
  isNumericColumn: column => numeric.has(column),
  joinedAgencyColumn: "owned_since",
  contractStatusFilterColumn: "contract_status",
  contractStatusOptions: [{ value: "under_contract" }],
  POSITION_ORDER: ["GK", "CB", "CM"],
  sortKeySupportedByView: key => supportedSort.has(key),
  normalizedViewSortState: sort => supportedSort.has(sort?.sortKey)
    ? { sortKey: sort.sortKey, sortDirection: ["asc", "desc"].includes(sort.sortDirection) ? sort.sortDirection : "desc" }
    : { sortKey: "overall", sortDirection: "desc" },
  normalizeViewForPage: view => view,
  tableStateWithoutPageFilters: (page, saved) => ({
    ...saved, ...initial(page), pageSize: saved.pageSize,
  }),
};
const code = table.slice(begin, end)
  + "\n({ resolve: tableUrlStateFromSearch, serialize: tableUrlSearchForState })";
const api = vm.runInNewContext(code, context, { timeout: 1500 });

const messy = "?hideRetired=FALSE&hideRetired=true&age.gte=invalid"
  + "&or.name.contains=Jos%C3%A9&sort=bogus&direction=asc&unexpected=ignored";
const parsed = api.resolve("database", "attributes", messy, initial("database"));
assert.equal(parsed.explicit, true);
assert.equal(parsed.state.hideRetired, false, "First duplicate quick parameter must win.");
assert.equal(parsed.state.sortKey, "overall", "Invalid sort must fall back to default.");
assert.equal(parsed.state.sortDirection, "desc");
assert.equal(parsed.state.rules.length, 1, "Invalid numeric rule must be discarded.");
assert.equal(parsed.state.rules[0].connector, "and", "First surviving rule cannot remain OR.");
assert.equal(parsed.state.rules[0].value, "José", "UTF-8 URL values must be reversible.");
assert.equal(parsed.canonicalSearch, "?hideRetired=false&name.contains=Jos%C3%A9",
  "Canonical URL must strip duplicated, invalid and unknown parameters.");

const serialized = api.serialize("database", "attributes", {
  ...initial("database"),
  rules: [
    { column: "age", operator: ">=", value: "invalid", connector: "and" },
    { column: "name", operator: "contains", value: "José", connector: "or" },
    { column: "overall", operator: ">=", value: "78", connector: "or" },
  ],
});
assert.equal(serialized, "?name.contains=Jos%C3%A9&or.overall.gte=78",
  "Serializer must normalize first *emitted* valid rule to AND.");
const roundTrip = api.resolve("database", "attributes", serialized, initial("database"));
assert.deepEqual(Array.from(roundTrip.state.rules, rule => rule.connector), ["and", "or"]);
assert.equal(roundTrip.canonicalSearch, serialized, "Canonical URL must be idempotent.");

const duplicateInvalid = api.resolve("database", "attributes",
  "?hideRetired=unknown&hideRetired=false&sort=age&sort=overall&direction=ASC&direction=desc",
  initial("database"));
assert.equal(duplicateInvalid.state.hideRetired, true, "Invalid first quick value must yield default.");
assert.equal(duplicateInvalid.state.sortKey, "age", "First supported sort key must be authoritative.");
assert.equal(duplicateInvalid.state.sortDirection, "asc");
assert.equal(duplicateInvalid.canonicalSearch, "?sort=age&direction=asc");

const validRange = api.resolve("database", "attributes",
  "?age.between.from=21&age.between.to=29&or.name.contains=S%C3%A3o+Paulo", initial("database"));
assert.equal(validRange.state.rules.length, 2);
assert.equal(validRange.state.rules[0].operator, "between");
assert.equal(validRange.state.rules[1].value, "São Paulo");
assert.equal(validRange.canonicalSearch,
  "?age.between.from=21&age.between.to=29&or.name.contains=S%C3%A3o+Paulo");

const badRange = api.resolve("database", "attributes",
  "?age.between.from=oops&age.between.to=99&or.name.contains=Caf%C3%A9", initial("database"));
assert.equal(badRange.state.rules.length, 1);
assert.equal(badRange.state.rules[0].connector, "and");
assert.equal(badRange.canonicalSearch, "?name.contains=Caf%C3%A9");

const saved = { ...initial("database"), rules: [{ column: "age", operator: ">=", value: "76" }] };
assert.equal(api.resolve("database", "attributes", "", saved).state.rules.length, 1,
  "No query must preserve locally saved table filters.");
assert.equal(api.serialize("database", "stats", {
  ...initial("database"), rules: [{ column: "age", operator: ">=", value: "50" }],
}), "", "Stats view must not serialize unsupported filters.");

for (const [source, label, validator] of [
  [table, "hydrated Table", "tableUrlRuleIsValid"],
  [bootstrap, "bootstrap", "firstPaintTableUrlRuleIsValid"],
  [firstPaint, "inline parser first paint", "initialTableUrlRuleIsValid"],
]) {
  assert.ok(source.includes("const seenQuickKeys = new Set();")
    && source.includes("seenQuickKeys.has(key)"),
    label + " must apply the same first-entry duplicate rule.");
  assert.ok(source.includes(".filter((entry) => " + validator + "("),
    label + " must discard invalid rules before assigning leading AND.");
}
assert.ok(browser.includes('["database-nav04-url"') && browser.includes('["database-nav04-url-phone"'),
  "The desktop and phone Chromium pasted URL scenarios must both be enabled.");
assert.ok(browser.includes("NAV-04 first paint and hydrated Filter count disagree"));
console.log("NAV-04 canonical URL parse/serialize, Unicode, duplicates, invalid rules/ranges, stable defaults, desktop/phone browser contracts passed.");
