import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const write = (path, content) => writeFile(new URL(path, import.meta.url), content, "utf8");

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

let appCore = await read("./modules/app-core.js");

appCore = replaceOnce(
  appCore,
  `  if (!route) {\n    return false;\n  }\n\n  const loadAndRender = async () => {`,
  `  if (!route) {\n    return false;\n  }\n\n  state.page = page;\n\n  const loadAndRender = async () => {`,
  "pager target state before cached incremental reload",
);

appCore = replaceOnce(
  appCore,
  `  if (incrementalRouteIsCached(route, page)) {\n    return loadAndRender();\n  }\n\n  state.page = page;\n  return withInteractionBusy(loadAndRender, options.loadingReason);`,
  `  if (incrementalRouteIsCached(route, page)) {\n    return loadAndRender();\n  }\n\n  return withInteractionBusy(loadAndRender, options.loadingReason);`,
  "duplicate uncached-only pager state assignment",
);

appCore = replaceOnce(
  appCore,
  `prevButton.addEventListener("click", () => {\n  if (state.incrementalMode) {\n    void reloadIncrementalPage(Math.max(1, state.page - 1));`,
  `prevButton.addEventListener("click", () => {\n  if (state.incrementalMode) {\n    void reloadIncrementalPage(Math.max(1, state.page - 1), { loadingMode: "blank" });`,
  "previous-page incremental reload",
);

appCore = replaceOnce(
  appCore,
  `nextButton.addEventListener("click", () => {\n  if (state.incrementalMode) {\n    void reloadIncrementalPage(state.page + 1);`,
  `nextButton.addEventListener("click", () => {\n  if (state.incrementalMode) {\n    void reloadIncrementalPage(state.page + 1, { loadingMode: "blank" });`,
  "next-page incremental reload",
);

let pagerValidation = await read("./validate-pager-current-page.mjs");
pagerValidation = replaceOnce(
  pagerValidation,
  `const [controls, interactions, selectionStack, appCore, buildNormalizer, tableRuntime] = await Promise.all([\n  read("./controls.css"),\n  read("./control-interactions-runtime.js"),\n  read("./selection-stack-runtime.js"),\n  read("./modules/app-core.js"),\n  read("./modules/app-core-build-normalizer.js"),\n  read("./modules/app-core-table-runtime.js"),\n]);`,
  `const [controls, interactions, selectionStack, appCore, generatedCore, buildNormalizer, tableRuntime] = await Promise.all([\n  read("./controls.css"),\n  read("./control-interactions-runtime.js"),\n  read("./selection-stack-runtime.js"),\n  read("./modules/app-core.js"),\n  read("./modules/app-core-runtime.js"),\n  read("./modules/app-core-build-normalizer.js"),\n  read("./modules/app-core-table-runtime.js"),\n]);`,
  "pager validation generated-core input",
);

const regression = `
const reloadStart = appCore.indexOf("async function reloadIncrementalPage(page = state.page, options = {}) {");
const reloadEnd = appCore.indexOf("window.mflReloadIncrementalPage = reloadIncrementalPage;", reloadStart);
const reloadSource = appCore.slice(reloadStart, reloadEnd);
const generatedReloadStart = generatedCore.indexOf("async function reloadIncrementalPage(page = state.page, options = {}) {");
const generatedReloadEnd = generatedCore.indexOf("window.mflReloadIncrementalPage = reloadIncrementalPage;", generatedReloadStart);
const generatedReloadSource = generatedCore.slice(generatedReloadStart, generatedReloadEnd);
invariant(
  reloadStart >= 0
    && reloadEnd > reloadStart
    && reloadSource.indexOf("state.page = page;") < reloadSource.indexOf("if (incrementalRouteIsCached(route, page))")
    && reloadSource.split("state.page = page;").length === 2
    && generatedReloadStart >= 0
    && generatedReloadEnd > generatedReloadStart
    && generatedReloadSource.indexOf("state.page = page;") < generatedReloadSource.indexOf("if (incrementalRouteIsCached(route, page))")
    && generatedReloadSource.split("state.page = page;").length === 2,
  "Pager target page must be committed before cached and uncached incremental reload paths diverge.",
);
invariant(
  appCore.includes('void reloadIncrementalPage(Math.max(1, state.page - 1), { loadingMode: "blank" });')
    && appCore.includes('void reloadIncrementalPage(state.page + 1, { loadingMode: "blank" });')
    && generatedCore.includes('void reloadIncrementalPage(Math.max(1, state.page - 1), { loadingMode: "blank" });')
    && generatedCore.includes('void reloadIncrementalPage(state.page + 1, { loadingMode: "blank" });'),
  "Previous and next pager buttons must use the same canonical five-row blank loading path as direct page entry.",
);
`;

pagerValidation = replaceOnce(
  pagerValidation,
  `\nconsole.log("Editable pager window-capture Escape cancellation validation passed with global editable-control priority.");`,
  `${regression}\nconsole.log("Editable pager window-capture Escape cancellation validation passed with cached and uncached page navigation coverage.");`,
  "pager validation completion marker",
);

await write("./modules/app-core.js", appCore);
await write("./validate-pager-current-page.mjs", pagerValidation);

console.log("Applied PR #428 pager runtime correction.");
