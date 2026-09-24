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
  + "\nthis.surname = depthPlayerSurname; this.shortName = depthPlayerShortName;", surnames);
assert.equal(surnames.surname({name:"Marco De Rossi"}), "De Rossi", "Surname label must preserve a multiword family name.");
assert.equal(surnames.surname({name:"Virgil van Dijk"}), "van Dijk");
assert.equal(surnames.surname({name:"Rossi"}), "Rossi", "Single-name players must remain readable.");
assert.equal(surnames.surname({name:"Marco Rossi"}), "Rossi", "Given name must not be displayed beneath the pitch circle.");
assert.equal(surnames.shortName({name:"Marco De Rossi"}), "M. De Rossi");
assert.equal(surnames.shortName({name:"Virgil van Dijk"}), "V. van Dijk");
assert.equal(surnames.shortName({name:"Rossi"}), "Rossi", "Single-name players do not get an invented initial.");
assert.equal(surnames.shortName({name:"Marco Rossi"}), "M. Rossi");
assert.ok(generated.includes("const depthPlayerSurname = player =>"), "Generated Planner must include surname extraction.");
const endMarker = "// END PLANNER DEPTH";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
assert.ok(start > 0 && end > start, "Planner must have one canonical depth algorithm.");
const helper = source.slice(start + startMarker.length, end);
// Run the actual positional ranking used by Auto-fill and the depth cards.
vm.runInContext('const depthPlayerName = player => String(player.name || "Player #" + player.player_id);\n'
  + source.slice(source.indexOf("const rankDepthPlayers ="), source.indexOf("const slotKeysFor ="))
  + "\nthis.rankDepthPlayers = rankDepthPlayers; this.pickerCandidates = depthPickerCandidates;", ratings);
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
const pickerFixtures = [
  {player_id:21,name:"LB 90",positions:"LB",overall:90},
  {player_id:22,name:"LB 85",positions:"LB",overall:85},
  {player_id:23,name:"LB 75",positions:"LB",overall:75},
  {player_id:24,name:"LB 100",positions:"LB",overall:100},
  {player_id:25,name:"CM 100",positions:"CM",overall:100},
  {player_id:26,name:"Retired LB",positions:"LB",overall:110,retirement_years:0},
];
assert.deepEqual(Array.from(ratings.pickerCandidates(pickerFixtures,"LB"),p=>p.player_id),[24,21,22],
  "At a team average of 90, a position-rated 85 LB must appear but a 75 LB and retired players must not.");
assert.deepEqual(Array.from(ratings.pickerCandidates(pickerFixtures,"LB",new Set([23])),p=>p.player_id),[24,21,22,23],
  "Already assigned players stay visible even when they fall below the eligibility threshold.");
assert.deepEqual(Array.from(ratings.pickerCandidates(pickerFixtures,"LB",new Set([26])),p=>p.player_id),[24,21,22],
  "A retired player must not be made available through a stale selected ID.");
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
assert.ok([source, generated].every(shell => !shell.includes('id="plannerDepthDetails"') && !shell.includes("renderDepthDetails(") && shell.includes('plannerFormationPlayerSurname') && !shell.includes('plannerFormationBackups') && !shell.includes('plannerRosterTotalsRow')), "Keep the selected player's name but omit depth cards, backup lists and squad totals.");
assert.ok([source, generated].every(shell => shell.includes('surnameText.textContent = depthPlayerSurname(starter);') && shell.includes('surname.title = depthPlayerName(starter);') && shell.includes('countryFlagElement(starter.nationality, "plannerFormationSurnameFlag")') && shell.includes('surname.setAttribute("aria-hidden", "true");')), "Selected circle must display the abbreviated player surname and flag while retaining accessible full name.");
assert.ok(source.includes("setRoster(players)") && planner.includes('setRoster?.(roster)') && planner.includes('setRoster?.([])'), "Roster changes and Clear must redraw depth.");
assert.ok(runtime.includes('setRoster?.(roster)') && runtime.includes('setRoster?.([])'), "Generated route core must redraw depth.");
assert.ok([css, styles].every(sheet => !sheet.includes(".plannerDepthCardList") && !sheet.includes(".plannerDepthDetails{") && !sheet.includes(".plannerFormationBackups{") && sheet.includes(".plannerFormationPlayerSurname{")), "Obsolete depth summary and occupied-circle label styles must be removed.");
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

