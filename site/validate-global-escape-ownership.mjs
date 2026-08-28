import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [controls, dropdowns, selectionStack, appEntry, appConfig, tableRuntime, staticUi] = await Promise.all([
  read("./control-interactions-runtime.js"),
  read("./dropdowns-runtime.js"),
  read("./selection-stack-runtime.js"),
  read("./modules/app-entry.js"),
  read("./modules/app-config.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./static-ui-runtime.js"),
]);

includes(appEntry, '"/control-interactions-runtime.js"', "The global control-interaction runtime must remain universally loaded.");
includes(appConfig, '"/selection-stack-runtime.js"', "Selection Stack must remain a canonical post-Table runtime dependency.");
includes(appEntry, "await loadScriptGroup(plan.postCore);", "app-entry must consume canonical post-core runtime dependencies.");

includes(controls, "const escapeHandlers = new Map();", "Global Escape ownership must have one shared handler registry.");
includes(controls, "function registerEscapeHandler(key, handler, options = {}) {", "Global Escape ownership must expose feature registration.");
includes(controls, "function dispatchEscapeHandlers(event) {", "Global Escape ownership must dispatch registered feature owners centrally.");
includes(controls, 'window.addEventListener("keydown", onEscapeCapture, true);', "Global Escape dispatch must run at window capture before document-level fallback behavior.");
includes(controls, "event.stopImmediatePropagation();", "A claimed Escape event must stop before competing document handlers run.");
excludes(controls, 'pagerCurrentPageInput', "Global Escape dispatch must not contain pager-specific exemptions.");

const escapeCaptureStart = controls.indexOf("function onEscapeCapture(event) {");
const keyDownStart = controls.indexOf("function onKeyDown(event) {", escapeCaptureStart);
invariant(escapeCaptureStart >= 0 && keyDownStart > escapeCaptureStart, "The global Escape capture owner must remain structurally isolated.");
const escapeCapture = controls.slice(escapeCaptureStart, keyDownStart);
excludes(escapeCapture, ".blur()", "Global Escape ownership must not blur controls before feature handlers can cancel.");

for (const required of [
  'const FILTER_CONTROL_SELECTOR = "input, select, textarea, button, [tabindex]";',
  "function filterControlForTarget(target) {",
  "function handleFilterControlEscape(event) {",
  'document.querySelector(".siteDatePicker")',
  "control.blur();",
  'window.__mflControlInteractionsRuntime?.registerEscapeHandler?.(',
  '"filter-controls",',
  "handleFilterControlEscape,",
  "{ priority: 300 },",
]) {
  includes(dropdowns, required, `Filters capture-phase Escape ownership is missing ${required}`);
}
includes(dropdowns, "return true;", "Focused Filters controls must claim Escape after synchronous blur.");
excludes(dropdowns, "function handleDropdownEscape() {", "Filters Escape ownership must not depend on native select :open detection.");
excludes(dropdowns, 'document.addEventListener("keyup", (event) => {\n    if (event.key !== "Escape") return;', "Filters Escape ownership must not depend on keyup delivery from native select menus.");

includes(selectionStack, "function editableEscapeTarget(target) {", "Selection Stack must defer Escape while an editable control owns focus.");
for (const editableType of ["HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "target.isContentEditable"]) {
  includes(selectionStack, editableType, `Selection Stack editable Escape priority is missing ${editableType}.`);
}
includes(selectionStack, "if (editableEscapeTarget(event.target)) return false;", "Selection Stack must decline Escape for focused editable controls before clearing selection.");
includes(selectionStack, 'register("selection-stack", handleEscape, { priority: 100 });', "Selection Stack Escape behavior must register with the global owner.");
includes(selectionStack, "unregisterEscapeHandler?.();", "Selection Stack must release its global Escape registration on teardown.");
excludes(selectionStack, 'document.addEventListener("keydown"', "Selection Stack must not install a competing document-level Escape listener.");
excludes(selectionStack, 'document.removeEventListener("keydown"', "Selection Stack teardown must not own a document-level Escape listener.");

includes(tableRuntime, 'window.addEventListener("keydown", (event) => {', "The pager must retain its earlier window-capture hard-cancel path until it is migrated onto the shared registry.");
includes(tableRuntime, 'target.id !== PAGER_CURRENT_PAGE_INPUT_ID', "The pager hard-cancel path must remain target-specific.");

includes(staticUi, 'if (event.key !== "Escape") return;', "Static UI must retain the neutral Escape fallback for unclaimed events.");
includes(staticUi, "queueMicrotask(() => {", "Neutral Escape focus release must remain deferred until feature ownership has had a chance to claim the event.");

console.log("Global Escape ownership validation passed with capture-phase Filters control release, editable-control priority, centralized feature dispatch, and neutral fallback focus release.");