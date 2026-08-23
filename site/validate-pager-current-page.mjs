import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [controls, interactions, tableRuntime] = await Promise.all([
  read("./controls.css"),
  read("./control-interactions-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
]);

for (const required of [
  "#pagerCurrentPageInput {",
  "width: 52px;",
  "font: inherit;",
  "#pagerCurrentPageInput:hover:not(:disabled),",
  "#pagerCurrentPageInput:focus:not(:disabled),",
  "border-color: var(--primary-hover);",
  "background: var(--row-hover);",
  "caret-color: var(--text);",
  "outline: 0;",
  "box-shadow: none;",
]) {
  invariant(controls.includes(required), `Editable pager styling is missing ${required}`);
}

const pagerEscapeExemption = 'if (active instanceof HTMLInputElement && active.id === "pagerCurrentPageInput") return;';
const genericEscapeBlur = "if (active instanceof HTMLElement && active !== document.body) active.blur();";
invariant(interactions.includes(pagerEscapeExemption), "Global Escape handling must leave pager cancellation to the pager input owner.");
invariant(
  interactions.indexOf(pagerEscapeExemption) < interactions.indexOf(genericEscapeBlur),
  "Pager Escape exemption must run before the global generic blur.",
);

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
invariant(
  escapeCaptureStart >= 0 && pagerInstallStart > escapeCaptureStart,
  "Pager Escape capture must be defined before the pager control installs.",
);
const escapeCapture = tableRuntime.slice(escapeCaptureStart, pagerInstallStart);
invariant(
  escapeCapture.includes('window.addEventListener("keydown", (event) => {') && escapeCapture.includes("}, true);"),
  "Pager Escape cancellation must run at window capture phase before document-level Escape owners.",
);
invariant(
  escapeCapture.indexOf("event.stopImmediatePropagation();") < escapeCapture.indexOf("cancelPagerCurrentPageEdit(target);"),
  "Pager Escape capture must stop downstream global Escape handlers before canceling the edit.",
);

const blurStart = tableRuntime.indexOf('controls.input.addEventListener("blur", () => {');
const inputKeydownStart = tableRuntime.indexOf('controls.input.addEventListener("keydown", (event) => {', blurStart);
invariant(blurStart >= 0 && inputKeydownStart > blurStart, "Pager blur and input keydown handlers must both exist in the generated Table runtime.");
const blurSection = tableRuntime.slice(blurStart, inputKeydownStart);
invariant(
  blurSection.indexOf("queueMicrotask(() => {") < blurSection.indexOf("void commitPagerCurrentPage(controls.input);"),
  "Pager blur navigation must remain deferred so cancellation can invalidate a pending commit.",
);
invariant(
  blurSection.includes("revision !== pagerEditRevision"),
  "Pager blur navigation must remain invalidated by a later cancel revision.",
);
const inputKeydownEnd = tableRuntime.indexOf("  [prevButton, nextButton].forEach", inputKeydownStart);
const inputKeydown = tableRuntime.slice(inputKeydownStart, inputKeydownEnd);
invariant(inputKeydown.includes('event.key !== "Enter"'), "Pager input keydown must continue to commit Enter.");
invariant(!inputKeydown.includes('"Escape"'), "Pager Escape must not depend on the later input-target keydown phase.");

console.log("Editable pager window-capture Escape cancellation validation passed.");
