import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(root, "styles.css"), "utf8");
const appCore = readFileSync(resolve(root, "modules/app-core.js"), "utf8");

const cellAlignment = styles.match(/table :is\(th, td\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(cellAlignment, /vertical-align: middle;/, "All table cells must use middle vertical alignment.");

const playerCellGeometry = styles.match(/#progressionPage \.playerTableScroller td \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(playerCellGeometry, /height: var\(--mfl-table-row-height\);/, "Player cells must retain the canonical row-content height.");
assert.match(playerCellGeometry, /line-height: var\(--mfl-table-row-height\);/, "Plain row text must use the full centered row line box.");
assert.match(playerCellGeometry, /vertical-align: middle;/, "The player cell line box must be vertically centered in the rendered row.");

const inlineTextAlignment = styles.match(/table :is\(th, td\) > :is\(a, span\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(inlineTextAlignment, /line-height: inherit;/, "Direct textual table content must inherit the centered cell line height.");
assert.match(inlineTextAlignment, /vertical-align: baseline;/, "Inline row text must share one baseline inside the centered line box.");
assert.doesNotMatch(inlineTextAlignment, /vertical-align: middle;/, "Inline spans must not use CSS middle alignment, which shifts progression text relative to its stat value.");

const replacedElementsAlignment = styles.match(/table :is\(th, td\) > :is\(button, img, input, select, svg\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(replacedElementsAlignment, /vertical-align: middle;/, "Direct controls and replaced elements in table cells must be vertically centered.");

assert.match(styles, /#tableBody \.selectionCell input,[\s\S]*#tableBody \.flagCell \.flagImage \{[\s\S]*display: inline-block;[\s\S]*margin: 0;[\s\S]*vertical-align: middle;/);

const sharedFullHeightContent = styles.match(/#progressionPage #tableBody :is\(\.tableControlCellContent, \.tableOverallCellContent\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(sharedFullHeightContent, /display: flex;/, "Control, Age and Overall hosts must use block-level flex layout.");
assert.match(sharedFullHeightContent, /align-items: center;/, "Control, Age and Overall children must be vertically centered inside their host.");
assert.match(sharedFullHeightContent, /width: 100%;/, "The shared row-content host must own the full cell width.");
assert.match(sharedFullHeightContent, /height: var\(--mfl-table-row-height\);/, "The shared row-content host must own the full canonical cell height.");
assert.match(sharedFullHeightContent, /min-height: var\(--mfl-table-row-height\);/, "The shared row-content host must preserve the canonical minimum cell height.");
assert.match(sharedFullHeightContent, /line-height: 1;/, "Children inside the shared flex host must not inherit the row line box.");
assert.doesNotMatch(sharedFullHeightContent, /inline-flex/, "Full-height row hosts must not re-enter inline baseline layout.");

const listingHost = styles.match(/#progressionPage #tableBody \.listingCellTableHost \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(listingHost, /display: flex;/, "Listing must have a dedicated full-height flex host.");
assert.match(listingHost, /align-items: center;/, "Listing content must be vertically centered.");
assert.match(listingHost, /height: var\(--mfl-table-row-height\);/, "Listing host must use the canonical row-content height.");

const playerNameHost = styles.match(/#progressionPage #tableBody \.playerNameCell \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(playerNameHost, /height: var\(--mfl-table-row-height\);/, "Player Name host must use the canonical row-content height.");
assert.match(playerNameHost, /min-height: var\(--mfl-table-row-height\);/, "Player Name host must not collapse below the canonical row-content height.");
assert.match(styles, /#tableBody \.playerNameCell \{[\s\S]*align-items: center;/, "Player Name text and markers must remain vertically centered by their flex host.");

assert.match(styles, /\.retirementMarker \{[\s\S]*display: inline-flex;[\s\S]*align-items: center;[\s\S]*justify-content: center;/, "Retirement markers must center their icon geometry internally.");
assert.doesNotMatch(styles, /#progressionPage #tableBody \.tableOverallCellContent \{[\s\S]*display: inline-flex;/, "Overall must not have a separate inline-flex centering contract.");

for (const rendererContract of [
  'selectionContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'actionsContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'flagContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'idContent.className = "tableControlCellContent";',
  'cell.innerHTML = listingBadge ? `<span class="listingCellTableHost">${listingBadge}</span>` : "";',
  'ageContent.className = "tableControlCellContent";',
  'nameWrap.className = "playerNameCell";',
  'contentHost.className = "tableOverallCellContent";',
]) {
  assert.ok(appCore.includes(rendererContract), `Player-row renderer lost its centered host contract: ${rendererContract}`);
}

assert.match(appCore, /progressionElement\.className = progression > 0 \? "progressionValue positive" : "progressionValue negative";/, "Stat progression must remain inline text beside its stat value.");
assert.match(appCore, /contentHost\.appendChild\(progressionElement\);/, "Stat progression must stay in the same centered text/flex host as its stat value.");
assert.match(appCore, /cell\.appendChild\(element\);[\s\S]*function appendStatValue/, "Next Overall progression text must remain in the same centered cell line as its value.");

console.log("Every player-table row item uses the shared vertical-centering contract.");
