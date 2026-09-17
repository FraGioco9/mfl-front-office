import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-mobile-route-coverage.tmp.mjs");
let diagnosticSource = await readFile(sourcePath, "utf8");

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

await writeFile(temporaryPath, diagnosticSource, "utf8");
try {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn(process.execPath, [temporaryPath], {
      cwd: resolve(validationDirectory, ".."),
      stdio: "inherit",
    });
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, "Compact mobile route browser coverage failed.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("Compact mobile Database/Watchlist route coverage passed.");
