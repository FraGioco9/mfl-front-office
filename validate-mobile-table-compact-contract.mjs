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

for (const [contract, label] of [
  ["--mfl-responsive-table-age-marker-size: clamp(8px, calc(6.666667px + 0.370370vw), 10px);", "Age status markers"],
  ["--mfl-responsive-table-age-marker-gap: clamp(1px, calc(-0.656442px + 0.460123vw), 7px);", "Age status marker spacing"],
  ["--mfl-responsive-table-listing-icon-size: clamp(6px, calc(4.343558px + 0.460123vw), 12px);", "Listing icons"],
  ["--mfl-responsive-table-flag-size: clamp(10px, calc(7.791411px + 0.613497vw), 18px);", "nationality flags"],
  ["--mfl-responsive-table-note-icon-size: clamp(7px, calc(5.067485px + 0.536810vw), 14px);", "Note icons"],
  ["--mfl-responsive-table-rarity-size: clamp(5px, calc(4.171779px + 0.230061vw), 8px);", "Overall rarity markers"],
  ["--mfl-responsive-table-checkbox-size: clamp(10px, calc(8.343558px + 0.460123vw), 16px);", "selection controls"],
  ["--mfl-responsive-table-action-size: clamp(13px, calc(11.067485px + 0.536810vw), 20px);", "row action controls"],
]) {
  assert.ok(
    responsiveSource.includes(contract),
    `${label} must share the continuous 360-1664px responsive scale instead of switching to a separate above-900 size model.`,
  );
}

