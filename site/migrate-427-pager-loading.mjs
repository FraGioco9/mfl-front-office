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
const pagerRegressionValidation = String.raw`
invariant(
  appCore.includes("const parsed = /^-?\\d+$/.test(raw) ? Number.parseInt(raw, 10) : current;")
    && appCore.includes('const digits = raw.replace(/\\D+/g, "");')
    && appCore.includes('await reloadIncrementalPage(target, { loadingMode: "blank" });')
    && tableRuntime.includes("const parsed = /^-?\\d+$/.test(raw) ? Number.parseInt(raw, 10) : current;")
    && tableRuntime.includes('const digits = raw.replace(/\\D+/g, "");')
    && tableRuntime.includes('await reloadIncrementalPage(target, { loadingMode: "blank" });'),
  "Pager numeric entry must remain digit-aware and page changes must request the canonical blank loading rows.",
);
invariant(
  !appCore.includes("const parsed = /^-?\\\\d+$/.test(raw)")
    && !appCore.includes('raw.replace(/\\\\D+/g, "")')
    && !tableRuntime.includes("const parsed = /^-?\\\\d+$/.test(raw)")
    && !tableRuntime.includes('raw.replace(/\\\\D+/g, "")'),
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
const requestBoundaryMarkerLine = "const requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0;';";
const updatedRequestBoundaryMarkerLine = "const requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode }) || 0;';";
loadingValidation = replaceOnce(
  loadingValidation,
  requestBoundaryMarkerLine,
  updatedRequestBoundaryMarkerLine,
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
  updatedRequestBoundaryMarkerLine,
  `${updatedRequestBoundaryMarkerLine}${loadingRegressionValidation}`,
  "table loading pager regression validation insertion point",
);
await write("./validate-table-loading-state.mjs", loadingValidation);

let backgroundLoadingValidation = await read("./validate-table-background-loading-stability.mjs");
backgroundLoadingValidation = replaceOnce(
  backgroundLoadingValidation,
  '  "const preserveRenderedRows = shouldPreserveRenderedRows(currentBody);",',
  '  \'const preserveRenderedRows = options.loadingMode !== "blank" && shouldPreserveRenderedRows(currentBody);\',',
  "background loading preserve-row marker",
);
backgroundLoadingValidation = replaceOnce(
  backgroundLoadingValidation,
  'const beginStart = runtime.indexOf("function beginRequest(routeScope) {");',
  'const beginStart = runtime.indexOf("function beginRequest(routeScope, options = {}) {");',
  "background loading beginRequest signature marker",
);
backgroundLoadingValidation = replaceOnce(
  backgroundLoadingValidation,
  '    && beginSource.indexOf("shouldPreserveRenderedRows(currentBody)") < beginSource.indexOf("prepareLoadingSurface()")\n    && beginSource.includes("if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();"),',
  '    && beginSource.includes(\'options.loadingMode !== "blank" && shouldPreserveRenderedRows(currentBody)\')\n    && beginSource.indexOf("shouldPreserveRenderedRows(currentBody)") < beginSource.indexOf("prepareLoadingSurface()")\n    && beginSource.includes("if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();"),',
  "background loading blank-mode exception assertion",
);
backgroundLoadingValidation = replaceOnce(
  backgroundLoadingValidation,
  '  "A post-route background request must preserve settled rows and adopt an already-primed refresh skeleton instead of rebuilding it.",',
  '  "A post-route background request must preserve settled rows by default while explicit blank-mode pager requests use the canonical loading skeleton.",',
  "background loading assertion message",
);
backgroundLoadingValidation = replaceOnce(
  backgroundLoadingValidation,
  'console.log("Settled table rows remain visible during ordinary background loading, filter loading uses blank rows, and every active Table load hides pager chrome until the request settles.");',
  'console.log("Settled table rows remain visible during ordinary background loading, pager and filter page loads use blank rows, and every active Table load hides pager chrome until the request settles.");',
  "background loading validation completion message",
);
await write("./validate-table-background-loading-stability.mjs", backgroundLoadingValidation);

console.log("Applied issue #427 pager loading and numeric-entry source migration.");
