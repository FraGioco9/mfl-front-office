import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, "..");
const source = await readFile(resolve(folder, "browser-routing-regression.mjs"), "utf8");
const file = resolve(folder, ".browser-load01c-ab.tmp.mjs");
const output = process.env.MFL_LOAD01C_OUT || await mkdtemp(join(tmpdir(), "load01c-"));
function once(s, from, to) {
  assert.equal(s.split(from).length - 1, 1, "LOAD01C source anchor must occur once: " + from.slice(0, 65));
  return s.replace(from, to);
}
let generated = source;
generated = once(generated,
  "  const injectedIndexHtml = indexHtml.replace(",
  `  const load01cProbe = (await readFile(resolve(siteDirectory, "validation/browser-load01b-injected-probe.js"), "utf8"))
    .replaceAll("__LOAD01B_KIND__", process.env.MFL_LOAD01C_SURFACE === "planner" ? "planner-squad" : "database")
    .replaceAll("__LOAD01B_THEME__", process.env.MFL_LOAD01C_THEME);
  const injectedIndexHtml = indexHtml.replace(`);
generated = once(generated,
  '  const server = createServer(async (request, response) => {',
  `  const htmlLoad01c = injectedIndexHtml.replace(
    '<script src="/__browser-routing-test.js"></script>',
    '<script src="/__browser-routing-test.js"></script><script src="/__load01c-probe.js"></script>'
  );
  assert.notEqual(htmlLoad01c, injectedIndexHtml, "Probe parser insertion failed");
  const server = createServer(async (request, response) => {`);
generated = once(generated,
  '    if (url.pathname === "/__browser-routing-result" && request.method === "POST") {',
  `    if (url.pathname === "/__load01c-probe.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      response.end(load01cProbe);
      return;
    }
    if (url.pathname === "/__browser-routing-result" && request.method === "POST") {`);
generated = once(generated, "      response.end(injectedIndexHtml);", "      response.end(htmlLoad01c);");
generated = once(generated,
  '  if (mode === "page") return pageDataStub(url, scenario);',
  `  if (mode === "page") {
    const payload = pageDataStub(url, scenario);
    const kind = String(process.env.MFL_LOAD01C_SURFACE || "");
    const scope = String(url.searchParams.get("scope") || "database");
    if ((kind === "planner" && scope === "club")
      || (kind === "database" && scope === "database")) {
      const size = Number(process.env.MFL_LOAD01C_ROWS);
      const template = payload.rows[0];
      assert(template && [1, 8, 10].includes(size), "LOAD01C seed row / fixed count required");
      payload.rows = Array.from({ length: size }, (_, i) => {
        const row = template.slice();
        const id = payload.columns.indexOf("player_id");
        const name = payload.columns.indexOf("name");
        if (id >= 0) row[id] = 1 + i;
        if (name >= 0) row[name] = "Browser Player " + (i + 1);
        return row;
      });
      payload.totalRows = size;
      payload.sourceRows = size;
      payload.totalPages = 1;
    }
    return payload;
  }`);
generated = once(generated,
  '  async function run() {\n    try {',
  '  async function run() {\n    try {\n      if (window.__load01b) return;');
generated = once(generated,
  "async function runChromeRegression(executable, url, width = 1280, height = 900) {",
  `async function runChromeRegression(executable, url, width = 1280, height = 900) {
  width = Number(process.env.MFL_LOAD01C_WIDTH) || width;
  height = Number(process.env.MFL_LOAD01C_HEIGHT) || height;`);
generated = once(generated,
  '    return await waitForBrowserRegression(cdp);',
  `    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    return await (await import("./browser-load01c-cdp.mjs")).runLoad01c(cdp, { url, width, height });`);

