import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [styles, tableWidthRuntime, tableLoadingRuntime, bootstrap, bootstrapCore, indexHtml, responsive] = await Promise.all([
  read("./styles.css"),
  read("./table-width-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
  read("./index.html"),
  read("./responsive.css"),
]);

function percentageVariable(name) {
  const match = styles.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([0-9.]+)%`));
  invariant(match, `Missing global table percentage ${name}.`);
  return Number(match[1]);
}

function pixelVariable(name) {
  const match = styles.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([0-9.]+)px`));
  invariant(match, `Missing global table pixel dimension ${name}.`);
  return Number(match[1]);
}

const shared = [
  "--mfl-table-col-select",
  "--mfl-table-col-id",
  "--mfl-table-col-flag",
  "--mfl-table-col-name",
  "--mfl-table-col-nationality",
  "--mfl-table-col-age",
  "--mfl-table-col-positions",
  "--mfl-table-col-seasons",
  "--mfl-table-col-overall",
  "--mfl-table-col-agent",
  "--mfl-table-col-link",
].reduce((sum, name) => sum + percentageVariable(name), 0);
const stats = percentageVariable("--mfl-table-col-stat") * 6;
const contracts = [
  "--mfl-table-col-contract-revenue",
  "--mfl-table-col-contract-club",
  "--mfl-table-col-contract-division",
].reduce((sum, name) => sum + percentageVariable(name), 0);

invariant(Math.abs(shared + stats - 100) < 0.0001, "Shared + Stats table columns must total 100%.");
invariant(Math.abs(shared + contracts - 100) < 0.0001, "Shared + Contracts table columns must total 100%.");
invariant(
  Math.abs(percentageVariable("--mfl-table-col-joined-agency") - percentageVariable("--mfl-table-col-agent")) < 0.0001
  && Math.abs(percentageVariable("--mfl-table-col-owned-since") - percentageVariable("--mfl-table-col-agent")) < 0.0001,
  "Agent identity columns must share one percentage.",
);

const evaluationSummary = [
  "--mfl-evaluation-summary-col-name",
  "--mfl-evaluation-summary-col-position",
  "--mfl-evaluation-summary-col-age",
  "--mfl-evaluation-summary-col-overall",
  "--mfl-evaluation-summary-col-seasons",
  "--mfl-evaluation-summary-col-return",
  "--mfl-evaluation-summary-col-value",
].reduce((sum, name) => sum + percentageVariable(name), 0);
const evaluationSeason = [
  "--mfl-evaluation-season-col-name",
  "--mfl-evaluation-season-col-season",
  "--mfl-evaluation-season-col-age",
  "--mfl-evaluation-season-col-overall",
  "--mfl-evaluation-season-col-mfl",
  "--mfl-evaluation-season-col-usd",
  "--mfl-evaluation-season-col-discount",
  "--mfl-evaluation-season-col-value",
].reduce((sum, name) => sum + percentageVariable(name), 0);
const advancedPlayer = percentageVariable("--mfl-advanced-player-col-label")
  + (15 * percentageVariable("--mfl-advanced-player-col-value"));

invariant(Math.abs(evaluationSummary - 100) < 0.0001, "Evaluation Summary columns must total 100%.");
invariant(Math.abs(evaluationSeason - 100) < 0.0001, "Evaluation season columns must total 100%.");
invariant(Math.abs(advancedPlayer - 100) < 0.0001, "Advanced player table columns must total 100%.");

invariant(pixelVariable("--mfl-table-header-height") === 38, "Player table headers must use the global 38px height.");
invariant(pixelVariable("--mfl-table-row-height") === 38, "Player table rows must use the global 38px height.");
invariant(
  styles.includes("#progressionPage .tableScroller th {\n  height: var(--mfl-table-header-height);")
  && styles.includes("#progressionPage .tableScroller td {\n  height: var(--mfl-table-row-height);"),
  "Header and row height must be driven directly by the global table geometry contract.",
);
invariant(
  styles.includes("#tableBody > .mflTableLoadingRow > td {")
  && styles.includes("height: var(--mfl-table-row-height);"),
  "Loading rows must inherit the same global row height as loaded rows.",
);

