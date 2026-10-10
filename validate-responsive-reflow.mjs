import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const routing = read("./validation/browser-routing-regression.mjs");
const browser = read("./validation/browser-matrix-runner.mjs");
const workflow = read("./.github/workflows/site-quality.yml");

for (const width of [320, 360, 520, 640, 900, 901]) {
  assert.ok(routing.includes(`"/database/attributes#resp01-${width}"`),
    `Responsive reflow Chromium layout viewport missing: ${width}px`);
  assert.ok(browser.includes(`"database-resp01-${width}"`),
    `Responsive reflow browser runner does not exercise ${width}px`);
}
for (const scenario of ["database-resp01-landscape", "player-resp01-320", "planner-resp01-320"]) {
  assert.ok(routing.includes(`"${scenario}"`) && browser.includes(`"${scenario}"`),
    `Responsive reflow missing content route: ${scenario}`);
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
assert.ok(workflow.includes("node validation/browser-matrix-runner.mjs narrow-reflow"),
  "Responsive reflow CSS reflow suite must be enforced by Site Quality.");
console.log("Responsive reflow source ownership, matrix, pre-navigation metrics and CI coverage verified.");
