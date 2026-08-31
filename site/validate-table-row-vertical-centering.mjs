import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(root, "styles.css"), "utf8");
const tableSource = readFileSync(resolve(root, "modules/core-sources/table.js"), "utf8");
const generatedTable = readFileSync(resolve(root, "modules/app-core-table-runtime.js"), "utf8");

const playerCellGeometry = styles.match(/#progressionPage \.playerTableScroller td \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(playerCellGeometry, /height: var\(--mfl-table-row-height\);/, "Player cells must retain the canonical row-content height.");
assert.match(playerCellGeometry, /min-height: var\(--mfl-table-row-height\);/, "Player cells must retain the canonical minimum row-content height.");
assert.match(playerCellGeometry, /vertical-align: middle;/, "Table cells must retain native middle alignment as the table-layout fallback.");

const sharedFullHeightContent = styles.match(/#progressionPage #tableBody :is\(\.tableControlCellContent, \.tableOverallCellContent\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(sharedFullHeightContent, /display: flex;/, "The canonical row-content host must use flex layout.");
assert.match(sharedFullHeightContent, /align-items: center;/, "The canonical row-content host must vertically center every child.");
assert.match(sharedFullHeightContent, /width: 100%;/, "The canonical row-content host must own the full cell width.");
assert.match(sharedFullHeightContent, /height: var\(--mfl-table-row-height\);/, "The canonical row-content host must own the full row-content height.");
assert.match(sharedFullHeightContent, /min-height: var\(--mfl-table-row-height\);/, "The canonical row-content host must preserve the minimum row-content height.");
assert.match(sharedFullHeightContent, /line-height: 1\.2;/, "Flex-centered row text must retain a descender-safe line box without changing row geometry.");
assert.doesNotMatch(sharedFullHeightContent, /overflow:\s*(?:hidden|clip)/, "The shared row-content host must not clip glyph ascenders or descenders.");
assert.doesNotMatch(sharedFullHeightContent, /inline-flex/, "The universal full-height host must not participate in inline baseline layout.");

const playerNameContent = styles.match(/#progressionPage #tableBody \.playerNameCell \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(playerNameContent, /display: flex;/, "Player-name content must use flex layout rather than a full-height baseline box.");
assert.match(playerNameContent, /align-items: center;/, "Player name, link, and markers must be vertically centered inside the row.");
assert.match(playerNameContent, /width: 100%;/, "Player-name content must retain the full cell width while centering.");
assert.match(playerNameContent, /height: var\(--mfl-table-row-height\);/, "Player-name content must own the full canonical row-content height.");
assert.match(playerNameContent, /line-height: 1\.2;/, "Player-name text must retain the same descender-safe line box as every other centered row item.");

const listingContent = styles.match(/#progressionPage #tableBody \.listingCellTableHost \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(listingContent, /display: flex;/, "Listing content must remain a flex-centered row item.");
assert.match(listingContent, /align-items: center;/, "Listing content must remain vertically centered inside the row.");
assert.match(listingContent, /height: var\(--mfl-table-row-height\);/, "Listing content must retain the full canonical row-content height.");

for (const source of [tableSource, generatedTable]) {
  assert.match(source, /function tableCenterCellContents\(cell\) \{/, "Canonical Table ownership must define one shared row-cell centering helper.");
  assert.match(source, /contentHost\.className = "tableControlCellContent";/, "Every newly wrapped cell must use the existing canonical full-height host class.");
  assert.match(source, /while \(cell\.firstChild\) contentHost\.appendChild\(cell\.firstChild\);/, "The centering helper must preserve every existing cell child.");
  assert.match(source, /tableRow\.appendChild\(tableCenterCellContents\(selectionCell\)\);/, "Selection cells must use the universal centering helper.");
  assert.match(source, /tableRow\.appendChild\(tableCenterCellContents\(actionsCell\)\);/, "Action cells must use the universal centering helper.");
  assert.match(source, /tableRow\.appendChild\(tableCenterCellContents\(cell\)\);/, "Every rendered data cell must use the universal centering helper.");
  assert.doesNotMatch(source, /!important|translate\(|translateY\(/, "Vertical centering must not use priority overrides or transform nudges.");
}

for (const contentContract of [
  'selectionContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'actionsContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'flagContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'idContent.className = "tableControlCellContent";',
  'ageContent.className = "tableControlCellContent";',
  'nameWrap.className = "playerNameCell";',
  'contentHost.className = "tableOverallCellContent";',
]) {
  assert.ok(tableSource.includes(contentContract), `Canonical Table source must preserve specialized row content: ${contentContract}`);
  assert.ok(generatedTable.includes(contentContract), `Generated Table runtime must preserve specialized row content: ${contentContract}`);
}

assert.doesNotMatch(tableSource, /app-core-table-row-centering|addTableRowVerticalCentering/, "Row centering must be authored directly in canonical Table source without a retired transform.");
new Function(tableSource);
console.log("Every player-table row item, including player names, markers, listings, controls, and stat content, keeps viewport-independent vertical centering with a descender-safe text line box.");
