import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [controls, interactions, selectionStack, appCore, generatedCore, tableRuntime] = await Promise.all([
  read("./controls.css"),
  read("./control-interactions-runtime.js"),
  read("./selection-stack-runtime.js"),
  Promise.all([
    Promise.resolve(readCanonicalCoreSource("shared")),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
]);

for (const required of [
  "#pagerCurrentPageInput {",
  "box-sizing: border-box;",
  "flex: 0 0 calc(5ch + 12px);",
  "width: calc(5ch + 12px);",
  "min-width: calc(5ch + 12px);",
  "max-width: calc(5ch + 12px);",
  "padding: 0 5px;",
  "font: inherit;",
  "font-variant-numeric: tabular-nums;",
  "#pagerCurrentPageInput:hover:not(:disabled),",
  "#pagerCurrentPageInput:focus:not(:disabled),",
  "border-color: var(--primary-hover);",
  "background: var(--row-hover);",
  "caret-color: var(--text);",
  "cursor: text;",
  "user-select: text;",
  "outline: 0;",
  "box-shadow: none;",
]) {
  invariant(controls.includes(required), `Editable pager styling is missing ${required}`);
}
invariant(
  !controls.includes("#pagerCurrentPageInput {\n  box-sizing: border-box;\n  flex: 0 0 52px;")
    && !controls.includes("width: 52px;\n  min-width: 52px;\n  max-width: 52px;"),
  "Pager current-page width must scale with its inherited font instead of using the old fixed 52px box.",
);

invariant(interactions.includes('window.addEventListener("keydown", onEscapeCapture, true);'), "Global Escape ownership must run at window capture before document-level focus fallback.");
invariant(!interactions.includes("pagerCurrentPageInput"), "Global Escape ownership must remain generic rather than hard-coding the pager input.");
const globalEscapeStart = interactions.indexOf("function onEscapeCapture(event) {");
const globalKeyDownStart = interactions.indexOf("function onKeyDown(event) {", globalEscapeStart);
invariant(globalEscapeStart >= 0 && globalKeyDownStart > globalEscapeStart, "Global Escape capture must remain structurally isolated.");
const globalEscapeCapture = interactions.slice(globalEscapeStart, globalKeyDownStart);
invariant(!globalEscapeCapture.includes(".blur()"), "Global Escape dispatch must not blur the pager before its local cancel owner runs.");
invariant(selectionStack.includes("if (editableEscapeTarget(event.target)) return false;"), "Selection-level Escape ownership must defer to focused editable controls such as the pager input.");

for (const required of [
  'const PAGER_CURRENT_PAGE_INPUT_ID = "pagerCurrentPageInput";',
  "let pagerEditRevision = 0;",
  "function cancelPagerCurrentPageEdit(input) {",
  "function installPagerEscapeCapture() {",
  "function syncPagerCurrentPage(currentPage, totalPages) {",
  "function installPagerCurrentPageControl() {",
  "input.maxLength = 5;",
  "installPagerCurrentPageControl();",
  "syncPagerCurrentPage(1, 1);",
  "syncPagerCurrentPage(state.page, totalPages);",
]) {
  invariant(appCore.includes(required), `Canonical app-core must own editable pager behavior through ${required}`);
}

for (const required of [
  "let pagerEditRevision = 0;",
  "let pagerEscapeCaptureInstalled = false;",
  "function resetPagerCurrentPage(input) {",
  "function cancelPagerCurrentPageEdit(input) {",
  "function installPagerEscapeCapture() {",
  'window.addEventListener("keydown", (event) => {',
  'event.key !== "Escape" || !(target instanceof HTMLInputElement) || target.id !== PAGER_CURRENT_PAGE_INPUT_ID',
  "event.stopImmediatePropagation();",
  "cancelPagerCurrentPageEdit(target);",
  "installPagerEscapeCapture();",
  "input.maxLength = 5;",
  "const revision = pagerEditRevision;",
  "queueMicrotask(() => {",
  "revision !== pagerEditRevision",
  "const target = Math.min(total, Math.max(1, parsed));",
  "syncPagerCurrentPage(state.page, totalPages);",
]) {
  invariant(tableRuntime.includes(required), `Generated Table pager runtime is missing ${required}`);
}

const escapeCaptureStart = tableRuntime.indexOf("function installPagerEscapeCapture() {");
const pagerInstallStart = tableRuntime.indexOf("function installPagerCurrentPageControl() {");
invariant(escapeCaptureStart >= 0 && pagerInstallStart > escapeCaptureStart, "Pager Escape capture must be defined before the pager control installs.");
const escapeCapture = tableRuntime.slice(escapeCaptureStart, pagerInstallStart);
invariant(escapeCapture.includes('window.addEventListener("keydown", (event) => {') && escapeCapture.includes("}, true);"), "Pager Escape cancellation must run at window capture phase before document-level Escape owners.");
invariant(escapeCapture.indexOf("event.stopImmediatePropagation();") < escapeCapture.indexOf("cancelPagerCurrentPageEdit(target);"), "Pager Escape capture must stop downstream global Escape handlers before canceling the edit.");

const focusStart = tableRuntime.indexOf('controls.input.addEventListener("focus", () => {');
const inputStart = tableRuntime.indexOf('controls.input.addEventListener("input", () => {', focusStart);
invariant(focusStart >= 0 && inputStart > focusStart, "Pager focus and input handlers must both exist in the generated Table runtime.");
const focusSection = tableRuntime.slice(focusStart, inputStart);
invariant(!focusSection.includes(".select()") && !appCore.includes("controls.input.select();"), "Pager focus must preserve native mouse caret and drag-selection behavior instead of force-selecting the full value.");
invariant(
  appCore.includes('input.type = "text";')
    && appCore.includes('input.inputMode = "numeric";')
    && appCore.includes("input.maxLength = 5;")
    && tableRuntime.includes('input.type = "text";')
    && tableRuntime.includes('input.inputMode = "numeric";')
    && tableRuntime.includes("input.maxLength = 5;"),
  "Pager page entry must remain a numeric-mode text input with a native five-character limit so native text selection stays available.",
);

const blurStart = tableRuntime.indexOf('controls.input.addEventListener("blur", () => {');
const inputKeydownStart = tableRuntime.indexOf('controls.input.addEventListener("keydown", (event) => {', blurStart);
invariant(blurStart >= 0 && inputKeydownStart > blurStart, "Pager blur and input keydown handlers must both exist in the generated Table runtime.");
const blurSection = tableRuntime.slice(blurStart, inputKeydownStart);
invariant(blurSection.indexOf("queueMicrotask(() => {") < blurSection.indexOf("void commitPagerCurrentPage(controls.input);"), "Pager blur navigation must remain deferred so cancellation can invalidate a pending commit.");
invariant(blurSection.includes("revision !== pagerEditRevision"), "Pager blur navigation must remain invalidated by a later cancel revision.");
const inputKeydownEnd = tableRuntime.indexOf("  [prevButton, nextButton].forEach", inputKeydownStart);
const inputKeydown = tableRuntime.slice(inputKeydownStart, inputKeydownEnd);
invariant(inputKeydown.includes('event.key !== "Enter"'), "Pager input keydown must continue to commit Enter.");
invariant(!inputKeydown.includes('"Escape"'), "Pager Escape must not depend on the later input-target keydown phase.");

invariant(
  appCore.includes("const parsed = /^\\d{1,5}$/.test(raw) ? Number.parseInt(raw, 10) : current;")
    && appCore.includes('const digits = raw.replace(/\\D+/g, "").slice(0, 5);')
    && appCore.includes("if (digits !== raw) controls.input.value = digits;")
    && appCore.includes('await reloadIncrementalPage(target, { loadingMode: "blank" });')
    && tableRuntime.includes("const parsed = /^\\d{1,5}$/.test(raw) ? Number.parseInt(raw, 10) : current;")
    && tableRuntime.includes('const digits = raw.replace(/\\D+/g, "").slice(0, 5);')
    && tableRuntime.includes("if (digits !== raw) controls.input.value = digits;")
    && tableRuntime.includes('await reloadIncrementalPage(target, { loadingMode: "blank" });'),
  "Pager numeric entry must remain positive-digit-only, truncate input to five digits, and request the canonical blank loading rows for page changes.",
);
invariant(
  !appCore.includes("const negative = raw.trimStart().startsWith(\"-\");")
    && !appCore.includes("const parsed = /^-?\\d+$/.test(raw)")
    && !tableRuntime.includes("const negative = raw.trimStart().startsWith(\"-\");")
    && !tableRuntime.includes("const parsed = /^-?\\d+$/.test(raw)"),
  "Pager entry must not retain the old negative or unbounded digit path.",
);
invariant(
  !appCore.includes("const parsed = /^\\\\d{1,5}$/.test(raw)")
    && !appCore.includes('raw.replace(/\\\\D+/g, "")')
    && !tableRuntime.includes("const parsed = /^\\\\d{1,5}$/.test(raw)")
    && !tableRuntime.includes('raw.replace(/\\\\D+/g, "")'),
  "Pager digit regexes must not be double-escaped in authored or generated source.",
);

const reloadStart = appCore.indexOf("async function reloadIncrementalPage(page = state.page, options = {}) {");
const reloadEnd = appCore.indexOf("window.mflReloadIncrementalPage = reloadIncrementalPage;", reloadStart);
const reloadSource = appCore.slice(reloadStart, reloadEnd);
const generatedReloadStart = generatedCore.indexOf("async function reloadIncrementalPage(page = state.page, options = {}) {");
const generatedReloadEnd = generatedCore.indexOf("window.mflReloadIncrementalPage = reloadIncrementalPage;", generatedReloadStart);
const generatedReloadSource = generatedCore.slice(generatedReloadStart, generatedReloadEnd);
invariant(
  reloadStart >= 0 && reloadEnd > reloadStart && reloadSource.indexOf("state.page = page;") < reloadSource.indexOf("if (incrementalRouteIsCached(route, page))") && reloadSource.split("state.page = page;").length === 2
    && generatedReloadStart >= 0 && generatedReloadEnd > generatedReloadStart && generatedReloadSource.indexOf("state.page = page;") < generatedReloadSource.indexOf("if (incrementalRouteIsCached(route, page))") && generatedReloadSource.split("state.page = page;").length === 2,
  "Pager target page must be committed before cached and uncached incremental reload paths diverge.",
);
const previousPageHandler = 'void reloadIncrementalPage(Math.max(1, state.page - 1), { loadingMode: "blank" });';
const nextPageHandler = 'void reloadIncrementalPage(state.page + 1, { loadingMode: "blank" });';
invariant(
  appCore.includes(previousPageHandler)
    && appCore.includes(nextPageHandler)
    && !generatedCore.includes(previousPageHandler)
    && !generatedCore.includes(nextPageHandler)
    && tableRuntime.includes(previousPageHandler)
    && tableRuntime.includes(nextPageHandler),
  "Previous and next pager buttons must use the same canonical five-row blank loading path as direct page entry from the lazy Table runtime.",
);

console.log("Editable pager validation passed with a scalable five-digit input, a hard five-digit entry cap, native text selection, Escape cancellation, lazy previous/next ownership, and cached/uncached page navigation coverage.");
