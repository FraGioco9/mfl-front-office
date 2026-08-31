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
const mobileRowBoost = 1.08;
const close = (actual, expected, tolerance = 1e-12) => Math.abs(actual - expected) <= tolerance;
const tablet = Object.freeze({ width: 820, inset: 24, header: 18.72596153846154, row: 18.09519230769231, outer: 20.75625 });
const fixed = Object.freeze([
  Object.freeze({ breakpoint: 520, width: 680, header: 15.528846153846153, row: 19, outer: 22, control: 13 }),
  Object.freeze({ breakpoint: 380, width: 600, header: 13.701923076923077, row: 18, outer: 21, control: 12 }),
]);
const sources = Object.freeze([["hydrated", shared], ["first-paint generator", projection], ["generated first-paint", index]]);
const tabletDeclarations = Object.freeze([
  "--mfl-table-header-height: max(18.72596153846154px, calc(2.2836538461538463vw - 0.5480769230769231px));",
  "--mfl-table-row-height: max(18.09519230769231px, calc(2.2067307692307696vw - 0.5296153846153846px));",
  "--mfl-table-row-outer-height: max(20.75625px, calc(2.53125vw - 0.6075px));",
]);

assert.ok(mobileRowBoost > 1 && mobileRowBoost < 1.1, "Mobile row boost must remain slight rather than redefining the layout.");
assert.match(styles, /--mfl-table-header-height: 38px;/);
assert.match(styles, /--mfl-table-row-height: 34px;/);
assert.match(styles, /--mfl-table-row-outer-height: 39px;/);
assert.match(styles, /--mfl-table-col-listing: 6\.3904569176696135%;/);
assert.match(styles, /--mfl-table-col-positions: 7\.508786878261796%;/);

const tabletScale = tablet.width / desktop.width;
assert.ok(close(tablet.header / desktop.header, tabletScale));
assert.ok(close(tablet.row / desktop.row, tabletScale * mobileRowBoost));
assert.ok(close(tablet.outer / desktop.outer, tabletScale * mobileRowBoost));
for (const [name, source] of sources) {
  for (const declaration of tabletDeclarations) assert.ok(source.includes(declaration), `${name} missing width-aware tablet geometry: ${declaration}`);
  assert.ok(source.includes("min-width: 820px;"), `${name} missing tablet minimum table width.`);
}

const viewport = 900;
const renderedWidth = viewport - tablet.inset;
const renderedScale = renderedWidth / desktop.width;
assert.ok(close((2.2836538461538463 * viewport / 100) - 0.5480769230769231, desktop.header * renderedScale));
assert.ok(close((2.2067307692307696 * viewport / 100) - 0.5296153846153846, desktop.row * renderedScale * mobileRowBoost));
assert.ok(close((2.53125 * viewport / 100) - 0.6075, desktop.outer * renderedScale * mobileRowBoost));

for (const geometry of fixed) {
  const scale = geometry.width / desktop.width;
  assert.ok(close(geometry.header / desktop.header, scale), `<=${geometry.breakpoint}px header/table scale mismatch.`);
  assert.ok(geometry.row / desktop.row > scale * mobileRowBoost, `<=${geometry.breakpoint}px row must be taller than the tablet-proportional mobile row.`);
  assert.ok(geometry.outer / desktop.outer > scale * mobileRowBoost, `<=${geometry.breakpoint}px outer row must be taller than the tablet-proportional mobile row.`);
  assert.ok(geometry.control <= geometry.row, `<=${geometry.breakpoint}px fixed controls must fit within row content.`);
  for (const [name, source] of sources) {
    assert.ok(source.includes(`--mfl-table-header-height: ${geometry.header}px;`), `${name} missing <=${geometry.breakpoint}px header.`);
    assert.ok(source.includes(`--mfl-table-row-height: ${geometry.row}px;`), `${name} missing <=${geometry.breakpoint}px row.`);
    assert.ok(source.includes(`--mfl-table-row-outer-height: ${geometry.outer}px;`), `${name} missing <=${geometry.breakpoint}px outer row.`);
    assert.ok(source.includes(`min-width: ${geometry.width}px;`), `${name} missing <=${geometry.breakpoint}px table width.`);
  }
}

for (const [name, source] of sources) {
  assert.ok(source.includes("--mfl-table-col-name: 12%;"), `${name} missing compact Name width.`);
  assert.ok(source.includes("--mfl-table-col-listing: 4%;"), `${name} missing compact Listing width.`);
  assert.ok(source.includes("--mfl-table-col-positions: 12.41623176057088%;"), `${name} missing expanded compact Positions width.`);
}
assert.doesNotMatch(shared, /style\.setProperty\("--mfl-table-col-(?:name|listing|positions)"/, "Hydration must not imperatively rebalance responsive column widths.");
assert.match(shared, /overflow-x: auto;\n {4}overflow-y: hidden;/);
assert.match(styles, /#progressionPage \.playerTableScroller col\.col-name \{ width: var\(--mfl-table-col-name\); \}/);
assert.match(styles, /#progressionPage \.playerTableScroller th \{\n {2}height: var\(--mfl-table-header-height\);/);
assert.match(styles, /#progressionPage \.playerTableScroller td \{\n {2}height: var\(--mfl-table-row-outer-height\);/);
assert.match(styles, /padding-block: calc\(\(var\(--mfl-table-row-outer-height\) - var\(--mfl-table-row-height\) - 1px\) \/ 2\);/);
assert.doesNotMatch(shared, /!important/);
console.log("Responsive player-table headers preserve desktop scale while compact rows are intentionally taller and Name/Listing space is reallocated to Positions across first paint and hydration.");
