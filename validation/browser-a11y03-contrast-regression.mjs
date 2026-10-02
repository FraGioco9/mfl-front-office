import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const source = await readFile(resolve(directory, "browser-routing-regression.mjs"), "utf8");
const temporaryPath = resolve(directory, ".browser-a11y03.tmp.mjs");
const marker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(source.includes(marker), "Canonical browser routing hook for A11Y-03 is unavailable.");
const injected = source.replace(marker, `    await cdp.send("Runtime.enable");
    const baseline = await waitForBrowserRegression(cdp);
    return await (await import("./browser-a11y03-contrast-helper.mjs")).auditContrast(cdp, url, baseline);
`);
const cases = [
  { route: "home", scenario: "database" },
  { route: "database", scenario: "database" },
  { route: "player", scenario: "player" },
  { route: "planner", scenario: "planner" },
  { route: "settings", scenario: "database" },
  { route: "database", scenario: "database", phone: true },
  { route: "planner", scenario: "planner", phone: true },
];

try {
  for (const item of cases) {
    let content = injected;
    if (item.phone && item.scenario === "database") {
      const old='["database", "/database/attributes"],';
      const next='["database", "/database/attributes", 390, 844],';
      assert.ok(content.includes(old), "Mobile database scenario is missing");
      content = content.replace(old, next);
    }
    await writeFile(temporaryPath, content, "utf8");
    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, [temporaryPath], {
        cwd: resolve(directory, ".."),
        stdio: "inherit",
        env: {
          ...process.env,
          MFL_BROWSER_SCENARIOS: item.scenario,
          MFL_A11Y01_ROUTE: item.route,
          MFL_A11Y03_ROUTE: item.route,
          MFL_PLANNER_BROWSER_FOCUSED: item.scenario === "planner" ? "1" : "0",
          MFL_PLANNER_BROWSER_PHASE: "shell",
          MFL_UX03_BROWSER_VIEWPORT: item.phone ? "phone" : "desktop",
        },
      });
      child.once("error", reject);
      child.once("close", done);
    });
    assert.equal(code, 0, "A11Y-03 contrast audit failed for " + item.route + (item.phone ? " phone" : " desktop"));
  }
} finally {
  await rm(temporaryPath, {force:true});
}
console.log("A11Y-03 seven route/viewport cases pass both light and dark color-contrast audits.");
