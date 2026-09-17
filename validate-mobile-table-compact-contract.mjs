import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const tableSource = readCanonicalCoreSource("table");
const tableRuntimeSource = readFileSync(resolve(root, "modules/app-core-table-runtime.js"), "utf8");
const sharedTableUiSource = readFileSync(resolve(root, "shared-table-ui-runtime.js"), "utf8");
const projectionSource = readFileSync(resolve(root, "sync-release-projections.mjs"), "utf8");
const bootstrapSource = readFileSync(resolve(root, "bootstrap.js"), "utf8");
const responsiveSource = readFileSync(resolve(root, "responsive.css"), "utf8");

assert.doesNotMatch(
  tableSource,
  /const compactTableLayout = window\.matchMedia\("\(max-width: (?:900|1040|1366)px\)"\)\.matches;/,
  "Canonical Table rows must not branch their DOM on a responsive compact-table breakpoint.",
);
assert.doesNotMatch(
  tableSource,
  /const compactJoinedAgencyLayout = window\.matchMedia\("\(max-width: 520px\)"\)\.matches;/,
  "Canonical Table rows must not branch Joined Agency DOM on the 520px breakpoint.",
);
assert.match(tableSource, /playerNameFullValue/, "Canonical Table rows must retain the full player name in stable DOM.");
assert.match(tableSource, /playerNameCompactValue/, "Canonical Table rows must retain the compact player name in stable DOM.");
assert.match(tableSource, /joinedAgencyFullValue/, "Canonical Table rows must retain the full Joined Agency value in stable DOM.");
assert.match(tableSource, /joinedAgencyCompactValue/, "Canonical Table rows must retain the compact Joined Agency value in stable DOM.");
assert.match(
  tableSource,
  /column === "listing_price"[\s\S]*host\.className = "listingCellTableHost";[\s\S]*host\.innerHTML = listingBadge;[\s\S]*cell\.appendChild\(host\);/,
  "Canonical Table rows must retain the structural Listing host plus icon and price markup regardless of viewport width.",
);
assert.doesNotMatch(tableSource, /price\?\.remove\(\)/, "Responsive Table rendering must not remove Listing prices from the DOM.");

