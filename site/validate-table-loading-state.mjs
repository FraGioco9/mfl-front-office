import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [runtime, bootstrap, stylesBase, appCoreSource] = await Promise.all([
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./styles-base.css"),
  read("./modules/app-core.js"),
]);

for (const required of [
  'input.checked = false;',
  'input.indeterminate = false;',
  'input.disabled = false;',
  'if (document.activeElement === input) input.blur();',
  'neutralizeSelectionHeader();',
]) {
  invariant(runtime.includes(required), `Loading header selection must stay neutral through ${required}`);
}
invariant(
  !runtime.includes("input.disabled = true;"),
  "Loading must not use the browser disabled-checkbox appearance for the header selector.",
);

invariant(
  bootstrap.includes('function neutralizeFirstPaintSelectionHeader(head) {')
    && bootstrap.includes('neutralizeFirstPaintSelectionHeader(head);')
    && bootstrap.includes('selectionInput.checked = false;')
    && bootstrap.includes('selectionInput.indeterminate = false;')
    && bootstrap.includes('selectionInput.disabled = false;'),
  "The first-paint header selector must be neutral before the table is revealed, including when static header DOM is reused.",
);

invariant(
  appCoreSource.includes('if (document.documentElement.classList.contains("mflDataLoading")) {')
    && appCoreSource.includes('selectVisibleInput.checked = false;')
    && appCoreSource.includes('selectVisibleInput.indeterminate = false;')
    && appCoreSource.includes('selectVisibleInput.disabled = false;'),
  "The canonical selection-header owner must refuse checked, indeterminate, or disabled visual states while table data is loading.",
);

invariant(
  bootstrap.includes('const renderedColumns = Array.from(colGroup?.children || []);')
    && bootstrap.includes('const nameColumnIndex = renderedColumns.findIndex((column) => column.classList.contains("col-name"));')
    && bootstrap.includes('if (columnIndex === nameColumnIndex) {')
    && bootstrap.includes('nameCell.className = "playerNameCell";')
    && bootstrap.includes('cell.appendChild(nameCell);'),
  "The synchronous bootstrap must render all blank loading rows with final loaded-row player-name geometry before first paint.",
);

invariant(
  !runtime.includes("normalizeLoadingRowGeometry")
    && !runtime.includes("loadingNameColumnIndex"),
  "The loading runtime must not repair row geometry after first paint; bootstrap owns it synchronously.",
);

invariant(
  bootstrap.includes("const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];")
    && bootstrap.includes('row.className = "mflTableLoadingRow";'),
  "Table loading must continue rendering exactly five blank rows.",
);

invariant(
  stylesBase.includes("#tableBody .playerNameCell {\n  min-height: 38px;\n  align-items: center;\n}"),
  "Loaded rows and first-paint blank rows must share the same player-name geometry.",
);

console.log("Table loading header selector stays visually neutral and five-row geometry is synchronous at first paint.");
