import { readFile } from "node:fs/promises";
import vm from "node:vm";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [source, generated, planner, runtime, css, styles] = await Promise.all([
  read("./html-sources/planner.html"),
  read("./index.html"),
  read("./modules/core-sources/planner.js"),
  read("./modules/app-core-planner-runtime.js"),
  read("./planner.css"),
  read("./styles-runtime.css"),
]);
const startMarker = "// BEGIN PLANNER DEPTH";
// Exercise the same rating helpers with both table arrays and Planner records.
const foundations = await read("./modules/core-sources/shared-foundations.js");
const dataSearch = await read("./modules/core-sources/shared-data-search.js");
const playerDisplay = await read("./modules/core-sources/shared-player-display.js");
const ratingColumns = ["positions", "overall", "passing", "shooting", "defense", "dribbling", "pace", "physical", "goalkeeping"];
const ratings = { columnIndex: column => ratingColumns.indexOf(column) };
vm.createContext(ratings);
vm.runInContext(foundations.slice(foundations.indexOf("const POSITION_GROUP_WEIGHTS"), foundations.indexOf("const statusText"))
  + dataSearch.slice(dataSearch.indexOf("function getValue("), dataSearch.indexOf("function getProgressionColumn("))
  + playerDisplay, ratings);
const player = { positions: "CM, CDM", overall: 80, passing: 80, shooting: 80, defense: 80, dribbling: 80, pace: 80, physical: 80, goalkeeping: 20 };
const searchSource = await read("./api/_data-views.js");
const searchDatabase = new DatabaseSync(":memory:");
searchDatabase.exec("CREATE TABLE players(player_id INTEGER, name TEXT, positions TEXT, overall REAL, retirement_years INTEGER, passing REAL, shooting REAL, defense REAL, dribbling REAL, pace REAL, physical REAL, goalkeeping REAL)");
searchDatabase.exec("INSERT INTO players VALUES(1, 'Position Player', 'CM, CDM', 80, 5, 80, 80, 80, 80, 80, 80, 20)");
searchDatabase.function("normalize_search", value => String(value).toLowerCase());
const searchRuntime = {
  SEARCH_PLAYER_COLUMNS: ["player_id", "name", "positions", "overall"],
  tableExists: () => false,
  qualifiedSelectList: (alias, columns) => columns.map(column => `${alias}.${column}`).join(", "),
  queryRows: (sql, parameters) => searchDatabase.prepare(sql).all(...parameters),
  rowsAsArrays: (rows, columns) => rows.map(row => columns.map(column => row[column])),
  normalizeSearchText: value => String(value).toLowerCase(),
};
vm.createContext(searchRuntime);
vm.runInContext(searchSource.slice(searchSource.indexOf("function normalizedQueryText("), searchSource.indexOf("function agentSearchRows("))
  + searchSource.slice(searchSource.indexOf("function searchData("), searchSource.indexOf("function summaryData(")), searchRuntime);
const searchResult = searchRuntime.searchData({query: {q: "Position Player", type: "players", view: "attributes"}});
const searchedPlayer = Object.fromEntries(searchResult.columns.map((column, index) => [column, searchResult.rows[0][index]]));
assert.equal(searchedPlayer.passing, 80, "Planner search must supply attributes so added players receive position-specific ratings");
assert.equal(searchRuntime.searchData({query: {q: "Position", type: "players"}}).columns.includes("passing"), false, "Other searches must retain the compact projection");
searchDatabase.close();
const tableRow = ratingColumns.map(column => player[column]);
assert.equal(ratings.getValue(player, "passing"), 80, "Planner records must read attributes without changing table column state");
for (const [position, familiarity, rating] of [["CM", "primary", 80], ["CDM", "secondary", 79], ["CAM", "fair", 75], ["RM", "some", 72], ["ST", null, null]]) {
  assert.equal(ratings.familiarityForPosition(player, position), familiarity);
  assert.equal(ratings.positionRating(player, position, familiarity), rating);
  assert.equal(ratings.positionRating(tableRow, position, familiarity), rating, "Existing player-page array ratings must remain unchanged");
}
vm.runInContext(source.slice(source.indexOf("const depthPlayerFamiliarity ="), source.indexOf("const rankDepthPlayers ="))
  + "\nthis.depthOverall = depthPlayerOverall;", ratings);
