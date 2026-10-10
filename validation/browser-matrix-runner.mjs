import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Real Chromium, synthetic fixtures only; Safari, wallet and deployment QA remain separate.
const suites = {
  recovery: {
    scenarios: [
      "ux02-home-zero", "ux02-home-retry", "ux02-search", "ux02-myclubs-empty",
      "ux02-watchlist-zero", "ux02-player-failure", "ux02-club-failure",
    ],
    env: { MFL_UX02_BROWSER_FOCUSED: "1" },
    failure: () => "Recovery browser matrix failed.",
    success: () => "Recovery real-Chromium empty, failure, retry, keyboard-focus and mobile matrix passed.",
  },
  "saved-actions": {
    scenarios: ["planner"],
    env: { MFL_UX03_BROWSER_FOCUSED: "1" },
    viewports: ["desktop", "phone"],
    viewportKey: "MFL_UX03_BROWSER_VIEWPORT",
    failure: (viewport) => "Saved actions Saved Plans browser matrix failed on " + viewport,
    success: (viewport) => "Saved actions Chromium Saved Plans regression passed on " + viewport,
  },
  "filter-state": {
    scenarios: ["database-linked-state", "database-empty", "watchlist-empty"],
    env: { MFL_UX04_BROWSER_FOCUSED: "1" },
    viewports: ["desktop", "phone"],
    viewportKey: "MFL_UX04_BROWSER_VIEWPORT",
    failure: (viewport) => "Filter state linked/empty filter regression failed on " + viewport,
    success: (viewport) => "Filter state linked/empty Chromium regression passed on " + viewport,
  },
  "narrow-reflow": {
    scenarios: [
      "player-resp01-320", "planner-resp01-320", "database-resp01-320",
      "database-resp01-360", "database-resp01-520", "database-resp01-640",
      "database-resp01-900", "database-resp01-901", "database-resp01-landscape",
    ],
    // The focused shell phase must not run desktop pitch-token assertions at 320px.
    env: { MFL_PLANNER_BROWSER_FOCUSED: "1", MFL_PLANNER_BROWSER_PHASE: "shell" },
    failure: () => "Responsive reflow Chromium CSS reflow matrix failed.",
    success: () => "Responsive reflow real Chromium pre-navigation CSS viewport reflow matrix passed.",
  },
};

const name = process.argv[2];
assert.ok(process.argv.length === 3 && Object.hasOwn(suites, name),
  "Specify one browser matrix: recovery, saved-actions, filter-state or narrow-reflow.");
const suite = suites[name];
const directory = dirname(fileURLToPath(import.meta.url));
for (const viewport of suite.viewports ?? [null]) {
  const env = { ...process.env, MFL_BROWSER_SCENARIOS: suite.scenarios.join(","), ...suite.env };
  if (viewport !== null) env[suite.viewportKey] = viewport;
  const code = await new Promise((done, fail) => {
    const child = spawn(process.execPath, [resolve(directory, "browser-routing-regression.mjs")], {
      cwd: resolve(directory, ".."),
      stdio: "inherit",
      env,
    });
    child.once("error", fail);
    child.once("close", done);
  });
  assert.equal(code, 0, suite.failure(viewport));
  console.log(suite.success(viewport));
}
