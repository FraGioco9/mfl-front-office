import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectionSource = readFileSync(resolve(root, "sync-release-projections.mjs"), "utf8");
const sharedTableUiSource = readFileSync(resolve(root, "shared-table-ui-runtime.js"), "utf8");
const stylesSource = readFileSync(resolve(root, "styles.css"), "utf8");

for (const [breakpoint, fontSize] of [[900, 12], [520, 11], [380, 10]]) {
  assert.match(
    projectionSource,
    new RegExp(`@media \\(max-width: ${breakpoint}px\\)[\\s\\S]*#progressionPage \\.playerTableScroller th \\{ font-size: ${fontSize}px; \\}`),
    `First paint must size the complete table header cell to ${fontSize}px at <=${breakpoint}px, not only its label span.`,
  );
  assert.match(
    sharedTableUiSource,
    new RegExp(`@media \\(max-width: ${breakpoint}px\\)[\\s\\S]*#progressionPage \\.playerTableScroller th \\{[\\s\\S]*font-size: ${fontSize}px;`),
    `Hydrated table headers must retain the same ${fontSize}px cell font metric at <=${breakpoint}px.`,
  );
}

assert.match(
  stylesSource,
  /#progressionPage \.playerTableScroller th \{\s*height: var\(--mfl-table-header-height\);\s*min-height: var\(--mfl-table-header-height\);\s*line-height: var\(--mfl-table-header-height\);\s*\}/,
  "Canonical table CSS must own header height, minimum height, and line height for both first paint and hydration.",
);

assert.doesNotMatch(
  projectionSource,
  /#progressionPage #tableHead > tr(?: > th)? \{[^}]*height:/,
  "First paint must not add temporary header geometry rules that disappear when the shared mobile style is hydrated.",
);

console.log("Mobile header first-paint metric validation passed.");
