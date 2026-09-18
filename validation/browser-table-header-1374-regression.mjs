import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const validationDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(validationDirectory, "browser-routing-regression.mjs");
const temporaryPath = resolve(validationDirectory, ".browser-table-header-1374-regression.tmp.mjs");
const source = await readFile(sourcePath, "utf8");

const geometryMarker = "  function assertSharedChromeGeometry() {\n    const viewportWidth = document.documentElement.clientWidth;\n";
assert.ok(source.includes(geometryMarker), "Shared chrome geometry hook must remain discoverable.");

const geometryProbe = geometryMarker + String.raw`    if (viewportWidth === 1374) {
      const headerDiagnostics = Array.from(document.querySelectorAll("#progressionPage #tableHead th"))
        .slice(0, 8)
        .map((header, index) => {
          const label = header.querySelector("[data-mfl-full-table-label][data-mfl-compact-table-label]");
          const sortButton = header.querySelector(".tableSortButton");
          const headerStyle = getComputedStyle(header);
          const labelStyle = label instanceof HTMLElement ? getComputedStyle(label) : null;
          const sortStyle = sortButton instanceof HTMLElement ? getComputedStyle(sortButton) : null;
          return {
            index,
            className: String(header.className || ""),
            column: String(header.dataset.tableColumn || ""),
            text: String(label?.textContent || header.textContent || "").trim(),
            full: String(label?.dataset?.mflFullTableLabel || ""),
            compact: String(label?.dataset?.mflCompactTableLabel || ""),
            headerClientWidth: header.clientWidth,
            headerScrollWidth: header.scrollWidth,
            headerTextOverflow: headerStyle.textOverflow,
            labelClientWidth: label instanceof HTMLElement ? label.clientWidth : 0,
            labelScrollWidth: label instanceof HTMLElement ? label.scrollWidth : 0,
            labelTextOverflow: labelStyle?.textOverflow || "",
            sortClientWidth: sortButton instanceof HTMLElement ? sortButton.clientWidth : 0,
            sortScrollWidth: sortButton instanceof HTMLElement ? sortButton.scrollWidth : 0,
            sortTextOverflow: sortStyle?.textOverflow || "",
          };
        });
      const ellipsizingHeaders = headerDiagnostics.filter((entry) => (
        (entry.headerTextOverflow === "ellipsis" && entry.headerScrollWidth - entry.headerClientWidth > 1)
        || (entry.labelTextOverflow === "ellipsis" && entry.labelScrollWidth - entry.labelClientWidth > 1)
        || (entry.sortTextOverflow === "ellipsis" && entry.sortScrollWidth - entry.sortClientWidth > 1)
      ));
      assert(
        ellipsizingHeaders.length === 0,
        "1374px first-column header ellipsis: " + JSON.stringify({ ellipsizingHeaders, headerDiagnostics }),
      );
    }
`;

let diagnosticSource = source.replace(geometryMarker, geometryProbe);
const scenariosPattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
assert.match(diagnosticSource, scenariosPattern, "Browser regression scenario list must remain discoverable.");
diagnosticSource = diagnosticSource.replace(
  scenariosPattern,
  'const regressionScenarios = Object.freeze([["database-1374", "/database/attributes", 1374, 900]]);\n\nconst server =',
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
  assert.equal(status, 0, "1374px first-column header browser regression failed.");
} finally {
  await rm(temporaryPath, { force: true });
}

console.log("1374px first-column header browser regression passed.");
