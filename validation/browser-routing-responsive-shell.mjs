import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-routing-responsive-shell.tmp.mjs");
const source = await readFile(sourcePath, "utf8");

const compactShellContract = 'if (viewportWidth <= 1366 && selector.startsWith(".stats")) {';
assert.equal(
  source.split(compactShellContract).length - 1,
  1,
  "Broad routing regression must consume exactly one canonical compact-shell breakpoint contract.",
);

await writeFile(temporaryPath, source, "utf8");

try {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn(process.execPath, [temporaryPath], {
      cwd: resolve(validationDirectory, ".."),
      stdio: "inherit",
      env: {
        ...process.env,
        MFL_BROWSER_SCENARIOS: [
          "stale",
          "database",
          "database-tablet",
          "database-phone",
          "database-empty",
          "database-linked-state",
          "player",
          "player-1444",
          "player-1363",
          "player-1200",
          "player-1181",
          "player-1180",
          "player-1101",
          "player-1090",
          "player-1041",
          "player-1040",
          "player-980",
          "player-901",
          "watchlist",
          "watchlist-empty",
          "myclubs-out",
          "myclubs-in",
          "myclubs-competition-fail",
          "myclubs-stale",
          "mflstats",
        ].join(","),
      },
    });
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, "Broad browser routing regression failed with the 1366px shell contract.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("Broad browser routing regression passed with the 1366px compact-shell contract.");
