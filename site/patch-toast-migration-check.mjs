import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./migrate-remove-global-loading-toast.mjs", import.meta.url);
let source = await readFile(path, "utf8");
const before = `for (const [label, source] of [
  ["app-entry.js", appEntry],
  ["loading.css", loadingCss],
  ["responsive.css", responsiveCss],
  ["validate-loading-ownership.mjs", loadingValidator],
  ["validate-home-summary-first-paint.mjs", homeValidator],
  ["validate-evaluation-search-lifecycle.mjs", evaluationValidator],
  ["validate-z-index-ownership.mjs", zIndexValidator],
]) {`;
const after = `for (const [label, source] of [
  ["app-entry.js", appEntry],
  ["loading.css", loadingCss],
  ["responsive.css", responsiveCss],
]) {`;
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error("Could not find migration verification source list.");
  source = source.replace(before, after);
  await writeFile(path, source);
}
console.log("Narrowed loading-toast migration verification to production owners.");
