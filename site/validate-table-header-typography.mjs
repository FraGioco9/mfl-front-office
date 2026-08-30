import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");

const base = read("styles-base.css");
const responsive = read("responsive.css");
const sharedRuntime = read("shared-table-ui-runtime.js");
const projections = read("sync-release-projections.mjs");

assert.ok(
  base.includes("th {\n  background: var(--header-bg);\n  color: var(--text);\n  font-size: 12px;")
    && base.includes("td {\n  font-size: 14px;\n}"),
  "Shared desktop tables must keep 12px headers against 14px row text.",
);

assert.ok(
  base.includes("background: var(--surface);\n  font-size: 12px;\n  isolation: isolate;")
    && base.includes(".advancedPlayerTable th {\n  background: var(--header-bg);\n  color: var(--text);\n  font-size: inherit;")
    && base.includes(".advancedPlayerTable thead th {\n  position: sticky;\n  font-size: 10px;"),
  "Advanced desktop tables must use 10px column headers against 12px rows while row-header cells inherit row typography.",
);

for (const [header, row] of [[10, 12], [9, 11], [8, 10]]) {
  assert.ok(
    responsive.includes(`#progressionPage .playerTableScroller th {\n    font-size: ${header}px;\n  }`)
      && responsive.includes(`#progressionPage .playerTableScroller td {\n    font-size: ${row}px;`),
    `Responsive player tables must use ${header}px headers against ${row}px rows.`,
  );
  assert.ok(
    sharedRuntime.includes(`#progressionPage .playerTableScroller th {\n    font-size: ${header}px;\n  }`),
    `Hydrated player tables must preserve ${header}px header text.`,
  );
  assert.ok(
    projections.includes(`#progressionPage .playerTableScroller th { font-size: ${header}px; }`),
    `First-paint player tables must start with ${header}px header text.`,
  );
}

assert.ok(
  responsive.includes(".advancedPlayerTable {\n    min-width: 680px;\n    font-size: 11px;\n  }\n\n  .advancedPlayerTable thead th {\n    font-size: 9px;")
    && responsive.includes(".advancedPlayerTable {\n    min-width: 560px;\n    font-size: 10px;\n  }\n\n  .advancedPlayerTable thead th {\n    font-size: 8px;"),
  "Advanced responsive tables must keep headers two pixels smaller than row text.",
);

console.log("Table headers remain two pixels smaller than row text across shared, advanced, hydrated, and first-paint table variants.");
