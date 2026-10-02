import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(directory, "browser-routing-regression.mjs");
const temporaryPath = resolve(directory, ".browser-a11y01.tmp.mjs");
const source = await readFile(sourcePath, "utf8");
const marker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(source.includes(marker), "A11Y-01 cannot locate the canonical CDP audit hook.");

// Keep Chromium fixtures, deterministic mock APIs, and existing hydration/
// navigation assertions intact. Only attach axe + keyboard after they pass.
const injected = source.replace(marker, `    await cdp.send("Runtime.enable");
    const baseline = await waitForBrowserRegression(cdp);
    return await (await import("./browser-a11y01-helper.mjs")).auditAccessibility(cdp, url, baseline);
`);

const cases = [
  { route: "home", scenario: "database" },
  { route: "database", scenario: "database" },
  { route: "player", scenario: "player" },
  { route: "planner", scenario: "planner-selected" },
  { route: "settings", scenario: "database" },
  { route: "database", scenario: "database", phone: true },
  { route: "planner", scenario: "planner-selected", phone: true },
];

try {
  for (const item of cases) {
    let text = injected;
    if (item.phone) {
      const entries = item.scenario === "database"
        ? ['["database", "/database/attributes"],', '["database", "/database/attributes", 390, 844],']
        : ['["planner-selected", "/planner?club=9001"],', '["planner-selected", "/planner?club=9001", 390, 844],'];
      assert.ok(text.includes(entries[0]), "A11Y-01 could not locate phone fixture: " + item.scenario);
      text = text.replace(entries[0], entries[1]);
    }
    await writeFile(temporaryPath, text, "utf8");
    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, [temporaryPath], {
        cwd: resolve(directory, ".."),
        stdio: "inherit",
        env: {
          ...process.env,
          MFL_BROWSER_SCENARIOS: item.scenario,
          MFL_A11Y01_ROUTE: item.route,
          MFL_PLANNER_BROWSER_FOCUSED: item.scenario === "planner-selected" ? "1" : "0",
          MFL_PLANNER_BROWSER_PHASE: "shell",
        },
      });
      child.once("error", reject);
      child.once("close", done);
    });
    assert.equal(code, 0, "A11Y-01 audit failed: " + item.route + (item.phone ? " phone" : " desktop"));
  }
} finally {
  await rm(temporaryPath, { force: true });
}
console.log("A11Y-01 axe WCAG 2.1 AA and keyboard audits passed for Home, Database, Player, Planner and Settings.");
