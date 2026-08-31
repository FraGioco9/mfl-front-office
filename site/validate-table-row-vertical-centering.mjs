import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(root, "styles.css"), "utf8");
const baseStyles = readFileSync(resolve(root, "styles-base.css"), "utf8");
const tableSource = readFileSync(resolve(root, "modules/core-sources/table.js"), "utf8");
const generatedTable = readFileSync(resolve(root, "modules/app-core-table-runtime.js"), "utf8");

const playerCellGeometry = styles.match(/#progressionPage \.playerTableScroller td \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(playerCellGeometry, /height: var\(--mfl-table-row-height\);/, "Player cells must retain the canonical row-content height.");
assert.match(playerCellGeometry, /min-height: var\(--mfl-table-row-height\);/, "Player cells must retain the canonical minimum row-content height.");
assert.match(playerCellGeometry, /line-height: 1\.2;/, "Player cells must not use full-row line-height as a vertical-positioning mechanism.");
assert.match(playerCellGeometry, /vertical-align: middle;/, "Table cells must retain native middle alignment as the table-layout fallback.");
assert.doesNotMatch(playerCellGeometry, /line-height: var\(--mfl-table-row-height\);/, "Player cells must not vertically position content with row-height line boxes.");

const baseCellGeometry = baseStyles.match(/th,\ntd \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(baseCellGeometry, /line-height: 1\.2;/, "Global table cells must use a normal text line box.");
assert.match(baseCellGeometry, /vertical-align: middle;/, "Global table cells must vertically center their line box.");
assert.doesNotMatch(baseCellGeometry, /line-height: 38px;/, "Global tables must not use a fixed full-row line-height for centering.");
const directCellInlineGeometry = styles.match(/table :is\(th, td\) > :is\(a, span\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(directCellInlineGeometry, /vertical-align: middle;/, "Direct table links and spans must inherit middle alignment.");
assert.doesNotMatch(directCellInlineGeometry, /vertical-align: baseline;/, "Direct table links and spans must never be forced back onto the baseline.");

const playerHeaderGeometry = styles.match(/#progressionPage \.playerTableScroller th \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(playerHeaderGeometry, /line-height: 1\.2;/, "Player headers must use a normal line box.");
assert.match(playerHeaderGeometry, /vertical-align: middle;/, "Player headers must retain native middle alignment.");
assert.doesNotMatch(playerHeaderGeometry, /line-height: var\(--mfl-table-header-height\);/, "Player headers must not use header-height line boxes for centering.");

const headerContent = styles.match(/#progressionPage #tableHead \.tableHeaderCellContent \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(headerContent, /display: flex;/, "Every player-table header must use a flex content host.");
assert.match(headerContent, /align-items: center;/, "Header text, arrows, and icons must share the exact vertical midpoint.");
assert.match(headerContent, /height: var\(--mfl-table-header-height\);/, "Header content host must own the full header height.");

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
  assert.match(source, /function tableCenterHeaderCellContents\(cell\) \{/, "Canonical Table ownership must define one shared header-cell centering helper.");
  assert.match(source, /contentHost\.className = "tableHeaderCellContent";/, "Every wrapped header must use the canonical full-height header host.");
  assert.match(source, /headerRow\.appendChild\(tableCenterHeaderCellContents\(selectionHeader\)\);/, "Header selection control must use the shared centering helper.");
  assert.match(source, /headerRow\.appendChild\(tableCenterHeaderCellContents\(actionsHeader\)\);/, "Header action cell must use the shared centering helper.");
  assert.match(source, /headerRow\.appendChild\(tableCenterHeaderCellContents\(cell\)\);/, "Every rendered data header must use the shared centering helper.");
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
console.log("Every table cell uses middle alignment without full-row line-height positioning, and every player-table header/body item shares a full-height centered content host.");
