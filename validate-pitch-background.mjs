import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { rootAsset } = require("./legacy-public-assets.cjs");
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [svg, base, responsive, plannerCss, generatedCss, playerMarkup, plannerMarkup, generatedHtml, playerCore, generatedPlayerCore, bootstrap] = await Promise.all([
  read("./pitch-background.svg"),
  read("./styles-base.css"),
  read("./responsive.css"),
  read("./planner.css"),
  read("./styles-runtime.css"),
  read("./html-sources/player.html"),
  read("./html-sources/planner.html"),
  read("./index.html"),
  read("./modules/core-sources/player.js"),
  read("./modules/app-core-player-runtime.js"),
  read("./bootstrap.js"),
]);

assert(rootAsset("pitch-background.svg"), "The shared SVG must be projected into Next's public assets.");
assert(svg.includes('viewBox="0 0 72 109"'), "The supplied pitch must retain its portrait aspect ratio.");
assert(svg.includes('transform="translate(0 109)"') && svg.includes('transform="rotate(-90)"'), "Pitch orientation must match the provided SVG.");
assert(svg.includes('stroke="#ceffd8"') && svg.includes('stroke-width="0.2"'), "Pitch lines must match the supplied artwork.");
assert.equal((svg.match(/<rect\b/g) || []).length, 6, "The pitch must retain its supplied boxes and boundaries.");
assert(base.includes('background: url("/pitch-background.svg") center / 100% 100% no-repeat,'), "Player and Planner must share the supplied SVG as the canonical pitch background.");
assert(generatedCss.includes('background: url("/pitch-background.svg") center / 100% 100% no-repeat,'), "Generated styles must use the supplied SVG from first paint.");
assert(base.includes("aspect-ratio: 72 / 109;"), "Player pitch geometry must match the SVG.");
assert(plannerCss.includes("aspect-ratio:72/109;"), "Planner pitch geometry must match the SVG.");
assert.equal((responsive.match(/aspect-ratio: 72 \/ 109;/g) || []).length, 2, "Tablet and mobile pitches must retain the SVG's aspect ratio.");
assert.equal((generatedCss.match(/aspect-ratio: 72 \/ 109;/g) || []).length, 3, "Generated CSS must include the desktop, tablet and mobile aspect ratios.");
assert(generatedCss.includes("aspect-ratio:72/109;"), "Generated Planner geometry must match the SVG.");
for (const [name, html] of [["Player source", playerMarkup], ["Planner source", plannerMarkup], ["generated shell", generatedHtml]]) {
  assert(html.includes('class="pitch'), name + " must retain the pitch and player slot content.");
  assert(!html.includes('pitchLine pitchBoxTop'), name + " must not render obsolete CSS pitch markings.");
}
for (const [name, source] of [["Player runtime", playerCore], ["generated Player runtime", generatedPlayerCore], ["Player loading shell", bootstrap]]) {
  assert(!source.includes('pitchLine pitchBoxTop'), name + " must not reintroduce old pitch markings during hydration.");
}
assert(!base.includes(".pitch::before,") && !generatedCss.includes(".pitch::before,"), "The retired pseudo-element field markings must not overlay the SVG.");
console.log("Shared Player/Planner SVG pitch validation passed for first paint, loading, hydration and responsive geometry.");