assert.ok(source.includes('id="plannerAutoFillDepthButton"') && source.includes('id="plannerClearDepthButton"') && source.includes('id="plannerDepthPicker"'), "Depth must expose Auto-fill, Clear and the slot player picker.");
assert.ok(source.includes('const depthAssignments = new Map()') && source.includes('const autoFillDepth = () =>'), "Depth must preserve unique explicit assignments and auto-fill.");
assert.ok(source.includes('depthAutoFill?.addEventListener("click", autoFillDepth)')
  && source.includes('depthClear?.addEventListener("click", () => {')
  && source.includes('depthAssignments.clear();')
  && source.includes('button.addEventListener("click", () => openDepthPicker('), "Auto-fill, Clear and slots must be interactive.");
assert.ok(!source.includes("spot.title =") && !generated.includes("spot.title ="), "Hovering an empty or occupied Planner circle must never open a native tooltip.");
assert.ok([source, generated].every(shell => shell.includes("depthPickerCandidates(depthRoster, position, new Set(assignmentByPlayer.keys()))")
  && shell.includes('.filter(player => Number(player.player_id) !== currentId);')
  && shell.includes('status.textContent = "Selected · " + assignedSlot.split("#")[0];')
  && shell.includes('if (assignedSlot && assignedSlot !== key) depthAssignments.delete(assignedSlot);')
  && !shell.includes("row.disabled = Boolean(assignedSlot);")
  && shell.includes('removeText.textContent = "Remove";')
  && shell.includes('const removeIcon = makeSlotIcon("svg", {')
  && shell.includes('removeIcon.appendChild(makeSlotIcon("path", { d: "M6 6L18 18M18 6L6 18" }));')
  && shell.includes('row.appendChild(overall);')
  && shell.includes('row.appendChild(status);')
  && !shell.includes("row.append(photoFrame, name, overall);")
  && shell.includes('photoFrame.className = "plannerDepthPickerPhoto";')
  && shell.includes('name.textContent = depthPlayerShortName(player);')
  && shell.includes('pickerContent.className = "plannerDepthPickerContent";')
  && shell.includes('pointer.dataset.side = opensBelow ? "below" : "above";')
  && shell.includes('depthPicker.appendChild(pointer);')
  && shell.includes('button.classList.add("plannerFormationSlotButtonPickerOpen");')
  && shell.includes('previous.classList.remove("plannerFormationSlotButtonPickerOpen");')),
  "Canonical and generated pickers must hide the current starter, move assigned players atomically, and use matching portrait frames and Remove.");
assert.ok(source.includes("const assignedSlotByPlayer = new Map();") && generated.includes("const assignedSlotByPlayer = new Map();") && source.includes('key.split("#")[0]') && generated.includes('key.split("#")[0]'), "Depth assignments must synchronize position-only squad Slot badges in both source and generated shells.");
assert.ok([source, generated].every(shell => shell.includes('plannerFormationPlayerGradient') && shell.includes('plannerFormationPlayerBadge')
  && shell.includes('button.setAttribute("aria-label", slotLabel + ": " + (starter ? depthPlayerName(starter)')
  && !shell.includes('backups.slice(0, 2)') && shell.includes('plannerFormationPlayerSurname')),
  "Occupied circles must keep gradient, OVR, surname and accessible full name without backup text below.");
