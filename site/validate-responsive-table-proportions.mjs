import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(root, name), "utf8");
const styles = read("styles.css");
const shared = read("shared-table-ui-runtime.js");
const projection = read("sync-release-projections.mjs");
const index = read("index.html");
const desktop = Object.freeze({ width: 1664, header: 38, row: 34, outer: 39 });
const close = (actual, expected, tolerance = 1e-12) => Math.abs(actual - expected) <= tolerance;
const tablet = Object.freeze({ width: 820, inset: 24, header: 18.72596153846154, row: 16.754807692307693, outer: 19.21875 });
const fixed = Object.freeze([
  Object.freeze({ breakpoint: 520, width: 680, header: 15.528846153846153, row: 13.89423076923077, outer: 15.9375, control: 13 }),
  Object.freeze({ breakpoint: 380, width: 600, header: 13.701923076923077, row: 12.259615384615385, outer: 14.0625, control: 12 }),
]);
const sources = Object.freeze([["hydrated", shared], ["first-paint generator", projection], ["generated first-paint", index]]);
const tabletDeclarations = Object.freeze([
  "--mfl-table-header-height: max(18.72596153846154px, calc(2.2836538461538463vw - 0.5480769230769231px));",
  "--mfl-table-row-height: max(16.754807692307693px, calc(2.043269230769231vw - 0.49038461538461536px));",
  "--mfl-table-row-outer-height: max(19.21875px, calc(2.34375vw - 0.5625px));",
]);

assert.match(styles, /--mfl-table-header-height: 38px;/);
assert.match(styles, /--mfl-table-row-height: 34px;/);
assert.match(styles, /--mfl-table-row-outer-height: 39px;/);
assert.match(styles, /--mfl-table-col-listing: 6\.3904569176696135%;/);
assert.match(styles, /--mfl-table-col-positions: 7\.508786878261796%;/);

const tabletScale = tablet.width / desktop.width;
assert.ok(close(tablet.header / desktop.header, tabletScale));
assert.ok(close(tablet.row / desktop.row, tabletScale));
assert.ok(close(tablet.outer / desktop.outer, tabletScale));
for (const [name, source] of sources) {
  for (const declaration of tabletDeclarations) assert.ok(source.includes(declaration), `${name} missing width-aware tablet geometry: ${declaration}`);
  assert.ok(source.includes("min-width: 820px;"), `${name} missing tablet minimum table width.`);
}

const viewport = 900;
const renderedWidth = viewport - tablet.inset;
const renderedScale = renderedWidth / desktop.width;
assert.ok(close((2.2836538461538463 * viewport / 100) - 0.5480769230769231, desktop.header * renderedScale));
assert.ok(close((2.043269230769231 * viewport / 100) - 0.49038461538461536, desktop.row * renderedScale));
assert.ok(close((2.34375 * viewport / 100) - 0.5625, desktop.outer * renderedScale));

for (const geometry of fixed) {
  const scale = geometry.width / desktop.width;
  assert.ok(close(geometry.header / desktop.header, scale), `<=${geometry.breakpoint}px header/table scale mismatch.`);
  assert.ok(close(geometry.row / desktop.row, scale), `<=${geometry.breakpoint}px cell/table scale mismatch.`);
  assert.ok(close(geometry.outer / desktop.outer, scale), `<=${geometry.breakpoint}px outer-row/table scale mismatch.`);
  assert.ok(geometry.control <= geometry.row, `<=${geometry.breakpoint}px fixed controls must fit within row content.`);
  for (const [name, source] of sources) {
    assert.ok(source.includes(`--mfl-table-header-height: ${geometry.header}px;`), `${name} missing <=${geometry.breakpoint}px header.`);
    assert.ok(source.includes(`--mfl-table-row-height: ${geometry.row}px;`), `${name} missing <=${geometry.breakpoint}px row.`);
    assert.ok(source.includes(`--mfl-table-row-outer-height: ${geometry.outer}px;`), `${name} missing <=${geometry.breakpoint}px outer row.`);
    assert.ok(source.includes(`min-width: ${geometry.width}px;`), `${name} missing <=${geometry.breakpoint}px table width.`);
  }
}

assert.doesNotMatch(shared, /--mfl-table-col-(?:listing|positions)\s*:/, "Hydrated mobile CSS must not alter desktop column percentages.");
assert.doesNotMatch(shared, /style\.setProperty\("--mfl-table-col-(?:listing|positions)"/, "Hydration must not rebalance canonical Listing or Positions percentages.");
assert.doesNotMatch(projection, /--mfl-table-col-(?:listing|positions)\s*:/, "First-paint projection must not alter desktop column percentages.");
assert.doesNotMatch(index, /--mfl-table-col-listing:\s*(?:4\.2|3\.8|3\.6)%|--mfl-table-col-positions:\s*(?:9\.699243795931409|10\.099243795931411|10\.29924379593141)%/);
assert.match(shared, /overflow-x: auto;\n {4}overflow-y: hidden;/);
assert.match(styles, /#progressionPage \.playerTableScroller col\.col-name \{ width: var\(--mfl-table-col-name\); \}/);
assert.match(styles, /#progressionPage \.playerTableScroller th \{\n {2}height: var\(--mfl-table-header-height\);/);
assert.match(styles, /#progressionPage \.playerTableScroller td \{\n {2}height: var\(--mfl-table-row-height\);/);
assert.doesNotMatch(shared, /!important/);
console.log("Responsive player-table dimensions preserve desktop proportions across first paint and hydration.");
