import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sharedTableUi = readFileSync(new URL("./shared-table-ui-runtime.js", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("./bootstrap.js", import.meta.url), "utf8");
const tableSource = readFileSync(new URL("./modules/core-sources/table.js", import.meta.url), "utf8");

const functionStart = sharedTableUi.indexOf("function syncWidthAwareHeaderLabels() {");
const functionEnd = sharedTableUi.indexOf("\n  function syncPlayerTableFadeState", functionStart);

assert.ok(functionStart >= 0 && functionEnd > functionStart, "Responsive table-header label owner must stay discoverable.");
const owner = sharedTableUi.slice(functionStart, functionEnd);

assert.match(
  sharedTableUi,
  /const HEADER_LABEL_COMPACT_MEDIA = window\.matchMedia\("\(max-width: 1366px\)"\);/,
  "Hydrated player-table headers must own one explicit <=1366px compact-label breakpoint.",
);
assert.match(
  bootstrap,
  /const FIRST_PAINT_COMPACT_HEADER_MEDIA = window\.matchMedia\("\(max-width: 1366px\)"\);/,
  "First-paint player-table headers must use the same explicit <=1366px compact-label breakpoint.",
);
assert.match(
  tableSource,
  /const compactTableHeader = window\.matchMedia\("\(max-width: 1366px\)"\)\.matches;/,
  "Rebuilt player-table headers must use the same explicit <=1366px compact-label breakpoint.",
);
assert.match(
  owner,
  /const compactHeader = HEADER_LABEL_COMPACT_MEDIA\.matches;/,
  "Hydrated header synchronization must derive compact mode only from the explicit viewport breakpoint.",
);
assert.match(
  owner,
  /const desired = compactHeader && short \? short : full;/,
  "Every compact-able header must switch together at the fixed breakpoint.",
);
assert.doesNotMatch(
  sharedTableUi,
  /HEADER_LABEL_OVERFLOW_EPSILON/,
  "Header shortening must no longer depend on measured text overflow.",
);
assert.doesNotMatch(
  owner,
  /scrollWidth|clientWidth/,
  "Header shortening must not read layout geometry to decide between full and compact labels.",
);
assert.match(
  owner,
  /if \(mobile && column === "listing_price"\) \{\s*label\.textContent = "";\s*return;\s*\}/,
  "Mobile Listing header must preserve its intentionally icon-only label.",
);

console.log("Responsive table headers use one fixed <=1366px full-to-compact breakpoint across first paint and hydration.");
