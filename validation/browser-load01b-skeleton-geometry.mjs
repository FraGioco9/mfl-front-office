import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");
const original = await readFile(resolve(directory, "browser-routing-regression.mjs"), "utf8");
const tmp = resolve(directory, ".browser-load01b-fixture.tmp.mjs");
const output = process.env.MFL_LOAD01B_OUTPUT || await mkdtemp(join(tmpdir(), "mfl-load01b-"));
const replaceExactly = (source, before, after) => {
  const count = source.split(before).length - 1;
  assert.equal(count, 1, "LOAD01B fixture anchor must be unique: " + before.slice(0, 65) + " (found " + count + ")");
  return source.replace(before, after);
};
let script = original;
script = replaceExactly(script,
  "  const injectedIndexHtml = indexHtml.replace(",
  `  const browserLoad01bProbe = (await readFile(resolve(siteDirectory, "validation/browser-load01b-injected-probe.js"), "utf8"))
    .replaceAll("__LOAD01B_KIND__", process.env.MFL_LOAD01B_KIND)
    .replaceAll("__LOAD01B_THEME__", process.env.MFL_LOAD01B_THEME);
  const injectedIndexHtml = indexHtml.replace(`);
script = replaceExactly(script,
  '  const server = createServer(async (request, response) => {',
  `  const probedIndexHtml = injectedIndexHtml.replace("</head>", '<script src="/__load01b-probe.js"></script></head>');
  assert.notEqual(probedIndexHtml, injectedIndexHtml, "LOAD01B probe must be parser-loaded");
  const server = createServer(async (request, response) => {`);
script = replaceExactly(script,
  '    if (url.pathname === "/__browser-routing-result" && request.method === "POST") {',
  `    if (url.pathname === "/__load01b-probe.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      response.end(browserLoad01bProbe);
      return;
    }
    if (url.pathname === "/__browser-routing-result" && request.method === "POST") {`);
script = replaceExactly(script,
  "      response.end(injectedIndexHtml);",
  "      response.end(probedIndexHtml);");
// Prevent the canonical fixture's own SPA navigation and modal teardown from racing screenshots.
script = replaceExactly(script,
  '  async function run() {\n    try {',
  '  async function run() {\n    try {\n      if (window.__load01b && window.__load01b.kind !== "myclubs" && !window.__load01b.measurementDone) await new Promise(resolve => { window.__load01b.unblockCanonical = () => { window.__load01b.measurementDone = true; resolve(); }; });');
script = replaceExactly(script,
  "async function runChromeRegression(executable, url, width = 1280, height = 900) {",
  `async function runChromeRegression(executable, url, width = 1280, height = 900) {
  width = Number(process.env.MFL_LOAD01B_WIDTH) || width;
  height = Number(process.env.MFL_LOAD01B_HEIGHT) || height;`);
script = replaceExactly(script,
  '    return await waitForBrowserRegression(cdp);',
  `    return await (await import("./browser-load01b-cdp-helper.mjs")).runLoad01b(cdp, {
      url, width, height,
    });`);
const cases = [
  { kind: "planner-squad", scenario: "planner-selected" },
  { kind: "plans", scenario: "planner" },
  { kind: "planner-search", scenario: "planner" },
  { kind: "database", scenario: "database" },
  { kind: "player", scenario: "player" },
];
const mode = process.env.MFL_LOAD01B_MODE || "all";
const selected = mode === "pilot"
  ? [cases[0]]
  : mode === "target" ? cases.filter(item => item.kind === process.env.MFL_LOAD01B_TARGET_KIND) : cases;
assert(selected.length > 0, "LOAD01B must have a matching target case");
const viewports = mode === "pilot" || mode === "target" ? [[1280, 900]] : [[1280, 900], [390, 844], [768, 1024]];
const themes = mode === "pilot" || mode === "target" ? ["light"] : ["light", "dark"];
const failures = [];
let attempted = 0;
try {
  await writeFile(tmp, script, "utf8");
  for (const item of selected) {
    for (const [width, height] of viewports) {
      for (const theme of themes) {
        attempted++;
        const label = item.kind + "/" + width + "/" + theme;
        const code = await new Promise((done, reject) => {
          const child = spawn(process.execPath, [tmp], {
            cwd: root, stdio: "inherit",
            env: {
              ...process.env,
              MFL_LOAD01B_KIND: item.kind,
              MFL_LOAD01B_THEME: theme,
              MFL_LOAD01B_WIDTH: String(width),
              MFL_LOAD01B_HEIGHT: String(height),
              MFL_LOAD01B_OUTPUT: output,
              MFL_BROWSER_SCENARIOS: item.scenario,
              MFL_PLANNER_BROWSER_FOCUSED: item.scenario === "planner" ? "1" : "0",
              MFL_PLANNER_BROWSER_PHASE: "shell",
              MFL_UX03_BROWSER_FOCUSED: "0",
            },
          });
          child.once("error", reject);
          child.once("close", done);
        });
        if (code !== 0) {
          failures.push(label);
          console.error("LOAD01B_FAIL " + label + " code=" + code);
        }
      }
    }
  }
  const reports = (await readdir(output)).filter(f => f.endsWith(".json"));
  console.log("LOAD01B_SUMMARY " + JSON.stringify({
    attempted, reports: reports.length, failures, output,
    expectedModes: selected.map(x => x.kind),
  }));
  assert.equal(failures.length, 0, "LOAD-01B fixture failures: " + failures.join(", "));
  assert.equal(reports.length, attempted, "Not all LOAD-01B cases emitted geometry reports");
} finally {
  await rm(tmp, { force: true });
}
