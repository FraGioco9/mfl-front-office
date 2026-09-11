import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const includes = (source, token, message) => {
  if (!source.includes(token)) throw new Error(message);
};
const excludes = (source, token, message) => {
  if (source.includes(token)) throw new Error(message);
};
const exactRule = (source, selector) => {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) return "";
  const end = source.indexOf("\n}", start);
  return end > start ? source.slice(start, end + 2) : "";
};

const [
  foundations,
  stacking,
  stylesBase,
  styles,
  controls,
  dropdowns,
  footer,
  parity,
  phoneTables,
  phoneStatic,
  compact,
  docs,
] = await Promise.all([
  read("./ui-foundations.css"),
  read("./stacking.css"),
  read("./styles-base.css"),
  read("./styles.css"),
  read("./controls.css"),
  read("./dropdowns.css"),
  read("./footer.css"),
  read("./responsive-sources/parity.css.inc"),
  read("./responsive-sources/tables-phone.css.inc"),
  read("./responsive-sources/static-phone.css.inc"),
  read("./responsive-sources/compact.css.inc"),
  read("../docs/ui-foundations.md"),
]);

for (const token of [
  "--mfl-control-height: 40px;",
  "--mfl-control-compact-height: 36px;",
  "--mfl-control-label-font-size: 14px;",
  "--mfl-control-font-weight: 700;",
  "--mfl-control-line-height: 1;",
  "--mfl-control-border-color: var(--border-strong);",
  "--mfl-control-background: var(--surface);",
  "--mfl-control-text-color: var(--text);",
  "--mfl-control-hover-border-color: var(--primary-hover);",
  "--mfl-control-hover-background: var(--row-hover);",
  "--mfl-control-hover-text-color: var(--text);",
  "--mfl-radius-control: 6px;",
  "--mfl-checkbox-size: 16px;",
  "--mfl-radius-checkbox: 4px;",
  "--mfl-icon-size-navigation: 18px;",
  "--mfl-icon-size-control: 17px;",
  "--mfl-page-gutter-inline: 28px;",
  "--mfl-page-inset-block-start: 10px;",
  "--mfl-page-inset-block-end: 6px;",
  "--mfl-page-title-font-size: 20px;",
  "--mfl-page-title-min-height: 32px;",
  "--mfl-page-title-margin-block-start: 0px;",
  "--mfl-page-title-margin-block-end: 8px;",
  "--mfl-page-title-line-height: 1.2;",
  "--mfl-page-section-gap: 6px;",
  "--mfl-section-title-font-size: 16px;",
  "--mfl-section-title-compact-font-size: 15px;",
  "--mfl-section-title-line-height: 1.1;",
  "--mfl-section-title-font-weight: 700;",
  "--mfl-metadata-font-size: 12px;",
  "--mfl-metadata-compact-font-size: 11px;",
  "--mfl-metadata-font-weight: 700;",
  "--mfl-metadata-strong-font-weight: 800;",
  "--mfl-metadata-line-height: 1.1;",
  "--mfl-helper-text-font-size: 12px;",
  "--mfl-helper-text-line-height: 1.25;",
  "--mfl-helper-text-font-weight: 400;",
  "--mfl-helper-error-font-weight: 700;",
  "--mfl-helper-text-color: var(--text-soft);",
  "--mfl-helper-error-color: var(--danger);",
  "--mfl-focus-ring-color: var(--primary);",
  "--mfl-focus-ring-width: 2px;",
  "--mfl-focus-ring-offset: 2px;",
  "--mfl-panel-background: var(--surface);",
  "--mfl-panel-border: 1px solid var(--border);",
  "--mfl-panel-border-strong: 1px solid var(--border-strong);",
  "--mfl-radius-panel: 8px;",
  "--mfl-modal-backdrop-background: rgba(0, 0, 0, 0.45);",
  "--mfl-dialog-background: var(--surface);",
  "--mfl-dialog-border: 1px solid var(--border);",
  "--mfl-dialog-divider: 1px solid var(--border);",
  "--mfl-radius-dialog: 8px;",
  "--mfl-shadow-tooltip: 0 10px 26px rgba(0, 0, 0, 0.28);",
  "--mfl-shadow-modal: 0 20px 80px rgba(0, 0, 0, 0.28);",
  "--mfl-shadow-mobile-navigation: 0 10px 28px rgba(0, 0, 0, 0.18);",
]) {
  includes(foundations, token, `Global UI foundations are missing: ${token}`);
}

