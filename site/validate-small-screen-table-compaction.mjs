import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(root, name), "utf8");
const responsive = read("responsive.css");
const shared = read("shared-table-ui-runtime.js");
const dropdowns = read("dropdowns.css");
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
console.log("Player, Evaluation, Advanced Settings, and row action controls use one compact small-screen contract with stable first-paint/hydrated geometry.");
