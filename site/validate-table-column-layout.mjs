import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  styles,
  stylesBase,
  tableWidthRuntime,
  tableLoadingRuntime,
  staticUiRuntime,
  bootstrap,
  bootstrapCore,
  indexHtml,
  responsive,
  appCoreSource,
] = await Promise.all([
  read("./styles.css"),
  read("./styles-base.css"),
  read("./table-width-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./static-ui-runtime.js"),
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
  read("./index.html"),
  read("./responsive.css"),
  read("./modules/app-core.js"),
]);

function cssVariable(name, unit) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*:\\s*([0-9.]+)${unit}`));
  invariant(match, `Missing canonical dimension ${name}.`);
  const value = Number(match[1]);
  invariant(Number.isFinite(value) && value > 0, `Invalid canonical dimension ${name}.`);
  return value;
}

function percentageVariable(name) {
  return cssVariable(name, "%");
}

function pixelVariable(name) {
  return cssVariable(name, "px");
}

function cssRules(source) {
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    rules.push({ selector: match[1].trim(), declarations: match[2] });
  }
  return rules;
}

function ownsWidth(declarations) {
  return /(?:^|;)\s*(?:width|min-width|max-width)\s*:/m.test(declarations);
}

function ownsEvaluationColumnWidth(rule) {
  if (!ownsWidth(rule.declarations)) return false;
  return rule.selector.split(",").some((selector) =>
    /\.evaluation(?:Summary)?Table\s+(?:th|td):nth-child\([^)]*\)\s*$/.test(selector.trim()),
  );
}

const playerVariables = Object.freeze({
  "col-select": "--mfl-table-col-select",
  "col-actions": "--mfl-table-col-actions",
  "col-id": "--mfl-table-col-id",
  "col-flag": "--mfl-table-col-flag",
  "col-name": "--mfl-table-col-name",
  "col-listing": "--mfl-table-col-listing",
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

const evaluationVariables = [
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
[...Object.values(playerVariables), ...evaluationVariables].forEach(percentageVariable);

for (const [className, variableName] of Object.entries(playerVariables)) {
  invariant(
    styles.includes(`#progressionPage .playerTableScroller col.${className} { width: var(${variableName}); }`),
    `Uniform Width must be consumed by the player colgroup for ${className}.`,
  );
}

function totalPlayerWidth(columnClasses) {
  return columnClasses.reduce((total, className) => total + percentageVariable(playerVariables[className]), 0);
}

const attributeWidth = totalPlayerWidth([
  "col-select", "col-actions", "col-id", "col-flag", "col-name", "col-listing", "col-age", "col-positions", "col-seasons",
  "col-overall", "col-stat", "col-stat", "col-stat", "col-stat", "col-stat", "col-stat", "col-agent", "col-link",
]);
const contractsWidth = totalPlayerWidth([
  "col-select", "col-actions", "col-id", "col-flag", "col-name", "col-listing", "col-age", "col-positions", "col-seasons",
  "col-overall", "col-contract-revenue", "col-contract-club", "col-contract-division", "col-agent", "col-link",
]);
invariant(Math.abs(attributeWidth - 100) < 0.001, "Player attribute table columns must total 100%.");
invariant(Math.abs(contractsWidth - 100) < 0.001, "Player contract table columns must total 100%.");
invariant(Math.abs(percentageVariable("--mfl-table-col-overall") - 6.2) < 0.000001, "Overall must reserve enough Uniform Width for its rarity circle and two-digit progression.");
invariant(Math.abs(percentageVariable("--mfl-table-col-stat") - 5.546666666666667) < 1e-12, "Stat columns must absorb the Overall width rebalance without changing total table width.");

