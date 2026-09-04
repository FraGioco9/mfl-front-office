import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n?/g, "\n");
const responsive = read("responsive.css");
const styles = read("styles.css");
const projections = read("sync-release-projections.mjs");

const phoneStart = responsive.indexOf("@media (max-width: 520px)");
const tinyStart = responsive.indexOf("@media (max-width: 380px)", phoneStart);
assert.ok(phoneStart >= 0 && tinyStart > phoneStart);
const phone = responsive.slice(phoneStart, tinyStart);
const tiny = responsive.slice(tinyStart);

assert.match(phone, /#progressionPage \.playerTableScroller table \{\s*min-width: 600px;\s*\}/);
assert.match(phone, /\[data-initial-table-view\] #progressionPage \.playerTableScroller table/);
assert.match(phone, /#progressionPage:has\(\.viewButton\.active\) \.playerTableScroller table/);
assert.match(phone, /min-width: 760px;/);
assert.match(tiny, /#progressionPage \.playerTableScroller table \{\s*min-width: 540px;\s*\}/);
assert.doesNotMatch(phone, /!important/);

const firstPaintTableWidths = Array.from(
  projections.matchAll(/\[data-initial-table-page\] #progressionPage \.playerTableScroller table \{ min-width: (\d+)px;/g),
  (match) => Number(match[1]),
);
assert.deepEqual(firstPaintTableWidths, [760, 760, 760], "Refresh first paint must keep the resolved player table at 760px through every mobile breakpoint.");
assert.doesNotMatch(
  projections,
  /\[data-initial-table-page\] #progressionPage \.playerTableScroller table \{ min-width: (?:600|540)px;/,
  "A resolved refresh must never paint the compact unresolved 600px/540px fallback before hydration.",
);

const percentage = (name) => {
  const match = styles.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([0-9.]+)%`));
  assert.ok(match, `Missing ${name}.`);
  return Number(match[1]);
};

const mobileTableWidth = 760;
const sharedAgentPx = mobileTableWidth * percentage("--mfl-table-col-agent") / 100;
const contractsAgentPx = mobileTableWidth * percentage("--mfl-table-col-contract-agent") / 100;
assert.equal(Math.round(sharedAgentPx), Math.round(contractsAgentPx), "Agent must resolve to the same effective mobile pixel width in Contracts and every other player-table view.");
assert.equal(Math.round(sharedAgentPx), 91, "Agent should use the 91px effective mobile width at the shared 760px table floor.");

const sharedName = percentage("--mfl-table-col-name");
const sharedOverall = percentage("--mfl-table-col-overall");
const nextName = percentage("--mfl-table-col-next-name");
const nextOverall = percentage("--mfl-table-col-next-overall");
const nextOverallPx = mobileTableWidth * nextOverall / 100;
assert.equal(nextOverall, 9, "Next Overall should reserve 9% of the mobile player table for Overall.");
assert.equal(Math.round(nextOverallPx), 68, "Next Overall should render an approximately 68px Overall column at the shared 760px table floor.");
assert.ok(nextOverall > sharedOverall, "Next Overall must be wider than the default Overall column.");
assert.ok(
  Math.abs((nextName + nextOverall) - (sharedName + sharedOverall)) < 1e-12,
  "Next Overall must take its extra Overall width from Name without changing the 100%/760px table total.",
);
assert.match(
  styles,
  /\[data-initial-table-view="next"\] #progressionPage \.playerTableScroller,[\s\S]*#progressionPage:has\(\.viewButton\[data-view="next"\]\.active\) \.playerTableScroller[\s\S]*--mfl-table-col-name: var\(--mfl-table-col-next-name\);[\s\S]*--mfl-table-col-overall: var\(--mfl-table-col-next-overall\);/,
  "Next Overall must use the same widened Overall geometry on refresh first paint and after hydration.",
);
assert.match(
  styles,
  /#progressionPage #tableBody \.tableControlCellContent > :is\(\.progressionValue, \.tableNextOverallValue\) \{\s*margin-left: 4px;\s*\}/,
  "Regular table progression deltas must use one 4px value-to-delta gap across Next, Current Season, and All Time.",
);
assert.match(
  styles,
  /#progressionPage #tableBody \.tableOverallCellContent > \.progressionValue \{\s*margin-left: calc\(4px - 0\.25em\);\s*\}/,
  "Overall progression must compensate its retained non-breaking-space glyph so its visible gap matches the same 4px table gap.",
);

console.log("Resolved mobile refreshes paint directly at 760px; Next Overall uses an approximately 68px Overall column, Agent remains effectively 91px, and progression value-to-delta spacing is normalized.");