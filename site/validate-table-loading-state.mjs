import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [runtime, bootstrap, stylesBase, appCoreSource, generatedCore, tableRuntime] = await Promise.all([
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./styles-base.css"),
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
]);

for (const required of [
  'input.checked = false;',
  'input.indeterminate = false;',
  'input.disabled = true;',
  'if (document.activeElement === input) input.blur();',
  'neutralizeSelectionHeader();',
]) {
  invariant(runtime.includes(required), `Loading header selection must stay neutral through ${required}`);
}
invariant(
  !runtime.includes("input.disabled = false;"),
  "Loading must keep the header selector disabled until the table request is released.",
);

invariant(
  bootstrap.includes('function neutralizeFirstPaintSelectionHeader(head) {')
    && bootstrap.includes('neutralizeFirstPaintSelectionHeader(head);')
    && bootstrap.includes('selectionInput.checked = false;')
    && bootstrap.includes('selectionInput.indeterminate = false;')
    && bootstrap.includes('selectionInput.disabled = true;'),
  "The first-paint header selector must be neutral before the table is revealed, including when static header DOM is reused.",
);

const loadingGuardMarkers = [
  'if (document.documentElement.classList.contains("mflDataLoading") && !rendered) {',
  'function updateSelectionHeader(pageRows = currentPageRows(), { rendered = false } = {}) {',
  'updateSelectionBar(pageRows, { rendered: true });',
  'selectVisibleInput.checked = false;',
  'selectVisibleInput.indeterminate = false;',
  'selectVisibleInput.disabled = true;',
];
for (const marker of loadingGuardMarkers) {
  invariant(appCoreSource.includes(marker), `Canonical selection-header loading guard is missing ${marker}`);
  invariant(tableRuntime.includes(marker), `Generated table runtime selection-header loading guard is missing ${marker}`);
}

for (const required of [
  'const TABLE_ROUTE_SCOPES = new Set(["database", "progression", "mfl", "agent", "watchlist", "myplayers", "club"]);',
  "let nextRequestToken = 0;",
  "let activeRequestToken = 0;",
  "function requestActive() {",
  "function beginRequest(routeScope, options = {}) {",
  'const scope = String(routeScope || "").toLowerCase();',
  "!TABLE_ROUTE_SCOPES.has(scope)",
  "activeRequestToken = token;",
  "function hidePager() {",
  "if (page) page.hidden = true;",
  "hidePager();",
  "function finishRequest(token) {",
  "requestToken !== activeRequestToken",
  "activeRequestToken = 0;",
  "if (requestActive()) return false;",
  "finishRequest,",
  "requestActive,",
  'if (body.dataset.staticLoading === "true" && realRowsPresent) return false;',
]) {
  invariant(runtime.includes(required), `Request-bound table loading ownership is missing ${required}`);
}
const beginRequestStart = runtime.indexOf("function beginRequest(routeScope, options = {}) {");
const beginRequestEnd = runtime.indexOf("function hydrateInitialClubHeader() {", beginRequestStart);
const beginRequestSource = runtime.slice(beginRequestStart, beginRequestEnd);
invariant(
  runtime.includes("function hasCanonicalLoadingRows(body) {")
    && runtime.includes('body.dataset.staticLoading === "true"')
    && runtime.includes("body.rows.length === 5")
    && runtime.includes("Array.from(body.rows).every((row) => row.classList.contains(BLANK_ROW_CLASS))")
    && beginRequestSource.includes("if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();"),
  "A refresh request must adopt the five blank rows already painted by bootstrap instead of replacing them a second time.",
);
invariant(
  beginRequestStart >= 0
    && beginRequestEnd > beginRequestStart
    && !beginRequestSource.includes("tableRouteActive()")
    && !beginRequestSource.includes("loadingSnapshot().dataLoading"),
  "An explicit table request must not depend on the previous DOM route or global data-loading flag before resetting stale rows.",
);