invariant(
  !/#progressionPage \.playerTableScroller[^\n{]*(?:th|td)[^{]*\{[^}]*\bwidth\s*:/s.test(styles),
  "Player headers and data cells must never own column widths.",
);
invariant(!styles.includes("--mfl-table-mobile-width"), "Uniform Width must contain percentages only; table pixel width is not part of the contract.");
invariant(pixelVariable("--mfl-table-header-height") === 38, "Player table headers must use the global 38px height.");
invariant(pixelVariable("--mfl-table-row-height") === 34, "Player table cell content must keep the compact global 34px height.");
invariant(pixelVariable("--mfl-table-row-outer-height") === 39, "Player table rendered rows must keep the existing 39px outer height.");
invariant(
  styles.includes("#progressionPage .playerTableScroller table {") && styles.includes("table-layout: fixed;"),
  "The player scroller must own stable fixed table layout before hydration.",
);
invariant(
  styles.includes("#progressionPage .playerTableScroller tbody > tr {\n  height: var(--mfl-table-row-outer-height);\n}")
    && styles.includes("#progressionPage .playerTableScroller td {\n  height: var(--mfl-table-row-height);\n  min-height: var(--mfl-table-row-height);\n  line-height: var(--mfl-table-row-height);")
    && !styles.includes("#tableBody > .mflTableLoadingRow > td {\n  height:"),
  "Loaded and blank player rows must share the existing 39px outer row height while cell content remains compact at 34px.",
);

const baseRules = cssRules(stylesBase);
const playerGeometryClasses = /\.col-(?:select|actions|id|flag|name|listing|age|positions|seasons|stat|agent|contract-revenue|contract-club|contract-division|link)\b/;
invariant(
  !baseRules.some((rule) => playerGeometryClasses.test(rule.selector) && ownsWidth(rule.declarations)),
  "styles-base.css must not own player column geometry; use Uniform Width in styles.css.",
);
invariant(!baseRules.some((rule) => /\.nameCell\b/.test(rule.selector) && ownsWidth(rule.declarations)), "The player Name cell must not own column geometry.");
invariant(!baseRules.some((rule) => /\.advancedPlayerTable\b/.test(rule.selector) && ownsWidth(rule.declarations)), "Advanced table column widths must come only from Uniform Width.");
invariant(!baseRules.some(ownsEvaluationColumnWidth), "Evaluation table-column widths must come only from Uniform Width.");
for (const retired of ["1240px", "900px", "tableWidthsReady", "col-shared-width-filler", "col-stable-width-filler", "col-exact-width-filler"]) {
  invariant(!stylesBase.includes(retired), `Legacy table geometry must stay removed: ${retired}.`);
}

for (const marker of ['name: "Uniform Width"', 'source: "styles.css"', 'unit: "%"', 'window.__mflUniformWidth = Object.freeze({']) {
  invariant(tableWidthRuntime.includes(marker), `Uniform Width runtime is missing ${marker}.`);
}
for (const forbidden of [
  "getComputedStyle", "GROUP_VARIABLES", "evaluationSummary", "evaluationSeason", "advancedContracts",
  "statsTotal", "contractsTotal", "setProperty(", "removeProperty(", "requestAnimationFrame(", "matchMedia(",
  "querySelector(", "__mflTableWidthRuntime", "takeOwnership", "const apply =",
]) {
  invariant(!tableWidthRuntime.includes(forbidden), `Uniform Width runtime must not own mutable geometry through ${forbidden}.`);
}

const widthScriptIndex = indexHtml.indexOf('<script src="/table-width-runtime.js"></script>');
const bootstrapScriptIndex = indexHtml.indexOf('<script src="/bootstrap.js"></script>');
invariant(widthScriptIndex >= 0 && bootstrapScriptIndex > widthScriptIndex, "Uniform Width must exist before synchronous bootstrap rendering.");
const playerTableShell = indexHtml.match(/<section class="tableShell" aria-label="Players table">([\s\S]*?)<div id="emptyState"/)?.[1] || "";
invariant(playerTableShell.includes('<div class="playerTableScroller">'), "The static Players table must start with its final Uniform Width scroller.");
invariant(!playerTableShell.includes('class="tableScroller"'), "The Players table must never enter the legacy generic scroller width cascade.");

