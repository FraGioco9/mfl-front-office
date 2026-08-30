import fs from "node:fs";
import assert from "node:assert/strict";

const core = fs.readFileSync(new URL("./modules/app-core.js", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("./bootstrap.js", import.meta.url), "utf8");
const entry = fs.readFileSync(new URL("./modules/app-entry.js", import.meta.url), "utf8");
const dataPage = fs.readFileSync(new URL("./api/_data-page.js", import.meta.url), "utf8");

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

const sortResolverSource = sourceBetween(core, "function tableSortStateForView", "function rememberTableSortState");
assert.match(sortResolverSource, /sourceSortSupported = sortKeySupportedByView/u, "View sorting must detect whether the destination supports the active sort column.");
assert.match(sortResolverSource, /if \(!sourceSortSupported && state\.tableSortSessionKey\) \{\s*state\.tableSortSessionSortState = resolvedSortState;/u, "An unsupported destination view must reset the page session itself to that view's canonical default.");

const standardViewSource = sourceBetween(core, "async function setView(viewName)", "function mflChunkFromPublicData");
assert.doesNotMatch(standardViewSource, /rememberTableSortState/u, "View switching must not restore an older per-view sort.");
assert.match(standardViewSource, /tableSortStateForView\([\s\S]*viewName/u, "Standard view switches must resolve sorting against the destination view.");

const incrementalViewSource = sourceBetween(core, "setView = async function setIncrementalView", "setPage = async function setIncrementalPage");
assert.doesNotMatch(incrementalViewSource, /rememberTableSortState/u, "Incremental view loading must not own a separate per-view sort state.");
assert.match(incrementalViewSource, /tableSortStateForView\([\s\S]*nextView/u, "Incremental view switches must resolve the page sort against the destination view.");

const incrementalPageSource = sourceBetween(core, "setPage = async function setIncrementalPage", "function divisionInfo");
assert.ok(incrementalPageSource.indexOf("resetTableSortSession(pageName, options);") < incrementalPageSource.indexOf("runPageTransition"), "Page sorting must reset before the destination transition can paint.");

const sortClickSource = sourceBetween(core, "function buildHeader()", "function isMissingSortValue");
assert.match(sortClickSource, /rememberTableSortState\(\);\s*state\.page = 1;\s*buildHeader\(\);\s*applyFilters\(\);/u, "Only a deliberate header sort click should commit a new page-level sort intent.");
assert.doesNotMatch(core, /function applyFilters\(options = \{\}\) \{\s*rememberTableSortState/u, "Filter application must not overwrite page-level sorting during a view fallback.");

const commitViewSource = sourceBetween(core, "function commitViewTransition", "function commitPageTransition");
assert.match(commitViewSource, /buildHeader\(\);/u, "View transitions must rebuild the sorted header before their runtime paint.");
const runViewTransitionSource = sourceBetween(core, "async function runViewTransition", "function tableSortStateForView");
assert.ok(runViewTransitionSource.indexOf("stageViewTransition(pageName, viewName, options)") < runViewTransitionSource.indexOf('classList.add("mflInitialRouteSuperseded")'), "The canonical view-transition order must remain stage then supersede.");
const canonicalHeaderSource = sourceBetween(core, "function ensureCanonicalTableHeader", "function installTableLoadingOwners");
assert.match(canonicalHeaderSource, /stagedViewCommit[\s\S]{0,700}buildHeader\(\)/u, "A staged destination view must be allowed to replace a stale bootstrap header during loading, including Club views.");
const loadingShellSource = sourceBetween(core, "function renderTableLoadingShell", "async function setPage");
assert.ok(loadingShellSource.indexOf("updateViewButtons();") < loadingShellSource.indexOf("buildHeader();"), "Loading shells must rebuild the header immediately after syncing the destination view.");

const bootstrapSortSource = sourceBetween(bootstrap, "function firstPaintTableSortState", "function firstPaintTableHeaderSignature");
assert.doesNotMatch(bootstrapSortSource, /storedTablePageState|viewSortStates|savedSort/u, "Refresh first paint must never resurrect persisted sorting.");
assert.match(bootstrapSortSource, /normalizedPage === "club"[\s\S]*positions[\s\S]*asc/u, "Club refresh first paint must show Positions ascending.");
assert.match(bootstrapSortSource, /sortKey: "overall", sortDirection: "desc"/u, "Every non-Club refresh first paint must show Overall descending.");

assert.match(core, /state\.view === "next" && statColumns\.includes\(column\)[\s\S]{0,120}return tableNextOverallSortValue\(row, column\);/u, "Next Overall must sort Overall and every stat by the gap to the next Overall +1 target.");
assert.match(core, /state\.view === "next" && statColumns\.includes\(state\.sortKey\)[\s\S]{0,120}compareNextOverallRows\(a, b, state\.sortKey, direction\)/u, "Next Overall comparisons must use the gap comparator for Overall and every stat.");
assert.match(dataPage, /view === "next" && STAT_COLUMNS\.has\(key\)[\s\S]{0,220}key === "overall" \? "next_overall_gap" : `\$\{key\}_to_next_overall`/u, "Incremental Next Overall sorting must use next_overall_gap for Overall and *_to_next_overall for stats.");
assert.match(core, /state\.currentPage === "progression" && \(state\.view === "current" \|\| state\.view === "all"\) && statColumns\.includes\(column\)[\s\S]{0,180}getProgressionColumn\(column\)[\s\S]{0,100}getValue\(row, "overall"\)/u, "Progression sorting must compare Overall/stat progression first and Overall second.");
assert.match(core, /comparisonDirection = state\.currentPage === "progression" && index > 0 \? -1 : direction/u, "Progression tie-breaks must keep higher Overall first after equal progression.");
assert.match(dataPage, /\["current", "all"\]\.includes\(view\)[\s\S]{0,320}overall DESC, player_id DESC/u, "Incremental Progression sorting must use progression first and Overall descending as the tie-break in both directions.");
assert.match(core, /compareRowsWithClubPositionOrder|clubPositionSort/u, "Existing Club position-order ownership must remain intact.");
assert.match(entry, /sortKey:\s*"positions"[\s\S]{0,80}sortDirection:\s*"asc"/u, "Club route bootstrap must keep Positions ascending.");

console.log("Table sort session validation passed.");