includes(stacking, '@import url("/ui-foundations.css");', "Global UI foundations must load before shared stacking/base styles.");

const viewControlTypography = exactRule(stylesBase, ".viewButton");
includes(viewControlTypography, "height: var(--mfl-control-height);", "View controls must consume the shared standard control height.");
includes(viewControlTypography, "font-size: var(--mfl-control-label-font-size);", "View controls must consume the shared standard control-label size.");
includes(viewControlTypography, "font-weight: var(--mfl-control-font-weight);", "View controls must consume the shared ordinary-control weight.");
includes(viewControlTypography, "line-height: var(--mfl-control-line-height);", "View controls must consume the shared ordinary-control line height.");
const filtersControlTypography = exactRule(controls, ".filtersViewButton");
includes(filtersControlTypography, "height: var(--mfl-control-height);", "Filters must consume the shared standard control height.");
includes(filtersControlTypography, "font-size: var(--mfl-control-label-font-size);", "Filters must consume the shared standard control-label size.");
includes(filtersControlTypography, "font-weight: var(--mfl-control-font-weight);", "Filters must consume the shared ordinary-control weight.");
includes(filtersControlTypography, "line-height: var(--mfl-control-line-height);", "Filters must consume the shared ordinary-control line height.");
for (const [label, rule] of [["View", viewControlTypography], ["Filters", filtersControlTypography]]) {
  includes(rule, "border-color: var(--mfl-control-border-color);", label + " controls must consume the shared resting border color.");
  includes(rule, "background: var(--mfl-control-background);", label + " controls must consume the shared resting background.");
  includes(rule, "color: var(--mfl-control-text-color);", label + " controls must consume the shared resting text color.");
}
const searchControlGeometry = exactRule(stylesBase, ".searchButton");
includes(searchControlGeometry, "height: var(--mfl-control-height);", "Search must consume the shared standard control height.");
const searchLabelTypography = exactRule(stylesBase, ".searchLabel");
includes(searchLabelTypography, "font-size: var(--mfl-control-label-font-size);", "Search label must consume the shared standard control-label size.");
includes(
  stylesBase,
  "input,\nselect {\n  height: var(--mfl-control-height);\n  width: 100%;\n  border: 1px solid var(--border-strong);\n  border-radius: var(--mfl-radius-control);",
  "Default input/select controls must consume the shared standard control height and radius.",
);
const baseButtonGeometry = exactRule(stylesBase, "button");
includes(baseButtonGeometry, "height: var(--mfl-control-height);", "Default buttons must consume the shared standard control height.");
includes(baseButtonGeometry, "border-radius: var(--mfl-radius-control);", "Default buttons must consume the shared control radius.");
const rowsMetadataGeometry = exactRule(stylesBase, ".field.rowsField span");
includes(rowsMetadataGeometry, "line-height: var(--mfl-control-height);", "Rows metadata must align to the shared control height.");
const filterSummaryGeometry = exactRule(stylesBase, "#filterSummary");
includes(filterSummaryGeometry, "height: var(--mfl-control-height);", "Filter summary must align to the shared control height.");
for (const selector of [
  "#progressionPage > .controlsBar > .rowsField",
  "#progressionPage .views > .rowsField",
  "#progressionPage .watchlistButton",
  "#progressionPage #pageSizeSelect",
]) {
  const rule = exactRule(styles, selector);
  if (!rule) throw new Error(`Expected shared table-control consumer ${selector}.`);
  includes(rule, "height: var(--mfl-control-height);", `${selector} must consume the shared standard control height.`);
}