assert.ok(source.includes('token.append(gradient, portrait);') && source.includes('portrait.addEventListener("error", () => { portrait.hidden = true; });'), "Assigned circles must show a portrait over the gradient and keep the gradient when the photo is unavailable.");
assert.ok(!source.includes('plannerFormationPlayerSliders') && !source.includes('plannerFormationPlayerShade'), "Assigned circles must not restore sliders icons or dark overlays.");
assert.ok(generated.includes('token.append(gradient, portrait);') && !generated.includes('plannerFormationPlayerSliders'), "Generated shell must include the portrait but no clipped icon.");
assert.ok(css.includes('.plannerFormationPlayerPhoto{') && styles.includes('.plannerFormationPlayerPhoto{') && css.includes('object-fit:contain;object-position:top;transform:translateY(12%) scale(1.9);transform-origin:top') && styles.includes('object-fit:contain;object-position:top;transform:translateY(12%) scale(1.9);transform-origin:top'), "Restore the earlier face-focused player portrait crop in canonical and generated styles.");
assert.ok(css.includes('.plannerFormationPlayerPhoto[hidden]{display:none}') && styles.includes('.plannerFormationPlayerPhoto[hidden]{display:none}'), "Failed player photos must leave the gradient visible.");
assert.ok(planner.includes('preview?.setClub?.(clubId);') && planner.includes('--planner-depth-primary') && planner.includes('--planner-depth-secondary'), "Changing Clubs must clear depth selection and set the branded gradient.");
assert.ok(css.includes('.plannerDepthPicker[hidden]') && styles.includes('.plannerDepthPicker[hidden]'), "Responsive depth picker must be reflected in generated CSS.");
assert.ok([css, styles].every(sheet => sheet.includes(".plannerFormationTokenPlus{position:absolute;inset:0;display:block;width:100%;height:100%;color:inherit;pointer-events:none}")), "Every empty plus must fill exactly the same SVG viewport as its ring.");
assert.ok([css, styles].every(sheet => sheet.includes(".plannerFormationPositionLabel{position:absolute;top:calc(100% + 8px);left:50%;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;max-width:70px;min-height:16px;padding:0 5px;overflow:hidden;border-radius:5px;background:rgb(162,162,162);color:#000;font-size:12px;font-weight:700;letter-spacing:.4px;line-height:16px;text-align:center;text-overflow:ellipsis;text-shadow:none;white-space:nowrap;transform:translateX(-50%);pointer-events:none}") && !sheet.includes(".plannerFormationSpot .plannerFormationPositionLabel{top:calc(86% + 1px)}")), "All empty slots must use compact grey position badges at the occupied surname distance.");
assert.ok([source, generated].every(shell => shell.includes('viewBox: "0 0 100 100", "aria-hidden": "true", class: "plannerFormationTokenPlus"') && shell.includes('plus.append(makeSlotIcon("path", { d: "M37 50h26" }), makeSlotIcon("path", { d: "M50 37v26" }));')), "Ring and plus must share one centered SVG coordinate system.");
assert.ok([css, styles].every(sheet => sheet.includes('.plannerDepthActions{display:flex;align-items:center;gap:6px;margin-left:auto}')
  && sheet.includes('.plannerFormationSlotButton:hover:not(:disabled) .plannerFormationToken,.plannerFormationSlotButton:focus-visible .plannerFormationToken,.plannerFormationSlotButtonPickerOpen .plannerFormationToken{transform:scale(1.1);box-shadow:0 0 0 2px var(--primary-hover)')
  && sheet.includes('.plannerDepthPickerContent{display:grid;gap:3px;max-height:min(370px,60dvh);overflow-y:auto;padding:10px;')
  && sheet.includes('.plannerDepthPickerPointer{position:absolute;top:-9px;width:16px;height:10px;pointer-events:none;')
  && sheet.includes('.plannerDepthPickerPointerAbove{top:auto;bottom:-9px;transform:rotate(180deg)}')
  && sheet.includes('.plannerDepthPickerPlayer>span:not(.plannerDepthPickerPhoto):not(.plannerDepthPickerSelected){flex:1 1 0;min-width:0;align-self:center;overflow:hidden;font-size:12px;line-height:36px')
  && sheet.includes('.plannerDepthPickerPlayer strong{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;align-self:center;min-height:36px;line-height:20px')
  && sheet.includes('.plannerDepthPickerPhoto{position:relative;isolation:isolate;display:block;flex:0 0 36px')
  && sheet.includes('.plannerDepthPickerPhoto img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;object-position:top;transform:translateY(12%) scale(1.9);transform-origin:top')
  && sheet.includes('.plannerDepthPickerSelected{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;align-self:center;min-height:36px;')
  && sheet.includes('.plannerDepthPicker .plannerDepthPickerPlayer:hover:not(:disabled),.plannerDepthPicker .plannerDepthPickerPlayer:focus-visible,.plannerDepthPicker .plannerDepthPickerClear:hover,.plannerDepthPicker .plannerDepthPickerClear:focus-visible{border-color:var(--primary);background:var(--row-hover);background-image:none;box-shadow:none;outline:0}')
  && sheet.includes('.plannerDepthPicker .plannerDepthPickerClear:hover,.plannerDepthPicker .plannerDepthPickerClear:focus-visible{color:var(--danger)}')
  && sheet.includes('.plannerDepthPickerRemoveIcon{display:block;flex:0 0 16px;width:16px;height:16px;align-self:center;overflow:visible}')
  && sheet.includes('.plannerDepthPickerClear{min-height:44px;align-items:center;')
  && sheet.includes('.plannerDepthPickerClear>span{display:inline-flex;align-items:center;min-height:20px;line-height:20px}')),
  "Picker portraits must match the pitch zoom; the SVG Remove icon and label must be vertically centered in generated CSS.");
