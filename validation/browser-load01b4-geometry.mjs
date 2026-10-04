import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const baseDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(baseDir, "..");
const original = await readFile(resolve(baseDir, "browser-routing-regression.mjs"), "utf8");
const tmp = resolve(baseDir, ".browser-load01b4.tmp.mjs");
const output = process.env.MFL_LOAD01B4_OUT || await mkdtemp(join(tmpdir(), "mfl-load01b4-"));
function swapOnce(s, before, after) {
  assert.equal(s.split(before).length - 1, 1, "LOAD01B4: expected one source anchor: " + before.slice(0, 100));
  return s.replace(before, after);
}
let script = original;
script = swapOnce(script, "  const injectedIndexHtml = indexHtml.replace(",
`  const injectedLoad01b4 = (await readFile(resolve(siteDirectory, "validation/browser-load01b4-probe.js"), "utf8"))
    .replaceAll("__KIND__", process.env.MFL_LOAD01B4_KIND)
    .replaceAll("__THEME__", process.env.MFL_LOAD01B4_THEME);
  const injectedIndexHtml = indexHtml.replace(`);
script = swapOnce(script, '  const server = createServer(async (request, response) => {',
`  const probedIndexHtml = injectedIndexHtml.replace(
    '<script src="/__browser-routing-test.js"></script>',
    '<script src="/__browser-routing-test.js"></script><script src="/__load01b4.js"></script>'
  );
  assert.notEqual(probedIndexHtml, injectedIndexHtml, "LOAD01B4 parser injection not applied");
  const server = createServer(async (request, response) => {`);
script = swapOnce(script,
  '    if (url.pathname === "/__browser-routing-result" && request.method === "POST") {',
`    if (url.pathname === "/__load01b4.js") {
      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(injectedLoad01b4);
      return;
    }
    if (url.pathname === "/__browser-routing-result" && request.method === "POST") {`);
script = swapOnce(script, "      response.end(injectedIndexHtml);", "      response.end(probedIndexHtml);");
// Disable *only* automatic canonical navigation in the temporary diagnostic copy.
// The unmodified canonical regression still runs independently in Site Quality CI.
script = swapOnce(script, '  async function run() {\n    try {',
  '  async function run() {\n    try {\n      if (window.__load01b4) return;');
script = swapOnce(script,
  '  const reflowMatrix = new URL(url).hash.startsWith("#resp01-");',
  '  const reflowMatrix = true; // Set exact viewport before parser scripts run');
script = swapOnce(script,
  "async function runChromeRegression(executable, url, width = 1280, height = 900) {",
`async function runChromeRegression(executable, url, width = 1280, height = 900) {
  width = Number(process.env.MFL_LOAD01B4_WIDTH) || width;
  height = Number(process.env.MFL_LOAD01B4_HEIGHT) || height;`);
script = swapOnce(script,
  '    return await waitForBrowserRegression(cdp);',
  `    await cdp.send("Network.enable");
    await cdp.send("Network.setBlockedURLs", { urls: ["https://*"] });
    return await (await import("./browser-load01b4-cdp.mjs")).runLoad01b4(cdp, { url, width, height });`);

// Register only these three source routes inside the temporary canonical fixture.
script = swapOnce(script,
  "const regressionScenarios = Object.freeze([",
  'const regressionScenarios = Object.freeze([\n  ["load01b4-home", "/"],\n  ["load01b4-club", "/clubs/9001/squad"],\n  ["load01b4-evaluation", "/evaluation"],');

const cases = [
  { kind: "myclubs", scenario: "myclubs-in", path: "/my-clubs#opted-in" },
  { kind: "home", scenario: "load01b4-home", path: "/" },
  { kind: "club", scenario: "load01b4-club", path: "/clubs/9001/squad" },
  { kind: "evaluation", scenario: "load01b4-evaluation", path: "/evaluation" },
  { kind: "database", scenario: "database", path: "/database/attributes" },
  { kind: "planner", scenario: "planner-selected", path: "/planner?club=9001" },
];
const mode = process.env.MFL_LOAD01B4_MODE || "all";
const selected = mode === "pilot" ? [cases[0]] : mode === "target"
  ? cases.filter(c => c.kind === process.env.MFL_LOAD01B4_TARGET) : cases;
assert(selected.length > 0, "LOAD01B4 selected zero cases");
const viewports = mode === "all" ? [[1280, 900], [768, 1024], [390, 844]] : [[1280, 900]];
const themes = mode === "all" ? ["light", "dark"] : ["light"];
let attempted = 0;
const failures = [];
try {
  await writeFile(tmp, script, "utf8");
  attempts: for (const item of selected) {
    for (const [width, height] of viewports) {
      for (const theme of themes) {
        const label = [item.kind, width, theme].join("-");
        attempted++;
        const exitCode = await new Promise((resolveExit, reject) => {
          const child = spawn(process.execPath, [tmp], {
            cwd: root,
            stdio: "inherit",
            env: {
              ...process.env,
              MFL_LOAD01B4_KIND: item.kind,
              MFL_LOAD01B4_THEME: theme,
              MFL_LOAD01B4_WIDTH: String(width),
              MFL_LOAD01B4_HEIGHT: String(height),
              MFL_LOAD01B4_OUT: output,
              MFL_BROWSER_SCENARIOS: item.scenario,
            },
          });
          child.once("error", reject);
          child.once("close", resolveExit);
        });
        if (exitCode !== 0) {
          failures.push(label);
          console.error("LOAD01B4_FAIL " + label + ": " + exitCode);
          break attempts;
        }
      }
    }
  }
  const reports = (await readdir(output)).filter(name => name.endsWith(".json"));
  console.log("LOAD01B4_SUMMARY " + JSON.stringify({ attempted, reports: reports.length, failures, output }));
  assert.deepEqual(failures, [], "Synthetic Chromium phase matrix failures");
  assert.equal(reports.length, attempted, "Expected an auditable JSON report for each executed scenario");
} finally {
  await rm(tmp, { force: true });
}
