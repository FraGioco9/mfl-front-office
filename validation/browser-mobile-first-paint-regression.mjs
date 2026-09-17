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

const databaseFirstPaintMarker = '      assert(parserSnapshot.initialTableView === "attributes", "Database first paint has the wrong view.");\n';
assert.ok(diagnosticSource.includes(databaseFirstPaintMarker), "Database first-paint assertion hook must remain discoverable.");
const databaseFirstPaintProbe = databaseFirstPaintMarker + String.raw`      assert(
        parserSnapshot.tableHeaderLabels.includes("POS") && parserSnapshot.tableHeaderLabels.includes("SZN"),
        "1374px parser first paint must already use the compact table-header set: " + JSON.stringify(parserSnapshot.tableHeaderLabels),
      );
      assert(
        !parserSnapshot.tableHeaderLabels.includes("Positions") && !parserSnapshot.tableHeaderLabels.includes("Seasons"),
        "1374px parser first paint must not expose full labels before compacting: " + JSON.stringify(parserSnapshot.tableHeaderLabels),
      );
`;
diagnosticSource = diagnosticSource.replace(databaseFirstPaintMarker, databaseFirstPaintProbe);

const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(diagnosticSource, scenariosPattern, "Browser regression scenario list must remain discoverable.");
diagnosticSource = diagnosticSource.replace(
  scenariosPattern,
  'const regressionScenarios = Object.freeze([["database", "/database/attributes", 1374, 900]]);\n\nconst server =',
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
  assert.equal(status, 0, "1374px mobile first-paint header regression failed.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("1374px mobile first-paint header regression passed.");
