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
  const value = Number(match[1]);
  invariant(Number.isFinite(value) && value > 0, `Invalid Uniform Width percentage ${name}.`);
  return value;
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

const allUniformWidthVariables = [
  ...Object.values(playerVariables),
  "--mfl-evaluation-summary-col-name",
  "--mfl-evaluation-summary-col-position",
  "--mfl-evaluation-summary-col-age",
  "--mfl-evaluation-summary-col-overall",
  "--mfl-evaluation-summary-col-seasons",
  "--mfl-evaluation-summary-col-return",
  "--mfl-evaluation-summary-col-value",
  "--mfl-evaluation-season-col-name",
  "--mfl-evaluation-season-col-season",
  "--mfl-evaluation-season-col-age",
  "--mfl-evaluation-season-col-overall",
  "--mfl-evaluation-season-col-mfl",
  "--mfl-evaluation-season-col-usd",
  "--mfl-evaluation-season-col-discount",
  "--mfl-evaluation-season-col-value",
  "--mfl-advanced-player-col-label",
  "--mfl-advanced-player-col-value",
];
allUniformWidthVariables.forEach(percentageVariable);

Object.entries(playerVariables).forEach(([className, variableName]) => {
  invariant(
    styles.includes(`#progressionPage .playerTableScroller col.${className} { width: var(${variableName}); }`),
    `Uniform Width must be consumed only by the player colgroup for ${className}.`,
  );
});
invariant(
  !/#progressionPage \.playerTableScroller[^\n{]*(?:th|td)[^{]*\{[^}]*\bwidth\s*:/s.test(styles),
  "Player headers and data cells must never own column widths.",
);
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

invariant(tableWidthRuntime.includes('name: "Uniform Width"'), "The canonical width contract must be named Uniform Width.");
invariant(tableWidthRuntime.includes('source: "styles.css"'), "Uniform Width must identify styles.css as its only numeric source.");
invariant(tableWidthRuntime.includes('unit: "%"'), "Uniform Width must use percentages.");
invariant(tableWidthRuntime.includes('window.__mflUniformWidth = Object.freeze({'), "Uniform Width must be exposed as the canonical global marker.");
invariant(
  !tableWidthRuntime.includes("getComputedStyle")
  && !tableWidthRuntime.includes("GROUP_VARIABLES")
  && !tableWidthRuntime.includes("evaluationSummary")
  && !tableWidthRuntime.includes("evaluationSeason")
  && !tableWidthRuntime.includes("advancedContracts")
  && !tableWidthRuntime.includes("statsTotal")
  && !tableWidthRuntime.includes("contractsTotal"),
  "Uniform Width runtime must not contain table layouts, grouped widths, or computed width values.",
);
invariant(
  !tableWidthRuntime.includes("setProperty(")
  && !tableWidthRuntime.includes("removeProperty(")
  && !tableWidthRuntime.includes("requestAnimationFrame(")
  && !tableWidthRuntime.includes("matchMedia(")
  && !tableWidthRuntime.includes("querySelector("),
  "Uniform Width runtime must never mutate table geometry after paint.",
);
invariant(
  !tableWidthRuntime.includes("__mflTableWidthRuntime")
  && !tableWidthRuntime.includes("takeOwnership")
  && !tableWidthRuntime.includes("const apply ="),
  "Uniform Width must not expose a compatibility width owner or apply API.",
);

const directWidthScriptIndex = indexHtml.indexOf('<script src="/table-width-runtime.js"></script>');
const bootstrapScriptIndex = indexHtml.indexOf('<script src="/bootstrap.js"></script>');
invariant(
  directWidthScriptIndex >= 0 && bootstrapScriptIndex > directWidthScriptIndex,
  "The Uniform Width marker must exist before synchronous bootstrap rendering.",
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
invariant(!responsive.includes("1240px"), "Responsive CSS must not own a fixed table width.");
invariant(
  !responsive.includes(".mflTableLoadingRow") || !/\.mflTableLoadingRow[^}]*39px/s.test(responsive),
  "Responsive styling must not assign a conflicting height to canonical loading rows.",
);

invariant(
  appCoreNormalizer.includes("removeLegacyTableWidthOwnership(nextSource)"),
  "Generated application core must remove its raw legacy table-width owner before execution.",
);
invariant(
  appCoreNormalizer.includes("const alreadyCanonical = existingCols.length === targetClasses.length")
  && appCoreNormalizer.includes("if (alreadyCanonical) return;"),
  "Canonical colgroup ownership must be idempotent and preserve an already-correct first-paint colgroup.",
);
invariant(
  !appCoreNormalizer.includes('const layoutOnlyClubFinish = `  function finishClubSwitch() {\n    return new Promise((resolve) => {\n      requestAnimationFrame(() => {\n        if (typeof buildTableColGroup === "function") buildTableColGroup();'),
  "Club completion must not rebuild an already-rendered colgroup.",
);

const widthAssertIndex = bootstrapCore.indexOf("assertUniformWidthContract();");
const appImportIndex = bootstrapCore.indexOf('await import(new URL("/modules/app-entry.js"');
invariant(
  widthAssertIndex >= 0 && appImportIndex > widthAssertIndex,
  "Uniform Width must be asserted before the application core can render a table.",
);
invariant(
  bootstrapCore.includes('window.__mflUniformWidth?.name !== "Uniform Width"')
  && !bootstrapCore.includes("ensureFirstPaintTableWidths")
  && !bootstrapCore.includes("__mflTableWidthRuntime"),
  "Bootstrap core must consume Uniform Width as a marker and must not load or call a width owner.",
);

console.log("Uniform Width single-source and stable-colgroup validation passed.");
