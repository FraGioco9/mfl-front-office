import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectionSource = readFileSync(resolve(root, "sync-release-projections.mjs"), "utf8");
const sharedTableUiSource = readFileSync(resolve(root, "shared-table-ui-runtime.js"), "utf8");
const stylesSource = readFileSync(resolve(root, "styles.css"), "utf8");

for (const [breakpoint, headerSize, rowSize] of [[900, 10, 12], [520, 9, 11], [380, 8, 10]]) {
  assert.match(
    projectionSource,
    new RegExp(`@media \\(max-width: ${breakpoint}px\\)[\\s\\S]*#progressionPage \\.playerTableScroller th \\{ font-size: ${headerSize}px; \\}`),
    `First paint must size the complete table header cell to ${headerSize}px against ${rowSize}px rows at <=${breakpoint}px, not only its label span.`,
  );
  assert.match(
    sharedTableUiSource,
    new RegExp(`@media \\(max-width: ${breakpoint}px\\)[\\s\\S]*#progressionPage \\.playerTableScroller th \\{[\\s\\S]*font-size: ${headerSize}px;`),
    `Hydrated table headers must retain the ${headerSize}px cell font metric against ${rowSize}px rows at <=${breakpoint}px.`,
  );
}

assert.match(
  stylesSource,
  /#progressionPage \.playerTableScroller th \{\s*height: var\(--mfl-table-header-height\);\s*min-height: var\(--mfl-table-header-height\);\s*line-height: 1\.2;\s*vertical-align: middle;\s*\}/,
  "Canonical table CSS must own header height and native middle alignment without using the full header height as text line-height.",
);
assert.match(
  stylesSource,
  /#progressionPage #tableHead \.tableHeaderCellContent \{[\s\S]*?display: flex;[\s\S]*?align-items: center;[\s\S]*?height: var\(--mfl-table-header-height\);/,
  "Header labels, arrows, and controls must share one full-height flex centering host.",
);

assert.doesNotMatch(
  projectionSource,
  /#progressionPage #tableHead > tr(?: > th)? \{[^}]*height:/,
  "First paint must not add temporary header geometry rules that disappear when the shared mobile style is hydrated.",
);

console.log("Mobile header first-paint metric validation passed.");