assert.equal(ratings.depthOverall(searchedPlayer, "CDM"), "79", "An added player's pitch OVR must use that slot's weights and penalty");
assert.equal(ratings.depthOverall(player, "CAM"), "75");
assert.equal(ratings.depthOverall({positions: "GK", overall: 80, goalkeeping: 83}, "GK"), "83", "GK must use goalkeeping as on the player page");
assert.equal(ratings.depthOverall({positions: "CM, CDM", overall: 80}, "CDM"), "—", "Missing attributes must never masquerade as base OVR for a different position");
assert.equal(ratings.depthOverall({positions: "CM", overall: 80}, "CM"), "80");
assert.equal(ratings.depthOverall(player, "ST"), "—");
const surnames = {};
vm.createContext(surnames);
vm.runInContext(source.slice(source.indexOf("const depthPlayerName ="), source.indexOf("const depthPlayerFamiliarity ="))
  + "\nthis.surname = depthPlayerSurname;", surnames);
assert.equal(surnames.surname({name:"Marco De Rossi"}), "De Rossi", "Surname label must preserve a multiword family name.");
assert.equal(surnames.surname({name:"Virgil van Dijk"}), "van Dijk");
assert.equal(surnames.surname({name:"Rossi"}), "Rossi", "Single-name players must remain readable.");
assert.equal(surnames.surname({name:"Marco Rossi"}), "Rossi", "Given name must not be displayed beneath the pitch circle.");
assert.ok(generated.includes("const depthPlayerSurname = player =>"), "Generated Planner must include surname extraction.");
const endMarker = "// END PLANNER DEPTH";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
assert.ok(start > 0 && end > start, "Planner must have one canonical depth algorithm.");
const helper = source.slice(start + startMarker.length, end);
// Run the actual positional ranking used by Auto-fill and the depth cards.
vm.runInContext('const depthPlayerName = player => String(player.name || "Player #" + player.player_id);\n'
  + source.slice(source.indexOf("const rankDepthPlayers ="), source.indexOf("const slotKeysFor ="))
  + "\nthis.rankDepthPlayers = rankDepthPlayers;", ratings);
const ratingFixtures = [
  {...player,player_id:14,name:"Natural CB",positions:"CB",overall:76},
  {...player,player_id:15,name:"Secondary CB",positions:"CM, CB",overall:98},
  {...player,player_id:16,name:"Unrated CB",positions:"CM, CB",overall:99,defense:null},
];
assert.equal(ratings.depthOverall(ratingFixtures[0],"CB"),"80");
assert.equal(ratings.depthOverall(ratingFixtures[1],"CB"),"79");
assert.equal(ratings.depthOverall(ratingFixtures[2],"CB"),"—");
assert.deepEqual(Array.from(ratings.rankDepthPlayers(ratingFixtures,"CB"),p=>p.player_id),[14,15,16],
  "Auto-fill must rank by positional OVR, not base OVR, and put unrated players last.");
vm.runInContext(helper + "\nthis.distribute = distributeFormationDepth;", ratings);
const distribute = ratings.distribute;
assert.deepEqual(Array.from(distribute([["CB"]],ratingFixtures)[0],p=>p.player_id),[14,15,16],
  "Depth alternatives must share the positional OVR order.");
