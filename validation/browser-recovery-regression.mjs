import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const scenarios = [
  "ux02-home-zero",
  "ux02-home-retry",
  "ux02-search",
  "ux02-myclubs-empty",
  "ux02-watchlist-zero",
  "ux02-player-failure",
  "ux02-club-failure",
];
const status = await new Promise((resolveStatus, rejectStatus) => {
  const child = spawn(process.execPath, [resolve(currentDir, "browser-routing-regression.mjs")], {
    cwd: resolve(currentDir, ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      MFL_UX02_BROWSER_FOCUSED: "1",
      MFL_BROWSER_SCENARIOS: scenarios.join(","),
    },
  });
  child.once("error", rejectStatus);
  child.once("close", resolveStatus);
});
assert.equal(status, 0, "Recovery browser matrix failed.");
console.log("Recovery real-Chromium empty, failure, retry, keyboard-focus and mobile matrix passed.");
