import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const routing = read("./validation/browser-routing-regression.mjs");
const browser = read("./validation/browser-resp01-reflow-regression.mjs");
const workflow = read("./.github/workflows/site-quality.yml");
const docs = read("./docs/responsive-reflow-1034.md");

for (const width of [320, 360, 520, 640, 900, 901]) {
  assert.ok(routing.includes(`"/database/attributes#resp01-${width}"`),
    `RESP-01 Chromium layout viewport missing: ${width}px`);
  assert.ok(browser.includes(`"database-resp01-${width}"`),
    `RESP-01 browser runner does not exercise ${width}px`);
}
for (const scenario of ["database-resp01-landscape", "player-resp01-320", "planner-resp01-320"]) {
  assert.ok(routing.includes(`"${scenario}"`) && browser.includes(`"${scenario}"`),
    `RESP-01 missing content route: ${scenario}`);
}
assert.ok(routing.includes('reflowMatrix ? "about:blank" : url')
  && routing.includes('"Emulation.setDeviceMetricsOverride"')
  && routing.includes('"Page.navigate", { url }'),
  "Narrow CSS viewports must be emulated before loading first-paint CSS, not after hydration.");
assert.ok(routing.includes("window.innerWidth === expected")
  && routing.includes("viewportWidth === expected"),
  "Never let headless Chromium silently clamp the 320px/360px test widths.");
assert.ok(browser.includes('MFL_PLANNER_BROWSER_FOCUSED: "1"')
  && browser.includes('MFL_PLANNER_BROWSER_PHASE: "shell"'),
  "320px Planner reflow must use the focused shell/club selection test rather than desktop pitch size tests.");
assert.ok(workflow.includes("node validation/browser-resp01-reflow-regression.mjs"),
  "RESP-01 CSS reflow suite must be enforced by Site Quality.");
assert.ok(docs.includes("real browser zoom") && docs.includes("text-only scaling"),
  "Do not mistake CSS viewport equivalence for genuine zoom/text-only coverage.");
console.log("RESP-01 source ownership, matrix, pre-navigation metrics, CI and test limitations verified.");