for (const required of [
  "function initialClubHeader() {",
  'root.classList.contains("mflInitialRouteResolved")',
  'String(root.dataset.initialTablePage || "").toLowerCase() !== "club"',
  'head.dataset.mflStaticHeader !== "true"',
  'const signatureFor = Reflect.get(window, "__mflPrimeTableHeaderSignature");',
  'String(head.dataset.mflHeaderSignature || "") !== expectedSignature',
  "function normalizeInitialClubHeaderGeometry() {",
  'head.dataset.mflClubHeaderGeometry === "canonical"',
  'cell.classList.remove("sortable");',
  'cell.querySelectorAll(":scope > .sortArrow").forEach((arrow) => arrow.remove());',
  'cell.querySelector(":scope > span")?.textContent === "Positions"',
  'arrow.className = "sortArrow asc";',
  'head.dataset.mflClubHeaderGeometry = "canonical";',
  'if (normalizeInitialClubHeaderGeometry()) return true;',
  "function hydrateInitialClubHeader() {",
  'const setVisiblePlayersSelected = Reflect.get(window, "setVisiblePlayersSelected");',
  'selectVisibleInput.dataset.mflClubHeaderBound !== "true"',
  'selectVisibleInput.addEventListener("change", () => setVisiblePlayersSelected(selectVisibleInput.checked));',
  'selectVisibleInput.dataset.mflClubHeaderBound = "true";',
  "function releaseInitialClubHeader() {",
  'head.dataset.mflStaticHeader !== "true" || head.dataset.mflClubHeaderGeometry !== "canonical"',
  "delete head.dataset.mflStaticHeader;",
  "delete head.dataset.mflClubHeaderGeometry;",
  "normalizeInitialClubHeaderGeometry();\n\n  if (typeof controller?.subscribe",
]) {
  invariant(runtime.includes(required), `Club refresh header handoff is missing ${required}`);
}

const normalizeStart = runtime.indexOf("function normalizeInitialClubHeaderGeometry() {");
const normalizeEnd = runtime.indexOf("function ensureCanonicalHeader() {", normalizeStart);
const normalizeSource = runtime.slice(normalizeStart, normalizeEnd);
invariant(
  normalizeStart >= 0
    && normalizeEnd > normalizeStart
    && normalizeSource.includes('cell.classList.remove("sortable");')
    && normalizeSource.includes('arrow.className = "sortArrow asc";'),
  "Club header geometry must be normalized before the request starts.",
);

const hydrateStart = runtime.indexOf("function hydrateInitialClubHeader() {");
const hydrateEnd = runtime.indexOf("function releaseInitialClubHeader() {", hydrateStart);
const hydrateSource = runtime.slice(hydrateStart, hydrateEnd);
invariant(
  hydrateStart >= 0
    && hydrateEnd > hydrateStart
    && hydrateSource.includes('selectVisibleInput.addEventListener("change"')
    && !hydrateSource.includes('cell.classList.remove("sortable")')
    && !hydrateSource.includes('arrow.className = "sortArrow asc";')
    && !hydrateSource.includes("delete head.dataset.mflStaticHeader"),
  "Inner request completion may hydrate Club header behavior but must preserve both geometry and static-header ownership.",
);

const releaseHeaderStart = runtime.indexOf("function releaseInitialClubHeader() {");
const releaseHeaderEnd = runtime.indexOf("function finishRequest(token) {", releaseHeaderStart);
const releaseHeaderSource = runtime.slice(releaseHeaderStart, releaseHeaderEnd);
invariant(
  releaseHeaderStart >= 0
    && releaseHeaderEnd > releaseHeaderStart
    && releaseHeaderSource.includes("delete head.dataset.mflStaticHeader;")
    && releaseHeaderSource.includes("delete head.dataset.mflClubHeaderGeometry;"),
  "Only the final Club loading handoff may release bootstrap static-header ownership.",
);