const lines = [["CB", "CB"], ["CM", "CAM"], ["ST"]];
const players = [
  { player_id: 3, name: "Third CB", positions: "CB", overall: 70 },
  { player_id: 1, name: "First CB", positions: "CB", overall: 90 },
  { player_id: 2, name: "Second CB", positions: "CB", overall: 80 },
  { player_id: 4, name: "Midfield", positions: "CM, CAM", overall: 84 },
  { player_id: 5, name: "Second midfield", positions: "CM", overall: 72 },
  { player_id: 6, name: "Goalkeeper", positions: "GK", overall: 75 },
  { player_id: 7, name: "Retired striker", positions: "ST", overall: 95, retirement_years: 0 },
  { player_id: 8, name: "Unknown retirement", positions: "ST", overall: 65, retirement_years: null },
];
const depth = distribute(lines, players);
assert.deepEqual(Array.from(depth[0], p => p.player_id), [1, 3], "First repeated CB slot must receive first/third CB, sorted Overall.");
assert.deepEqual(Array.from(depth[1], p => p.player_id), [2], "Second repeated CB slot must receive second CB without duplication.");
assert.deepEqual(Array.from(depth[2], p => p.player_id), [4, 5], "CM depth must sort by Overall.");
assert.deepEqual(Array.from(depth[3], p => p.player_id), [4], "Multi-position player must also contribute to CAM.");
assert.deepEqual(Array.from(depth[4], p => p.player_id), [8], "Only explicitly retired players must be omitted.");
assert.deepEqual(Array.from(depth[5], p => p.player_id), [6], "Goalkeeper depth must be separate.");
assert.deepEqual(Array.from(distribute([["ST"]], [
  {player_id: 11, name: "Tie", positions: "ST", overall: 81},
  {player_id: 9, name: "Tie", positions: "ST", overall: 81},
])[0], p => p.player_id), [9, 11], "Equal Overall must use stable player ID order.");
assert.equal(distribute([["RW"]], players)[0].length, 0, "Empty position must remain empty.");
assert.ok(generated.includes(helper), "Generated shell must contain the exact canonical depth algorithm.");
assert.ok(source.includes('id="plannerDepthDetails"') && generated.includes('id="plannerDepthDetails"'), "Depth cards must exist in both shells.");
assert.ok(source.includes("renderDepthDetails(positions, buckets);"), "Formation changes must redraw depth.");
assert.ok(source.includes("setRoster(players)") && planner.includes('setRoster?.(roster)') && planner.includes('setRoster?.([])'), "Roster changes and Clear must redraw depth.");
assert.ok(runtime.includes('setRoster?.(roster)') && runtime.includes('setRoster?.([])'), "Generated route core must redraw depth.");
assert.ok(css.includes(".plannerDepthCardList") && styles.includes(".plannerDepthCardList"), "Depth styling must be in canonical and generated CSS.");
for (const stylesheet of [css, styles]) {
  assert.ok(stylesheet.includes(".plannerRosterTable .plannerSlotColumn{width:48px}")
    && stylesheet.includes(".plannerRosterTable .plannerSlotColumn{width:44px}")
    && stylesheet.includes(".plannerRosterTable .plannerNationalityColumn{width:28px}")
    && stylesheet.includes(".plannerRosterTable .plannerNationalityColumn{width:26px}")
    && stylesheet.includes("--planner-columns:32px minmax(0,1fr) 21% 10% 10% 18%"),
    "Flag columns must fit flags, Player gains leftover width, and Slot stays unchanged.");
  assert.ok(stylesheet.includes(".plannerFormationSlotButton:hover:not(:disabled) .plannerFormationToken")
    && stylesheet.includes(".plannerFormationSlotButton:focus-visible .plannerFormationToken")
    && stylesheet.includes("transform:scale(1.1)")
    && stylesheet.includes("prefers-reduced-motion:reduce"),
    "Empty and occupied circles must share a reduced-motion-aware hover animation.");
}

