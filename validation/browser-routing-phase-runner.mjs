import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
assert.ok(process.argv.length === 3 && ["broad", "planner", "mobile"].includes(mode),
  "Specify one browser routing phase: broad, planner or mobile.");
const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, {
  broad: ".browser-routing-responsive-shell.tmp.mjs",
  planner: ".browser-planner-regression.tmp.mjs",
  mobile: ".browser-mobile-route-coverage.tmp.mjs",
}[mode]);
let diagnosticSource = await readFile(sourcePath, "utf8");

if (mode === "broad") {
  const compactShellContract = 'if (viewportWidth <= 1366 && selector.startsWith(".stats")) {';
  assert.equal(diagnosticSource.split(compactShellContract).length - 1, 1,
    "Broad routing regression must consume exactly one canonical compact-shell breakpoint contract.");
}
if (mode === "mobile") {
  const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
  assert.match(diagnosticSource, scenariosPattern, "Browser routing scenario list must remain discoverable.");
  diagnosticSource = diagnosticSource.replace(
    scenariosPattern,
    `const regressionScenarios = Object.freeze([
  ["database-phone", "/database/attributes", 520, 844],
  ["database-compact-380", "/database/attributes", 380, 800],
  ["database-compact-360", "/database/attributes", 360, 780],
  ["watchlist-phone", "/watchlist/browser1/current-season", 520, 844],
  ["watchlist-compact-380", "/watchlist/browser1/current-season", 380, 800],
  ["watchlist-compact-360", "/watchlist/browser1/current-season", 360, 780],
]);

const server =`,
  );
}

await writeFile(temporaryPath, diagnosticSource, "utf8");
async function runPhase(env, failureMessage) {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const options = { cwd: resolve(validationDirectory, ".."), stdio: "inherit" };
    if (env) options.env = env;
    const child = spawn(process.execPath, [temporaryPath], options);
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, failureMessage);
}
try {
  if (mode === "broad") {
    await runPhase({
      ...process.env,
      MFL_BROWSER_SCENARIOS: [
        "stale", "database", "database-tablet", "database-phone",
        "database-empty", "database-linked-state",
        "player", "player-1444", "player-1363", "player-1200",
        "player-1181", "player-1180", "player-1101", "player-1090",
        "player-1041", "player-1040", "player-980", "player-901",
        "watchlist", "watchlist-empty", "myclubs-out", "myclubs-in",
        "myclubs-competition-fail", "myclubs-stale", "mflstats",
      ].join(","),
    }, "Broad browser routing regression failed with the 1366px shell contract.");
  } else if (mode === "planner") {
    const phases = [
      { name: "shell", scenarios: "planner,planner-out,planner-selected" },
      { name: "squad", scenarios: "planner" },
      { name: "depth-picker", scenarios: "planner" },
      { name: "depth-ranking", scenarios: "planner" },
    ];
    for (const phase of phases) {
      await runPhase({
        ...process.env,
        MFL_BROWSER_SCENARIOS: phase.scenarios,
        MFL_PLANNER_BROWSER_FOCUSED: "1",
        MFL_PLANNER_BROWSER_PHASE: phase.name,
      }, "Planner browser regression failed: " + phase.name + ".");
      console.log("Planner browser regression passed: " + phase.name + ".");
    }
  } else {
    await runPhase(undefined, "Compact mobile route browser coverage failed.");
  }
} finally {
  await rm(temporaryPath, { force: true });
}
if (mode === "broad") {
  console.log("Broad browser routing regression passed with the 1366px compact-shell contract.");
} else if (mode === "planner") {
  console.log("Focused Planner browser regression passed across all phases.");
} else {
  console.log("Compact mobile Database/Watchlist route coverage passed.");
}
