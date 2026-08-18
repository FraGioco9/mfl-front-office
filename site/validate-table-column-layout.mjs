import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [styles, tableWidthRuntime, tableLoadingRuntime, bootstrap, bootstrapCore, indexHtml, responsive, appCoreNormalizer] = await Promise.all([
  read("./styles.css"),
  read("./table-width-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
  read("./index.html"),
  read("./responsive.css"),
  read("./modules/app-core-normalizer.js"),
]);

function percentageVariable(name) {
  const match = styles.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([0-9.]+)%`));
  invariant(match, `Missing Uniform Width percentage ${name}.`);
  return Number(match[1]);
}

function pixelVariable(name) {
  const match = styles.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([0-9.]+)px`));
  invariant(match, `Missing global table pixel dimension ${name}.`);
  return Number(match[1]);
}

const playerVariables = Object.freeze({
  "col-select": "--mfl-table-col-select",
  "col-id": "--mfl-table-col-id",
  "col-flag": "--mfl-table-col-flag",
  "col-name": "--mfl-table-col-name",
  "col-nationality": "--mfl-table-col-nationality",
  "col-age": "--mfl-table-col-age",
  "col-positions": "--mfl-table-col-positions",
  "col-seasons": "--mfl-table-col-seasons",
  "col-stat": "--mfl-table-col-stat",
  "col-overall": "--mfl-table-col-overall",
  "col-contract-revenue": "--mfl-table-col-contract-revenue",
  "col-contract-club": "--mfl-table-col-contract-club",
  "col-contract-division": "--mfl-table-col-contract-division",
  "col-agent": "--mfl-table-col-agent",
  "col-link": "--mfl-table-col-link",
});

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

invariant(Math.abs(shared + stats - 100) < 0.0001, "Uniform Width player Stats columns must total 100%.");
invariant(Math.abs(shared + contracts - 100) < 0.0001, "Uniform Width player Contracts columns must total 100%.");

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
const advancedContracts = percentageVariable("--mfl-advanced-player-col-label")
  + (15 * percentageVariable("--mfl-advanced-player-col-value"));

invariant(Math.abs(evaluationSummary - 100) < 0.0001, "Uniform Width Evaluation Summary columns must total 100%.");
invariant(Math.abs(evaluationSeason - 100) < 0.0001, "Uniform Width Evaluation season columns must total 100%.");
invariant(Math.abs(advancedContracts - 100) < 0.0001, "Uniform Width Advanced Contracts columns must total 100%.");

Object.entries(playerVariables).forEach(([className, variableName]) => {
  invariant(
    styles.includes(`#progressionPage .playerTableScroller :is(col, th, td).${className} { width: var(${variableName});`),
    `Uniform Width must own col/th/td geometry for ${className}.`,
  );
});
invariant(
  !styles.includes("--mfl-table-mobile-width"),
  "Uniform Width must contain percentages only; table pixel width is not part of the contract.",
);
invariant(pixelVariable("--mfl-table-header-height") === 38, "Player table headers must use the global 38px height.");
invariant(pixelVariable("--mfl-table-row-height") === 38, "Player table rows must use the global 38px height.");
invariant(
  styles.includes("#progressionPage .playerTableScroller table {")
  && styles.includes("table-layout: fixed;"),
  "The dedicated player scroller must own stable table layout before runtime hydration.",
);
invariant(
  styles.includes("#tableBody > .mflTableLoadingRow > td {")
  && styles.includes("height: var(--mfl-table-row-height);"),
  "Loading rows must inherit the same global row height as loaded rows.",
);

invariant(tableWidthRuntime.includes('const UNIFORM_WIDTH_NAME = "Uniform Width";'), "The canonical width contract must be named Uniform Width.");
invariant(tableWidthRuntime.includes('source: "styles.css"'), "Uniform Width must identify styles.css as its only numeric source.");
invariant(tableWidthRuntime.includes('unit: "%"'), "Uniform Width must use percentages.");
invariant(tableWidthRuntime.includes('window.__mflUniformWidth = contract;'), "Uniform Width must be exposed as the canonical global contract.");
invariant(
  tableWidthRuntime.includes('evaluationSummary: Object.freeze([')
  && tableWidthRuntime.includes('evaluationSeason: Object.freeze([')
  && tableWidthRuntime.includes('advancedContracts: Object.freeze(['),
  "Uniform Width must cover every table type, not only the player table.",
);
invariant(
  !tableWidthRuntime.includes("setProperty(")
  && !tableWidthRuntime.includes("removeProperty(")
  && !tableWidthRuntime.includes("requestAnimationFrame(")
  && !tableWidthRuntime.includes("matchMedia(")
  && !tableWidthRuntime.includes("querySelector("),
  "Uniform Width runtime must be read-only and must never mutate table geometry after paint.",
);
invariant(
  !tableWidthRuntime.includes("MOBILE_TABLE_WIDTH")
  && !tableWidthRuntime.includes("toFixed(2)")
  && !tableWidthRuntime.includes('endsWith("px")'),
  "Uniform Width must never convert column percentages into runtime pixel widths.",
);

