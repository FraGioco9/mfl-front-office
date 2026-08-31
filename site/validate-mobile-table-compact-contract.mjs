import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const tableSource = readFileSync(resolve(root, "modules/core-sources/table.js"), "utf8");
const tableRuntimeSource = readFileSync(resolve(root, "modules/app-core-table-runtime.js"), "utf8");
const sharedTableUiSource = readFileSync(resolve(root, "shared-table-ui-runtime.js"), "utf8");
const projectionSource = readFileSync(resolve(root, "sync-release-projections.mjs"), "utf8");
const bootstrapSource = readFileSync(resolve(root, "bootstrap.js"), "utf8");
const responsiveSource = readFileSync(resolve(root, "responsive.css"), "utf8");

assert.match(
  tableSource,
  /const mobileTable = window\.matchMedia\("\(max-width: 900px\)"\)\.matches;[\s\S]*const compactTableHeadings = window\.matchMedia\("\(max-width: 520px\)"\)\.matches;/,
  "Canonical Table source must retain the shared 900px and compact 520px breakpoints.",
);

assert.match(
  sharedTableUiSource,
  /@media \(max-width: 900px\) \{[\s\S]*--mfl-table-header-height: 18.72596153846154px;[\s\S]*--mfl-table-row-height: 16.754807692307693px;[\s\S]*--mfl-table-row-outer-height: 19.21875px;/,
  "Mobile table headers must match the visible 32px row height while preserving the 28px cell content height.",
);
assert.match(
  sharedTableUiSource,
  /@media \(max-width: 520px\) \{[\s\S]*--mfl-table-header-height: 15.528846153846153px;[\s\S]*--mfl-table-row-height: 13.89423076923077px;[\s\S]*--mfl-table-row-outer-height: 15.9375px;/,
  "Phone table headers must match the visible 28px row height while preserving the 24px cell content height.",
);
assert.match(
  sharedTableUiSource,
  /@media \(max-width: 380px\) \{[\s\S]*--mfl-table-header-height: 13.701923076923077px;[\s\S]*--mfl-table-row-height: 12.259615384615385px;[\s\S]*--mfl-table-row-outer-height: 14.0625px;/,
  "Tiny-screen table headers must match the visible 26px row height while preserving the 22px cell content height.",
);

assert.match(tableSource, /player_seasons: "SZN"/, "Hydrated small-screen Seasons headings must use SZN.");
assert.match(
  bootstrapSource,
  /FIRST_PAINT_COMPACT_COLUMN_LABELS[\s\S]*player_seasons: "SZN"/,
  "Bootstrap must render SZN as the real first-paint Seasons header text.",
);
assert.doesNotMatch(
  projectionSource,
  /data-table-column=\\"player_seasons\\"[\s\S]*content: \\"SZN\\"/,
  "First-paint SZN must be real bootstrap text rather than a CSS pseudo-label.",
);

for (const [breakpoint, fontSize] of [["900", "10"], ["520", "9"], ["380", "8"]]) {
  assert.match(
    projectionSource,
    new RegExp(`@media \\(max-width: ${breakpoint}px\\)[\\s\\S]*#tableHead th > span:first-child \\{ font-size: ${fontSize}px; \\}`),
    `First-paint headers at <=${breakpoint}px must stay two pixels smaller than row text at ${fontSize}px.`,
  );
}
assert.match(sharedTableUiSource, /@media \(max-width: 900px\) \{[\s\S]*#progressionPage \.playerTableScroller th \{[\s\S]*font-size: 10px;/, "Hydrated mobile headers must use 10px text against 12px rows.");
assert.match(sharedTableUiSource, /@media \(max-width: 520px\) \{[\s\S]*#progressionPage \.playerTableScroller th \{[\s\S]*font-size: 9px;/, "Hydrated phone headers must use 9px text against 11px rows.");
assert.match(sharedTableUiSource, /@media \(max-width: 380px\) \{[\s\S]*#progressionPage \.playerTableScroller th \{[\s\S]*font-size: 8px;/, "Hydrated tiny-screen headers must use 8px text against 10px rows.");
assert.match(responsiveSource, /#progressionPage \.playerTableScroller td \{\n {4}font-size: 12px;\n {2}\}/, "Mobile row text must retain its 12px font contract.");
assert.match(responsiveSource, /@media \(max-width: 520px\)[\s\S]*#progressionPage \.playerTableScroller td \{\n {4}font-size: 11px;\n {2}\}/, "Phone row text must retain its 11px font contract.");
assert.match(responsiveSource, /@media \(max-width: 380px\)[\s\S]*#progressionPage \.playerTableScroller td \{\n {4}font-size: 10px;\n {2}\}/, "Tiny-screen row text must retain its 10px font contract.");
assert.match(projectionSource, /@media \(max-width: 900px\)[\s\S]*--mfl-table-header-height: 18.72596153846154px; --mfl-table-row-height: 16.754807692307693px; --mfl-table-row-outer-height: 19.21875px;/, "First-paint mobile header height must already match the visible row height.");
assert.match(projectionSource, /@media \(max-width: 520px\)[\s\S]*--mfl-table-header-height: 15.528846153846153px; --mfl-table-row-height: 13.89423076923077px; --mfl-table-row-outer-height: 15.9375px;/, "First-paint phone header height must already match the visible row height.");
assert.match(projectionSource, /@media \(max-width: 380px\)[\s\S]*--mfl-table-header-height: 13.701923076923077px; --mfl-table-row-height: 12.259615384615385px; --mfl-table-row-outer-height: 14.0625px;/, "First-paint tiny-screen header height must already match the visible row height.");

assert.match(tableSource, /selectVisibleInput\.type = "checkbox";[\s\S]*selectVisibleInput\.disabled = true;/, "Every rebuilt table header must start with selection disabled until visible data exists.");
assert.match(tableRuntimeSource, /selectVisibleInput\.type = "checkbox";[\s\S]*selectVisibleInput\.disabled = true;/, "Generated table runtime must preserve the disabled header-selection first state.");
assert.match(sharedTableUiSource, /#progressionPage #tableHead \.selectionCell input:disabled \{[\s\S]*opacity: 0\.45;/, "The disabled hydrated header checkbox must be graphically distinct.");
assert.match(projectionSource, /#tableHead \.selectionCell input:disabled \{ opacity: 0\.45; \}/, "The first-paint disabled header checkbox must already use the final disabled appearance.");

assert.match(tableSource, /function compactMobileJoinedAgency\(value\) \{[\s\S]*split\(\/\\s\+\/, 1\)\[0\]/, "Joined Agency must have a compact date-only formatter.");
assert.match(tableSource, /column === joinedAgencyColumn[\s\S]*window\.matchMedia\("\(max-width: 520px\)"\)\.matches[\s\S]*compactMobileJoinedAgency\(joinedAgencyValue\)/, "Joined Agency must switch to date-only values only on small screens.");

const phoneStyle = sharedTableUiSource.match(/@media \(max-width: 520px\) \{([\s\S]*?)\n\}\n@media \(max-width: 380px\)/)?.[1] || "";
assert.match(phoneStyle, /#progressionPage #tableBody \.tableOverallRarityCircle \{[\s\S]*flex-basis: 5px;[\s\S]*width: 5px;[\s\S]*height: 5px;[\s\S]*margin-right: 3px;/, "The Overall rarity circle must use the refined 5px size and 3px number gap on phone screens.");
const tinyStyle = sharedTableUiSource.match(/@media \(max-width: 380px\) \{([\s\S]*?)\n\}`;/)?.[1] || "";
assert.match(tinyStyle, /#progressionPage #tableBody \.tableOverallRarityCircle \{[\s\S]*flex-basis: 5px;[\s\S]*width: 5px;[\s\S]*height: 5px;[\s\S]*margin-right: 3px;/, "The Overall rarity circle must keep the refined 5px size and 3px number gap on tiny screens.");

assert.doesNotMatch(tableSource, /!important/, "Canonical mobile Table presentation must not add !important overrides.");
assert.doesNotMatch(sharedTableUiSource, /!important/, "Shared mobile table presentation must not add !important overrides.");

const tableBanner = "// Generated Table core from modules/core-sources/table.js. Do not edit directly.\n";
assert.ok(tableRuntimeSource.startsWith(tableBanner), "Generated Table runtime must carry the canonical banner.");
assert.equal(
  tableRuntimeSource.slice(tableBanner.length).replace(/\s*$/, ""),
  tableSource.replace(/\s*$/, ""),
  "Generated Table runtime must exactly match canonical table.js.",
);

console.log("Source-owned mobile compact table contract validation passed.");