const searchControlState = exactRule(controls, ".searchButton");
includes(searchControlState, "border-color: var(--mfl-control-border-color);", "Search must consume the shared resting border color.");
includes(searchControlState, "background: var(--mfl-control-background);", "Search must consume the shared resting background.");
includes(searchControlState, "color: var(--mfl-control-text-color);", "Search must consume the shared resting text color.");
const searchHoverState = exactRule(controls, ".searchButton:hover:not(:disabled),\n.searchButton:focus-visible:not(:disabled)");
includes(searchHoverState, "border-color: var(--mfl-control-hover-border-color);", "Search hover/focus must consume the shared hover border color.");
includes(searchHoverState, "background: var(--mfl-control-hover-background);", "Search hover/focus must consume the shared hover background.");
includes(searchHoverState, "color: var(--mfl-control-hover-text-color);", "Search hover/focus must consume the shared hover text color.");
const ordinaryControlHover = exactRule(controls, ":is(\n  .viewButton:not([hidden]),\n  .filtersViewButton\n):not(.active):hover:not(:disabled)");
includes(ordinaryControlHover, "border-color: var(--mfl-control-hover-border-color);", "View/Filters hover must consume the shared hover border color.");
includes(ordinaryControlHover, "background: var(--mfl-control-hover-background);", "View/Filters hover must consume the shared hover background.");
includes(ordinaryControlHover, "color: var(--mfl-control-hover-text-color);", "View/Filters hover must consume the shared hover text color.");
const filtersOpenState = exactRule(controls, "body.filtersOpen .filtersViewButton");
includes(filtersOpenState, "border-color: var(--mfl-control-hover-border-color);", "Open Filters must consume the shared hover border color.");
includes(filtersOpenState, "background: var(--mfl-control-hover-background);", "Open Filters must consume the shared hover background.");
const specialistControlHover = exactRule(controls, ":is(\n  .themeButton,\n  .navButton,\n  .mflStatsFilterButton,\n  .mflStatsDistributionModeButton,\n  .playerAttributeViewButton\n):not(.active):hover:not(:disabled)");
includes(specialistControlHover, "border-color: var(--primary-hover);", "Specialist control hover border must remain locally owned.");
includes(specialistControlHover, "background: var(--row-hover);", "Specialist control hover background must remain locally owned.");
excludes(specialistControlHover, "var(--mfl-control-hover-", "Navigation/Stats/Player specialist hover states must not consume ordinary control-state tokens.");
const playerAttributeTypography = exactRule(stylesBase, ".playerAttributeViewButton");
if (!playerAttributeTypography) throw new Error("Expected Player Attribute control typography owner.");
excludes(playerAttributeTypography, "font-size: var(--mfl-control-label-font-size);", "Player Attribute control size must remain Player-owned.");
includes(controls, ".mflStatsFilterButton,\n  .mflStatsDistributionModeButton,\n  .playerAttributeViewButton\n) {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  line-height: var(--mfl-control-line-height);", "Equivalent selector controls must consume the shared ordinary-control line-height foundation.");

