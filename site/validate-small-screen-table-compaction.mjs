import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(root, name), "utf8");
const responsive = read("responsive.css");
const shared = read("shared-table-ui-runtime.js");
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
assert.ok(responsive.includes('min-width: 500px;'), "Phone Evaluation table must use a reduced width floor.");
assert.ok(responsive.includes('min-width: 460px;'), "Tiny Evaluation/Advanced tables must use a reduced width floor.");
assert.ok(responsive.includes('--mfl-evaluation-header-row-height: 27px;') && responsive.includes('--mfl-evaluation-season-row-height: 23px;'), "Phone Evaluation rows must be compact.");
assert.ok(responsive.includes('.advancedPlayerTable tbody :is(th, td) { height: 22px; }'), "Advanced Settings table rows must compact on phones.");
assert.ok(index.includes('evaluationHeaderCompact" aria-hidden="true">SZN</span>'), "Expected Seasons must use SZN on small screens.");
assert.ok(index.includes('evaluationHeaderCompact" aria-hidden="true">DISC</span>'), "Discount Factor must use DISC on small screens.");
for (const source of [responsive, shared, table]) assert.doesNotMatch(source, /!important/, "Compact tables must not introduce !important.");
console.log("Player, Evaluation, and Advanced Settings tables use one compact small-screen contract with stable first-paint/hydrated geometry.");