assert.ok(source.includes('id="plannerAutoFillDepthButton"') && source.includes('id="plannerDepthPicker"'), "Depth must expose Auto-fill and the slot player picker.");
assert.ok(source.includes('const depthAssignments = new Map()') && source.includes('const autoFillDepth = () =>'), "Depth must preserve unique explicit assignments and auto-fill.");
assert.ok(source.includes('depthAutoFill?.addEventListener("click", autoFillDepth)') && source.includes('button.addEventListener("click", () => openDepthPicker('), "Auto-fill and slots must be interactive.");
assert.ok(source.includes("const assignedSlotByPlayer = new Map();") && generated.includes("const assignedSlotByPlayer = new Map();") && source.includes('key.split("#")[0]') && generated.includes('key.split("#")[0]'), "Depth assignments must synchronize position-only squad Slot badges in both source and generated shells.");
assert.ok(source.includes('backups.slice(0, 2)') && source.includes('plannerFormationPlayerGradient') && source.includes('plannerFormationPlayerBadge'), "Each occupied circle must show the club gradient, player and badge, plus two backups.");
assert.ok(source.includes('surnameText.textContent = depthPlayerSurname(starter);') && generated.includes('surnameText.textContent = depthPlayerSurname(starter);')
  && source.includes('countryFlagElement(starter.nationality, "plannerFormationSurnameFlag")')
  && generated.includes('countryFlagElement(starter.nationality, "plannerFormationSurnameFlag")')
  && source.includes('surname.title = depthPlayerName(starter);') && source.includes('surname.setAttribute("aria-hidden", "true");'),
  "Occupied Planner circles must pair a canonical nationality flag with the surname while retaining full-name accessibility.");
assert.ok(source.includes('token.append(gradient, portrait);') && source.includes('portrait.addEventListener("error", () => { portrait.hidden = true; });'), "Assigned circles must show a portrait over the gradient and keep the gradient when the photo is unavailable.");
assert.ok(!source.includes('plannerFormationPlayerSliders') && !source.includes('plannerFormationPlayerShade'), "Assigned circles must not restore sliders icons or dark overlays.");
assert.ok(generated.includes('token.append(gradient, portrait);') && !generated.includes('plannerFormationPlayerSliders'), "Generated shell must include the portrait but no clipped icon.");
assert.ok(css.includes('.plannerFormationPlayerPhoto{') && styles.includes('.plannerFormationPlayerPhoto{') && css.includes('object-fit:contain;object-position:top;transform:translateY(12%) scale(1.9);transform-origin:top') && styles.includes('object-fit:contain;object-position:top;transform:translateY(12%) scale(1.9);transform-origin:top'), "Restore the earlier face-focused player portrait crop in canonical and generated styles.");
assert.ok(css.includes('.plannerFormationPlayerPhoto[hidden]{display:none}') && styles.includes('.plannerFormationPlayerPhoto[hidden]{display:none}'), "Failed player photos must leave the gradient visible.");
assert.ok(planner.includes('preview?.setClub?.(clubId);') && planner.includes('--planner-depth-primary') && planner.includes('--planner-depth-secondary'), "Changing Clubs must clear depth selection and set the branded gradient.");
assert.ok(css.includes('.plannerDepthPicker[hidden]') && css.includes('.plannerFormationBackups') && styles.includes('.plannerFormationBackups'), "Responsive depth picker and alternatives must be reflected in generated CSS.");
assert.ok([css, styles].every(sheet => sheet.includes('max-width:500px;height:auto;aspect-ratio:72/109')
  && sheet.includes('.plannerFormationPlayerSurname{position:absolute;top:calc(100% + 8px)')
  && sheet.includes('.plannerFormationSurnameFlag.flagImage{display:block;box-sizing:border-box;flex:0 0 20px;width:20px;height:20px;border:1px solid rgba(255,255,255,.65);border-radius:2px')
  && sheet.includes('.plannerFormationSurnameFlag.flagImage{flex-basis:18px;width:18px;height:18px}')
  && sheet.includes('.plannerFormationSurnameText{min-width:0;overflow:hidden;text-overflow:ellipsis')
  && sheet.includes('.plannerFormationBackups{position:absolute;top:calc(100% + 40px)')
  && sheet.includes('.plannerDepthDetails{margin-top:88px}')),
  "Larger pitch must place table-sized, white-bordered flags close to surnames while keeping backups separate and goalkeeper clearance.");
