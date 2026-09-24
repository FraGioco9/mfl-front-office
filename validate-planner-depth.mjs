import { readFile } from "node:fs/promises";
import vm from "node:vm";
import assert from "node:assert/strict";

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
const endMarker = "// END PLANNER DEPTH";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
assert.ok(start > 0 && end > start, "Planner must have one canonical depth algorithm.");
const helper = source.slice(start + startMarker.length, end);
const sandbox = {};
vm.runInNewContext(helper + "\nthis.distribute = distributeFormationDepth;", sandbox);
const distribute = sandbox.distribute;
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
  {player_id: 11, positions: "ST", overall: 81},
  {player_id: 9, positions: "ST", overall: 81},
])[0], p => p.player_id), [9, 11], "Equal Overall must use stable player ID order.");
assert.equal(distribute([["RW"]], players)[0].length, 0, "Empty position must remain empty.");
assert.ok(generated.includes(helper), "Generated shell must contain the exact canonical depth algorithm.");
assert.ok(source.includes('id="plannerDepthDetails"') && generated.includes('id="plannerDepthDetails"'), "Depth cards must exist in both shells.");
assert.ok(source.includes("renderDepthDetails(positions, buckets);"), "Formation changes must redraw depth.");
assert.ok(source.includes("setRoster(players)") && planner.includes('setRoster?.(roster)') && planner.includes('setRoster?.([])'), "Roster changes and Clear must redraw depth.");
assert.ok(runtime.includes('setRoster?.(roster)') && runtime.includes('setRoster?.([])'), "Generated route core must redraw depth.");
assert.ok(css.includes(".plannerDepthCardList") && styles.includes(".plannerDepthCardList"), "Depth styling must be in canonical and generated CSS.");

assert.ok(source.includes('id="plannerAutoFillDepthButton"') && source.includes('id="plannerDepthPicker"'), "Depth must expose Auto-fill and the slot player picker.");
assert.ok(source.includes('const depthAssignments = new Map()') && source.includes('const autoFillDepth = () =>'), "Depth must preserve unique explicit assignments and auto-fill.");
assert.ok(source.includes('depthAutoFill?.addEventListener("click", autoFillDepth)') && source.includes('button.addEventListener("click", () => openDepthPicker('), "Auto-fill and slots must be interactive.");
assert.ok(source.includes('backups.slice(0, 2)') && source.includes('plannerFormationPlayerGradient') && source.includes('plannerFormationPlayerBadge'), "Each occupied circle must show the club gradient, player and badge, plus two backups.");
assert.ok(source.includes('token.append(gradient, portrait);') && source.includes('portrait.addEventListener("error", () => { portrait.hidden = true; });'), "Assigned circles must show a portrait over the gradient and keep the gradient when the photo is unavailable.");
assert.ok(!source.includes('plannerFormationPlayerSliders') && !source.includes('plannerFormationPlayerShade'), "Assigned circles must not restore sliders icons or dark overlays.");
assert.ok(generated.includes('token.append(gradient, portrait);') && !generated.includes('plannerFormationPlayerSliders'), "Generated shell must include the portrait but no clipped icon.");
assert.ok(css.includes('.plannerFormationPlayerPhoto{') && styles.includes('.plannerFormationPlayerPhoto{') && css.includes('object-fit:contain;object-position:top;transform:translateY(12%) scale(1.9);transform-origin:top') && styles.includes('object-fit:contain;object-position:top;transform:translateY(12%) scale(1.9);transform-origin:top'), "Restore the earlier face-focused player portrait crop in canonical and generated styles.");
assert.ok(css.includes('.plannerFormationPlayerPhoto[hidden]{display:none}') && styles.includes('.plannerFormationPlayerPhoto[hidden]{display:none}'), "Failed player photos must leave the gradient visible.");
assert.ok(planner.includes('preview?.setClub?.(clubId);') && planner.includes('--planner-depth-primary') && planner.includes('--planner-depth-secondary'), "Changing Clubs must clear depth selection and set the branded gradient.");
assert.ok(css.includes('.plannerDepthPicker[hidden]') && css.includes('.plannerFormationBackups') && styles.includes('.plannerFormationBackups'), "Responsive depth picker and alternatives must be reflected in generated CSS.");
assert.ok(generated.includes('const autoFillDepth = () =>') && generated.includes('plannerFormationPlayerGradient'), "Generated shell must include interactive gradient depth.");
console.log("Planner depth: repeated slots, Overall, multi-position, retirement, empty slots, reset and generated assets passed.");
