import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("./" + file, import.meta.url), "utf8");
const clubs = read("modules/core-sources/my-clubs.js");
const clubShell = read("html-sources/my-clubs.html");

assert.match(clubShell, /id="myClubsSearchButton"/);
assert.match(clubs, /This wallet has no clubs yet\. Search for a club to explore its squad\./);
assert.match(clubs, /if \(searchButton\) searchButton\.hidden = valid\.length > 0;/);
assert.match(clubs, /document\.getElementById\("openSearchButton"\)/);
assert.match(clubs, /if \(retryButton\) retryButton\.hidden = false;/);
assert.match(clubs, /if \(searchButton\) searchButton\.hidden = true;/);

const planner = read("modules/core-sources/planner.js");
assert.match(planner, /No teams match this search\. Try another name or club ID\./);
assert.match(planner, /renderResults\(\[\],q,\{error:error\?\.message\|\|"Could not search teams\."\}\)/);
assert.match(planner, /if\(seq!==searchSequence\|\|input\?\.value\.trim\(\)!==q\)return\[\]/);
assert.match(planner, /results\.setAttribute\("role",fragment\.querySelector\("\.plannerTeamSearchResult"\)\?"listbox":"status"\)/);
assert.match(planner, /if\(input\?\.value\.trim\(\)===query\)\{/);
assert.match(planner, /loading\.textContent="Searching teams…"/);
assert.match(planner, /ownedClubs=null;\s+void requestOwnedClubs\(\);/);
assert.match(planner, /No saved plans yet\. Select a club and save your first plan\./);
assert.match(planner, /retry\.addEventListener\("click",\(\)=>void openPlansModal\(\)\)/);
assert.match(planner, /if\(Number\(error\?\.status\)!==401\)/);

const evaluation = read("modules/core-sources/evaluation.js");
assert.match(evaluation, /function renderSavedEvaluationState\(/);
assert.match(evaluation, /No saved evaluations yet\. Select a player to create one\./);
assert.match(evaluation, /hideModal\(evaluationLoadModal\);\s+evaluationSearchInput\?\.focus\(\)/);
assert.match(evaluation, /renderSavedEvaluationState\(error\?\.message \|\| "Could not load saved evaluations\.", "Retry"/);
assert.match(evaluation, /void evaluationOpenSavedEvaluationsModalOwner\(\)/);
assert.match(read("styles-base.css"), /\.evaluationLoadList\.evaluationLoadListStatus/);

const table = read("modules/core-sources/table.js");
const lifecycle = read("modules/core-sources/table-render-lifecycle.js");
assert.match(table, /hasSourceRows \? "No players match the current filters\." : "No players found\."/);
assert.match(lifecycle, /emptyState\.hidden = pageRows\.length > 0;/);
assert.match(lifecycle, /function showTableBusyState\(\)/);

console.log("UX-02 contextual empty-state action, request error, retry and loading contracts passed.");
