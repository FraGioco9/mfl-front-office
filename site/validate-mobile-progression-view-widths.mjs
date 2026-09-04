import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const responsive = readFileSync(resolve(root, "responsive.css"), "utf8").replace(/\r\n?/g, "\n");

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

console.log("Every resolved or active mobile player-table view uses the same readable 760px floor while generic compact fallbacks remain 600px/540px.");
