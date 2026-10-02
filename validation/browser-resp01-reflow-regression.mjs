import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Uses the canonical Next/HTML fixture and a real headless Chromium process.
// CDP device-metrics override is set *before navigation*; --window-size by
// itself may silently clamp the viewport below 500 CSS pixels in Chromium.
// This tests CSS reflow, not real browser page zoom, OS text-only scaling,
// Safari/iPhone touch, or an authenticated Dapper wallet.
const directory = dirname(fileURLToPath(import.meta.url));
const scenarios = [
  "player-resp01-320",
  "planner-resp01-320",
  "database-resp01-320",
  "database-resp01-360",
  "database-resp01-520",
  "database-resp01-640",
  "database-resp01-900",
  "database-resp01-901",
  "database-resp01-landscape",
];

const code = await new Promise((resolveStatus, rejectStatus) => {
  const child = spawn(process.execPath, [resolve(directory, "browser-routing-regression.mjs")], {
    cwd: resolve(directory, ".."),
    stdio: "inherit",
    // Run the existing Planner shell/club-selection smoke at 320px; its full
    // desktop pitch-token pixel tests are enforced separately by Planner CI.
    env: {
      ...process.env,
      MFL_BROWSER_SCENARIOS: scenarios.join(","),
      MFL_PLANNER_BROWSER_FOCUSED: "1",
      MFL_PLANNER_BROWSER_PHASE: "shell",
    },
  });
  child.once("error", rejectStatus);
  child.once("close", resolveStatus);
});
assert.equal(code, 0, "RESP-01 Chromium CSS reflow matrix failed.");
console.log("RESP-01 real Chromium pre-navigation CSS viewport reflow matrix passed.");
