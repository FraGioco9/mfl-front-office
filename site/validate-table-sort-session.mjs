import fs from "node:fs";
import assert from "node:assert/strict";

const core = fs.readFileSync(new URL("./modules/app-core.js", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("./bootstrap.js", import.meta.url), "utf8");
const entry = fs.readFileSync(new URL("./modules/app-entry.js", import.meta.url), "utf8");

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

assert.match(core, /tableSortSessionKey:\s*""/u, "Table state must own one transient sort-session key.");
assert.match(core, /tableSortSessionSortState:\s*null/u, "Table state must own one page-level transient sort intent.");
assert.doesNotMatch(core, /tableSortSessionViewStates/u, "Per-view session sorting must not compete with the page-level sort intent.");
assert.match(core, /pageName === "club"[\s\S]{0,180}sortKey:\s*"positions"[\s\S]{0,100}sortDirection:\s*"asc"/u, "Club pages must retain Positions ascending as their canonical default.");
assert.match(core, /sortKey:\s*"overall",\s*\n\s*sortDirection:\s*"desc"/u, "Non-Club table views must default to Overall descending.");
assert.doesNotMatch(core, /sortDirection:\s*viewName === "next" \? "asc" : "desc"/u, "Next Overall must not default ascending.");

const resetSessionSource = sourceBetween(core, "function resetTableSortSession", "function defaultTablePageState");
assert.match(resetSessionSource, /state\.tableSortSessionSortState = null;/u, "Changing page/entity must clear the previous page sort intent.");
assert.match(resetSessionSource, /state\.tableSortSessionSortState = defaultSortState;/u, "A new page session must start from its canonical default.");

const standardViewSource = sourceBetween(core, "async function setView(viewName)", "function mflChunkFromPublicData");
assert.doesNotMatch(standardViewSource, /rememberTableSortState/u, "View switching must not rewrite the page-level sort intent.");
assert.match(standardViewSource, /tableSortStateForView\([\s\S]*viewName/u, "Standard view switches must resolve the existing page sort against the destination view.");

const incrementalViewSource = sourceBetween(core, "setView = async function setIncrementalView", "setPage = async function setIncrementalPage");
assert.doesNotMatch(incrementalViewSource, /rememberTableSortState/u, "Incremental view loading must not own a separate per-view sort state.");
assert.match(incrementalViewSource, /tableSortStateForView\([\s\S]*nextView/u, "Incremental view switches must resolve the same page-level sort intent.");

const incrementalPageSource = sourceBetween(core, "setPage = async function setIncrementalPage", "function divisionInfo");
assert.ok(incrementalPageSource.indexOf("resetTableSortSession(pageName, options);") < incrementalPageSource.indexOf("runPageTransition"), "Page sorting must reset before the destination transition can paint.");

const sortClickSource = sourceBetween(core, "function buildHeader()", "function isMissingSortValue");
assert.match(sortClickSource, /rememberTableSortState\(\);\s*state\.page = 1;\s*buildHeader\(\);\s*applyFilters\(\);/u, "Only a deliberate header sort click should commit a new page-level sort intent.");
assert.doesNotMatch(core, /function applyFilters\(options = \{\}\) \{\s*rememberTableSortState/u, "Filter application must not overwrite page-level sorting during a view fallback.");

const commitViewSource = sourceBetween(core, "function commitViewTransition", "function commitPageTransition");
assert.match(commitViewSource, /buildHeader\(\);/u, "View transitions must rebuild the sorted header before their runtime paint.");
const loadingShellSource = sourceBetween(core, "function renderTableLoadingShell", "async function setPage");
assert.ok(loadingShellSource.indexOf("updateViewButtons();") < loadingShellSource.indexOf("buildHeader();"), "Loading shells must rebuild the header immediately after syncing the destination view.");

const bootstrapSortSource = sourceBetween(bootstrap, "function firstPaintTableSortState", "function firstPaintTableHeaderSignature");
assert.doesNotMatch(bootstrapSortSource, /storedTablePageState|viewSortStates|savedSort/u, "Refresh first paint must never resurrect persisted sorting.");
assert.match(bootstrapSortSource, /normalizedPage === "club"[\s\S]*positions[\s\S]*asc/u, "Club refresh first paint must show Positions ascending.");
assert.match(bootstrapSortSource, /sortKey: "overall", sortDirection: "desc"/u, "Every non-Club refresh first paint, including Next Overall, must show Overall descending.");

assert.match(core, /state\.view === "next"[\s\S]{0,180}column === "overall"[\s\S]{0,120}tableNextOverallPreciseValue\(row\)/u, "Next Overall sortable values must use the displayed precise Overall value.");
assert.match(core, /state\.sortKey === "overall"[\s\S]{0,220}tableNextOverallPreciseValue\(a\)[\s\S]{0,120}tableNextOverallPreciseValue\(b\)/u, "Next Overall comparisons must sort the displayed Overall value instead of the needed gain.");
assert.match(core, /state\.currentPage === "progression" && \(state\.view === "current" \|\| state\.view === "all"\) && statColumns\.includes\(column\)[\s\S]{0,180}getProgressionColumn\(column\)[\s\S]{0,100}getValue\(row, "overall"\)/u, "Progression sorting must compare Overall/stat progression first and Overall second.");
assert.match(core, /comparisonDirection = state\.currentPage === "progression" && index > 0 \? -1 : direction/u, "Progression tie-breaks must keep higher Overall first after equal progression.");
assert.match(core, /compareRowsWithClubPositionOrder|clubPositionSort/u, "Existing Club position-order ownership must remain intact.");
assert.match(entry, /sortKey:\s*"positions"[\s\S]{0,80}sortDirection:\s*"asc"/u, "Club route bootstrap must keep Positions ascending.");

console.log("Table sort session validation passed.");

