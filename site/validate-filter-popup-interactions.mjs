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
  "function blurFilterSelectAfterCommit(target) {",
  'const filtersModal = document.getElementById("filtersModal");',
  "!filtersModal.contains(target)",
  "window.setTimeout(() => {",
  "target.blur();",
  "window.requestAnimationFrame(() => {",
  "document.activeElement === target) target.blur();",
  'document.addEventListener("change", (event) => {\n    blurFilterSelectAfterCommit(event.target);\n  });',
]) {
  invariant(dropdownRuntime.includes(required), `Filter dropdowns are missing post-commit blur ownership through ${required}`);
}

invariant(
  !dropdownRuntime.includes("queueMicrotask(() => {\n      if (target.isConnected && document.activeElement === target) target.blur();"),
  "Filter dropdown blur must not run before the native picker commit finishes.",
);
invariant(!controls.includes("!important"), "Filter popup interactions must not introduce CSS priority overrides.");
invariant(!dropdownRuntime.includes('document.createElement("style")'), "Filter dropdown behavior must not inject runtime styles.");

console.log("Filter popup hover and post-commit blur validation passed.");