const finishRequestStart = runtime.indexOf("function finishRequest(token) {");
const finishRequestEnd = runtime.indexOf("function show(", finishRequestStart);
const finishRequestSource = runtime.slice(finishRequestStart, finishRequestEnd);
invariant(
  finishRequestStart >= 0
    && finishRequestEnd > finishRequestStart
    && finishRequestSource.includes("hydrateInitialClubHeader();")
    && !finishRequestSource.includes('classList.remove("sortable")')
    && !finishRequestSource.includes("sortArrow")
    && !finishRequestSource.includes("delete head.dataset.mflStaticHeader")
    && !finishRequestSource.includes("delete body.dataset.staticLoading")
    && !finishRequestSource.includes("primeLoadingRows()"),
  "Completing the inner data request must not mutate Club geometry or release either static-header or loading-tbody ownership.",
);

const releaseStart = runtime.indexOf("function release() {");
const releaseEnd = runtime.indexOf("function sync(", releaseStart);
const releaseSource = runtime.slice(releaseStart, releaseEnd);
invariant(
  releaseStart >= 0
    && releaseEnd > releaseStart
    && releaseSource.includes("releaseInitialClubHeader();")
    && releaseSource.includes("delete body.dataset.staticLoading;")
    && releaseSource.includes('body.querySelectorAll(`:scope > .${BLANK_ROW_CLASS}`).forEach((row) => row.remove());')
    && releaseSource.indexOf("releaseInitialClubHeader();") < releaseSource.indexOf("delete body.dataset.staticLoading;"),
  "Final table-loading release must atomically hand off the Club header before clearing the loading tbody marker.",
);

const requestBoundaryMarker = 'window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode })';
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

const requestFinishMarker = 'window.__mflTableLoadingRuntime?.finishRequest?.(tableLoadingRequestToken);';
invariant(
  appCoreSource.includes(requestBoundaryMarker)
    && !appCoreSource.includes("preservePager")
    && appCoreSource.includes(requestFinishMarker)
    && appCoreSource.includes('function tableRenderTableOwner() {\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\n  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;'),
  "Canonical application source must preserve first-paint loading rows until data is authoritative and guard active requests.",
);
invariant(
  appCoreSource.includes("requestIncrementalRoute(route, 1")
    && !appCoreSource.includes("preservePager"),
  "View transitions must use the same pager-hidden Table loading contract as every other uncached request."
);

const incrementalPageStart = appCoreSource.indexOf("setPage = async function setIncrementalPage(");
const incrementalPageEnd = appCoreSource.indexOf("function divisionInfo(", incrementalPageStart);
const incrementalPageSource = appCoreSource.slice(incrementalPageStart, incrementalPageEnd);
const progressionTokenIndex = incrementalPageSource.indexOf('const progressionLoadingRequestToken = pageName === "progression" && !routeDataCacheReady(pageName, options)');
const pageTransitionIndex = incrementalPageSource.indexOf("return runPageTransition(pageName, navigationUpdatesHistory, options, (navigationTransition) => setPage(pageName, false, {");
invariant(
  appCoreSource.includes("const inheritedTableLoadingRequestToken = Number(options.tableLoadingRequestToken || 0);")
    && appCoreSource.includes("async function renderLoadedIncrementalRoute(pageName, updateHash, options, route, requestOptions = {})")
    && appCoreSource.includes("const payload = await requestIncrementalRoute(route, 1, {")
    && appCoreSource.includes("__mflNavigationTransition: options.__mflNavigationTransition || null")
    && incrementalPageStart >= 0
    && incrementalPageEnd > incrementalPageStart
    && pageTransitionIndex >= 0
    && progressionTokenIndex > pageTransitionIndex
    && incrementalPageSource.includes("skipNavigationTransition: true")
    && incrementalPageSource.includes("__mflNavigationUpdatesHistory: navigationUpdatesHistory")
    && incrementalPageSource.includes("tableLoadingRequestToken: progressionLoadingRequestToken")
    && incrementalPageSource.includes("finally {\n        window.__mflTableLoadingRuntime?.finishRequest?.(progressionLoadingRequestToken);"),
  "Page loading must stay inside the route-transition loader, while Progression acquires its canonical Table request token only in the recursive loading pass and keeps it through final render.",
);