const directWidthScriptIndex = indexHtml.indexOf('<script src="/table-width-runtime.js"></script>');
const bootstrapScriptIndex = indexHtml.indexOf('<script src="/bootstrap.js"></script>');
invariant(
  directWidthScriptIndex >= 0 && bootstrapScriptIndex > directWidthScriptIndex,
  "Uniform Width validation must execute before synchronous bootstrap first-paint rendering.",
);
const playerTableShell = indexHtml.match(/<section class="tableShell" aria-label="Players table">([\s\S]*?)<div id="emptyState"/)?.[1] || "";
invariant(
  playerTableShell.includes('<div class="playerTableScroller">'),
  "The static Players table must be born with its final Uniform Width scroller class.",
);
invariant(
  !playerTableShell.includes('class="tableScroller"'),
  "The Players table must never enter the historical generic tableScroller width cascade, even before bootstrap.",
);

invariant(!bootstrap.includes("primePlayerTableScroller"), "Bootstrap must not switch table scroller classes after first paint.");
invariant(!bootstrap.includes("__mflTableWidthRuntime?.apply"), "Bootstrap must not apply or rewrite table widths.");
invariant(bootstrap.includes("function primeInitialTableStructure(page, view) {"), "Bootstrap must build first-paint table structure synchronously.");
invariant(bootstrap.includes('selectionCol.className = "col-select";'), "First-paint colgroup must include the selection column.");
invariant(bootstrap.includes('head.dataset.mflStaticHeader = "true";'), "The synchronous first-paint header must be marked for canonical takeover.");
invariant(!bootstrap.includes("cell.colSpan = 16"), "First-paint loading rows must not collapse the table into one colspan cell.");
invariant(bootstrap.includes('row.className = "mflTableLoadingRow";'), "First-paint loading rows must use the canonical loading-row class.");
invariant(
  bootstrap.includes("const columnCount = Math.max(1, colGroup?.children.length || document.getElementById(\"tableHead\")?.querySelector(\"tr\")?.cells.length || 1);"),
  "First-paint loading rows must use the actual rendered column count.",
);
invariant(
  bootstrap.includes(`const FIRST_PAINT_CONTRACT_COLUMNS = Object.freeze([\n    "overall",\n    "active_contract_club_name",\n    "active_contract_club_division",\n    "active_contract_revenue_share",\n  ]);`),
  "First-paint Contracts columns must use the same order as the normalized application core.",
);

const initialStructureIndex = bootstrap.indexOf("primeInitialTableStructure(tablePage, view);");
const initialRowsIndex = bootstrap.indexOf("primeInitialTableRows();", initialStructureIndex);
const revealIndex = bootstrap.indexOf('document.querySelectorAll("main > .pageView")', initialStructureIndex);
invariant(
  initialStructureIndex >= 0
  && initialRowsIndex > initialStructureIndex
  && revealIndex > initialRowsIndex,
  "First paint must build columns/header, build loading rows, then reveal the table in that order.",
);

invariant(tableLoadingRuntime.includes('const BLANK_ROW_CLASS = "mflTableLoadingRow";'), "Runtime loading rows must use the first-paint loading-row class.");
invariant(!tableLoadingRuntime.includes("__mflTableWidthRuntime"), "The loading/header runtime must not invoke a width owner.");
invariant(!tableLoadingRuntime.includes("TABLE_ROW_HEIGHT = 39"), "Loading runtime must not own a conflicting 39px row height.");
invariant(!tableLoadingRuntime.includes("installStyles()"), "Loading runtime must not inject a second table geometry stylesheet.");
invariant(
  (tableLoadingRuntime.match(/const staticRoutePending = staticHeader/g) || []).length >= 2
  && tableLoadingRuntime.includes("document.documentElement.dataset.initialTablePage")
  && tableLoadingRuntime.includes("document.documentElement.dataset.initialTableView"),
  "Loading/header ownership must preserve the first-paint header until the application core reaches the requested page and view.",
);

invariant(
  !/\.col-(?:select|id|flag|name|nationality|age|positions|seasons|stat|overall|agent|contract-revenue|contract-club|contract-division|link)[^{]*\{[^}]*width\s*:/s.test(responsive),
  "Responsive CSS must not override Uniform Width column percentages.",
);
invariant(
  !responsive.includes(".mflTableLoadingRow") || !/\.mflTableLoadingRow[^}]*39px/s.test(responsive),
  "Responsive styling must not assign a conflicting height to canonical loading rows.",
);

invariant(
  appCoreNormalizer.includes("tableColGroup.replaceChildren(fragment);\\n  window.__mflTableWidthRuntime?.apply?.();"),
  "Raw app-core legacy width ownership must remain explicitly recognized by the normalizer until the source core is rebuilt.",
);
invariant(
  appCoreNormalizer.includes("removeLegacyTableWidthOwnership(nextSource)"),
  "Generated application core must remove its raw legacy table-width owner before execution.",
);

const widthLoadIndex = bootstrapCore.indexOf("await ensureFirstPaintTableWidths();");
const appImportIndex = bootstrapCore.indexOf('await import(new URL("/modules/app-entry.js"');
invariant(
  widthLoadIndex >= 0 && appImportIndex > widthLoadIndex,
  "Uniform Width validation must remain loaded before the application core can render a table.",
);

console.log("Uniform Width and synchronous first-paint table validation passed.");
