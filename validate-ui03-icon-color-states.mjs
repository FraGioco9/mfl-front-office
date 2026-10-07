import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(resolve(root, path), "utf8");
const controls = read("controls.css");
const planner = read("planner.css");
const foundations = read("ui-foundations.css");
const palette = read("styles-base.css");
const evaluationHtml = read("html-sources/evaluation.html");
const plannerHtml = read("html-sources/planner.html");

for (const token of ["--mfl-icon-size-navigation: 18px;", "--mfl-icon-size-control: 17px;",
  "--mfl-focus-ring-color: var(--primary);", "--mfl-focus-ring-width: 2px;"]) {
  assert.ok(foundations.includes(token), "Missing canonical token: " + token);
}
const getRule = (css, selector) => {
  const start = css.indexOf(selector + " {");
  assert.ok(start >= 0, "Selector not found: " + selector);
  return css.slice(start, css.indexOf("}", start) + 1);
};
const controlRule = getRule(controls, ".evaluationSearchClearButton:focus-visible:not(:disabled),\n.playerSearchClearButton:focus-visible:not(:disabled)");
const plannerStart = ".plannerTeamSearchClearButton:focus-visible:not(:disabled),.plannerPlayerSearchClearButton:focus-visible:not(:disabled)";
const plannerRule = planner.slice(planner.indexOf(plannerStart), planner.indexOf("}", planner.indexOf(plannerStart)) + 1);
assert.ok(plannerRule.startsWith(plannerStart), "Planner focus-visible pair missing.");
for (const required of [
  "outline: var(--mfl-focus-ring-width) solid var(--mfl-focus-ring-color);",
  "outline-offset: calc(-1 * var(--mfl-focus-ring-width));",
]) {
  assert.ok(controlRule.includes(required), "Ordinary clear focus ring must consume " + required);
  assert.ok(plannerRule.includes(required.replaceAll(": ", ":").replace(/;$/, "")),
    "Planner clear focus ring must consume " + required);
}
assert.match(controls, /outline: 0;\s*border-color: transparent;\s*background: transparent;\s*box-shadow: none;/,
  "Ordinary search-clear hover must remain transparent.");
assert.match(planner, /#plannerTeamSearchInput:placeholder-shown\+\.plannerTeamSearchClearButton\{visibility:hidden;opacity:0;pointer-events:none\}/,
  "Empty Planner Team clear button must stay hidden.");
for (const [html, id, label] of [
  [evaluationHtml, "evaluationSearchClearButton", "Clear player search"],
  [plannerHtml, "plannerTeamSearchClearButton", "Clear team search"],
  [plannerHtml, "plannerPlayerSearchClearButton", "Clear player search"],
]) {
  const buttonStart = html.indexOf('id="' + id + '"');
  assert.ok(buttonStart >= 0 && html.slice(buttonStart, buttonStart + 160).includes('aria-label="' + label + '"'),
    "Icon-only button needs readable aria-label: " + id);
}

assert.ok(planner.includes("color:color-mix(in srgb,#05f82c 38%,var(--text))"),
  "Saved plan badge must use foreground derived from theme text; not fixed pale green.");
const hex = value => {
  const h = value.replace("#", "");
  assert.match(h, /^[0-9a-fA-F]{6}$/);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const blend = (a, b, fraction) => a.map((n, i) => n * fraction + b[i] * (1 - fraction));
const linear = n => { const v = n / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = rgb => 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
const contrast = (a, b) => {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const variable = (text, name) => {
  const re = new RegExp(name + ":\\s*(#[a-fA-F0-9]{6});");
  const found = text.match(re);
  assert.ok(found, "Theme is missing palette token " + name);
  return hex(found[1]);
};
const themeStart = palette.indexOf(':root[data-theme="dark"] {');
assert.ok(themeStart > 0);
const light = palette.slice(0, themeStart);
const dark = palette.slice(themeStart, palette.indexOf("\n}", themeStart) + 2);
for (const [name, source] of [["light", light], ["dark", dark]]) {
  const background = blend(hex("#05f82c"), variable(source, "--surface-muted"), 0.10);
  const foreground = blend(hex("#05f82c"), variable(source, "--text"), 0.38);
  const ratio = contrast(foreground, background);
  assert.ok(ratio >= 4.5, name + " Saved pill contrast must be at least 4.5:1; got " + ratio.toFixed(2));
  console.log("UI-03 Saved badge " + name + " contrast: " + ratio.toFixed(2) + ":1");
}
console.log("UI-03 icon focus, aria labels, theme-derived Saved status and color contrasts passed.");
