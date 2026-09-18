import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-mobile-first-paint-regression.tmp.mjs");
const source = await readFile(sourcePath, "utf8");

const snapshotMarker = '      title: document.title,\n';
assert.ok(source.includes(snapshotMarker), "Parser first-paint snapshot hook must remain discoverable.");
const snapshotProbe = String.raw`      tableHeaderLabels: Array.from(document.querySelectorAll("#tableHead [data-mfl-full-table-label][data-mfl-compact-table-label]"))
        .map((label) => String(label.textContent || "").trim()),
      title: document.title,
`;
let diagnosticSource = source.replace(snapshotMarker, snapshotProbe);

const paintSamplerMarker = '  if (linkedTablePaintSampling) requestAnimationFrame(sampleLinkedTablePaint);\n';
assert.ok(diagnosticSource.includes(paintSamplerMarker), "Frame paint-sampling hook must remain discoverable.");
const paintSamplerProbe = paintSamplerMarker + String.raw`
  const tableHeaderPaintHistory = [];
  let tableHeaderPaintSampling = scenario === "database";
  const sampleTableHeaderPaint = () => {
    if (!tableHeaderPaintSampling) return;
    const labels = Array.from(document.querySelectorAll("#tableHead [data-mfl-full-table-label][data-mfl-compact-table-label]"))
      .map((label) => String(label.textContent || "").trim());
    const mode = labels.includes("Positions") || labels.includes("Seasons")
      ? "full"
      : labels.includes("POS") && labels.includes("SZN")
        ? "compact"
        : "";
    if (mode && tableHeaderPaintHistory.at(-1) !== mode) tableHeaderPaintHistory.push(mode);
    requestAnimationFrame(sampleTableHeaderPaint);
  };
  if (tableHeaderPaintSampling) requestAnimationFrame(sampleTableHeaderPaint);
`;
diagnosticSource = diagnosticSource.replace(paintSamplerMarker, paintSamplerProbe);

const databaseFirstPaintMarker = '      assert(parserSnapshot.initialTableView === "attributes", "Database first paint has the wrong view.");\n';
assert.ok(diagnosticSource.includes(databaseFirstPaintMarker), "Database first-paint assertion hook must remain discoverable.");
const databaseFirstPaintProbe = databaseFirstPaintMarker + String.raw`      {
        const compactHeader = document.documentElement.clientWidth <= 1366;
        const labels = parserSnapshot.tableHeaderLabels;
        assert(
          compactHeader
            ? labels.includes("POS") && labels.includes("SZN")
            : labels.includes("Positions") && labels.includes("Seasons"),
          (compactHeader ? "1366px compact" : "1367px full") + " parser first paint has the wrong table-header set: " + JSON.stringify(labels),
        );
        assert(
          compactHeader
            ? !labels.includes("Positions") && !labels.includes("Seasons")
            : !labels.includes("POS") && !labels.includes("SZN"),
          (compactHeader ? "1366px compact" : "1367px full") + " parser first paint exposed the opposite header set: " + JSON.stringify(labels),
        );
      }
`;
diagnosticSource = diagnosticSource.replace(databaseFirstPaintMarker, databaseFirstPaintProbe);

const routeReadyMarker = '    await waitFor(() => document.documentElement.dataset.mflRouteReady === "true", scenario + " direct refresh never settled.");\n';
assert.ok(diagnosticSource.includes(routeReadyMarker), "Direct-refresh readiness hook must remain discoverable.");
const routeReadyProbe = routeReadyMarker + String.raw`    if (scenario === "database") {
      tableHeaderPaintSampling = false;
      const expectedHeaderMode = document.documentElement.clientWidth <= 1366 ? "compact" : "full";
      assert(
        tableHeaderPaintHistory[0] === expectedHeaderMode,
        expectedHeaderMode + " header paint history started in the wrong mode: " + JSON.stringify(tableHeaderPaintHistory),
      );
      assert(
        tableHeaderPaintHistory.every((mode) => mode === expectedHeaderMode),
        expectedHeaderMode + " headers bounced across the fixed 1366/1367 boundary during hydration: " + JSON.stringify(tableHeaderPaintHistory),
      );
    }
`;
diagnosticSource = diagnosticSource.replace(routeReadyMarker, routeReadyProbe);

const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(diagnosticSource, scenariosPattern, "Browser regression scenario list must remain discoverable.");
diagnosticSource = diagnosticSource.replace(
  scenariosPattern,
  'const regressionScenarios = Object.freeze([["database-1366", "/database/attributes", 1366, 900], ["database-1367", "/database/attributes", 1367, 900]]);\n\nconst server =',
);

await writeFile(temporaryPath, diagnosticSource, "utf8");
try {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn(process.execPath, [temporaryPath], {
      cwd: resolve(validationDirectory, ".."),
      stdio: "inherit",
    });
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, "1366/1367 table-header first-paint boundary regression failed.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("1366/1367 table-header first-paint boundary regression passed.");
