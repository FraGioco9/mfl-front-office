import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [controls, dropdownRuntime] = await Promise.all([
  read("./controls.css"),
  read("./dropdowns-runtime.js"),
]);

for (const required of [
  ".filtersDialog [data-filter-value],\n.filtersDialog select,",
  ".filtersDialog [data-filter-value]:not(:disabled),\n.filtersDialog select:not(:disabled) {\n  cursor: pointer;",
  ".filtersDialog select:hover:not(:disabled)",
  ".filtersDialog select:focus:not(:disabled)",
]) {
  invariant(controls.includes(required), `Filter popup controls are missing canonical hover ownership through ${required}`);
}

for (const required of [
  "function filterSelectForTarget(target) {",
  "document.activeElement instanceof HTMLSelectElement",
  "function blurFilterSelectWhenClosed(target) {",
  "!select.isConnected || isSelectOpen(select)",
  "!isSelectOpen(select) && document.activeElement === select",
  "blurFilterSelectWhenClosed(event.target);",
  '["Enter", "Escape", "Tab"].includes(event.key)',
]) {
  invariant(dropdownRuntime.includes(required), `Filter dropdowns are missing close-state blur ownership through ${required}`);
}

const closeBlurCalls = dropdownRuntime.match(/blurFilterSelectWhenClosed\(event\.target\);/g) || [];
invariant(
  closeBlurCalls.length >= 4,
  "Filter dropdown blur must be checked from pointer, change, keyboard, and click closure paths so reselecting the same option also clears focus.",
);

invariant(
  !dropdownRuntime.includes("function blurFilterSelectAfterCommit(target)"),
  "Filter dropdown focus clearing must not depend only on value-change commits.",
);
invariant(
  !dropdownRuntime.includes("queueMicrotask(() => {\n      if (target.isConnected && document.activeElement === target) target.blur();"),
  "Filter dropdown blur must not run before the native picker close finishes.",
);
invariant(!controls.includes("!important"), "Filter popup interactions must not introduce CSS priority overrides.");
invariant(!dropdownRuntime.includes('document.createElement("style")'), "Filter dropdown behavior must not inject runtime styles.");

console.log("Filter popup hover and close-state blur validation passed.");
