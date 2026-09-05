import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const footer = read("./footer.css");
const responsive = read("./responsive.css");
const generated = read("./styles-runtime.css");
const indexHtml = read("./index.html");

const gridFloor = "grid-template-rows: minmax(var(--mfl-footer-page-floor), max-content) max-content;";
assert.ok(footer.includes("main {\n  --mfl-footer-page-floor: 800px;") && footer.includes(gridFloor), "Every route must share the desktop 800px footer floor through the first content grid row.");
assert.ok(!footer.includes("main > .pageView {\n  min-height: var(--mfl-footer-page-floor);"), "The footer floor must not depend on a visible pageView.");
assert.ok(generated.includes("--mfl-footer-page-floor: 800px;") && generated.includes(gridFloor), "The canonical grid-row footer-floor owner must be projected into styles-runtime.css.");
assert.ok(
  indexHtml.includes('data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage')
    && indexHtml.includes('data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage'),
  "Direct entity refreshes must retain their pre-verification hidden-shell guards while the grid row preserves footer distance.",
);

const contracts = [
  ["900", "clamp(560px, 80dvh, 680px)"],
  ["520", "clamp(500px, 76dvh, 620px)"],
  ["380", "clamp(460px, 72dvh, 560px)"],
];
for (const [breakpoint, floor] of contracts) assert.ok(responsive.includes(`--mfl-footer-page-floor: ${floor};`), `${breakpoint}px must own the scaled shared footer floor ${floor}.`);

assert.equal((footer.match(/--mfl-footer-page-floor:/g) || []).length, 1, "Desktop footer floor must have one canonical declaration.");
assert.equal((responsive.match(/--mfl-footer-page-floor:/g) || []).length, 3, "Responsive footer floor must be defined exactly once at each mobile breakpoint.");
assert.ok(!responsive.includes("#homePage {\n    --mfl-footer-page-floor"), "Mobile footer floor must not be Home-specific.");
assert.ok(!responsive.includes("#progressionPage {\n    --mfl-footer-page-floor"), "Mobile footer floor must not be table-specific.");
assert.ok(!footer.includes("!important") && !responsive.includes("--mfl-footer-page-floor: 800px !important"), "Footer floor must not use overrides or !important.");

console.log("Shared responsive footer minimum-distance validation passed, including hidden Player/Club first paint.");