includes(stylesBase, ".navEmoji {\n  display: grid;\n  place-items: center;\n  align-self: center;\n  justify-self: center;\n  width: var(--mfl-icon-size-navigation);\n  height: var(--mfl-icon-size-navigation);", "Shared navigation icons must consume the navigation-icon foundation.");
for (const token of [
  "#sidebar .navEmoji {\n  flex: 0 0 var(--mfl-icon-size-navigation);\n  width: var(--mfl-icon-size-navigation);",
  "#sidebar .navJerseyIcon {\n  width: var(--mfl-icon-size-navigation);\n  height: var(--mfl-icon-size-navigation);",
  ".searchButton .searchIcon {\n  display: block;\n  flex: 0 0 var(--mfl-icon-size-control);\n  width: var(--mfl-icon-size-control);\n  height: var(--mfl-icon-size-control);",
  ".filtersViewIcon {\n  flex: 0 0 var(--mfl-icon-size-control);\n  align-self: center;\n  width: var(--mfl-icon-size-control);\n  height: var(--mfl-icon-size-control);",
]) {
  includes(controls, token, `Equivalent ordinary UI icons must consume the shared semantic icon-size foundation: ${token}`);
}
includes(stylesBase, ".advancedSettingsIcon {\n  flex: 0 0 16px;\n  width: 16px;\n  height: 16px;", "Advanced Settings icon geometry must remain specialist-owned.");
includes(dropdowns, ".accountButtonIcon {\n  flex: 0 0 auto;\n  width: 18px;\n  height: 18px;", "Account icon geometry must remain Account-owned despite matching the navigation size numerically on desktop.");

for (const duplicate of [
  "--mfl-page-title-font-size: 20px;",
  "--mfl-page-title-min-height: 32px;",
  "--mfl-page-title-margin-block-start: 0px;",
  "--mfl-page-title-margin-block-end: 8px;",
  "--mfl-page-title-line-height: 1.2;",
  "--mfl-page-section-gap: 6px;",
]) {
  excludes(styles, duplicate, `Page foundation value must be owned only by ui-foundations.css: ${duplicate}`);
}

for (const token of [
  "min-height: var(--mfl-page-title-min-height);",
  "margin: var(--mfl-page-title-margin-block-start) 0 var(--mfl-page-title-margin-block-end);",
  "line-height: var(--mfl-page-title-line-height);",
  "font-size: var(--mfl-page-title-font-size);",
  "#progressionPage .views {\n  margin-bottom: var(--mfl-page-section-gap);",
  ".quickFilters {\n  margin-bottom: var(--mfl-page-section-gap);",
  "top: calc(var(--mfl-page-title-margin-block-start) + var(--mfl-page-title-min-height) + var(--mfl-page-title-margin-block-end));",
]) {
  includes(styles, token, `Page chrome must consume the shared page foundation: ${token}`);
}
excludes(
  styles,
  "top: calc(var(--mfl-page-title-margin-block-start) + 32px + var(--mfl-page-title-margin-block-end));",
  "First-paint page controls must not duplicate the shared 32px page-title height.",
);

includes(
  stylesBase,
  "padding: var(--mfl-page-inset-block-start) var(--mfl-page-gutter-inline) var(--mfl-page-inset-block-end);",
  "Desktop main content must consume the shared page gutter and block inset tokens.",
);
excludes(stylesBase, "padding: 4px 28px 6px;", "Desktop main content must not retain duplicated page inset/gutter literals.");

for (const token of [
  "--mfl-page-gutter-inline: 12px;",
  "--mfl-page-inset-block-end: max(calc(var(--mobile-nav-height) + 18px), env(safe-area-inset-bottom));",
  "padding-right: max(var(--mfl-page-gutter-inline), env(safe-area-inset-right));",
  "padding-bottom: var(--mfl-page-inset-block-end);",
  "padding-left: max(var(--mfl-page-gutter-inline), env(safe-area-inset-left));",
]) {
  includes(parity, token, `Tablet/mobile page layout must consume the shared page foundation: ${token}`);
}

for (const token of [
  "--mfl-page-gutter-inline: 8px;",
  "--mfl-page-title-font-size: 18px;",
  "--mfl-page-section-gap: 5px;",
]) {
  includes(phoneTables, token, `Phone page foundations must override the shared semantic token: ${token}`);
}
excludes(phoneTables, ".tablePageTitle {\n    font-size: 18px;", "Phone title sizing must use the shared page-title token.");
excludes(phoneTables, "padding-right: max(8px, env(safe-area-inset-right));", "Phone main gutter must use the shared gutter token.");
excludes(phoneTables, "padding-left: max(8px, env(safe-area-inset-left));", "Phone main gutter must use the shared gutter token.");

