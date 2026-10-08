import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const [shared, table, lifecycle, player] = await Promise.all([
  readFile(new URL("../modules/core-sources/shared-data-search.js", import.meta.url), "utf8"),
  readFile(new URL("../modules/core-sources/table.js", import.meta.url), "utf8"),
  readFile(new URL("../modules/core-sources/table-render-lifecycle.js", import.meta.url), "utf8"),
  readFile(new URL("../modules/core-sources/player.js", import.meta.url), "utf8"),
]);

const start = shared.indexOf("function isBlankValue(value) {");
const end = shared.indexOf("function isDevelopmentCenterClubName(value) {", start);
assert(start >= 0 && end > start, "DATA-04 canonical missing-value helpers must remain inspectable");

const context = {};
vm.createContext(context);
vm.runInContext(
  shared.slice(start, end)
    + "\nglobalThis.__data04 = { isBlankValue, applyUnknownDataValue, unknownDataValueHtml, unknownDataValueLabel, unknownDataValueTooltip };",
  context,
);
const helpers = context.__data04;

function fakeElement() {
  const classes = new Set();
  const attributes = new Map();
  return {
    textContent: "",
    dataset: {},
    classList: { add: (value) => classes.add(value) },
    setAttribute: (key, value) => attributes.set(key, value),
    classes,
    attributes,
  };
}

for (const missing of [null, undefined, "", "NULL", "null"]) {
  const element = fakeElement();
  assert.equal(helpers.isBlankValue(missing), true);
  assert.equal(helpers.applyUnknownDataValue(element, missing), true);
  assert.equal(element.textContent, "Unknown");
  assert.equal(element.dataset.tooltip, "Not provided by MFL.");
  assert(element.classes.has("unknownDataValue"));
  assert.equal(element.attributes.get("aria-label"), "Unknown. Not provided by MFL.");
  assert.match(helpers.unknownDataValueHtml(missing), /data-tooltip="Not provided by MFL\."/);
}

for (const known of [0, "0", false, 1, "Diamond"]) {
  const element = fakeElement();
  assert.equal(helpers.isBlankValue(known), false, String(known) + " must not be treated as missing");
  assert.equal(helpers.applyUnknownDataValue(element, known), false);
  assert.equal(helpers.unknownDataValueHtml(known), "");
}

assert.match(table, /if \(applyUnknownDataValue\(cell, value\)\) \{\s*return;/);
assert.match(lifecycle, /if \(!applyUnknownDataValue\(ageValue, getValue\(row, column\)\)\)/);
assert.match(lifecycle, /else if \(rowHasActiveContract\(row\)\) \{\s*applyUnknownDataValue\(cell, getValue\(row, column\)\);/);
assert.match(lifecycle, /aria-label", "Not For Sale"/);

assert.match(shared, /rawValue === null \|\| rawValue === undefined \|\| rawValue === "" \? NaN : Number\(rawValue\)/);
assert.match(shared, /if \(!Number\.isFinite\(numericValue\)\) return "";/);
assert(shared.includes("listingPriceFormatter.format(numericValue)"));

assert.match(shared, /const retirementYears = rawRetirementYears === null[\s\S]*?\? null[\s\S]*?: Number\(rawRetirementYears\);/);
assert.match(shared, /if \(retirementYears === 0\) \{[\s\S]*?label: "Retired"/);

for (const rawField of ["rawNationality", "rawAge", "rawHeight", "rawFoot", "rawSeasons"]) {
  assert(
    player.includes("isBlankValue(" + rawField + ")"),
    "Player must classify " + rawField + " through the canonical missing-value predicate",
  );
}
assert(player.includes("unknownDataValueHtml(contractDivisionRaw)"));
assert(player.includes("revenueShare ? escapeHtml(revenueShare) : unknownDataValueHtml(rawRevenueShare)"));
assert(player.includes(': "–";'));

console.log("DATA04_MISSING_VALUE_SEMANTICS_PASS " + JSON.stringify({
  missingLabel: helpers.unknownDataValueLabel,
  missingTooltip: helpers.unknownDataValueTooltip,
  zeroPreserved: true,
  missingListingMeansNotForSale: true,
  freeAgentNotUnknownDivision: true,
  retirementZeroMeansRetired: true,
}));