for (const required of [
  "function primeInitialTableStructure(page, view) {",
  "const FIRST_PAINT_SORTABLE_COLUMNS = new Set(APP_CONFIG.table.sortableColumns);",
  'selectionInput.id = "selectVisiblePlayersInput";',
  'head.dataset.mflHeaderSignature = signature;',
  'Reflect.set(window, "__mflPrimeTableHeaderSignature", firstPaintTableHeaderSignature);',
  'Reflect.set(window, "__mflPrimeTableStructure", primeInitialTableStructure);',
  'selectionHeader.className = "selectionCell";',
  'head.dataset.mflStaticHeader = "true";',
  'row.className = "mflTableLoadingRow";',
]) {
  invariant(bootstrap.includes(required), `Bootstrap first-paint table ownership is missing ${required}.`);
}
invariant(!bootstrap.includes("primePlayerTableScroller"), "Bootstrap must not switch table scroller classes after first paint.");
invariant(!bootstrap.includes("__mflTableWidthRuntime?.apply"), "Bootstrap must not apply or rewrite table widths.");
invariant(!bootstrap.includes('selectionHeader.className = "selectionCell col-select";'), "Selection width must belong to the colgroup, not the header cell.");
invariant(
  bootstrap.includes("const FIRST_PAINT_CONTRACT_COLUMNS = APP_CONFIG.table.contractColumns;")
    && bootstrap.includes('const viewColumns = normalizedView === "contracts" ? FIRST_PAINT_CONTRACT_COLUMNS : FIRST_PAINT_STAT_COLUMNS;'),
  "Contracts first paint must consume the canonical semantic column order from app config.",
);
invariant(
  bootstrap.includes('const targetClasses = ["col-select", "col-actions", ...columns.map((column) => firstPaintTableColumnClass(column))];')
    && bootstrap.includes("const alreadyCanonical = existingCols.length === targetClasses.length")
    && bootstrap.includes("if (!alreadyCanonical) {"),
  "Bootstrap must preserve an already-canonical colgroup.",
);
invariant(!bootstrap.includes("cell.colSpan = 16"), "First-paint loading rows must not collapse into one colspan cell.");
invariant(
  bootstrap.includes('const renderedColumns = Array.from(colGroup?.children || []);')
    && bootstrap.includes('const columnCount = Math.max(1, renderedColumns.length || document.getElementById("tableHead")?.querySelector("tr")?.cells.length || 1);'),
  "First-paint loading rows must use the rendered column count.",
);

const initialStructureIndex = bootstrap.indexOf("primeInitialTableStructure(tablePage, view);");
const initialRowsIndex = bootstrap.indexOf("primeInitialTableRows();", initialStructureIndex);
const revealIndex = bootstrap.indexOf('document.querySelectorAll("main > .pageView")', initialStructureIndex);
invariant(initialStructureIndex >= 0 && initialRowsIndex > initialStructureIndex && revealIndex > initialRowsIndex, "First paint must build columns/header, rows, then reveal the table.");

for (const required of [
  'const BLANK_ROW_CLASS = "mflTableLoadingRow";',
  'Reflect.get(window, "__mflPrimeTableRows")',
  "primeRows(true);",
]) {
  invariant(tableLoadingRuntime.includes(required), `Runtime table loading must reuse bootstrap ownership through ${required}.`);
}
for (const forbidden of ["BLANK_ROW_OPACITIES", "document.createDocumentFragment()", "__mflTableWidthRuntime", "TABLE_ROW_HEIGHT = 39", "installStyles()"] ) {
  invariant(!tableLoadingRuntime.includes(forbidden), `Runtime loading must not regain duplicate geometry through ${forbidden}.`);
}

for (const forbidden of ["STATIC_TABLE_", "FILTER_STORAGE_KEY", 'document.createElement("th")', 'document.createElement("col")', "__mflTableWidthRuntime", "table.style.width", "table.style.minWidth"]) {
  invariant(!staticUiRuntime.includes(forbidden), `Static UI must not duplicate table ownership through ${forbidden}.`);
}
invariant(
  staticUiRuntime.includes('Reflect.get(window, "__mflPrimeTableHeaderSignature")')
    && staticUiRuntime.includes('Reflect.get(window, "__mflPrimeTableStructure")')
    && staticUiRuntime.includes("return Boolean(primeStructure(state.page, state.view));"),
  "Static UI must delegate table headers to the bootstrap owner.",
);