assert.ok(source.includes("const y = 76 - lineIndex * (66 / (lines.length - 1)) - (midfield ? 3 : 0);") && generated.includes("const y = 76 - lineIndex * (66 / (lines.length - 1)) - (midfield ? 3 : 0);") && source.includes('goalkeeper.style.top = "94%";'), "All formations must use the upper and lower pitch evenly in canonical and generated shells.");
assert.ok(css.includes("width:clamp(54px,16%,70px)") && styles.includes("width:clamp(54px,16%,70px)") && css.includes("width:clamp(50px,15%,64px)") && styles.includes("width:clamp(50px,15%,64px)"), "Balanced circle sizes must match across desktop/mobile and canonical/generated styles.");
assert.ok(source.includes("pairedStrikers ? 30 : 48") && generated.includes("pairedStrikers ? 30 : 48") && source.includes("occurrence === 1 ? 40 : 60") && generated.includes("occurrence === 1 ? 40 : 60"), "Keep two strikers closer together in two- and four-player attacking lines.");
assert.ok(source.includes('selected === "41212narrow" && (midfield || pairedStrikers) ? 0.68 : 1') && generated.includes('selected === "41212narrow" && (midfield || pairedStrikers) ? 0.68 : 1'), "Narrow diamond must compact its striker pair as well as its midfield.");
assert.ok(source.includes("midfield ? 3 : 0") && generated.includes("midfield ? 3 : 0") && source.includes('position === "RWB") && lineIndex === 0 ? -7') && generated.includes('position === "RWB") && lineIndex === 0 ? -7'), "Advance the midfield and back-five wingbacks in the canonical and generated pitch.");
assert.ok(source.includes('position === "RW") && wideForwardLine ? 6') && generated.includes('position === "RW") && wideForwardLine ? 6'), "Wingers must sit behind central forwards.");
assert.ok(source.includes('const hasHoldingAndCentralMidfield = positions.includes("CDM") && positions.includes("CM");') && generated.includes('const hasHoldingAndCentralMidfield = positions.includes("CDM") && positions.includes("CM");'), "Mixed CDM/CM formations must opt into position-specific midfield depth.");
assert.ok(source.includes('hasHoldingAndCentralMidfield && position === "CM" ? 6') && generated.includes('hasHoldingAndCentralMidfield && position === "CM" ? 6') && source.includes('hasHoldingAndCentralMidfield && position === "CDM" ? 9') && generated.includes('hasHoldingAndCentralMidfield && position === "CDM" ? 9'), "Lower both CM and CDM slots in mixed midfield formations while keeping CDMs deeper.");
assert.ok(source.includes('selected === "352b" && midfield && position === "CAM" ? 50') && generated.includes('selected === "352b" && midfield && position === "CAM" ? 50') && source.includes('occurrence === 1 ? 38 : 62') && generated.includes('occurrence === 1 ? 38 : 62'), "3-5-2 (B) must centre CAM between the two CDMs.");
assert.ok(source.includes('selected === "352b" && midfield && position === "CDM" ? 8') && generated.includes('selected === "352b" && midfield && position === "CDM" ? 8') && source.includes('selected === "352b" && midfield && position === "CAM" ? -8') && generated.includes('selected === "352b" && midfield && position === "CAM" ? -8'), "3-5-2 (B) CDMs must sit deeper while CAM sits farther forward.");
assert.ok(generated.includes('const autoFillDepth = () =>') && generated.includes('plannerFormationPlayerGradient'), "Generated shell must include interactive gradient depth.");
console.log("Planner depth: repeated slots, Overall, multi-position, retirement, empty slots, reset and generated assets passed.");