const pilot = process.env.MFL_LOAD01C_MODE === "pilot";
const widths = pilot ? [[1280, 900]] : [[1280, 900], [390, 844]];
const themes = pilot ? ["light"] : ["light", "dark"];
const repeats = pilot ? [1] : [1, 2];
const surfaces = pilot ? ["planner"] : ["planner", "database"];
const trials = [];
for (const surface of surfaces) {
  for (const rows of (surface === "planner" ? [1, 8] : [1, 10])) {
    for (const [width, height] of widths) for (const theme of themes) for (const repeat of repeats) {
      for (const variant of ["A", "B"]) {
        trials.push({ surface, rows, width, height, theme, repeat,
          placeholders: variant === "A" ? (surface === "planner" ? 8 : 10) : 1,
          variant });
      }
    }
  }
}
const reports = [];
const failed = [];
try {
  await writeFile(file, generated, "utf8");
  for (const trial of trials) {
    const id = [trial.surface, trial.rows, trial.variant, trial.width, trial.theme, trial.repeat].join("/");
    const code = await new Promise((resolveExit, reject) => {
      const child = spawn(process.execPath, [file], { cwd: root, stdio: "inherit", env: {
        ...process.env,
        MFL_LOAD01C_OUT: output,
        MFL_LOAD01C_SURFACE: trial.surface,
        MFL_LOAD01C_ROWS: String(trial.rows),
        MFL_LOAD01C_PLACEHOLDERS: String(trial.placeholders),
        MFL_LOAD01C_THEME: trial.theme,
        MFL_LOAD01C_WIDTH: String(trial.width),
        MFL_LOAD01C_HEIGHT: String(trial.height),
        MFL_LOAD01C_REPEAT: String(trial.repeat),
        MFL_BROWSER_SCENARIOS: trial.surface === "planner" ? "planner-selected" : "database",
      }});
      child.once("error", reject);
      child.once("close", resolveExit);
    });
    if (code !== 0) { failed.push(id); console.error("LOAD01C_FAIL " + id + " exit=" + code); break; }
    reports.push({ ...trial, filename: [trial.surface, trial.rows, trial.placeholders, trial.width, trial.theme, trial.repeat].join("-") + ".json" });
  }
  const byKey = new Map();
  for (const row of reports) {
    const key = [row.surface, row.rows, row.width, row.theme, row.repeat].join("/");
    const items = byKey.get(key) || [];
    items.push(row);
    byKey.set(key, items);
  }
  const results = [];
  for (const [key, variants] of byKey) {
    if (variants.length !== 2) continue;
    const [base, alternative] = await Promise.all(
      variants.map(async row => JSON.parse(await readFile(resolve(output, row.filename), "utf8")))
    );
    assert.deepEqual(base.loaded.signatures, alternative.loaded.signatures,
      "A/B must render exactly the same fetched rows " + key);
    assert.deepEqual(base.loaded.columns, alternative.loaded.columns,
      "A/B must retain identical loaded cell columns " + key);
    assert.deepEqual(base.loaded.table, alternative.loaded.table,
      "A/B must retain the same final table geometry " + key);
    results.push({ key, surface: base.surface, loadedRows: base.rows,
      base: { placeholders: base.placeholders, heightDelta: base.heightDelta, cls: base.loaded.cls },
      whatIf: { placeholders: alternative.placeholders, heightDelta: alternative.heightDelta, cls: alternative.loaded.cls },
      equivalentLoaded: true,
    });
  }
  const status = { attempted: reports.length + failed.length, expected: trials.length,
    paired: results.length, failures: failed, results, output };
  await writeFile(resolve(output, "load01c-ab-summary.json"), JSON.stringify(status, null, 2) + "\n");
  console.log("LOAD01C_SUMMARY " + JSON.stringify(status).slice(0, 20000));
  assert.equal(failed.length, 0, "LOAD01C fixture cases must all succeed");
  assert.equal(reports.length, trials.length, "Every variant must emit a geometry report");
  assert.equal(results.length * 2, trials.length, "Every same-runner A/B needs both arms");
} finally {
  await rm(file, { force: true });
}
