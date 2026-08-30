import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(root, "styles.css"), "utf8");
const transform = readFileSync(resolve(root, "modules/app-core-table-row-centering.js"), "utf8");
const buildNormalizer = readFileSync(resolve(root, "modules/app-core-build-normalizer.js"), "utf8");
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
assert.match(sharedFullHeightContent, /line-height: 1;/, "Content inside the flex host must not depend on baseline line-box centering.");
assert.doesNotMatch(sharedFullHeightContent, /inline-flex/, "The universal full-height host must not participate in inline baseline layout.");

assert.match(transform, /function tableCenterCellContents\(cell\) \{/, "The build must define one shared row-cell centering helper.");
assert.match(transform, /contentHost\.className = "tableControlCellContent";/, "Every newly wrapped cell must use the existing canonical full-height host class.");
assert.match(transform, /while \(cell\.firstChild\) contentHost\.appendChild\(cell\.firstChild\);/, "The helper must preserve every existing cell child while moving it into the canonical host.");
assert.match(transform, /tableRow\.appendChild\(tableCenterCellContents\(selectionCell\)\);/, "Selection cells must use the universal centering helper.");
assert.match(transform, /tableRow\.appendChild\(tableCenterCellContents\(actionsCell\)\);/, "Action cells must use the universal centering helper.");
assert.match(transform, /tableRow\.appendChild\(tableCenterCellContents\(cell\)\);/, "Every rendered data cell must use the universal centering helper.");
assert.doesNotMatch(transform, /matchMedia|innerWidth|max-width|min-width/, "Row-content centering must not differ by viewport size.");
assert.doesNotMatch(transform, /!important|translate\(|translateY\(|position:\s*relative|\btop\s*:/, "Vertical centering must not use priority overrides or positional nudges.");

assert.match(buildNormalizer, /import \{ addTableRowVerticalCentering \} from "\.\/app-core-table-row-centering\.js";/, "The canonical build must import the shared table-row centering transform.");
assert.match(
  buildNormalizer,
  /const mobileTableArtifacts = addMobileTablePresentation\(tableArtifacts\);\n {2}const centeredTableArtifacts = addTableRowVerticalCentering\(mobileTableArtifacts\);\n {2}const walletArtifacts = splitWalletApplicationCoreRuntime\(centeredTableArtifacts\);/,
  "Universal row centering must run after table/mobile presentation and before later route transforms.",
);

assert.match(generatedTable, /function tableCenterCellContents\(cell\) \{/, "The shipped Table runtime must contain the universal cell-centering helper.");
assert.match(generatedTable, /tableRow\.appendChild\(tableCenterCellContents\(selectionCell\)\);/, "The shipped runtime must center selection cells with the shared helper.");
assert.match(generatedTable, /tableRow\.appendChild\(tableCenterCellContents\(actionsCell\)\);/, "The shipped runtime must center action cells with the shared helper.");
assert.match(generatedTable, /tableRow\.appendChild\(tableCenterCellContents\(cell\)\);/, "The shipped runtime must center every data cell with the shared helper.");

for (const contentContract of [
  'selectionContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'actionsContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'flagContent.className = "tableControlCellContent tableControlCellContentCentered";',
  'idContent.className = "tableControlCellContent";',
  'ageContent.className = "tableControlCellContent";',
  'nameWrap.className = "playerNameCell";',
  'contentHost.className = "tableOverallCellContent";',
]) {
  assert.ok(generatedTable.includes(contentContract), `Existing specialized row content must remain intact inside the universal host: ${contentContract}`);
}

console.log("Every player-table row item uses one viewport-independent full-height vertical-centering contract.");
