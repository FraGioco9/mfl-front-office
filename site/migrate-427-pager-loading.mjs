import { readFile, writeFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const write = (path, content) => writeFile(new URL(path, import.meta.url), content, "utf8");

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function replaceExactCount(source, before, after, expectedCount, label) {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) throw new Error(`Expected ${expectedCount} ${label} occurrence(s), found ${count}`);
  return source.split(before).join(after);
}

let appCore = await read("./modules/app-core.js");
appCore = replaceOnce(
  appCore,
  String.raw`  const parsed = /^-?\\d+$/.test(raw) ? Number.parseInt(raw, 10) : current;`,
  String.raw`  const parsed = /^-?\d+$/.test(raw) ? Number.parseInt(raw, 10) : current;`,
  "double-escaped pager numeric validation",
);
appCore = replaceOnce(
  appCore,
  String.raw`    const digits = raw.replace(/\\D+/g, "");`,
  String.raw`    const digits = raw.replace(/\D+/g, "");`,
  "double-escaped pager input normalization",
);
appCore = replaceOnce(
  appCore,
  "      await reloadIncrementalPage(target);",
  '      await reloadIncrementalPage(target, { loadingMode: "blank" });',
  "pager incremental reload",
);
appCore = replaceOnce(
  appCore,
  "      const payload = await requestIncrementalRoute(route, page);",
  '      const payload = await requestIncrementalRoute(route, page, { loadingMode: options.loadingMode });',
  "incremental page request option forwarding",
);
appCore = replaceOnce(
  appCore,
  "  const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0;",
  '  const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode }) || 0;',
  "table loading request option forwarding",
);
await write("./modules/app-core.js", appCore);

let loadingRuntime = await read("./table-loading-runtime.js");
loadingRuntime = replaceOnce(
  loadingRuntime,
  "  function beginRequest(routeScope) {",
  "  function beginRequest(routeScope, options = {}) {",
  "table loading request options signature",
);
loadingRuntime = replaceOnce(
  loadingRuntime,
  "    const preserveRenderedRows = shouldPreserveRenderedRows(currentBody);",
  '    const preserveRenderedRows = options.loadingMode !== "blank" && shouldPreserveRenderedRows(currentBody);',
  "pager-specific rendered-row preservation",
);
await write("./table-loading-runtime.js", loadingRuntime);

let pagerValidation = await read("./validate-pager-current-page.mjs");
const pagerRegressionValidation = `
invariant(
  appCore.includes(String.raw\`const parsed = /^-?\\d+$/.test(raw) ? Number.parseInt(raw, 10) : current;\`)
    && appCore.includes(String.raw\`const digits = raw.replace(/\\D+/g, "");\`)
    && appCore.includes('await reloadIncrementalPage(target, { loadingMode: "blank" });')
    && tableRuntime.includes(String.raw\`const parsed = /^-?\\d+$/.test(raw) ? Number.parseInt(raw, 10) : current;\`)
    && tableRuntime.includes(String.raw\`const digits = raw.replace(/\\D+/g, "");\`)
    && tableRuntime.includes('await reloadIncrementalPage(target, { loadingMode: "blank" });'),
  "Pager numeric entry must remain digit-aware and page changes must request the canonical blank loading rows.",
);
invariant(
  !appCore.includes(String.raw\`const parsed = /^-?\\\\d+$/.test(raw)\`)
    && !appCore.includes(String.raw\`raw.replace(/\\\\D+/g, "")\`)
    && !tableRuntime.includes(String.raw\`const parsed = /^-?\\\\d+$/.test(raw)\`)
    && !tableRuntime.includes(String.raw\`raw.replace(/\\\\D+/g, "")\`),
  "Pager digit regexes must not be double-escaped in authored or generated source.",
);
`;
pagerValidation = replaceOnce(
  pagerValidation,
  "\nconsole.log(\"Editable pager window-capture Escape cancellation validation passed with global editable-control priority.\");",
  `${pagerRegressionValidation}\nconsole.log("Editable pager window-capture Escape cancellation validation passed with global editable-control priority.");`,
  "pager validation completion marker",
);
await write("./validate-pager-current-page.mjs", pagerValidation);

let loadingValidation = await read("./validate-table-loading-state.mjs");
loadingValidation = replaceExactCount(
  loadingValidation,
  "function beginRequest(routeScope) {",
  "function beginRequest(routeScope, options = {}) {",
  2,
  "table loading beginRequest validation marker",
);
loadingValidation = replaceOnce(
  loadingValidation,
  "const requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0;';",
  "const requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode }) || 0;';",
  "table loading request boundary validation marker",
);
const loadingRegressionValidation = `
invariant(
  beginRequestSource.includes('const preserveRenderedRows = options.loadingMode !== "blank" && shouldPreserveRenderedRows(currentBody);'),
  "Explicit blank-mode requests must replace stale rendered rows with the canonical loading tbody.",
);
invariant(
  appCoreSource.includes('await reloadIncrementalPage(target, { loadingMode: "blank" });')
    && appCoreSource.includes('const payload = await requestIncrementalRoute(route, page, { loadingMode: options.loadingMode });')
    && appCoreSource.includes(requestBoundaryMarker)
    && generatedCore.includes('const payload = await requestIncrementalRoute(route, page, { loadingMode: options.loadingMode });')
    && generatedCore.includes(requestBoundaryMarker)
    && tableRuntime.includes('await reloadIncrementalPage(target, { loadingMode: "blank" });'),
  "Pager page changes must carry blank loading intent from the Table pager through the shared incremental request boundary.",
);
`;
loadingValidation = replaceOnce(
  loadingValidation,
  "\nconst requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode }) || 0;';",
  `${loadingRegressionValidation}\nconst requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode }) || 0;';`,
  "table loading pager regression validation insertion point",
);
await write("./validate-table-loading-state.mjs", loadingValidation);

console.log("Applied issue #427 pager loading and numeric-entry source migration.");