invariant(!/\.col-(?:select|id|flag|name|listing|age|positions|seasons|stat|overall|agent|contract-revenue|contract-club|contract-division|link)[^{]*\{[^}]*width\s*:/s.test(responsive), "Responsive CSS must not override Uniform Width column percentages.");
invariant(!responsive.includes("1240px"), "Responsive CSS must not own a fixed player table width.");
invariant(
  !responsive.includes(".mflTableLoadingRow"),
  "Responsive CSS must not own loading-row height; loading rows inherit the populated-row geometry.",
);

invariant(
  appCoreSource.includes("const alreadyCanonical = existingCols.length === targetClasses.length")
    && appCoreSource.includes("if (alreadyCanonical) return;"),
  "Canonical app-core colgroup ownership must be idempotent.",
);
const appendStatValueStart = appCoreSource.indexOf("function appendStatValue(cell, row, statColumn) {");
const appendStatValueEnd = appCoreSource.indexOf("function tableInteractiveKey(", appendStatValueStart);
invariant(appendStatValueStart >= 0 && appendStatValueEnd > appendStatValueStart, "Table stat renderer must remain directly inspectable.");
const appendStatValueSource = appCoreSource.slice(appendStatValueStart, appendStatValueEnd);
invariant(
  appendStatValueSource.indexOf('if (state.view === "next")') >= 0
    && appendStatValueSource.indexOf('if (state.view === "next")') < appendStatValueSource.indexOf('if (statColumn === "overall")'),
  "Next Overall must return before the rarity circle is rendered.",
);
invariant(
  appendStatValueSource.includes('contentHost.className = "tableOverallCellContent";')
    && appendStatValueSource.includes('rarityCircle.className = "tableOverallRarityCircle";')
    && appendStatValueSource.includes('rarityColorForOverall(value)')
    && appendStatValueSource.includes('contentHost.appendChild(rarityCircle);')
    && appendStatValueSource.includes('cell.appendChild(contentHost);')
    && appendStatValueSource.includes('contentHost.appendChild(progressionElement);'),
  "Every non-Next table Overall must use one vertically centered content host with the canonical rarity circle and progression.",
);
invariant(
  styles.includes("#progressionPage #tableBody .tableOverallCellContent {")
    && styles.includes("display: inline-flex;")
    && styles.includes("align-items: center;")
    && styles.includes("height: var(--mfl-table-row-height);")
    && styles.includes("#progressionPage #tableBody .tableOverallRarityCircle {")
    && styles.includes("flex: 0 0 8px;")
    && styles.includes("width: 8px;")
    && styles.includes("height: 8px;")
    && styles.includes("background: var(--mfl-overall-rarity-color, var(--text-muted));"),
  "Overall rarity circles must be exactly 8x8px and centered by a row-height inline-flex content host.",
);

const clubFinishStart = appCoreSource.indexOf("function finishClubSwitch() {");
const clubFinishEnd = appCoreSource.indexOf("function hideClubPageControls() {", clubFinishStart);
invariant(clubFinishStart >= 0 && clubFinishEnd > clubFinishStart, "Canonical Club completion owner must remain directly inspectable.");
const clubFinishSection = appCoreSource.slice(clubFinishStart, clubFinishEnd);
invariant(
  !clubFinishSection.includes("buildTableColGroup()"),
  "Club completion must not rebuild an already-rendered colgroup.",
);

const widthAssertIndex = bootstrapCore.indexOf("assertUniformWidthContract();");
const appImportIndex = bootstrapCore.indexOf('await import(new URL("/modules/app-entry.js"');
invariant(widthAssertIndex >= 0 && appImportIndex > widthAssertIndex, "Uniform Width must be asserted before app-core table rendering.");
invariant(
  bootstrapCore.includes('window.__mflUniformWidth?.name !== "Uniform Width"')
    && !bootstrapCore.includes("ensureFirstPaintTableWidths")
    && !bootstrapCore.includes("__mflTableWidthRuntime"),
  "Bootstrap core must consume Uniform Width only as a marker.",
);

console.log("Uniform Width single-source, bootstrap-owned static headers/loading rows, and stable-colgroup validation passed.");
