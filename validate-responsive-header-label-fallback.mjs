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
  /const labels = Array\.from\(document\.querySelectorAll\("#progressionPage #tableHead \[data-mfl-full-table-label\]\[data-mfl-compact-table-label\]"\)\)/,
  "Header label fallback must collect both direct labels and labels nested inside sortable header buttons as one set.",
);
assert.match(
  owner,
  /labels\.forEach\(\(label\) => \{[\s\S]*?label\.textContent = full;[\s\S]*?\}\);/,
  "Intermediate/desktop headers must all try their full labels before overflow is evaluated.",
);
assert.match(
  owner,
  /const useCompact = labels\.some\(\(label\) => \{[\s\S]*?label\.scrollWidth - label\.clientWidth > HEADER_LABEL_OVERFLOW_EPSILON;[\s\S]*?\}\);/,
  "One shared compact-mode decision must be driven by whether any rendered full header label overflows.",
);
assert.match(
  owner,
  /labels\.forEach\(\(label\) => \{[\s\S]*?const desired = useCompact && short \? short : full;[\s\S]*?label\.textContent = desired;[\s\S]*?\}\);/,
  "If any header needs shortening, every header with a compact label must switch together instead of mixing full and compact names.",
);
assert.doesNotMatch(
  owner,
  /if \(fullOverflows && short && short !== full\) label\.textContent = short;/,
  "Header fallback must not shorten columns independently anymore.",
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

console.log("Responsive table-header grouped full-to-compact fallback validation passed.");