assert.ok([css, styles].every(sheet => sheet.includes('max-width:500px;height:auto;aspect-ratio:72/109')
  && sheet.includes('.plannerFormationSpot:has(.plannerFormationTokenAssigned) .plannerFormationPositionLabel{display:none}')
  && sheet.includes('.plannerFormationPlayerSurname{position:absolute;top:calc(100% + 8px)')
  && sheet.includes('.plannerFormationSurnameFlag.flagImage{display:block;box-sizing:border-box;flex:0 0 18px;')
  && sheet.includes('.plannerFormationSurnameText{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}')
  && !sheet.includes('.plannerFormationBackup{')),
  "Assigned circles must show the selected player's surname and flag beneath the circle without backup text.");
assert.ok([source, generated].every(shell => shell.includes("const y = standardMidfieldLine ? 40\n                  : 76 - lineIndex * (66 / (lines.length - 1)) - (lineIndex === 0 ? 6 : 0) - (midfield ? 3 : 0);") && shell.includes("const width = (count >= 5 ? 76 : count === 4 ? 72 : count === 3 ? 62 : pairedStrikers ? 30 : 44) * spread;") && shell.includes('goalkeeper.style.top = "calc(100% - 72px)";')), "All formations must compress their wide positions, raise the back line, and reserve a fixed bottom inset for the goalkeeper name.");
assert.ok([source, generated].every(shell => shell.includes('const standardMidfieldLine = flatFourMidfield || ((selected === "4312" || selected === "4321") && midfield')
  && shell.includes('count === 3 && linePositions.every(position => position === "CM"));')), "4-3-1-2 and 4-3-2-1 must use the 4-4-2 midfield baseline for their three CMs without shifting other formations.");
assert.ok([source, generated].every(shell => shell.includes('selected === "4312" && position === "CAM" ? -4')),
  "4-3-1-2 must move its CAM forward to 25% without shifting its two strikers or other formations.");
assert.ok([source, generated].every(shell => shell.includes('selected === "4321" && position === "CF" ? -9')),
  "4-3-2-1 must bring both CFs to 20% while keeping other formations at their existing CF heights.");
assert.ok([source, generated].every(shell => shell.includes('const flatFourMidfield = midfield && count === 4')
  && shell.includes('linePositions.every(position => ["LM", "RM", "CM", "CDM", "CAM"].includes(position));')
  && shell.includes('const offset = flatFourMidfield && selected === "442b" && position === "CDM" ? 6')
  && shell.includes('flatFourMidfield ? 0')), "Four-man midfield rows match 4-4-2 except the two deeper CDMs in 4-4-2 (B).");
