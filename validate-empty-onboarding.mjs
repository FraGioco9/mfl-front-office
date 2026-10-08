import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("./" + path, import.meta.url), "utf8");
const source = read("modules/core-sources/table.js");
const start = source.indexOf("function tableRenderEmptyDiscoveryAction() {");
const end = source.indexOf("function appliedTableFilterSignature(rules) {", start);
assert.ok(start > 0 && end > start, "Action must remain inside canonical Table core");

function fixture({ page, sourceRows, optedIn = true, searchExists = true }) {
  const actions = [];
  const appended = [];
  let openCount = 0;
  const state = { currentPage: page, tableSourceRowsCount: sourceRows, currentWatchlistId: "list-id", view: "stats" };
  const globalSearch = searchExists ? { click: () => { openCount += 1; } } : null;
  const ctx = vm.createContext({
    state,
    hasWalletOptIn: () => optedIn,
    emptyState: { appendChild: button => appended.push(button) },
    document: {
      getElementById: id => id === "openSearchButton" ? globalSearch : null,
      createElement: tag => {
        assert.equal(tag, "button");
        return {
          addEventListener(event, cb) { actions.push({ event, cb }); },
          click() { actions.find(a => a.event === "click")?.cb(); },
        };
      },
    },
  });
  vm.runInContext(source.slice(start, end), ctx);
  ctx.tableRenderEmptyDiscoveryAction();
  return { appended, getOpenCount: () => openCount, state, actions };
}

for (const p of ["watchlist", "myplayers"]) {
  const a = fixture({ page: p, sourceRows: 0 });
  assert.equal(a.appended.length, 1, p + " should have one contextual action");
  const button = a.appended[0];
  assert.equal(button.id, "tableEmptyDiscoverPlayersButton");
  assert.equal(button.type, "button");
  assert.equal(button.className, "compactButton");
  assert.equal(button.textContent, p === "watchlist" ? "Find players" : "Explore players");
  assert.equal(a.getOpenCount(), 0, "Rendering must not open the search");
  button.click();
  assert.equal(a.getOpenCount(), 1, "The action reuses the existing Search control");
  assert.equal(a.state.currentWatchlistId, "list-id", "Preserve active watchlist identity");
  assert.equal(a.state.view, "stats", "Preserve the selected view");
}

for (const scenario of [
  { page: "watchlist", sourceRows: 3 },
  { page: "myplayers", sourceRows: 10 },
  { page: "watchlist", sourceRows: 0, optedIn: false },
  { page: "myplayers", sourceRows: 0, optedIn: false },
  { page: "database", sourceRows: 0 },
  { page: "club", sourceRows: 0 },
  { page: "agents", sourceRows: 0 },
  { page: "watchlist", sourceRows: 0, searchExists: false },
]) {
  const state = fixture(scenario);
  assert.equal(state.appended.length, 0,
    JSON.stringify(scenario) + " must not offer a misleading or inaccessible discovery action");
}

const lifecycle = read("modules/core-sources/table-render-lifecycle.js");
assert.match(lifecycle, /if \(pageRows\.length === 0\) \{\s*tableRenderEmptyFilterAction\(\);\s*tableRenderEmptyDiscoveryAction\(\);\s*\}/);
assert.match(lifecycle, /emptyState\.textContent = tableEmptyStateMessage\(\);/);
assert.match(lifecycle, /emptyState\.hidden = pageRows\.length > 0;/);
assert.match(source, /if \(Number\(state\.tableSourceRowsCount \|\| 0\) > 0 \|\| !hasWalletOptIn\(\)\) return;/);
assert.match(source, /tableCanClearFiltersFromEmptyState\(\)/);
console.log("UX-02E actual-empty Watchlist/My Players discovery action is scoped and keyboard-clickable.");
