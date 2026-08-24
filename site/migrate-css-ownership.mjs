import { readFile, writeFile } from "node:fs/promises";

const read = async (relativePath) => String(await readFile(new URL(relativePath, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

function ruleRange(source, selector) {
  const marker = `${selector} {`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  if (source.indexOf(marker, start + marker.length) >= 0) {
    throw new Error(`Found duplicate rule marker: ${selector}`);
  }
  const end = source.indexOf("\n}", start);
  if (end < 0) throw new Error(`Could not find end of rule: ${selector}`);
  return { start, end: end + 2, text: source.slice(start, end + 2) };
}

function removeRuleIfPresent(source, selector) {
  const range = ruleRange(source, selector);
  if (!range) return source;
  let end = range.end;
  if (source.slice(end, end + 2) === "\n\n") end += 1;
  return source.slice(0, range.start) + source.slice(end);
}

function replaceInsideRule(source, selector, search, replacement, label) {
  const range = ruleRange(source, selector);
  if (!range) throw new Error(`Could not find ${label} rule: ${selector}`);
  if (!range.text.includes(search)) return source;
  if (range.text.indexOf(search) !== range.text.lastIndexOf(search)) {
    throw new Error(`Found duplicate ${label} fragment in ${selector}`);
  }
  const nextRule = range.text.replace(search, replacement);
  return source.slice(0, range.start) + nextRule + source.slice(range.end);
}

async function writeIfChanged(relativePath, current, next) {
  if (next === current) {
    console.log(`Unchanged ${relativePath}`);
    return;
  }
  await writeFile(new URL(relativePath, import.meta.url), next, "utf8");
  console.log(`Migrated ${relativePath}`);
}

const stylesBasePath = "./styles-base.css";
const stylesPath = "./styles.css";
const controlsPath = "./controls.css";

const originalStylesBase = await read(stylesBasePath);
const originalStyles = await read(stylesPath);
const originalControls = await read(controlsPath);

let stylesBase = originalStylesBase;
let styles = originalStyles;
let controls = originalControls;

stylesBase = replaceInsideRule(
  stylesBase,
  ".searchButton",
  "  border-color: var(--border-strong);\n  background: var(--surface-muted);\n  color: var(--text);\n",
  "",
  "Search layout",
);

for (const selector of [
  ".searchButton:hover",
  ".navButton:hover",
  ".navButton.active",
  ".viewButton.active",
  ".searchButton:hover:not(:disabled),\n.viewButton:not(.active):hover:not(:disabled)",
  ".viewButton.active:hover:not(:disabled)",
  ".mflStatsFilterButton:hover:not(.active)",
  ".mflStatsFilterButton.active",
  ".mflStatsDistributionModeButton:hover:not(.active)",
  ".mflStatsDistributionModeButton.active",
  ".playerAttributeViewButton.active",
]) {
  stylesBase = removeRuleIfPresent(stylesBase, selector);
}

if (stylesBase.includes(".tablePageTitle,\n.playerTitle {")) {
  stylesBase = stylesBase.replace(".tablePageTitle,\n.playerTitle {", ".playerTitle {");
}

const activeSelector = `:is(
  .navButton,
  .viewButton:not([hidden]),
  .filtersViewButton,
  .mflStatsFilterButton,
  .mflStatsDistributionModeButton,
  .playerAttributeViewButton
).active`;
const activeRule = ruleRange(controls, activeSelector);
if (!activeRule) throw new Error("Could not find the canonical shared active-control rule.");
if (!activeRule.text.includes("  border-color: var(--primary);")) {
  controls = replaceInsideRule(
    controls,
    activeSelector,
    "  cursor: default;",
    "  border-color: var(--primary);\n  background: var(--primary);\n  color: #ffffff;\n  cursor: default;",
    "shared active-control",
  );
}

const tableTitleRule = ruleRange(styles, ".tablePageTitle");
if (!tableTitleRule) throw new Error("Could not find the canonical table-title rule.");
if (!tableTitleRule.text.includes("  font-size: 20px;")) {
  styles = replaceInsideRule(
    styles,
    ".tablePageTitle",
    "  line-height: var(--mfl-page-title-line-height);",
    "  line-height: var(--mfl-page-title-line-height);\n  font-size: 20px;",
    "table-title",
  );
}

for (const retiredSelector of [
  ".searchButton:hover {",
  ".navButton:hover {",
  ".navButton.active {",
  ".viewButton.active {",
  ".viewButton.active:hover:not(:disabled) {",
  ".mflStatsFilterButton:hover:not(.active) {",
  ".mflStatsFilterButton.active {",
  ".mflStatsDistributionModeButton:hover:not(.active) {",
  ".mflStatsDistributionModeButton.active {",
  ".playerAttributeViewButton.active {",
]) {
  if (stylesBase.includes(retiredSelector)) {
    throw new Error(`Duplicate shared-control owner remains in styles-base.css: ${retiredSelector}`);
  }
}
if (stylesBase.includes(".searchButton:hover:not(:disabled),\n.viewButton:not(.active):hover:not(:disabled) {")) {
  throw new Error("Duplicate Search/View hover owner remains in styles-base.css.");
}
if (stylesBase.includes(".tablePageTitle,\n.playerTitle {")) {
  throw new Error("Table title typography remains split with player-title ownership.");
}
const finalSearchRule = ruleRange(stylesBase, ".searchButton")?.text || "";
for (const visualDeclaration of [
  "border-color: var(--border-strong);",
  "background: var(--surface-muted);",
  "color: var(--text);",
]) {
  if (finalSearchRule.includes(visualDeclaration)) {
    throw new Error(`styles-base.css still owns Search visual state through ${visualDeclaration}`);
  }
}
const finalActiveRule = ruleRange(controls, activeSelector)?.text || "";
for (const required of [
  "border-color: var(--primary);",
  "background: var(--primary);",
  "color: #ffffff;",
  "cursor: default;",
]) {
  if (!finalActiveRule.includes(required)) {
    throw new Error(`controls.css shared active rule is missing ${required}`);
  }
}
const finalTableTitleRule = ruleRange(styles, ".tablePageTitle")?.text || "";
if (!finalTableTitleRule.includes("font-size: 20px;")) {
  throw new Error("styles.css must own table-title font size.");
}
const playerTitleRule = ruleRange(stylesBase, ".playerTitle")?.text || "";
if (!playerTitleRule.includes("font-size: 20px;") || !playerTitleRule.includes("margin: 14px 0 12px;")) {
  throw new Error("Player title base typography must remain unchanged.");
}

await writeIfChanged(stylesBasePath, originalStylesBase, stylesBase);
await writeIfChanged(stylesPath, originalStyles, styles);
await writeIfChanged(controlsPath, originalControls, controls);