assert.ok(css.includes("width:clamp(58px,17%,74px)") && styles.includes("width:clamp(58px,17%,74px)") && css.includes("width:clamp(54px,16%,68px)") && styles.includes("width:clamp(54px,16%,68px)"), "Slightly enlarged circle sizes must match across desktop/mobile and canonical/generated styles.");
assert.ok(source.includes("pairedStrikers ? 30 : 44") && generated.includes("pairedStrikers ? 30 : 44") && source.includes("occurrence === 1 ? 40 : 60") && generated.includes("occurrence === 1 ? 40 : 60"), "Keep two strikers closer together in two- and four-player attacking lines.");
assert.ok(source.includes('selected === "41212narrow" && (midfield || pairedStrikers) ? 0.68 : 1') && generated.includes('selected === "41212narrow" && (midfield || pairedStrikers) ? 0.68 : 1'), "Narrow diamond must compact its striker pair as well as its midfield.");
assert.ok(source.includes("midfield ? 3 : 0") && generated.includes("midfield ? 3 : 0") && source.includes('position === "RWB") && lineIndex === 0 ? -7') && generated.includes('position === "RWB") && lineIndex === 0 ? -7'), "Advance the midfield and back-five wingbacks in the canonical and generated pitch.");
assert.ok(source.includes('position === "RW") && wideForwardLine ? 6') && generated.includes('position === "RW") && wideForwardLine ? 6'), "Wingers must sit behind central forwards.");
assert.ok([source, generated].every(shell => shell.includes('selected === "433cf" && (position === "LW" || position === "RW") ? 2')
  && shell.includes('selected === "433cf" && position === "CF" ? 6')
  && shell.includes('position === "CF" ? ((linePositions.includes("LW") || linePositions.includes("RW")) ? -4 : -3) : 0;')), "4-3-3 (CF) wingers must rise to 12% and the CF sit beneath them at 16%, leaving other CF formations unchanged.");
assert.ok(source.includes('const hasHoldingAndCentralMidfield = positions.includes("CDM") && positions.includes("CM");') && generated.includes('const hasHoldingAndCentralMidfield = positions.includes("CDM") && positions.includes("CM");'), "Mixed CDM/CM formations must opt into position-specific midfield depth.");
assert.ok([source, generated].every(shell => shell.includes('selected === "433a" && position === "CAM" ? -10')
  && shell.includes('selected === "433d" && position === "CDM" ? 14')
  && shell.includes('(selected === "433a" || selected === "433d") && position === "CM" ? 0')
  && shell.includes('hasHoldingAndCentralMidfield && position === "CM" ? 6')
  && shell.includes('hasHoldingAndCentralMidfield && position === "CDM" ? 9')
  && shell.includes('position === "CAM" && count > 1 ? -4')),
  "4-3-3 (att/def) CMs stay on the usual midfield line, with CAM at 30% and CDM at 54%; other mixed midfields retain their depths.");
assert.ok(source.includes('selected === "352b" && midfield && position === "CAM" ? 50') && generated.includes('selected === "352b" && midfield && position === "CAM" ? 50') && source.includes('occurrence === 1 ? 38 : 62') && generated.includes('occurrence === 1 ? 38 : 62'), "3-5-2 (B) must centre CAM between the two CDMs.");
assert.ok(source.includes('selected === "352b" && midfield && position === "CDM" ? 8') && generated.includes('selected === "352b" && midfield && position === "CDM" ? 8') && source.includes('selected === "352b" && midfield && position === "CAM" ? -8') && generated.includes('selected === "352b" && midfield && position === "CAM" ? -8'), "3-5-2 (B) CDMs must sit deeper while CAM sits farther forward.");
assert.ok(generated.includes('const autoFillDepth = () =>') && generated.includes('plannerFormationPlayerGradient'), "Generated shell must include interactive gradient depth.");
console.log("Planner depth: repeated slots, Overall, multi-position, retirement, empty slots, reset and generated assets passed.");
