import fs from "node:fs";
import assert from "node:assert/strict";

const core = fs.readFileSync(new URL("./modules/app-core.js", import.meta.url), "utf8");
const entry = fs.readFileSync(new URL("./modules/app-entry.js", import.meta.url), "utf8");

function sourceBetween(start, end) {
  const startIndex = core.indexOf(start);
  const endIndex = core.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return core.slice(startIndex, endIndex);
}

assert.match(core, /tableSortSessionKey:\s*""/u, "Table state must own one transient sort-session key.");
assert.match(core, /tableSortSessionViewStates:\s*\{\}/u, "Table state must remember per-view sorting only inside the active page session.");
assert.match(core, /pageName === "club"[\s\S]{0,180}sortKey:\s*"positions"[\s\S]{0,100}sortDirection:\s*"asc"/u, "Club pages must retain Positions ascending as their canonical default.");
assert.match(core, /sortKey:\s*"overall",\s*\n\s*sortDirection:\s*"desc"/u, "Non-Club table views must default to Overall descending.");
assert.doesNotMatch(core, /sortDirection:\s*viewName === "next" \? "asc" : "desc"/u, "Next Overall must no longer default ascending.");

const resetSessionSource = sourceBetween("function resetTableSortSession", "function defaultTablePageState");
assert.match(resetSessionSource, /state\.tableSortSessionViewStates = \{\};/u, "Changing page/entity must clear transient per-view sorting.");
assert.ok(resetSessionSource.indexOf("state.tableSortSessionViewStates = {};") < resetSessionSource.indexOf("defaultSortStateForView"), "Transient view sorts must clear before canonical defaults are applied.");

assert.match(core, /function tableSortStateForView\(/u, "Same-page view switches must resolve sorting from the transient page session.");
assert.match(core, /function rememberTableSortStateForView\(/u, "Sort changes must be remembered per view until the page session ends.");

const standardViewSource = sourceBetween("async function setView(viewName)", "function mflChunkFromPublicData");
assert.ok(standardViewSource.indexOf("rememberTableSortStateForView(state.view") < standardViewSource.indexOf("state.view = viewName"), "Standard view switches must save the current view sort before changing views.");
assert.match(standardViewSource, /tableSortStateForView\([\s\S]*viewName/u, "Standard view switches must restore the destination view's session sort.");

const incrementalViewSource = sourceBetween("setView = async function setIncrementalView", "setPage = async function setIncrementalPage");
assert.ok(incrementalViewSource.indexOf("rememberTableSortStateForView") < incrementalViewSource.indexOf("const targetSortState = tableSortStateForView"), "Incremental view switches must save the previous sort before resolving the next one.");
assert.match(incrementalViewSource, /tableSortStateForView\([\s\S]*nextView/u, "Incremental view switches must restore the destination view's session sort.");

const incrementalPageSource = sourceBetween("setPage = async function setIncrementalPage", "function divisionInfo");
assert.ok(incrementalPageSource.indexOf("resetTableSortSession(pageName, options);") < incrementalPageSource.indexOf("runPageTransition"), "Page sorting must reset before the destination transition can paint.");

const commitViewSource = sourceBetween("function commitViewTransition", "function commitPageTransition");
assert.match(commitViewSource, /buildHeader\(\);/u, "View transitions must rebuild the sorted header before their first paint.");
const loadingShellSource = sourceBetween("function renderTableLoadingShell", "async function setPage");
assert.ok(loadingShellSource.indexOf("updateViewButtons();") < loadingShellSource.indexOf("buildHeader();"), "Loading shells must rebuild the header immediately after syncing the destination view.");

assert.match(core, /state\.view === "next"[\s\S]{0,180}column === "overall"[\s\S]{0,120}tableNextOverallPreciseValue\(row\)/u, "Next Overall sortable values must use the displayed precise Overall value.");
assert.match(core, /state\.sortKey === "overall"[\s\S]{0,220}tableNextOverallPreciseValue\(a\)[\s\S]{0,120}tableNextOverallPreciseValue\(b\)/u, "Next Overall comparisons must sort the displayed Overall value instead of the needed gain.");
assert.match(core, /state\.currentPage === "progression" && \(state\.view === "current" \|\| state\.view === "all"\) && statColumns\.includes\(column\)[\s\S]{0,180}getProgressionColumn\(column\)[\s\S]{0,100}getValue\(row, "overall"\)/u, "Progression stat sorting must compare progression first and Overall second.");
assert.match(core, /comparisonDirection = state\.currentPage === "progression" && index > 0 \? -1 : direction/u, "Progression tie-breaks must keep higher Overall first after equal progression.");
assert.match(core, /function applyFilters\(options = \{\}\) \{\s*rememberTableSortStateForView\(\);/u, "Canonical filter application must retain the active view sort for the page session.");
assert.match(core, /compareRowsWithClubPositionOrder|clubPositionSort/u, "Existing Club position-order ownership must remain intact.");
assert.match(entry, /sortKey:\s*"positions"[\s\S]{0,80}sortDirection:\s*"asc"/u, "Club route bootstrap must keep Positions ascending.");

console.log("Table sort session validation passed.");
