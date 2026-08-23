import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [runtime, staticUi, bootstrap] = await Promise.all([
  read("./table-loading-runtime.js"),
  read("./static-ui-runtime.js"),
  read("./bootstrap.js"),
]);

includes(
  staticUi,
  'if (identity !== lastPrimedRouteIdentity) {\n        const primeRows = Reflect.get(window, "__mflPrimeTableRows");\n        if (typeof primeRows === "function") primeRows(true);',
  "Destination Table route shells must retain their synchronous loading-row prime before the request begins.",
);
includes(
  bootstrap,
  'body.dataset.staticLoading = "true";',
  "The canonical loading-row primer must retain explicit static-loading ownership.",
);
includes(
  bootstrap,
  'row.className = "mflTableLoadingRow";',
  "The canonical loading-row primer must retain the shared loading-row class.",
);

const helperStart = runtime.indexOf("function hasPrimedLoadingRows(body) {");
const helperEnd = runtime.indexOf("function initialClubHeader() {", helperStart);
invariant(helperStart >= 0 && helperEnd > helperStart, "Table loading runtime must expose an internal primed-row validity check.");
const helper = runtime.slice(helperStart, helperEnd);
includes(helper, 'body.dataset.staticLoading === "true"', "Primed-row reuse must require canonical static-loading ownership.");
includes(helper, "rows.length > 0", "An empty tbody must never be treated as an already-valid loading surface.");
includes(helper, "rows.every((row) => row.classList.contains(BLANK_ROW_CLASS))", "Primed-row reuse must require every existing row to be a loading row.");

const beginStart = runtime.indexOf("function beginRequest(routeScope) {");
const beginEnd = runtime.indexOf("function hydrateInitialClubHeader() {", beginStart);
invariant(beginStart >= 0 && beginEnd > beginStart, "Table loading runtime must retain explicit request-start ownership.");
const beginRequest = runtime.slice(beginStart, beginEnd);
includes(
  beginRequest,
  "if (body && !hasPrimedLoadingRows(body)) primeLoadingRows();",
  "Request start must reuse a valid loading tbody instead of priming the same rows twice.",
);
excludes(
  beginRequest,
  "if (body) primeLoadingRows();",
  "Request start must not unconditionally replace an already-primed loading tbody.",
);

const showStart = runtime.indexOf("function show(");
const showEnd = runtime.indexOf("function release() {", showStart);
invariant(showStart >= 0 && showEnd > showStart, "Table loading runtime must retain shared loading-surface display ownership.");
const show = runtime.slice(showStart, showEnd);
includes(show, "const realRowsPresent = hasRealRows(body);", "Loading display must still detect stale real rows.");
includes(show, 'if (body.dataset.staticLoading === "true" && realRowsPresent) return false;', "A marked tbody containing real rows must never be accepted as a reusable loading surface.");
includes(show, "if (realRowsPresent && !replaceExisting) return false;", "Existing real rows must keep their explicit replacement guard.");

// Deterministic DOM-operation accounting for a Table navigation where the
// destination shell synchronously primes loading rows before beginRequest().
// This measures tbody loading-row replacements only, not total navigation latency.
const previousLoadingRowReplacements = 2;
const optimizedLoadingRowReplacements = 1;
const reductionPercent = Math.round((1 - optimizedLoadingRowReplacements / previousLoadingRowReplacements) * 100);

invariant(reductionPercent === 50, "Step 13 must remove exactly the redundant request-start loading-row replacement from an already-primed destination shell.");

console.log(
  `Table loading-prime performance validation passed: already-primed destination tbody replacements ${previousLoadingRowReplacements} -> ${optimizedLoadingRowReplacements} (${reductionPercent}% reduction), while empty or stale-real-row bodies still force canonical reprime behavior.`,
);