assert.match(
  responsiveSource,
  /@media \(max-width: 1664px\) \{[\s\S]*--mfl-responsive-table-listing-icon-size: clamp\(6px,[\s\S]*12px\);[\s\S]*--mfl-responsive-table-flag-size: clamp\(10px,[\s\S]*18px\);[\s\S]*--mfl-responsive-table-age-marker-size: clamp\(8px, calc\(6\.666667px \+ 0\.370370vw\), 10px\);/,
  "Responsive table icons must keep their responsive tokens, with Age markers starting on a continuous 8-10px small-screen ramp.",
);
assert.doesNotMatch(
  responsiveSource,
  /@media \(min-width: 701px\) and \(max-width: 900px\) \{[\s\S]*--mfl-responsive-table-age-marker-size:\s*10px;/,
  "Age status markers must not plateau between 701px and 900px; they must keep scaling from very small screens.",
);
assert.match(
  responsiveSource,
  /@media \(min-width: 901px\) and \(max-width: 1366px\) \{[\s\S]*--mfl-responsive-table-age-marker-size: clamp\(10px, calc\(6\.124731px \+ 0\.430108vw\), 12px\);/,
  "Age status markers must use the slower 10-12px intermediate scale through 1366px.",
);
assert.match(
  responsiveSource,
  /@media \(min-width: 1367px\) and \(max-width: 1664px\) \{[\s\S]*--mfl-responsive-table-age-marker-size: clamp\(12px, calc\(-6\.410774px \+ 1\.346801vw\), 16px\);/,
  "Age status markers must rejoin the normal 16px desktop size smoothly by 1664px.",
);

assert.match(
  responsiveSource,
  /--mfl-responsive-table-sort-arrow-half-width: clamp\(2px,[\s\S]*4px\);[\s\S]*--mfl-responsive-table-sort-arrow-height: clamp\(3px,[\s\S]*6px\);[\s\S]*--mfl-responsive-table-sort-arrow-gap: clamp\(1px,[\s\S]*3px\);/,
  "Sort arrows must scale continuously with the rest of the responsive table icon system.",
);
assert.match(
  responsiveSource,
  /\.playerTableScroller \.sortArrow \{[\s\S]*margin-left: var\(--mfl-responsive-table-sort-arrow-gap\);[\s\S]*transform: none;/,
  "Responsive sort arrows must consume the shared fluid geometry instead of breakpoint transform jumps.",
);
assert.match(
  responsiveSource,
  /\.playerTableScroller \.sortArrow\.asc \{[\s\S]*border-left: var\(--mfl-responsive-table-sort-arrow-half-width\) solid transparent;[\s\S]*border-bottom: var\(--mfl-responsive-table-sort-arrow-height\) solid var\(--text\);/,
  "Ascending sort arrows must consume the continuous responsive geometry.",
);
assert.doesNotMatch(
  responsiveSource,
  /\.playerTableScroller \.sortArrow \{\s*transform: scale\((?:0\.75|0\.62|0\.54)\)/,
  "Sort arrows must not jump between the old fixed mobile scale tiers.",
);
assert.match(
  responsiveSource,
  /@media \(min-width: 901px\) and \(max-width: 1366px\) \{[\s\S]*--mfl-table-header-height: 30px;[\s\S]*\.playerTableScroller \{[\s\S]*overflow-x: auto;[\s\S]*\.playerTableScroller th \{[\s\S]*font-size: 10px;[\s\S]*\.playerTableScroller td \{[\s\S]*font-size: 12px;/,
  "Intermediate player tables must reuse the compact tablet layout from 901px through 1366px.",
);
assert.match(
  responsiveSource,
  /:is\(\.retirementMarker, \.newMintMarker\) \{[\s\S]*width: var\(--mfl-responsive-table-age-marker-size\);/,
  "Intermediate Age marker containers must consume their fluid size token.",
);
assert.match(
  responsiveSource,
  /\.retirementMarker::before,[\s\S]*:is\(\.retirementMarker, \.newMintMarker\) img,[\s\S]*\.newMintMarker \.newMintIcon \{[\s\S]*width: var\(--mfl-responsive-table-age-marker-size\);[\s\S]*height: var\(--mfl-responsive-table-age-marker-size\);/,
  "Intermediate retirement and new-player visible icon drawings must use the same fluid Age-marker size as their containers.",
);
assert.match(
  responsiveSource,
  /:is\(\.retirementMarker, \.newMintMarker\),[\s\S]*\.newMintMarker \.newMintIcon \{[\s\S]*aspect-ratio: 1 \/ 1;/,
  "Age status markers and their visible drawings must preserve square proportions while scaling.",
);
assert.match(
  responsiveSource,
  /\.retirementMarker::before \{[\s\S]*-webkit-mask-size: contain;[\s\S]*mask-size: contain;/,
  "Retirement icon masks must use contain sizing so the source artwork is never stretched.",
);
assert.match(
  responsiveSource,
  /:is\(\.retirementMarker, \.newMintMarker\) img \{[\s\S]*object-fit: contain;/,
  "Image-backed Age status markers must preserve their source proportions.",
);
assert.match(
  responsiveSource,
  /\.playerTableScroller \.listingCellIcon \{[\s\S]*width: var\(--mfl-responsive-table-listing-icon-size\);[\s\S]*height: var\(--mfl-responsive-table-listing-icon-size\);/,
  "Intermediate Listing icons must consume their fluid size token.",
);
assert.match(
  responsiveSource,
  /\.playerTableScroller \.flagImage \{[\s\S]*width: var\(--mfl-responsive-table-flag-size\);[\s\S]*height: var\(--mfl-responsive-table-flag-size\);/,
  "Intermediate flag icons must consume their fluid size token.",
);
assert.match(
  responsiveSource,
  /\.playerTableScroller \.playerNoteIcon \{[\s\S]*font-size: var\(--mfl-responsive-table-note-icon-size\);/,
  "Intermediate Note icons must consume their fluid size token.",
);
assert.match(
  responsiveSource,
  /#tableBody \.tableOverallRarityCircle \{[\s\S]*width: var\(--mfl-responsive-table-rarity-size\);[\s\S]*height: var\(--mfl-responsive-table-rarity-size\);/,
  "Intermediate Overall rarity markers must consume their fluid size token.",
);
assert.match(
  responsiveSource,
  /\.playerTableScroller :is\(th, td\)\.selectionCell input,[\s\S]*\.quickFilters input\[type="checkbox"\] \{[\s\S]*width: var\(--mfl-responsive-table-checkbox-size\);[\s\S]*height: var\(--mfl-responsive-table-checkbox-size\);/,
  "Intermediate selection controls must consume their fluid size token.",
);
assert.match(
  responsiveSource,
  /\.playerTableScroller \.playerTableActionsButton \{[\s\S]*width: var\(--mfl-responsive-table-action-size\);[\s\S]*height: var\(--mfl-responsive-table-action-size\);/,
  "Intermediate row action controls must consume their fluid size token.",
);
assert.match(
  responsiveSource,
  /@media \(max-width: 1366px\) \{[\s\S]*\.playerNameFullValue \{[\s\S]*display: none;[\s\S]*\.playerNameCompactValue \{[\s\S]*display: inline;[\s\S]*\.listingCellPrice \{[\s\S]*display: none;/,
  "Responsive Table presentation must switch names to N. Surname and Listing to icon-only at <=1366px.",
);
assert.match(
  responsiveSource,
  /#progressionPage \.playerTableScroller td\.col-age \.tableControlCellContent \{[\s\S]*gap: var\(--mfl-responsive-table-age-marker-gap\);/,
  "Age/marker spacing must consume one continuous responsive gap token.",
);
assert.doesNotMatch(
  responsiveSource,
  /td\.col-age \.tableControlCellContent \{[\s\S]{0,120}gap: (?:1|2|3)px;/,
  "Age/marker spacing must not fall back to breakpoint-stepped fixed gaps.",
);
assert.match(
  responsiveSource,
  /@media \(max-width: 520px\) \{[\s\S]*\.joinedAgencyFullValue \{[\s\S]*display: none;[\s\S]*\.joinedAgencyCompactValue \{[\s\S]*display: inline;/,
  "Joined Agency must switch to its compact date-only value at <=520px without rerendering rows.",
);

const phoneStyle = sharedTableUiSource.match(/@media \(max-width: 520px\) \{([\s\S]*?)\n\}\n@media \(max-width: 380px\)/)?.[1] || "";
assert.match(phoneStyle, /#progressionPage #tableBody \.tableOverallRarityCircle \{[\s\S]*flex-basis: var\(--mfl-responsive-table-rarity-size\);[\s\S]*width: var\(--mfl-responsive-table-rarity-size\);[\s\S]*height: var\(--mfl-responsive-table-rarity-size\);[\s\S]*margin-right: 3px;/, "Phone Overall rarity circles must consume the continuous responsive size while keeping the 3px number gap.");
const tinyStyle = sharedTableUiSource.match(/@media \(max-width: 380px\) \{([\s\S]*?)\n\}`;/)?.[1] || "";
assert.match(tinyStyle, /#progressionPage #tableBody \.tableOverallRarityCircle \{[\s\S]*flex-basis: var\(--mfl-responsive-table-rarity-size\);[\s\S]*width: var\(--mfl-responsive-table-rarity-size\);[\s\S]*height: var\(--mfl-responsive-table-rarity-size\);[\s\S]*margin-right: 3px;/, "Tiny-screen Overall rarity circles must keep consuming the continuous responsive size with the 3px number gap.");

assert.doesNotMatch(tableSource, /!important/, "Canonical responsive Table presentation must not add !important overrides.");
assert.doesNotMatch(sharedTableUiSource, /!important/, "Shared mobile Table presentation must not add !important overrides.");
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
