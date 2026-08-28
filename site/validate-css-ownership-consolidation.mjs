import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [stylesBase, styles, controls] = await Promise.all([
  read("./styles-base.css"),
  read("./styles.css"),
  read("./controls.css"),
]);

function exactRule(source, selector) {
  const marker = `${selector} {`;
  const starts = [];
  let offset = 0;
  while (offset < source.length) {
    const index = source.indexOf(marker, offset);
    if (index < 0) break;
    if (index === 0 || source[index - 1] === "\n") starts.push(index);
    offset = index + marker.length;
  }
  invariant(starts.length <= 1, `Expected at most one exact rule for ${selector}.`);
  if (!starts.length) return "";
  const end = source.indexOf("\n}", starts[0]);
  invariant(end >= 0, `Could not find the end of ${selector}.`);
  return source.slice(starts[0], end + 2);
}

const retiredGenericSelectors = [
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
];
for (const selector of retiredGenericSelectors) {
  invariant(
    !exactRule(stylesBase, selector),
    `styles-base.css must not regain generic shared-control visual ownership through ${selector}.`,
  );
}

const baseSearchRule = exactRule(stylesBase, ".searchButton");
invariant(baseSearchRule, "styles-base.css must retain Search geometry ownership.");
for (const visualDeclaration of [
  "border-color: var(--border-strong);",
  "background: var(--surface-muted);",
  "color: var(--text);",
]) {
  invariant(
    !baseSearchRule.includes(visualDeclaration),
    `Search visual state must stay in controls.css, not styles-base.css: ${visualDeclaration}`,
  );
}
for (const geometryDeclaration of [
  "display: grid;",
  "width: min(560px, 100%);",
  "height: 40px;",
]) {
  invariant(
    baseSearchRule.includes(geometryDeclaration),
    `Search geometry must remain in styles-base.css: ${geometryDeclaration}`,
  );
}

const activeSelector = `:is(
  .navButton,
  .viewButton:not([hidden]),
  .filtersViewButton,
  .mflStatsFilterButton,
  .mflStatsDistributionModeButton,
  .playerAttributeViewButton
).active`;
const canonicalActiveRule = exactRule(controls, activeSelector);
invariant(canonicalActiveRule, "controls.css must retain the canonical shared active-control rule.");
for (const required of [
  "border-color: var(--primary);",
  "background: var(--primary);",
  "color: #ffffff;",
  "cursor: default;",
]) {
  invariant(
    canonicalActiveRule.includes(required),
    `controls.css shared active-control rule is missing ${required}`,
  );
}

const canonicalHoverSelector = `:is(
  .themeButton,
  .navButton,
  .viewButton:not([hidden]),
  .filtersViewButton,
  .mflStatsFilterButton,
  .mflStatsDistributionModeButton,
  .playerAttributeViewButton
):not(.active):hover:not(:disabled)`;
const canonicalHoverRule = exactRule(controls, canonicalHoverSelector);
invariant(canonicalHoverRule, "controls.css must retain the canonical shared hover-control rule, including the theme toggle.");
for (const required of ["border-color: var(--primary-hover);", "background: var(--row-hover);"]) {
  invariant(canonicalHoverRule.includes(required), `controls.css shared hover-control rule is missing ${required}`);
}

invariant(
  !stylesBase.includes(".tablePageTitle,\n.playerTitle {"),
  "Table and Player title typography must not share an owner in styles-base.css.",
);
invariant(
  stylesBase.includes(`.playerTitle {
  margin: 14px 0 12px;
  font-size: 20px;
  line-height: 1.2;
}`),
  "Player title base typography must remain unchanged in styles-base.css.",
);
const tableTitleRule = exactRule(styles, ".tablePageTitle");
invariant(tableTitleRule, "styles.css must remain the canonical table-title owner.");
for (const required of [
  "margin: var(--mfl-page-title-margin-block-start) 0 var(--mfl-page-title-margin-block-end);",
  "line-height: var(--mfl-page-title-line-height);",
  "font-size: 20px;",
]) {
  invariant(tableTitleRule.includes(required), `styles.css table-title rule is missing ${required}`);
}

invariant(!stylesBase.includes("!important"), "CSS ownership consolidation must not add !important to styles-base.css.");
invariant(!styles.includes("!important"), "CSS ownership consolidation must not add !important to styles.css.");
invariant(!controls.includes("!important"), "CSS ownership consolidation must not add !important to controls.css.");

console.log("Canonical shared-control and table-title CSS ownership validation passed.");
