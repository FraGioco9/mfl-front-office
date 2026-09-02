import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(root, name), "utf8");
const responsive = read("responsive.css");
const shared = read("shared-table-ui-runtime.js");
const dropdowns = read("dropdowns.css");
const projection = read("sync-release-projections.mjs");
const table = read("modules/core-sources/table.js");
const bootstrap = read("bootstrap.js");
const index = read("index.html");

for (const token of [
  'positions: "POS"', 'player_seasons: "SZN"', 'overall: "OVR"',
  'wallet_name: "AGT"', 'owned_since: "JOIN"',
  'active_contract_revenue_share: "REV"', 'active_contract_club_name: "CLUB"',
  'active_contract_club_division: "DIV"',
]) {
  assert.ok(table.includes(token), `Canonical compact headings missing ${token}`);
  assert.ok(bootstrap.includes(token), `First-paint compact headings missing ${token}`);
}
assert.doesNotMatch(table, /\? "POSITIONS"/, "Small screens must not restore the long Positions heading.");
assert.ok(shared.includes('mobile && short\n          ? short'), "Hydration must retain compact labels throughout <=900px.");
assert.doesNotMatch(shared, /function syncMobileColumnWidths/, "Responsive column widths must not be imperatively rewritten after paint.");
for (const width of [760, 600, 540]) assert.ok(shared.includes(`min-width: ${width}px;`), `Player table missing ${width}px compact floor.`);
for (const geometry of ['30px;\n    --mfl-table-row-height: 26px', '26px;\n    --mfl-table-row-height: 22px', '24px;\n    --mfl-table-row-height: 20px']) assert.ok(shared.includes(geometry), `Player rows missing compact geometry ${geometry}`);
for (const triggerSize of [18, 15, 13]) assert.ok(shared.includes(`width: ${triggerSize}px;`), `Player row action trigger missing ${triggerSize}px compact size.`);

assert.ok(
  shared.includes('const TINY_TABLE_MEDIA = window.matchMedia("(max-width: 380px)");')
    && shared.includes('TINY_TABLE_MEDIA.addEventListener("change", onResponsiveSizeChange);')
    && shared.includes('TINY_TABLE_MEDIA.removeEventListener("change", onResponsiveSizeChange);'),
  "The tiny-screen media-query owner must exist for both runtime listener lifecycle paths.",
);
assert.doesNotMatch(
  shared,
  /if \(!MOBILE_TABLE_MEDIA\.matches \|\| scroller\.getClientRects\(\)\.length === 0\) \{\s*setPlayerTableFadeDirections\(scroller, false, false\);/,
  "A temporarily hidden table must not clear an already-valid first-paint/hydrated fade direction.",
);
assert.ok(
  shared.includes('if (!MOBILE_TABLE_MEDIA.matches) {\n      setPlayerTableFadeDirections(scroller, false, false);\n      return;\n    }\n    if (scroller.getClientRects().length === 0) return;'),
  "Fade ownership must clear only when leaving mobile and preserve the previous cue while the table is temporarily non-renderable.",
);
assert.ok(
  shared.includes('function clearViewScrollerCues(views) {')
    && shared.includes('if (!MOBILE_TABLE_MEDIA.matches || views.hidden) {\n      clearViewScrollerCues(views);\n      return;\n    }\n    if (views.getClientRects().length === 0) return;'),
  "Views and Quick Filters must clear overflow cues only when intentionally unavailable, not during a temporary non-renderable hydration phase.",
);
assert.doesNotMatch(
  shared,
  /if \(!MOBILE_TABLE_MEDIA\.matches \|\| views\.getClientRects\(\)\.length === 0\) \{[\s\S]*?removeViewScrollShell\(views\);/,
  "Temporary Views/Quick Filters invisibility must not destroy the fade/chevron shell.",
);
assert.ok(
  shared.includes('const contentWidth = viewContentWidth(views);\n    if (contentWidth <= 0) return;'),
  "Hydration must keep the previous horizontal cue until rendered controls provide a meaningful width measurement.",
);

for (const token of [
  '.playerTableActionsButton { width: 18px;',
  '.playerTableActionsButton svg { width: 12px;',
  '.flagImage { width: 14px;',
  ':is(.retirementMarker, .newMintMarker) { flex: 0 0 11px;',
  '.playerNoteIcon { font-size: 9px;',
  '.listingCellContent { width: 18px;',
  '.listingCellIcon { flex: 0 0 9px;',
  '.playerTableActionsButton { width: 15px;',
  '.playerTableActionsButton svg { width: 9px;',
  '.flagImage { width: 11px;',
  ':is(.retirementMarker, .newMintMarker) { flex-basis: 9px;',
  '.playerNoteIcon { font-size: 7px;',
  '.listingCellContent { width: 15px;',
  '.listingCellIcon { flex-basis: 7px;',
  '.playerTableActionsButton { width: 13px;',
  '.playerTableActionsButton svg { width: 8px;',
  '.flagImage { width: 10px;',
  ':is(.retirementMarker, .newMintMarker) { flex-basis: 8px;',
  '.listingCellContent { width: 13px;',
  '.listingCellIcon { flex-basis: 6px;',
]) {
  assert.ok(projection.includes(token), `First-paint mobile control geometry missing ${token}`);
}

assert.ok(responsive.includes('min-width: 500px;'), "Phone Evaluation table must use a reduced width floor.");
assert.ok(responsive.includes('min-width: 460px;'), "Tiny Evaluation/Advanced tables must use a reduced width floor.");
assert.ok(responsive.includes('--mfl-evaluation-header-row-height: 27px;') && responsive.includes('--mfl-evaluation-season-row-height: 23px;'), "Phone Evaluation rows must be compact.");
assert.ok(responsive.includes('.advancedPlayerTable tbody :is(th, td) { height: 22px; }'), "Advanced Settings table rows must compact on phones.");
assert.ok(index.includes('evaluationHeaderCompact" aria-hidden="true">SZN</span>'), "Expected Seasons must use SZN on small screens.");
assert.ok(index.includes('evaluationHeaderCompact" aria-hidden="true">DISC</span>'), "Discount Factor must use DISC on small screens.");
for (const [breakpoint, width, rowHeight, fontSize, iconSize] of [
  [900, 176, 26, 11, 14],
  [520, 156, 24, 10, 12],
  [380, 144, 22, 9, 11],
]) {
  const contract = new RegExp(
    `@media \\(max-width: ${breakpoint}px\\) \\{[\\s\\S]*?\\.playerTableActionMenu \\{[\\s\\S]*?width: ${width}px;[\\s\\S]*?min-width: ${width}px;[\\s\\S]*?\\.playerTableActionItem \\{[\\s\\S]*?height: ${rowHeight}px;[\\s\\S]*?min-height: ${rowHeight}px;[\\s\\S]*?font-size: ${fontSize}px;[\\s\\S]*?\\.playerTableActionIcon,[\\s\\S]*?width: ${iconSize}px;[\\s\\S]*?height: ${iconSize}px;`,
  );
  assert.match(dropdowns, contract, `Player action controls must use the compact ${breakpoint}px geometry contract.`);
}
for (const source of [responsive, shared, dropdowns, table]) assert.doesNotMatch(source, /!important/, "Compact tables must not introduce !important.");
console.log("Player, Evaluation, Advanced Settings, row actions, first-paint controls, table fades, and horizontal chevron cues share one compact small-screen contract.");
