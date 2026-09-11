import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n?/g, "\n");
const styles = read("styles.css");
const base = read("styles-base.css");
const docs = read("../docs/ui-foundations.md");

// Table visual semantics and standard desktop geometry stay Table-owned; responsive/specialist geometry remains independent.
for (const token of [
  "--mfl-table-surface: var(--surface);",
  "--mfl-table-border-color: var(--border);",
  "--mfl-table-radius: 8px;",
  "--mfl-table-header-background: var(--header-bg);",
  "--mfl-table-header-text-color: var(--text);",
  "--mfl-table-sort-hover-background: var(--surface-muted);",
  "--mfl-table-row-hover-background: var(--row-hover);",
  "--mfl-table-header-font-size: 12px;",
  "--mfl-table-row-font-size: 14px;",
  "--mfl-table-cell-padding-inline: 6px;",
  "--mfl-table-header-height: 38px;",
  "--mfl-table-row-height: 34px;",
  "--mfl-table-row-outer-height: 39px;",
]) {
  assert.ok(styles.includes(token), `Missing canonical Table-domain foundation: ${token}`);
}

for (const expected of [
  ".tableShell {\n  position: relative;\n  background: var(--mfl-table-surface);\n  border: 1px solid var(--mfl-table-border-color);\n  border-radius: var(--mfl-table-radius);",
  "th,\ntd {\n  cursor: default;\n  user-select: none;\n  height: var(--mfl-table-header-height);\n  border-bottom: 1px solid var(--mfl-table-border-color);\n  padding: 0 var(--mfl-table-cell-padding-inline);",
  "td {\n  font-size: var(--mfl-table-row-font-size);\n}",
  "th {\n  background: var(--mfl-table-header-background);\n  color: var(--mfl-table-header-text-color);\n  font-size: var(--mfl-table-header-font-size);",
  "th.sortable:hover {\n  background: var(--mfl-table-sort-hover-background);\n}",
  "#tableBody tr.tableRowHovered > td,\n#tableBody tr.tableRowHovered > th {\n  background: var(--mfl-table-row-hover-background);\n  background-image: linear-gradient(var(--mfl-table-row-hover-background), var(--mfl-table-row-hover-background));",
]) {
  assert.ok(base.includes(expected), `Shared table styling must consume its Table-domain foundation: ${expected}`);
}

assert.ok(
  base.includes("#tableBody .playerNameCell {\n  min-height: var(--mfl-table-header-height);\n  align-items: center;")
    && styles.includes("#progressionPage .playerTableScroller th {\n  height: var(--mfl-table-header-height);\n  min-height: var(--mfl-table-header-height);\n  line-height: var(--mfl-table-header-height);")
    && styles.includes("#progressionPage .playerTableScroller tbody > tr {\n  height: var(--mfl-table-row-outer-height);\n}")
    && styles.includes("#progressionPage .playerTableScroller td {\n  height: var(--mfl-table-row-height);\n  min-height: var(--mfl-table-row-height);\n  line-height: var(--mfl-table-row-height);")
    && styles.includes("#tableBody > .mflTableLoadingRow > td {\n  padding-top: 0;\n  padding-bottom: 0;")
    && !styles.includes("#tableBody > .mflTableLoadingRow > td {\n  height:"),
  "Base, populated, and loading player-table cells must inherit the canonical Table-domain geometry instead of owning duplicate measurements.",
);

assert.ok(
  base.includes(".advancedPlayerTable {\n  position: relative;\n  z-index: 1;\n  overflow: visible;\n  border: 1px solid var(--mfl-table-border-color);\n  border-radius: var(--mfl-table-radius);")
    && base.includes("background: var(--mfl-table-surface);\n  font-size: 12px;\n  isolation: isolate;")
    && base.includes(".advancedPlayerTable th,\n.advancedPlayerTable td {\n  height: 32px;\n  vertical-align: middle;\n  padding: 4px 5px;\n  border-bottom: 1px solid var(--mfl-table-border-color);")
    && base.includes(".advancedPlayerTable th {\n  background: var(--mfl-table-header-background);\n  color: var(--mfl-table-header-text-color);\n  font-size: inherit;"),
  "Advanced Settings tables must share equivalent surface/header/divider foundations without inheriting ordinary table typography.",
);

assert.ok(
  base.includes(".advancedPlayerTable tbody tr:hover td:hover,\n.advancedPlayerTable tbody td:hover {\n  background-color: var(--contracts-cell-hover);")
    && !base.includes(".advancedPlayerTable tbody td:hover {\n  background-color: var(--mfl-table-row-hover-background);"),
  "Advanced Settings cell hover must remain specialist-owned.",
);

assert.ok(
  styles.includes("#progressionPage .playerTableScroller th.col-name {\n    z-index: 6;\n    background: var(--mfl-table-header-background);")
    && styles.includes("background: var(--mfl-table-surface);\n    background-image: linear-gradient(var(--mfl-table-surface), var(--mfl-table-surface));")
    && styles.includes("background: var(--mfl-table-row-hover-background);\n    background-image: linear-gradient(var(--mfl-table-row-hover-background), var(--mfl-table-row-hover-background));"),
  "Mobile sticky Name cells must consume the same Table-domain surface/header/row-hover language.",
);

for (const forbidden of [
  ".tableShell {\n  position: relative;\n  background: var(--surface);",
  "th.sortable:hover {\n  background: var(--surface-muted);",
  "#tableBody tr.tableRowHovered > td,\n#tableBody tr.tableRowHovered > th {\n  background: var(--row-hover);",
]) {
  assert.ok(!base.includes(forbidden), `Migrated table role must not drift back to a raw theme primitive: ${forbidden}`);
}

assert.ok(
  styles.includes("/* Uniform Width. This is the only numeric column-width contract. */"),
  "Uniform Width must remain the sole numeric player-table column-width contract.",
);
assert.ok(
  styles.includes("--mfl-table-col-name:") && styles.includes("--mfl-table-col-stat:"),
  "Table foundation migration must preserve canonical Uniform Width columns.",
);

for (const phrase of [
  "Table visual foundations, geometry, and Uniform Width",
  "--mfl-table-surface",
  "--mfl-table-header-background",
  "--mfl-table-row-hover-background",
  "Responsive table typography and geometry remain in the responsive owner",
]) {
  assert.ok(docs.includes(phrase), `UI foundation documentation is missing the Table-domain boundary: ${phrase}`);
}

console.log("Shared table surfaces, standard desktop cell geometry, headers, dividers, hover states, typography, and loading inheritance use canonical Table-domain foundations while responsive/specialist geometry remains independent.");
