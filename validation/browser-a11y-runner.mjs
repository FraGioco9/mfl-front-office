import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const routeCases = [
  { route: "home", scenario: "database" },
  { route: "database", scenario: "database" },
  { route: "player", scenario: "player" },
  { route: "planner", scenario: "planner" },
  { route: "settings", scenario: "database" },
  { route: "database", scenario: "database", phone: true },
  { route: "planner", scenario: "planner", phone: true },
];
const plannerCases = ["database", "planner"].map(scenario => ({ scenario }));
const suites = {
  "01": {
    helper: "browser-a11y01-helper.mjs",
    audit: "auditAccessibility",
    cases: routeCases,
    summary: "A11Y-01 axe WCAG 2.1 AA and keyboard audits passed for Home, Database, Player, Planner and Settings.",
  },
  "02": {
    helper: "browser-a11y02-control-helper.mjs",
    audit: "auditControlSemantics",
    cases: ["database", "player", "planner", "watchlist"].map(scenario => ({ route: scenario, scenario })),
    summary: "A11Y-02 control-name/state matrix passed for Database, Player, Planner and Watchlist.",
  },
  "03": {
    helper: "browser-a11y03-contrast-helper.mjs",
    audit: "auditContrast",
    cases: routeCases,
    summary: "A11Y-03 seven route/viewport cases pass both light and dark color-contrast audits.",
  },
  "04": {
    helper: "browser-a11y04-live-helper.mjs",
    audit: "auditLiveAnnouncements",
    cases: plannerCases,
    summary: "A11Y-04 browser live-announcement matrix passed.",
  },
  "05": {
    helper: "browser-a11y05-reduced-helper.mjs",
    audit: "auditReducedMotion",
    cases: plannerCases,
    summary: "A11Y-05 reduced motion matrix passed for Database/Stats and Planner hydrated routes.",
  },
  "06": {
    helper: "browser-a11y06-landmarks-helper.mjs",
    audit: "auditLandmarks",
    cases: routeCases,
    summary: "A11Y-06 named landmarks and first-Tab skip matrix passed on seven route/viewport cases.",
  },
};

const suiteId = process.argv[2];
assert.ok(Object.hasOwn(suites, suiteId) && process.argv.length === 3, "Specify exactly one A11Y suite: 01, 02, 03, 04, 05, or 06.");
const suite = suites[suiteId];
const directory = dirname(fileURLToPath(import.meta.url));
const source = await readFile(resolve(directory, "browser-routing-regression.mjs"), "utf8");
const marker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.equal(source.split(marker).length, 2, "A11Y-" + suiteId + " requires exactly one canonical Chromium CDP hook.");
const injected = source.replace(marker,
  '    await cdp.send("Runtime.enable");\n'
  + '    const baseline = await waitForBrowserRegression(cdp);\n'
  + '    return await (await import("./' + suite.helper + '")).' + suite.audit + '(cdp, url, baseline);\n'
);
const temporary = resolve(directory, ".browser-a11y" + suiteId + "-" + process.pid + "-" + randomUUID() + ".tmp.mjs");
const failures = [];

function failureMessage(item) {
  if (suiteId === "01") return "A11Y-01 audit failed: " + item.route + (item.phone ? " phone" : " desktop");
  if (suiteId === "02") return "A11Y-02 browser audit failed: " + item.route;
  if (suiteId === "04") return "A11Y-04 failed hydrated browser scenario: " + item.scenario;
  if (suiteId === "05") return "A11Y-05 reduced-motion browser case failed: " + item.scenario;
  return "A11Y-06 landmarks/keyboard failed: " + item.route + (item.phone ? " phone" : " desktop");
}

try {
  for (const item of suite.cases) {
    let content = injected;
    if (item.phone && item.scenario === "database") {
      const desktopFixture = '["database", "/database/attributes"],';
      assert.ok(content.includes(desktopFixture), "A11Y-" + suiteId + " phone database fixture is missing.");
      content = content.replace(desktopFixture, '["database", "/database/attributes", 390, 844],');
    }
    await writeFile(temporary, content, "utf8");
    const env = {
      ...process.env,
      MFL_BROWSER_SCENARIOS: item.scenario,
      MFL_PLANNER_BROWSER_FOCUSED: item.scenario === "planner" ? "1" : "0",
      MFL_PLANNER_BROWSER_PHASE: "shell",
    };
    if (suiteId === "01" || suiteId === "03" || suiteId === "06") {
      env.MFL_A11Y01_ROUTE = item.route;
      env.MFL_UX03_BROWSER_VIEWPORT = item.phone && item.scenario === "planner" ? "phone" : "desktop";
    }
    if (suiteId === "02") env.MFL_A11Y02_ROUTE = item.route;
    if (suiteId === "03") env.MFL_A11Y03_ROUTE = item.route;
    if (suiteId === "06") env.MFL_A11Y06_ROUTE = item.route;

    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, [temporary], {
        cwd: resolve(directory, ".."),
        stdio: "inherit",
        env,
      });
      child.once("error", reject);
      child.once("close", done);
    });
    if (suiteId === "03") {
      if (code !== 0) {
        const label = item.route + (item.phone ? " phone" : " desktop");
        failures.push(label);
        console.error("A11Y-03 contrast audit failed on " + label);
      }
    } else {
      assert.equal(code, 0, failureMessage(item));
    }
  }
} finally {
  await rm(temporary, { force: true });
}
if (suiteId === "03") {
  assert.deepEqual(failures, [], "A11Y-03 contrast failures across route/viewport cases: " + failures.join(", "));
}
console.log(suite.summary);
