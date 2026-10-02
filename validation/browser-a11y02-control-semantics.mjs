import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(directory, "browser-routing-regression.mjs");
const temporaryPath = resolve(directory, ".browser-a11y02.tmp.mjs");
const source = await readFile(sourcePath, "utf8");
const marker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(source.includes(marker), "A11Y-02 cannot locate the canonical CDP hook.");

const injected = source.replace(marker, `    await cdp.send("Runtime.enable");
    const baseline = await waitForBrowserRegression(cdp);
    return await (await import("./browser-a11y02-control-helper.mjs")).auditControlSemantics(cdp, url, baseline);
`);

const cases = [
  { route: "database", scenario: "database" },
  { route: "player", scenario: "player" },
  { route: "planner", scenario: "planner" },
  { route: "watchlist", scenario: "watchlist" },
];

try {
  for (const item of cases) {
    await writeFile(temporaryPath, injected, "utf8");
    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, [temporaryPath], {
        cwd: resolve(directory, ".."),
        stdio: "inherit",
        env: {
          ...process.env,
          MFL_BROWSER_SCENARIOS: item.scenario,
          MFL_A11Y02_ROUTE: item.route,
          MFL_PLANNER_BROWSER_FOCUSED: item.scenario === "planner" ? "1" : "0",
          MFL_PLANNER_BROWSER_PHASE: "shell",
        },
      });
      child.once("error", reject);
      child.once("close", done);
    });
    assert.equal(code, 0, "A11Y-02 browser audit failed: " + item.route);
  }
} finally {
  await rm(temporaryPath, { force: true });
}
console.log("A11Y-02 control-name/state matrix passed for Database, Player, Planner and Watchlist.");
