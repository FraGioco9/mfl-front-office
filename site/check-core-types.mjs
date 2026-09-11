import { spawnSync } from "node:child_process";
import process from "node:process";

const BASELINE = Object.freeze({
  "modules/core-sources/club.js:TS2339": 24,
  "modules/core-sources/club.js:TS2551": 2,
  "modules/core-sources/club.js:TS2630": 1,
  "modules/core-sources/evaluation.js:TS2322": 1,
  "modules/core-sources/evaluation.js:TS2339": 77,
  "modules/core-sources/evaluation.js:TS2551": 6,
  "modules/core-sources/mfl-stats.js:TS2339": 11,
  "modules/core-sources/player.js:TS2339": 40,
  "modules/core-sources/player.js:TS2551": 1,
  "modules/core-sources/settings.js:TS2339": 56,
  "modules/core-sources/settings.js:TS2551": 1,
  "modules/core-sources/shared-foundations.js:TS2339": 1,
  "modules/core-sources/shared-session.js:TS2339": 24,
  "modules/core-sources/shared-session.js:TS2554": 1,
  "modules/core-sources/shared-routing.js:TS2339": 9,
  "modules/core-sources/shared-routing.js:TS2551": 1,
  "modules/core-sources/shared-transitions.js:TS2339": 6,
  "modules/core-sources/shared-page-lifecycle.js:TS2304": 8,
  "modules/core-sources/shared-page-lifecycle.js:TS2339": 30,
  "modules/core-sources/shared-page-lifecycle.js:TS2552": 1,
  "modules/core-sources/shared-table-state.js:TS2339": 4,
  "modules/core-sources/shared-table-state.js:TS2554": 1,
  "modules/core-sources/shared-personal-state.js:TS2339": 31,
  "modules/core-sources/shared-personal-state.js:TS2554": 3,
  "modules/core-sources/shared-data-search.js:TS2339": 4,
  "modules/core-sources/shared-evaluation-lifecycle.js:TS2339": 37,
  "modules/core-sources/shared-evaluation-lifecycle.js:TS2551": 1,
  "modules/core-sources/shared-player-first-paint.js:TS2339": 2,
  "modules/core-sources/shared-player-actions.js:TS2551": 1,
  "modules/core-sources/shared-global-search.js:TS2304": 1,
  "modules/core-sources/shared-global-search.js:TS2339": 12,
  "modules/core-sources/shared-incremental-routing.js:TS2339": 10,
  "modules/core-sources/shared-incremental-routing.js:TS2551": 1,
  "modules/core-sources/shared-incremental-routing.js:TS2554": 1,
  "modules/core-sources/shared-interaction-bindings.js:TS2339": 28,
  "modules/core-sources/shared-interaction-bindings.js:TS2345": 4,
  "modules/core-sources/shared-startup-lifecycle.js:TS2339": 4,
  "modules/core-sources/shared-layout-center.js:TS2339": 2,
  "modules/core-sources/shared-incremental-navigation.js:TS2339": 42,
  "modules/core-sources/shared-incremental-navigation.js:TS2551": 2,
  "modules/core-sources/shared-incremental-navigation.js:TS2554": 2,
  "modules/core-sources/shared-route-runtime-gate.js:TS2339": 21,
  "modules/core-sources/shared-core-contracts.js:TS2339": 9,
  "modules/core-sources/shared-core-contracts.js:TS2630": 7,
  "modules/core-sources/shared-app-startup.js:TS2339": 4,
  "modules/core-sources/shared-shell-navigation.js:TS2339": 71,
  "modules/core-sources/shared-shell-navigation.js:TS2630": 23,
  "modules/core-sources/table-interaction-bindings.js:TS2339": 7,
  "modules/core-sources/table-render-lifecycle.js:TS2339": 7,
  "modules/core-sources/table.js:TS2339": 62,
  "modules/core-sources/table.js:TS2551": 1,
  "modules/core-sources/wallet.js:TS2339": 6,
  "modules/core-sources/watchlist.js:TS2339": 10,
});

const tscCommand = process.platform === "win32" ? "tsc.cmd" : "tsc";
const result = spawnSync(tscCommand, ["-p", "jsconfig.core.json", "--noEmit", "--pretty", "false"], {
  cwd: process.cwd(),
  encoding: "utf8",
  windowsHide: true,
});

if (result.error) throw result.error;
const output = `${result.stdout || ""}\n${result.stderr || ""}`;
const counts = Object.create(null);
const unexpectedDiagnostics = [];
let total = 0;
for (const line of output.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed.includes("error TS")) continue;
  const match = /^(modules\/core-sources\/[^(:]+\.js)\(\d+,\d+\): error TS(\d+):/.exec(trimmed);
  if (!match) {
    unexpectedDiagnostics.push(trimmed);
    continue;
  }
  total += 1;
  const key = `${match[1]}:TS${match[2]}`;
  counts[key] = (counts[key] || 0) + 1;
}

if (unexpectedDiagnostics.length) {
  throw new Error(`Canonical core TypeScript produced diagnostics outside the tracked source buckets:\n${unexpectedDiagnostics.join("\n")}`);
}
if (result.status === 0 && total === 0) {
  console.log("Canonical core TypeScript check passed without diagnostics.");
  process.exit(0);
}
if (!total) {
  process.stderr.write(output);
  throw new Error(`Canonical core TypeScript process failed with status ${result.status} without parseable diagnostics.`);
}

const regressions = [];
for (const [key, count] of Object.entries(counts)) {
  const allowed = BASELINE[key] || 0;
  if (count > allowed) regressions.push(`${key}: ${count} > ${allowed}`);
}
if (regressions.length) {
  throw new Error(`Canonical core TypeScript diagnostic baseline regressed:\n${regressions.join("\n")}`);
}

const baselineTotal = Object.values(BASELINE).reduce((sum, count) => sum + count, 0);
console.log(`Canonical core TypeScript regression check passed: ${total}/${baselineTotal} diagnostics remain; no bucket increased.`);