invariant(
  tableWidthRuntime.includes('source: "styles.css"'),
  "Table width runtime must identify styles.css as the percentage source of truth.",
);
invariant(
  tableWidthRuntime.includes('["col-name", "--mfl-table-col-name"]'),
  "Table width runtime must resolve semantic columns from CSS variables rather than duplicate numeric widths.",
);
invariant(
  !tableWidthRuntime.includes('["col-name", 15]'),
  "Table width runtime must not duplicate canonical percentage values.",
);
invariant(
  !tableWidthRuntime.includes("if (!elements || elements.page.hidden) return false;"),
  "Canonical table widths must be applicable while the destination page is still hidden before first reveal.",
);

const directWidthScriptIndex = indexHtml.indexOf('<script src="/table-width-runtime.js"></script>');
const bootstrapScriptIndex = indexHtml.indexOf('<script src="/bootstrap.js"></script>');
invariant(
  directWidthScriptIndex >= 0 && bootstrapScriptIndex > directWidthScriptIndex,
  "The canonical table width runtime must execute before synchronous bootstrap first-paint rendering.",
);

invariant(bootstrap.includes("function primeInitialTableStructure(page, view) {"), "Bootstrap must build first-paint table structure synchronously.");
invariant(bootstrap.includes('selectionCol.className = "col-select";'), "First-paint colgroup must include the selection column.");
invariant(bootstrap.includes('head.dataset.mflStaticHeader = "true";'), "The synchronous first-paint header must be marked for canonical takeover.");
invariant(!bootstrap.includes("cell.colSpan = 16"), "First-paint loading rows must not collapse the table into one colspan cell.");
invariant(bootstrap.includes('row.className = "mflTableLoadingRow";'), "First-paint loading rows must use the canonical loading-row class.");
invariant(
  bootstrap.includes("const columnCount = Math.max(1, colGroup?.children.length || document.getElementById(\"tableHead\")?.querySelector(\"tr\")?.cells.length || 1);"),
  "First-paint loading rows must use the actual rendered column count.",
);

const initialStructureIndex = bootstrap.indexOf("primeInitialTableStructure(tablePage, view);");
const initialWidthApplyIndex = bootstrap.indexOf("window.__mflTableWidthRuntime?.apply?.(true);", initialStructureIndex);
const initialRowsIndex = bootstrap.indexOf("primeInitialTableRows();", initialStructureIndex);
const revealIndex = bootstrap.indexOf('document.querySelectorAll("main > .pageView")', initialStructureIndex);
invariant(
  initialStructureIndex >= 0
  && initialWidthApplyIndex > initialStructureIndex
  && initialRowsIndex > initialWidthApplyIndex
  && revealIndex > initialRowsIndex,
  "First paint must build columns/header, apply final widths, build loading rows, then reveal the table in that order.",
);

invariant(tableLoadingRuntime.includes('const BLANK_ROW_CLASS = "mflTableLoadingRow";'), "Runtime loading rows must use the first-paint loading-row class.");
invariant(!tableLoadingRuntime.includes("TABLE_ROW_HEIGHT = 39"), "Loading runtime must not own a conflicting 39px row height.");
invariant(!tableLoadingRuntime.includes("installStyles()"), "Loading runtime must not inject a second table geometry stylesheet.");
invariant(
  !responsive.includes(".mflTableLoadingRow") || !/\.mflTableLoadingRow[^}]*39px/s.test(responsive),
  "Responsive styling must not assign a conflicting height to canonical loading rows.",
);

const widthLoadIndex = bootstrapCore.indexOf("await ensureFirstPaintTableWidths();");
const appImportIndex = bootstrapCore.indexOf('await import(new URL("/modules/app-entry.js"');
invariant(
  widthLoadIndex >= 0 && appImportIndex > widthLoadIndex,
  "The global table width contract must remain loaded before the application core can render a table.",
);

console.log("Global table percentage, height, and synchronous first-paint geometry validation passed.");
