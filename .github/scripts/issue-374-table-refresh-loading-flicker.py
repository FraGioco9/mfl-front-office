from pathlib import Path

runtime = Path("site/table-loading-runtime.js")
text = runtime.read_text()
old = '''  function hasRealRows(body) {
    return Array.from(body.rows).some((row) => !row.classList.contains(BLANK_ROW_CLASS));
  }

  function shouldPreserveRenderedRows(body = elements().body) {'''
new = '''  function hasRealRows(body) {
    return Array.from(body.rows).some((row) => !row.classList.contains(BLANK_ROW_CLASS));
  }

  function loadingRowsMatchCurrentStructure(body) {
    if (!(body instanceof HTMLTableSectionElement) || body.dataset.staticLoading !== "true") return false;
    const rows = Array.from(body.rows);
    if (rows.length !== 5 || rows.some((row) => !row.classList.contains(BLANK_ROW_CLASS))) return false;
    const colGroup = document.getElementById("tableColGroup");
    const head = document.getElementById("tableHead");
    const columnCount = Math.max(
      1,
      colGroup instanceof HTMLElement ? colGroup.children.length : 0,
      head instanceof HTMLTableSectionElement ? head.rows[0]?.cells.length || 0 : 0,
    );
    return rows.every((row) => row.cells.length === columnCount);
  }

  function shouldPreserveRenderedRows(body = elements().body) {'''
if text.count(old) != 1:
    raise SystemExit("table loading helper anchor mismatch")
text = text.replace(old, new, 1)
old = "    if (body && !preserveRenderedRows) primeLoadingRows();"
new = "    if (body && !preserveRenderedRows && !loadingRowsMatchCurrentStructure(body)) primeLoadingRows();"
if text.count(old) != 1:
    raise SystemExit("beginRequest loading-row anchor mismatch")
runtime.write_text(text.replace(old, new, 1))

core = Path("site/modules/app-core.js")
text = core.read_text()
old = '''function renderTable() {
  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;
  const totalRows = state.incrementalMode ? state.incrementalTotalRows : state.filteredRows.length;'''
new = '''function renderTable() {
  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;
  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;
  const totalRows = state.incrementalMode ? state.incrementalTotalRows : state.filteredRows.length;'''
if text.count(old) != 1:
    raise SystemExit("renderTable loading guard anchor mismatch")
core.write_text(text.replace(old, new, 1))

validator = Path("site/validate-table-loading-state.mjs")
text = validator.read_text()
anchor = '  "function requestActive() {",\n'
addition = (
    '  "function loadingRowsMatchCurrentStructure(body) {",\n'
    '  \'body.dataset.staticLoading !== "true"\',\n'
    '  "rows.length !== 5",\n'
    '  "rows.some((row) => !row.classList.contains(BLANK_ROW_CLASS))",\n'
    '  "rows.every((row) => row.cells.length === columnCount)",\n'
)
if anchor not in text:
    raise SystemExit("validator runtime markers anchor missing")
text = text.replace(anchor, addition + anchor, 1)
old = '''    && appCoreSource.includes('function renderTable() {\\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;'),
  "Canonical application source must directly own the Table request loading boundary and active-request render guard.",'''
new = '''    && appCoreSource.includes('function renderTable() {\\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\\n  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;'),
  "Canonical application source must preserve the first-paint loading tbody until table data is authoritative, while still guarding active requests.",'''
if text.count(old) != 1:
    raise SystemExit("validator canonical render guard anchor mismatch")
text = text.replace(old, new, 1)
old = '''  tableRuntime.includes("function tableRenderTableOwner() {\\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;"),
  "The Table renderer must preserve canonical loading rows while stale state can still be rendered during an active request.",'''
new = '''  tableRuntime.includes("function tableRenderTableOwner() {\\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;\\n  if (tableBody.dataset.staticLoading === \\\"true\\\" && !state.dataLoaded) return;"),
  "The Table renderer must preserve canonical first-paint loading rows until authoritative data exists and while a request is active.",'''
if text.count(old) != 1:
    raise SystemExit("validator generated render guard anchor mismatch")
text = text.replace(old, new, 1)
marker = '''const beginRequestSource = runtime.slice(beginRequestStart, beginRequestEnd);
invariant(
  beginRequestStart >= 0
    && beginRequestEnd > beginRequestStart
    && !beginRequestSource.includes("tableRouteActive()")
    && !beginRequestSource.includes("loadingSnapshot().dataLoading"),
  "An explicit table request must not depend on the previous DOM route or global data-loading flag before resetting stale rows.",
);'''
replacement = '''const beginRequestSource = runtime.slice(beginRequestStart, beginRequestEnd);
invariant(
  beginRequestStart >= 0
    && beginRequestEnd > beginRequestStart
    && !beginRequestSource.includes("tableRouteActive()")
    && !beginRequestSource.includes("loadingSnapshot().dataLoading")
    && beginRequestSource.includes("!loadingRowsMatchCurrentStructure(body)"),
  "An explicit table request must preserve an already-canonical loading tbody without depending on the previous DOM route or global data-loading flag.",
);'''
if text.count(marker) != 1:
    raise SystemExit("validator beginRequest invariant anchor mismatch")
validator.write_text(text.replace(marker, replacement, 1))