assert.match(
  sharedTableUiSource,
  /@media \(max-width: 900px\) \{[\s\S]*--mfl-table-header-height: 30px;[\s\S]*--mfl-table-row-height: 26px;[\s\S]*--mfl-table-row-outer-height: 30px;/,
  "Mobile table headers must match the visible 32px row height while preserving the 28px cell content height.",
);
assert.match(
  sharedTableUiSource,
  /@media \(max-width: 520px\) \{[\s\S]*--mfl-table-header-height: 26px;[\s\S]*--mfl-table-row-height: 22px;[\s\S]*--mfl-table-row-outer-height: 26px;/,
  "Phone table headers must match the visible 28px row height while preserving the 24px cell content height.",
);
assert.match(
  sharedTableUiSource,
  /@media \(max-width: 380px\) \{[\s\S]*--mfl-table-header-height: 24px;[\s\S]*--mfl-table-row-height: 20px;[\s\S]*--mfl-table-row-outer-height: 24px;/,
  "Tiny-screen table headers must match the visible 26px row height while preserving the 22px cell content height.",
);

assert.match(tableSource, /positions: "POS"/, "Hydrated small-screen Positions headings must use POS.");
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
assert.match(responsiveSource, /#progressionPage \.playerTableScroller td \{\n {4}font-size: 12px;\n {2}\}/, "Compact-table row text must retain its 12px font contract.");
assert.match(responsiveSource, /@media \(max-width: 520px\)[\s\S]*#progressionPage \.playerTableScroller td \{\n {4}font-size: 11px;\n {2}\}/, "Phone row text must retain its 11px font contract.");
assert.match(responsiveSource, /@media \(max-width: 380px\)[\s\S]*#progressionPage \.playerTableScroller td \{\n {4}font-size: 10px;\n {2}\}/, "Tiny-screen row text must retain its 10px font contract.");
assert.match(projectionSource, /@media \(max-width: 900px\)[\s\S]*--mfl-table-header-height: 30px; --mfl-table-row-height: 26px; --mfl-table-row-outer-height: 30px;/, "First-paint mobile header height must already match the visible row height.");
assert.match(projectionSource, /@media \(max-width: 520px\)[\s\S]*--mfl-table-header-height: 26px; --mfl-table-row-height: 22px; --mfl-table-row-outer-height: 26px;/, "First-paint phone header height must already match the visible row height.");
assert.match(projectionSource, /@media \(max-width: 380px\)[\s\S]*--mfl-table-header-height: 24px; --mfl-table-row-height: 20px; --mfl-table-row-outer-height: 24px;/, "First-paint tiny-screen header height must already match the visible row height.");

assert.match(tableSource, /selectVisibleInput\.type = "checkbox";[\s\S]*selectVisibleInput\.disabled = true;/, "Every rebuilt table header must start with selection disabled until visible data exists.");
assert.match(tableRuntimeSource, /selectVisibleInput\.type = "checkbox";[\s\S]*selectVisibleInput\.disabled = true;/, "Generated table runtime must preserve the disabled header-selection first state.");
assert.match(sharedTableUiSource, /#progressionPage #tableHead \.selectionCell input:disabled \{[\s\S]*opacity: 0\.45;/, "The disabled hydrated header checkbox must be graphically distinct.");
assert.match(projectionSource, /#tableHead \.selectionCell input:disabled \{ opacity: 0\.45; \}/, "The first-paint disabled header checkbox must already use the final disabled appearance.");

assert.match(tableSource, /function compactMobilePlayerName\(value\)/, "Player names must retain one canonical compact formatter.");
assert.match(tableSource, /function compactMobileJoinedAgency\(value\) \{[\s\S]*split\(\/\\s\+\/, 1\)\[0\]/, "Joined Agency must retain one canonical compact date-only formatter.");
assert.match(
  responsiveSource,
  /@media \(min-width: 901px\) and \(max-width: 1366px\) \{[\s\S]*--mfl-table-header-height: 30px;[\s\S]*--mfl-intermediate-age-marker-size: clamp\(11px, calc\(5\.1871px \+ 0\.645161vw\), 14px\);[\s\S]*\.playerTableScroller \{[\s\S]*overflow-x: auto;[\s\S]*\.playerTableScroller th \{[\s\S]*font-size: 10px;[\s\S]*\.playerTableScroller td \{[\s\S]*font-size: 12px;[\s\S]*:is\(\.retirementMarker, \.newMintMarker\) \{[\s\S]*width: var\(--mfl-intermediate-age-marker-size\);[\s\S]*\.listingCellIcon \{[\s\S]*width: 9px;/,
  "Intermediate player tables must reuse compact tablet geometry while Age markers scale fluidly from 11px to 14px across 901-1366px.",
);
assert.match(
  responsiveSource,
  /\.retirementMarker::before,[\s\S]*:is\(\.retirementMarker, \.newMintMarker\) img,[\s\S]*\.newMintMarker \.newMintIcon \{[\s\S]*width: var\(--mfl-intermediate-age-marker-size\);[\s\S]*height: var\(--mfl-intermediate-age-marker-size\);/,
  "Intermediate retirement and new-player visible icon drawings must use the same fluid Age-marker size as their containers.",
);
assert.match(
  responsiveSource,
  /@media \(max-width: 1366px\) \{[\s\S]*\.playerNameFullValue \{[\s\S]*display: none;[\s\S]*\.playerNameCompactValue \{[\s\S]*display: inline;[\s\S]*\.listingCellPrice \{[\s\S]*display: none;/,
  "Responsive Table presentation must switch names to N. Surname and Listing to icon-only at <=1366px.",
);
assert.match(
  responsiveSource,
  /@media \(max-width: 700px\) \{[\s\S]*#progressionPage \.playerTableScroller #tableBody td\.col-age \.tableControlCellContent \{[\s\S]*gap: 2px;/,
  "Age/marker spacing must shrink to 2px at <=700px.",
);
assert.match(
  responsiveSource,
  /@media \(max-width: 520px\) \{[\s\S]*\.joinedAgencyFullValue \{[\s\S]*display: none;[\s\S]*\.joinedAgencyCompactValue \{[\s\S]*display: inline;/,
  "Joined Agency must switch to its compact date-only value at <=520px without rerendering rows.",
);
assert.match(
  responsiveSource,
  /@media \(max-width: 380px\) \{[\s\S]*#progressionPage \.playerTableScroller #tableBody td\.col-age \.tableControlCellContent \{[\s\S]*gap: 1px;/,
  "Age/marker spacing must shrink to 1px at <=380px.",
);

const phoneStyle = sharedTableUiSource.match(/@media \(max-width: 520px\) \{([\s\S]*?)\n\}\n@media \(max-width: 380px\)/)?.[1] || "";
assert.match(phoneStyle, /#progressionPage #tableBody \.tableOverallRarityCircle \{[\s\S]*flex-basis: 5px;[\s\S]*width: 5px;[\s\S]*height: 5px;[\s\S]*margin-right: 3px;/, "The Overall rarity circle must use the refined 5px size and 3px number gap on phone screens.");
const tinyStyle = sharedTableUiSource.match(/@media \(max-width: 380px\) \{([\s\S]*?)\n\}`;/)?.[1] || "";
assert.match(tinyStyle, /#progressionPage #tableBody \.tableOverallRarityCircle \{[\s\S]*flex-basis: 5px;[\s\S]*width: 5px;[\s\S]*height: 5px;[\s\S]*margin-right: 3px;/, "The Overall rarity circle must keep the refined 5px size and 3px number gap on tiny screens.");

assert.doesNotMatch(tableSource, /!important/, "Canonical responsive Table presentation must not add !important overrides.");
assert.doesNotMatch(sharedTableUiSource, /!important/, "Shared mobile table presentation must not add !important overrides.");
assert.doesNotMatch(responsiveSource, /mobile-table-content[\s\S]*!important/, "Responsive Table content must not require !important overrides.");
assert.doesNotMatch(sharedTableUiSource, /MutationObserver/, "Shared mobile Table presentation must not repair rendered rows through MutationObserver.");

const tableBanner = "// Generated Table core from modules/core-sources/table.js. Do not edit directly.\n";
assert.ok(tableRuntimeSource.startsWith(tableBanner), "Generated Table runtime must carry the canonical banner.");
assert.equal(
  tableRuntimeSource.slice(tableBanner.length).replace(/\s*$/, ""),
  tableSource.replace(/\s*$/, ""),
  "Generated Table runtime must exactly match the manifest-assembled canonical Table source.",
);

console.log("Source-owned resize-safe compact table contract through 1366px validation passed.");
