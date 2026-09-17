import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-routing-responsive-shell.tmp.mjs");
const source = await readFile(sourcePath, "utf8");

const oldContract = 'if (viewportWidth <= 900 && selector.startsWith(".stats")) {';
const newContract = 'if (viewportWidth <= 1366 && selector.startsWith(".stats")) {';
assert.equal(
  source.split(oldContract).length - 1,
  1,
  "Broad routing regression must expose exactly one compact-header breakpoint contract.",
);

const responsiveSource = source.replace(oldContract, newContract);
await writeFile(temporaryPath, responsiveSource, "utf8");

try {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn(process.execPath, [temporaryPath], {
      cwd: resolve(validationDirectory, ".."),
      stdio: "inherit",
    });
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, "Broad browser routing regression failed with the 1366px shell contract.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("Broad browser routing regression passed with the 1366px compact-shell contract.");
