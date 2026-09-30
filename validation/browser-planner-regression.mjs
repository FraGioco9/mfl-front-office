import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-planner-regression.tmp.mjs");
const source = await readFile(sourcePath, "utf8");

await writeFile(temporaryPath, source, "utf8");

const phases = [
  { name: "shell", scenarios: "planner,planner-out,planner-selected" },
  { name: "squad", scenarios: "planner" },
  { name: "depth-picker", scenarios: "planner" },
  { name: "depth-ranking", scenarios: "planner" },
];

try {
  for (const phase of phases) {
    const status = await new Promise((resolveStatus, rejectStatus) => {
      const child = spawn(process.execPath, [temporaryPath], {
        cwd: resolve(validationDirectory, ".."),
        stdio: "inherit",
        env: {
          ...process.env,
          MFL_BROWSER_SCENARIOS: phase.scenarios,
          MFL_PLANNER_BROWSER_FOCUSED: "1",
          MFL_PLANNER_BROWSER_PHASE: phase.name,
        },
      });
      child.once("error", rejectStatus);
      child.once("close", resolveStatus);
    });
    assert.equal(status, 0, `Planner browser regression failed: ${phase.name}.`);
    console.log(`Planner browser regression passed: ${phase.name}.`);
  }
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("Focused Planner browser regression passed across all phases.");
