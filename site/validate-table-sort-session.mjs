import fs from "node:fs";
import assert from "node:assert/strict";

// Sorting stays page-scoped until a destination view cannot represent the active key; Next Overall desc means lowest gap first, while Progression desc means largest increase then highest matching raw stat.
const core = [
  "./modules/core-sources/shared.js",
  "./modules/core-sources/evaluation.js",
  "./modules/core-sources/mfl-stats.js",
  "./modules/core-sources/club.js",
  "./modules/core-sources/settings.js",
  "./modules/core-sources/player.js",
  "./modules/core-sources/table.js",
  "./modules/core-sources/wallet.js",
  "./modules/core-sources/watchlist.js",
].map((path) => fs.readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
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

assert.doesNotMatch(core, /async function setView\(viewName\)/u, "The retired normalized standard-view owner must not compete with canonical incremental table view loading.");
const incrementalViewSource = sourceBetween(core, "setView = async function setIncrementalView", "setPage = async function setIncrementalPage");
assert.doesNotMatch(incrementalViewSource, /rememberTableSortState/u, "Incremental view loading must not own a separate per-view sort state.");
assert.match(incrementalViewSource, /tableSortStateForView\([\s\S]*nextView/u, "Canonical table view switches must resolve the page sort against the destination view.");

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
assert.match(core, /primaryComparison = comparePrimitiveValues\(aNeeded, bNeeded, -direction, true\)/u, "Next Overall descending must put the lowest required gap first.");
assert.match(core, /column === "overall" \? tableNextOverallPreciseValue\(a\) : getValue\(a, column\)[\s\S]{0,180}comparePrimitiveValues\(aCurrent, bCurrent, direction, true\)/u, "Next Overall tie-breaks must use the selected Overall/stat current value with the visible direction.");
assert.doesNotMatch(core, /state\.view === "next" && statColumns\.includes\(column\) \? "asc"/u, "Next Overall columns must use the normal descending numeric arrow semantics.");
assert.match(dataPage, /view === "next" && STAT_COLUMNS\.has\(key\)[\s\S]{0,360}gapDirection = direction === "DESC" \? "ASC" : "DESC"[\s\S]{0,220}currentValue = key === "overall" \? "next_overall" : key/u, "Incremental Next Overall descending must order the lowest gap first and apply the same rule to every stat.");
assert.match(core, /state\.currentPage === "progression" && \(state\.view === "current" \|\| state\.view === "all"\) && statColumns\.includes\(column\)[\s\S]{0,180}getProgressionColumn\(column\)[\s\S]{0,100}getValue\(row, column\)/u, "Progression sorting must compare the selected Overall/stat progression first and that same raw Overall/stat second.");
assert.doesNotMatch(core, /comparisonDirection = state\.currentPage === "progression"/u, "Progression primary and raw selected-stat tie-break must use the same visible sort direction.");
assert.match(dataPage, /\["current", "all"\]\.includes\(view\)[\s\S]{0,320}quoteIdentifier\(key\)\} \$\{direction\}, player_id DESC/u, "Incremental Progression sorting must use selected progression first and the matching raw Overall/stat second.");
assert.match(core, /compareRowsWithClubPositionOrder|clubPositionSort/u, "Existing Club position-order ownership must remain intact.");
assert.match(entry, /sortKey:\s*"positions"[\s\S]{0,80}sortDirection:\s*"asc"/u, "Club route bootstrap must keep Positions ascending.");

console.log("Table sort session validation passed.");
