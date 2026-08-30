import fs from "node:fs";
import assert from "node:assert/strict";

const core = fs.readFileSync(new URL("./modules/app-core.js", import.meta.url), "utf8");
const entry = fs.readFileSync(new URL("./modules/app-entry.js", import.meta.url), "utf8");

assert.match(core, /tableSortSessionKey:\s*""/u, "Table state must own one transient sort-session key.");
assert.match(core, /pageName === "club"[\s\S]{0,180}sortKey:\s*"positions"[\s\S]{0,100}sortDirection:\s*"asc"/u, "Club pages must retain Positions ascending as their canonical default.");
assert.match(core, /sortKey:\s*"overall",\s*\n\s*sortDirection:\s*"desc"/u, "Non-Club table views must default to Overall descending.");
assert.doesNotMatch(core, /sortDirection:\s*viewName === "next" \? "asc" : "desc"/u, "Next Overall must no longer default ascending.");
assert.match(core, /function sortKeySupportedByView\(/u, "Sort carry-over must validate the destination view supports the active column.");
assert.match(core, /sortKeyIsSupported && \(sortState\?\.sortDirection === "asc" \|\| sortState\?\.sortDirection === "desc"\)/u, "Unsupported carried sorts must restore the canonical default direction.");
assert.match(core, /state\.view === "next"[\s\S]{0,180}column === "overall"[\s\S]{0,120}tableNextOverallPreciseValue\(row\)/u, "Next Overall sortable values must use the displayed precise Overall value.");
assert.match(core, /state\.sortKey === "overall"[\s\S]{0,220}tableNextOverallPreciseValue\(a\)[\s\S]{0,120}tableNextOverallPreciseValue\(b\)/u, "Next Overall comparisons must sort the displayed Overall value instead of the needed gain.");
assert.match(core, /function tableSortSessionKey\(/u, "Sort lifecycle must be scoped to page/entity identity.");
assert.match(core, /agents:\$\{walletAddress \|\| window\.location\.pathname\}/u, "Agent sort sessions must be entity-scoped.");
assert.match(core, /watchlist:\$\{watchlistId \|\| "default"\}/u, "Watchlist sort sessions must be entity-scoped.");
assert.match(core, /club:\$\{clubId \|\| window\.location\.pathname\}/u, "Club sort sessions must be entity-scoped.");
assert.match(core, /resetTableSortSession\(pageName, options\);/u, "Route entry must activate/reset transient sorting.");
assert.match(core, /\{ sortKey: state\.sortKey, sortDirection: state\.sortDirection \}[\s\S]{0,120}viewName[\s\S]{0,100}pageKey \|\| state\.currentPage/u, "Standard same-page view switches must carry the active sort forward.");
assert.match(core, /\{ sortKey: previousSortKey, sortDirection: previousSortDirection \}[\s\S]{0,120}nextView[\s\S]{0,100}pageKey \|\| pageName/u, "Incremental view switches must carry the active sort forward.");
assert.match(core, /\{ sortKey: state\.sortKey, sortDirection: state\.sortDirection \}[\s\S]{0,120}state\.view[\s\S]{0,80}pageName/u, "Restoring table-page state must not resurrect a prior visit's saved sort.");
assert.match(core, /state\.currentPage === "progression" && \(state\.view === "current" \|\| state\.view === "all"\) && statColumns\.includes\(column\)/u, "Only Progression Current/All views may sort stat columns by progression delta.");
assert.match(core, /compareRowsWithClubPositionOrder|clubPositionSort/u, "Existing Club position-order ownership must remain intact.");
assert.match(entry, /sortKey:\s*"positions"[\s\S]{0,80}sortDirection:\s*"asc"/u, "Club route bootstrap must keep Positions ascending.");

console.log("Table sort session validation passed.");
