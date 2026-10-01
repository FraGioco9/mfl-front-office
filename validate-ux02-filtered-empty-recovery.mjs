import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");
const table = read("modules/core-sources/table.js");
const lifecycle = read("modules/core-sources/table-render-lifecycle.js");
const css = read("styles-base.css");

const start = table.indexOf("function tableHasResettableFilters() {");
const end = table.indexOf("function appliedTableFilterSignature(rules) {", start);
assert.ok(start > 0 && end > start, "UX-02 recovery helper is owned by the table core");
const code = table.slice(start, end);

function fixture({ page = "database", sourceRows = 4, advanced = 0, quick = {} } = {}) {
  let advancedCount = advanced;
  const appended = [];
  const calls = [];
  const inputs = Object.fromEntries(
    ["hideRetiredInput", "hideRetiringInput", "hideMflPlayersInput", "packablePlayersInput", "newMintsInput"]
      .map(name => [name, { checked: Boolean(quick[name]) }]),
  );
  const state = {
    currentPage: page,
    tableSourceRowsCount: sourceRows,
    page: 4,
    sortKey: "overall",
    sortDirection: "desc",
    view: "attributes",
    currentWatchlistId: "watchlist-one",
    pageSize: 100,
  };
  const emptyState = { hidden: false, appendChild(node) { appended.push(node); } };
  const context = vm.createContext({
    ...inputs,
    state,
    emptyState,
    activeFilterCount: () => advancedCount,
    tableClearAdvancedFiltersOwner: applyNow => {
      assert.equal(applyNow, false, "Reset should apply once after all filters are cleared");
      advancedCount = 0;
      calls.push("clear-advanced");
    },
    applyFilters: () => calls.push("apply"),
    document: {
      createElement(tag) {
        assert.equal(tag, "button");
        const handlers = {};
        return {
          disabled: false,
          addEventListener(event, callback) { handlers[event] = callback; },
          click() { handlers.click?.(); },
        };
      },
    },
  });
  vm.runInContext(code, context);
  return { ...context, state, emptyState, inputs, appended, calls, advancedCount: () => advancedCount };
}

for (const scenario of [
  { sourceRows: 0, advanced: 2 },
  { sourceRows: 0, quick: { hideRetiredInput: true } },
  { page: "club", sourceRows: 10, advanced: 2 },
  { page: "database", sourceRows: 4 },
]) {
  const test = fixture(scenario);
  assert.equal(test.tableCanClearFiltersFromEmptyState(), false,
    "Do not offer Clear filters for truly empty, Club or unfiltered data");
  test.tableRenderEmptyFilterAction();
  assert.equal(test.appended.length, 0);
}

for (const scenario of [
  { advanced: 2, quick: { hideRetiredInput: true, hideMflPlayersInput: true } },
  { page: "mfl", quick: { packablePlayersInput: true } },
  { page: "myplayers", quick: { newMintsInput: true, hideRetiringInput: true } },
]) {
  const test = fixture(scenario);
  assert.equal(test.tableCanClearFiltersFromEmptyState(), true);
  test.tableRenderEmptyFilterAction();
  assert.equal(test.appended.length, 1);
  const button = test.appended[0];
  assert.equal(button.id, "tableEmptyClearFiltersButton");
  assert.equal(button.textContent, "Clear filters");
  assert.deepEqual(test.calls, [], "No implicit reset during render");
  button.click();
  assert.equal(button.disabled, true);
  assert.deepEqual(Array.from(test.calls), ["clear-advanced", "apply"], "One authoritative filter reload");
  assert.equal(test.advancedCount(), 0);
  assert.ok(Object.values(test.inputs).every(control => !control.checked));
  assert.equal(test.emptyState.hidden, true, "No stale empty-state flash during the reload");
  assert.equal(test.state.page, 1);
  assert.equal(test.state.pageSize, 100);
  assert.equal(test.state.view, "attributes");
  assert.equal(test.state.sortKey, "overall");
  assert.equal(test.state.sortDirection, "desc");
  assert.equal(test.state.currentWatchlistId, "watchlist-one");
}

assert.match(lifecycle, /emptyState\.textContent = tableEmptyStateMessage\(\);\s*if \(pageRows\.length === 0\) tableRenderEmptyFilterAction\(\);\s*emptyState\.hidden = pageRows\.length > 0;/);
assert.match(lifecycle, /function showTableBusyState\(\)/);
assert.match(lifecycle, /emptyState\.hidden = true;\s*emptyState\.textContent = "";/);
assert.match(css, /\.emptyState \.compactButton \{\s*display: block;\s*margin: 12px auto 0;/);
assert.match(read("controls.css"), /#quickClearFiltersButton \{\s*display: none;/,
  "Do not reintroduce the globally hidden reset button");
console.log("UX-02 Table empty CTA: zero data vs filtered empty, status, single reload and preserved controls passed.");