for (const [selector, sizeToken] of [
  [".advancedSettingsSection h3", "var(--mfl-section-title-font-size)"],
  [".settingsSection h3", "var(--mfl-section-title-font-size)"],
  [".mflStatsDistribution h3", "var(--mfl-section-title-compact-font-size)"],
  [".privacySection h3", "var(--mfl-section-title-compact-font-size)"],
]) {
  const rule = exactRule(stylesBase, selector);
  if (!rule) throw new Error(`Expected shared section-title consumer ${selector}.`);
  includes(rule, `font-size: ${sizeToken};`, `${selector} must consume its shared section-title size.`);
  includes(rule, "font-weight: var(--mfl-section-title-font-weight);", `${selector} must consume the shared section-title weight.`);
  includes(rule, "line-height: var(--mfl-section-title-line-height);", `${selector} must consume the shared section-title line height.`);
}
includes(stylesBase, ".evaluationPanel h3 {\n  margin: 0 0 10px;\n  font-size: 18px;", "Evaluation section headings must keep their specialist geometry.");
includes(stylesBase, ".playerHero h2,\n.playerPanel h3 {\n  margin: 0;", "Player heading geometry must remain Player-owned.");

for (const selector of [
  ".mflStatsViews",
  ".mflStatsFilters",
  ".mflStatsCards",
  ".mflStatsDistributionHeader",
]) {
  const start = phoneStatic.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Expected small-screen Stats section ${selector}.`);
  const end = phoneStatic.indexOf("}", start);
  includes(
    phoneStatic.slice(start, end),
    "var(--mfl-page-section-gap)",
    `${selector} must use the shared page section gap.`,
  );
}
excludes(phoneStatic, ".mflStatsPage .tablePageTitle", "Stats pages must not own a separate phone title size.");
includes(compact, "--mfl-page-title-font-size: 17px;", "Compact screens must override the shared page-title token.");
excludes(compact, ".tablePageTitle {\n    font-size: 17px;", "Compact title sizing must use the shared page-title token.");

for (const token of [
  ".homeStats div {\n  padding: 10px 14px;\n  border: var(--mfl-panel-border);\n  border-radius: var(--mfl-radius-panel);\n  background: var(--mfl-panel-background);",
  ".mflStatsFilters {\n  display: grid;\n  gap: 5px;\n  margin-bottom: 7px;\n  padding: 7px 9px;\n  border: var(--mfl-panel-border-strong);\n  border-radius: var(--mfl-radius-panel);\n  background: var(--mfl-panel-background);",
  ".mflStatsCards article,\n.mflStatsDistribution {\n  border: var(--mfl-panel-border-strong);\n  border-radius: var(--mfl-radius-panel);\n  background: var(--mfl-panel-background);",
  ".settingsIdentity div,\n.settingsSection {\n  border: var(--mfl-panel-border-strong);\n  border-radius: var(--mfl-radius-panel);\n  background: var(--mfl-panel-background);",
  ".privacySection {\n  padding: 14px 16px;\n  border: var(--mfl-panel-border);\n  border-radius: var(--mfl-radius-panel);\n  background: var(--mfl-panel-background);",
]) {
  includes(stylesBase, token, `Equivalent page/content surfaces must consume the shared panel radius: ${token}`);
}
includes(styles, "--mfl-table-radius: 8px;", "Table radius must remain table-owned rather than consuming the generic panel radius.");
includes(stylesBase, ".tableShell {\n  position: relative;\n  background: var(--mfl-table-surface);\n  border: 1px solid var(--mfl-table-border-color);\n  border-radius: var(--mfl-table-radius);", "Table shell must consume the Table-domain surface/border/radius contract rather than generic panel foundations.");
includes(stylesBase, ".playerHero,\n.playerPanel {\n  border: 1px solid var(--border);\n  border-radius: 8px;", "Player surface radius must remain Player-owned.");
const tableShellSurface = exactRule(stylesBase, ".tableShell");
excludes(tableShellSurface, "var(--mfl-panel-", "Table surfaces must remain table-owned rather than consuming ordinary panel surface tokens.");
const playerHeroSurface = exactRule(stylesBase, ".playerHero,\n.playerPanel");
excludes(playerHeroSurface, "var(--mfl-panel-", "Player surfaces must remain Player-owned rather than consuming ordinary panel surface tokens.");

excludes(
  styles,
  "#progressionPage .watchlistSwitcherLabel,\n#progressionPage .rowsField > span {\n  font-size: 12px;\n  font-weight: 600;",
  "Table chrome must not override shared metadata typography after the foundation is applied.",
);
includes(
  styles,
  "#progressionPage .watchlistSwitcherLabel {\n  text-transform: uppercase;\n}",
  "Table chrome may keep presentation-only uppercase styling without re-owning metadata size/weight/line-height.",
);

for (const [selector, sizeToken, weightToken, lineToken] of [
  [".changelogMinorMeta", "var(--mfl-metadata-font-size)", "var(--mfl-metadata-font-weight)", "var(--mfl-metadata-line-height)"],
  [".homeStats label", "var(--mfl-metadata-font-size)", "var(--mfl-metadata-font-weight)", null],
  [".watchlistSwitcherLabel", "var(--mfl-metadata-font-size)", "var(--mfl-metadata-font-weight)", null],
  [".field.rowsField span", "var(--mfl-metadata-compact-font-size)", "var(--mfl-metadata-strong-font-weight)", null],
  [".field span", "var(--mfl-metadata-font-size)", "var(--mfl-metadata-font-weight)", null],
  [".mflStatsFilters > span", "var(--mfl-metadata-font-size)", "var(--mfl-metadata-strong-font-weight)", null],
  [".mflStatsCards article > span", "var(--mfl-metadata-compact-font-size)", "var(--mfl-metadata-strong-font-weight)", "var(--mfl-metadata-line-height)"],
  [".settingsIdentity span", "var(--mfl-metadata-font-size)", "var(--mfl-metadata-font-weight)", null],
]) {
  const rule = exactRule(stylesBase, selector);
  if (!rule) throw new Error(`Expected metadata foundation consumer ${selector}.`);
  includes(rule, `font-size: ${sizeToken};`, `${selector} must consume the shared metadata size.`);
  includes(rule, `font-weight: ${weightToken};`, `${selector} must consume the shared metadata weight.`);
  if (lineToken) includes(rule, `line-height: ${lineToken};`, `${selector} must consume the shared metadata line height.`);
}

const checkboxFocus = exactRule(stylesBase, 'input[type="checkbox"]:focus-visible');
includes(checkboxFocus, "border-color: var(--mfl-focus-ring-color);", "Checkbox keyboard focus must consume the shared ring color.");
includes(checkboxFocus, "var(--mfl-focus-ring-offset)", "Checkbox keyboard focus must consume the shared ring offset.");
includes(checkboxFocus, "var(--mfl-focus-ring-width)", "Checkbox keyboard focus must consume the shared ring width.");
excludes(checkboxFocus, "0 0 0 4px var(--primary)", "Checkbox focus must not retain the old literal outer ring.");

includes(stylesBase, ".settingsEmailAddressInput:focus:not(:focus-visible) {\n  outline: none;", "Mouse focus on the Settings email field may remain visually quiet.");
includes(stylesBase, ".settingsEmailAddressInput:focus-visible {\n  outline: var(--mfl-focus-ring-width) solid var(--mfl-focus-ring-color);\n  outline-offset: var(--mfl-focus-ring-offset);", "Settings email keyboard focus must consume the shared ring contract.");
includes(stylesBase, ".siteDatePickerButton:focus-visible {\n  outline: var(--mfl-focus-ring-width) solid var(--mfl-focus-ring-color);\n  outline-offset: 1px;", "Compact date-picker focus must consume shared ring width/color while preserving its compact offset.");
includes(footer, "outline: var(--mfl-focus-ring-width) solid var(--mfl-focus-ring-color);", "Footer keyboard focus must consume the shared focus ring.");
includes(footer, "outline-offset: var(--mfl-focus-ring-offset);", "Footer keyboard focus must consume the shared focus offset.");

includes(controls, "--mfl-filter-remove-danger: var(--danger);", "Filter removal must derive from the theme-aware global danger token.");
excludes(controls, "#ff2020", "Filter controls must not retain the old one-off destructive red.");
includes(controls, "border-radius: var(--mfl-radius-control);", "Filter removal must consume the shared control radius.");

for (const token of [
  ".addWatchlistError {\n  min-height: 18px;\n  margin: 6px 0 0;\n  color: var(--mfl-helper-error-color);\n  font-size: var(--mfl-helper-text-font-size);\n  font-weight: var(--mfl-helper-error-font-weight);\n  line-height: var(--mfl-helper-text-line-height);",
  "#addWatchlistNameInput[aria-invalid=\"true\"] {\n  border-color: var(--danger);",
  ".evaluationLoadDeleteButton {\n  border-color: var(--border);\n  background: var(--surface-muted);\n  color: var(--danger);",
  ".evaluationFooterDeleteButton {\n  align-self: center;\n  gap: 8px;\n  border-color: var(--border);\n  background: var(--surface-muted);\n  color: var(--danger);",
  ".deleteWatchlistConfirmButton {\n  border-color: var(--border);\n  background: var(--surface-muted);\n  color: var(--danger);",
  ".settingsEmailAddressInput.invalid {\n  border-color: var(--danger);",
  ".settingsEmailDiscardButton {\n  border-color: var(--border);\n  background: var(--surface-muted);\n  color: var(--danger);",
]) {
  includes(stylesBase, token, `Shared destructive/error UI must derive from --danger: ${token}`);
}

for (const token of [
  "#linkWalletButton.walletOptOut {\n  background: transparent;\n  color: var(--danger);",
  ".watchlistDropdownDelete {\n  border-color: var(--border);\n  background: var(--surface-muted);\n  color: var(--danger);",
  ".watchlistDropdownDelete:hover:not(:disabled),\n.watchlistDropdownDelete:focus-visible:not(:disabled) {\n  border-color: var(--danger);\n  background: var(--danger);\n  color: var(--surface);",
]) {
  includes(dropdowns, token, `Dropdown destructive UI must derive from --danger: ${token}`);
}

includes(stylesBase, ".mflDialog {\n  display: flex;\n  flex-direction: column;\n  border: var(--mfl-dialog-border);\n  border-radius: var(--mfl-radius-dialog);\n  background: var(--mfl-dialog-background);\n  box-shadow: var(--mfl-shadow-modal);", "Ordinary dialogs must consume the shared dialog shell foundations.");
excludes(footer, "border-radius: var(--mfl-radius-dialog);", "Bug Report must inherit dialog radius from the shared dialog shell rather than duplicate it.");
excludes(footer, "box-shadow: var(--mfl-shadow-modal);", "Bug Report must inherit modal shadow from the shared dialog shell rather than duplicate it.");
includes(footer, "border-radius: var(--mfl-radius-control);", "Bug Report fields must consume the shared control radius where the semantic role matches.");
includes(footer, ".bugReportStatus {\n  min-height: 16px;\n  margin: 0;\n  color: var(--mfl-helper-text-color);\n  font-size: var(--mfl-helper-text-font-size);\n  font-weight: var(--mfl-helper-text-font-weight);\n  line-height: var(--mfl-helper-text-line-height);", "Bug Report ordinary status feedback must consume the shared helper-text foundation.");
includes(footer, ".bugReportStatus.isError {\n  color: var(--mfl-helper-error-color);\n  font-weight: var(--mfl-helper-error-font-weight);", "Bug Report error feedback must consume the shared helper error foundation.");
excludes(footer, ".bugReportDialog {\n  display: flex;\n  flex-direction: column;\n  width: min(620px, calc(100vw - 24px));\n  max-height: min(760px, calc(100dvh - 24px));\n  min-width: 0;\n  border: 1px solid var(--border);\n  border-radius: 10px;", "Bug Report must not reintroduce its former 10px dialog radius.");

for (const [name, source] of [
  ["styles-base.css", stylesBase],
  ["controls.css", controls],
  ["dropdowns.css", dropdowns],
  ["footer.css", footer],
]) {
  for (const forbidden of ["#e06b6b", "#ff8a8a", "#c92a2a", "#fff7f7", "#d84b4b", "#ff6b6b", "#e95656"]) {
    excludes(source, forbidden, `${name} must not retain legacy destructive/error literal ${forbidden}.`);
  }
}

for (const token of [
  "# MFL Front Office UI foundations",
  "## Ownership map",
  "`--danger` is the only global destructive/error-color source.",
  "Shared page/table title size: `20px` (`--mfl-page-title-font-size`)",
  "Desktop page gutter: `28px` (`--mfl-page-gutter-inline`)",
  "Shared section title: `16px` (`--mfl-section-title-font-size`)",
  "Standard metadata/small-label size: `12px` (`--mfl-metadata-font-size`)",
  "Ordinary helper/status text size: `12px` (`--mfl-helper-text-font-size`)",
  "Ordinary control resting border: `var(--border-strong)` (`--mfl-control-border-color`)",
  "Ordinary control hover background: `var(--row-hover)` (`--mfl-control-hover-background`)",
  "Canonical ordinary content-panel radius: `8px` (`--mfl-radius-panel`)",
  "Ring width: `2px` through `--mfl-focus-ring-width`",
  "Repeated desktop page-section rhythm: `6px` (`--mfl-page-section-gap`)",
  "Canonical dialog radius: `8px`",
  "Uniform Width remains the only numeric player-table column-width contract.",
  "Semantic destructive/error UI uses `--danger` end to end.",
  "Equivalent ordinary content surfaces consume `--mfl-radius-panel`",
  "data visualization/game-state colors",
  "Do not globalize a value merely because two numbers or colors match.",
]) {
  includes(docs, token, `UI foundations documentation is missing: ${token}`);
}

for (const source of [foundations, stacking, stylesBase, styles, controls, dropdowns, footer, parity, phoneTables, phoneStatic, compact]) {
  excludes(source, "!important", "Global UI foundation work must not add !important overrides.");
}

console.log("Global UI foundations validation passed with semantic icon sizing, control typography/state, page layout/title/rhythm, ordinary content-surface, section-title, keyboard-focus, metadata, helper/status feedback, destructive/error, and dialog ownership contracts.");

// Shared inset must survive responsive rules and static-page wrappers.
const responsive = await read("./responsive.css");
includes(responsive, "padding: var(--mfl-page-inset-block-start) var(--mfl-page-gutter-inline) var(--mfl-page-inset-block-end);", "Mobile main must consume the canonical page insets.");
excludes(responsive, "padding: 4px 12px calc(var(--mobile-nav-height) + 18px);", "Mobile main must not bypass the shared page-start token.");
includes(stylesBase, "top: var(--pinned-topbar-height);", "Pinned navigation must use the header-height owner.");
for (const page of ["privacyPage", "changelogPage"]) {
  const baseRule = stylesBase.match(new RegExp("\\." + page + " \\{([^}]+)\\}"))?.[1] || "";
  includes(baseRule, "margin: 0 auto;", `${page} must not add a separate page-start margin.`);
  excludes(responsive, `.${page} {\n    margin-top:`, `${page} responsive rules must not reintroduce page-start margins.`);
}
