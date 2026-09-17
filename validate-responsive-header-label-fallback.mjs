import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sharedTableUi = readFileSync(new URL("./shared-table-ui-runtime.js", import.meta.url), "utf8");
const functionStart = sharedTableUi.indexOf("function syncWidthAwareHeaderLabels() {");
const functionEnd = sharedTableUi.indexOf("\n  function syncPlayerTableFadeState", functionStart);

assert.ok(functionStart >= 0 && functionEnd > functionStart, "Responsive table-header label owner must stay discoverable.");
const owner = sharedTableUi.slice(functionStart, functionEnd);

assert.match(
  sharedTableUi,
  /const HEADER_LABEL_OVERFLOW_EPSILON = 1;/,
  "Header label fallback must use one small shared overflow tolerance.",
);
assert.match(
  owner,
  /document\.querySelectorAll\("#progressionPage #tableHead \[data-mfl-full-table-label\]\[data-mfl-compact-table-label\]"\)/,
  "Header label fallback must target both direct labels and labels nested inside sortable header buttons.",
);
assert.match(
  owner,
  /label\.textContent = full;/,
  "Intermediate/desktop headers must try their full label before deciding whether fallback is needed.",
);
assert.match(
  owner,
  /const fullOverflows = label\.scrollWidth - label\.clientWidth > HEADER_LABEL_OVERFLOW_EPSILON;/,
  "Header fallback must be driven by the rendered label's real overflow rather than by a hard-coded desktop breakpoint.",
);
assert.match(
  owner,
  /if \(fullOverflows && short && short !== full\) label\.textContent = short;/,
  "Any full header label that would ellipsize must switch to its existing compact/mobile label.",
);
assert.match(
  owner,
  /if \(mobile && column === "listing_price"\) \{\s*label\.textContent = "";\s*return;\s*\}/,
  "Mobile Listing header must preserve its intentionally icon-only label.",
);
assert.match(
  owner,
  /if \(mobile && short\) \{\s*label\.textContent = short;\s*return;\s*\}/,
  "Mobile headers must continue to use compact labels directly.",
);

console.log("Responsive table-header full-to-compact fallback validation passed.");