for (const retiredOwner of [
  "normalizeTableRequestLoadingBoundary",
  "tableRequestLoadingArtifacts",
  "normalizePagerCurrentPageLifecycle",
  "pagerCurrentPageArtifacts",
  "normalizeTableControlCellAlignment",
  "tableControlCellArtifacts",
  "normalizeHomeSummaryLifecycle",
  "homeSummaryArtifacts",
  "normalizeGlobalSearchOpenLifecycle",
  "globalSearchArtifacts",
  "normalizeEvaluationRecentReadiness",
  "evaluationRecentArtifacts",
  "normalizeEvaluationLoadLifecycle",
  "evaluationLoadArtifacts",
  "normalizeEvaluationSavedValuationCache",
  "app-core-build-normalizer",
]) {
  invariant(!appCoreSource.includes(retiredOwner), `Canonical application source must not contain retired build owner ${retiredOwner}.`);
  invariant(!generatedCore.includes(retiredOwner), `Generated shared runtime must not contain retired build owner ${retiredOwner}.`);
}

const generatedBoundaryIndex = generatedCore.indexOf(requestBoundaryMarker);
const generatedPromiseIndex = generatedCore.indexOf("let requestPromise = force ? null : state.incrementalRequestPromises.get(cacheKey);");
const generatedApplyIndex = generatedCore.indexOf("applyIncrementalPayload(route, payload);", generatedBoundaryIndex);
const generatedFinishAfterApplyIndex = generatedCore.indexOf(requestFinishMarker, generatedApplyIndex);
invariant(
  generatedBoundaryIndex >= 0
    && generatedPromiseIndex > generatedBoundaryIndex
    && generatedApplyIndex > generatedPromiseIndex
    && generatedFinishAfterApplyIndex > generatedApplyIndex,
  "Generated shared core must hold the table request token from request acquisition through fresh payload application.",
);

invariant(
  tableRuntime.includes("function tableRenderTableOwner() {\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\n  if (tableBody.dataset.staticLoading === \"true\" && !state.dataLoaded) return;"),
  "The generated Table renderer must preserve first-paint loading rows until authoritative data exists and during active requests.",
);
invariant(
  !tableRuntime.includes('document.documentElement.classList.contains("mflDataLoading") && !state.incrementalApplying')
    && !tableRuntime.includes("commitFinalRender"),
  "Table render isolation must be request-token based, not tied to broad global loading or final-render commit flags.",
);

invariant(
  tableRuntime.includes('const clubPositionSort = state.currentPage === "club" && column === "positions";')
    && tableRuntime.includes('if (state.currentPage !== "club" && sortableColumns.has(column)) {'),
  "The pre-request Club header normalization must match the non-sortable Club header contract used by the runtime.",
);

invariant(
  bootstrap.includes('const renderedColumns = Array.from(colGroup?.children || []);')
    && bootstrap.includes('const nameColumnIndex = renderedColumns.findIndex((column) => column.classList.contains("col-name"));')
    && bootstrap.includes('if (columnIndex === nameColumnIndex) {')
    && bootstrap.includes('nameCell.className = "playerNameCell";')
    && bootstrap.includes('cell.appendChild(nameCell);'),
  "The synchronous bootstrap must render all blank loading rows with final loaded-row player-name geometry before first paint.",
);

invariant(
  !runtime.includes("normalizeLoadingRowGeometry")
    && !runtime.includes("loadingNameColumnIndex"),
  "The loading runtime must not repair row geometry after first paint; bootstrap owns it synchronously.",
);

invariant(
  bootstrap.includes("const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];")
    && bootstrap.includes('row.className = "mflTableLoadingRow";'),
  "Table loading must continue rendering exactly five blank rows.",
);

invariant(
  stylesBase.includes("#tableBody .playerNameCell {\n  min-height: 38px;\n  align-items: center;\n}"),
  "Loaded rows and first-paint blank rows must share the same player-name geometry.",
);

console.log("All table-backed routes keep one source-owned stable loading tbody, and Club refresh preserves its canonical first-paint header through the entire nested load until the final shared release.");
