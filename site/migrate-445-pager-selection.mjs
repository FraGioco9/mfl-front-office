import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const write = (path, content) => writeFile(new URL(path, import.meta.url), content, "utf8");

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

let controls = await read("./controls.css");
controls = replaceOnce(
  controls,
  `  text-align: center;\n  vertical-align: middle;\n  transition: background var(--mfl-motion-fast) ease, border-color var(--mfl-motion-fast) ease, color var(--mfl-motion-fast) ease;`,
  `  text-align: center;\n  vertical-align: middle;\n  cursor: text;\n  user-select: text;\n  transition: background var(--mfl-motion-fast) ease, border-color var(--mfl-motion-fast) ease, color var(--mfl-motion-fast) ease;`,
  "pager text-selection styling",
);

let appCore = await read("./modules/app-core.js");
appCore = replaceOnce(
  appCore,
  `  controls.input.addEventListener("focus", () => {\n    pagerEditRevision += 1;\n    delete controls.input.dataset.cancelCommit;\n    controls.input.select();\n  });`,
  `  controls.input.addEventListener("focus", () => {\n    pagerEditRevision += 1;\n    delete controls.input.dataset.cancelCommit;\n  });`,
  "pager forced focus selection",
);

let validator = await read("./validate-pager-current-page.mjs");
validator = replaceOnce(
  validator,
  `  "caret-color: var(--text);",\n  "outline: 0;",`,
  `  "caret-color: var(--text);",\n  "cursor: text;",\n  "user-select: text;",\n  "outline: 0;",`,
  "pager selection style regression requirements",
);

validator = replaceOnce(
  validator,
  `const blurStart = tableRuntime.indexOf('controls.input.addEventListener("blur", () => {');`,
  `const focusStart = tableRuntime.indexOf('controls.input.addEventListener("focus", () => {');\nconst inputStart = tableRuntime.indexOf('controls.input.addEventListener("input", () => {', focusStart);\ninvariant(focusStart >= 0 && inputStart > focusStart, "Pager focus and input handlers must both exist in the generated Table runtime.");\nconst focusSection = tableRuntime.slice(focusStart, inputStart);\ninvariant(\n  !focusSection.includes(".select()") && !appCore.includes("controls.input.select();"),\n  "Pager focus must preserve native mouse caret and drag-selection behavior instead of force-selecting the full value.",\n);\ninvariant(\n  appCore.includes('input.type = "text";')\n    && appCore.includes('input.inputMode = "numeric";')\n    && tableRuntime.includes('input.type = "text";')\n    && tableRuntime.includes('input.inputMode = "numeric";'),\n  "Pager page entry must remain a text input with numeric input mode so native text selection stays available.",\n);\n\nconst blurStart = tableRuntime.indexOf('controls.input.addEventListener("blur", () => {');`,
  "pager native selection regression coverage",
);

validator = replaceOnce(
  validator,
  `console.log("Editable pager window-capture Escape cancellation validation passed with cached and uncached page navigation coverage.");`,
  `console.log("Editable pager validation passed with native text selection, Escape cancellation, and cached/uncached page navigation coverage.");`,
  "pager validator completion message",
);

await write("./controls.css", controls);
await write("./modules/app-core.js", appCore);
await write("./validate-pager-current-page.mjs", validator);

console.log("Applied issue #445 pager text-selection fix.");
