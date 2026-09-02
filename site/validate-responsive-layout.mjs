import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [indexHtml, responsive, stylesBase, controls, scrollbars, sharedTableUi, staticUi, appCore, bootstrap] = await Promise.all([
  read("./index.html"),
  read("./responsive.css"),
  read("./styles-base.css"),
  read("./controls.css"),
  read("./scrollbars.css"),
  read("./shared-table-ui-runtime.js"),
  read("./static-ui-runtime.js"),
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./bootstrap.js"),
]);

includes(indexHtml, 'name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"', "The document viewport must support phone widths and safe areas.");
includes(indexHtml, '<link rel="stylesheet" href="/responsive.css" data-mfl-responsive-layout="true">', "Responsive layout must keep one explicit stylesheet owner.");
includes(indexHtml, 'class="navEmoji navJerseyIcon"', "My Players must keep the canonical shirt SVG markup.");
includes(stylesBase, ".advancedSettingValue {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;", "Advanced Settings value boxes must vertically center their content while preserving right alignment.");
includes(stylesBase, ".advancedMflUsdResetButton {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;", "The MFL/USD Reset control must vertically center its content inside its box.");
includes(stylesBase, ".advancedMflUsdStepper button {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;", "MFL/USD stepper controls must center their glyphs inside their boxes.");
includes(stylesBase, ".advancedRewardRateResetButton {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;", "Late-career reward Reset controls must vertically center their content inside their boxes.");
includes(stylesBase, ".advancedRewardRateStepper button {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;", "Late-career reward stepper controls must center their glyphs inside their boxes.");
includes(stylesBase, ".advancedSettingChevron {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  align-self: center;\n  line-height: 1;", "Advanced Settings chevrons must be vertically centered in their header boxes.");
includes(stylesBase, ".advancedPlayerTable th,\n.advancedPlayerTable td {\n  height: 32px;\n  vertical-align: middle;", "Advanced Settings table cells must vertically center their contents.");
includes(indexHtml, 'id="settingsIconGlyph" viewBox="0 0 24 24"', "Settings must expose one canonical shared SVG symbol.");
includes(indexHtml, 'class="navEmoji navSettingsIcon settingsIcon"', "Settings navigation must use the shared Settings icon.");
includes(indexHtml, 'class="settingsIcon advancedSettingsIcon"', "Advanced Settings must use the same shared Settings icon.");
includes(indexHtml, 'M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5', "Settings must keep the redesigned symmetric gear geometry.");
includes(indexHtml, '<button id="showAddFilterButton" class="iconButton popupAddButton" type="button" aria-label="Add filter" hidden aria-hidden="true" tabindex="-1"></button>', "The legacy Add Filter plus control must be inert and hidden in canonical first-paint markup.");
includes(indexHtml, '<select id="addFilterSelect">\n              <option value="" disabled selected hidden>Add filter...</option>\n            </select>', "Canonical first-paint Filters markup must keep Add filter... as a hidden disabled placeholder rather than a selectable option.");
includes(appCore, 'placeholder.disabled = true;\n  placeholder.hidden = true;\n  placeholder.selected = true;', "Runtime Filters repopulation must keep Add filter... hidden, disabled, and selected only as the closed-state placeholder.");
includes(controls, "#sidebar .navEmoji {\n  flex: 0 0 18px;\n  width: 18px;\n  min-width: 18px;\n  max-width: 18px;\n  height: 18px;", "Desktop navigation icons must share one 18px geometry contract.");
includes(controls, "#sidebar .navJerseyIcon {\n  width: 18px;\n  height: 18px;\n  color: inherit;\n  fill: none;\n  stroke: currentColor;\n  stroke-width: 2;\n  stroke-linecap: round;\n  stroke-linejoin: round;", "My Players must render the Lucide shirt as an outline-only currentColor icon.");
includes(controls, "#filterSummary.filtersViewCount {\n  display: inline-grid;\n  flex: 0 0 18px;\n  place-items: center;\n  align-self: stretch;", "The Filters count must use its full button height and center the digit in the actual count box.");
includes(controls, "min-height: 0;\n  height: auto;", "The Filters count must stretch from the parent control instead of using a competing fixed vertical size.");
includes(controls, "--mfl-filter-control-height: 36px;", "Filters must share one 36px control-height contract across desktop and mobile.");
includes(controls, "--mfl-filter-box-font-size: 1em;", "Filters must expose one canonical box-text size shared by entered/selected text and hints.");
includes(controls, "--mfl-filter-box-line-height: 17px;", "Filters must expose one canonical text line-height that can be centered inside the 36px control.");
includes(controls, "--mfl-popup-close-glyph-size: calc(var(--mfl-popup-close-size) / 3);", "The Filters close glyph must remain exactly proportional to the close-button box at every viewport size.");
includes(controls, ".filtersDialog :is(\n  .addFilterRow select,\n  .filterRule select,\n  .filterRule input\n) {\n  box-sizing: border-box;\n  height: var(--mfl-filter-control-height);\n  min-height: var(--mfl-filter-control-height);\n  max-height: var(--mfl-filter-control-height);\n  padding-block: calc((var(--mfl-filter-control-height) - 2px - var(--mfl-filter-box-line-height)) / 2);\n  font-family: inherit;\n  font-size: var(--mfl-filter-box-font-size);\n  font-style: normal;\n  font-weight: inherit;\n  line-height: var(--mfl-filter-box-line-height);\n  letter-spacing: inherit;\n  vertical-align: middle;\n}", "Every actual Filters input/select box must use the canonical centered line-box geometry without clipping descenders.");
includes(controls, ".filtersDialog .filterRule input[data-filter-value]::placeholder {\n  font-family: inherit;\n  font-size: var(--mfl-filter-box-font-size);\n  font-style: normal;\n  font-weight: inherit;\n  line-height: var(--mfl-filter-box-line-height);\n  letter-spacing: inherit;\n}", "Text and Value filter placeholders must share the same centered line box as entered values.");
includes(controls, ".filtersDialog .filterRule input:is([type=\"search\"], [type=\"number\"])[data-filter-value] {\n  appearance: textfield;\n  -webkit-appearance: none;\n}", "Text and Value inputs must normalize browser appearance while component-owned typography remains authoritative.");
includes(controls, ".filtersDialog .filterRule input[type=\"date\"]::-webkit-datetime-edit,\n.filtersDialog .filterRule input[type=\"date\"]::-webkit-datetime-edit-fields-wrapper {\n  box-sizing: border-box;\n  height: 100%;\n  padding-block: 0;\n  font-family: inherit;\n  font-size: var(--mfl-filter-box-font-size);\n  font-style: normal;\n  font-weight: inherit;\n  line-height: var(--mfl-filter-box-line-height);\n  letter-spacing: inherit;\n}", "Date filter edit segments, including the localized empty-date hint, must share the centered canonical box typography.");
includes(controls, ".filtersDialog .filterRule input[type=\"date\"]::-webkit-datetime-edit {\n  display: flex;\n  align-items: center;\n}", "Date filter text must be vertically centered inside the 36px box.");
includes(controls, ".filtersDialog .filtersHeader .popupCloseButton {\n  flex: 0 0 var(--mfl-popup-close-size);\n  width: var(--mfl-popup-close-size);", "The Filters header close control must keep the canonical touch target while its glyph scales responsively.");
includes(controls, ".filtersDialog select option {\n  font-size: inherit;\n}", "Filters select options must keep the same size as normal box text.");
includes(controls, "--mfl-filter-remove-danger: #ff2020;", "Filter-rule removal must use canonical #ff2020 danger red.");
includes(controls, "width: var(--mfl-filter-remove-size, 28px);\n  inline-size: var(--mfl-filter-remove-size, 28px);\n  min-width: var(--mfl-filter-remove-size, 28px);", "The rendered filter remove button must use the same responsive size variable as the spacing geometry instead of retaining the desktop 28px box.");
includes(controls, "width: min(12px, calc(var(--mfl-filter-remove-size, 28px) - 2px));", "The remove glyph must remain centered inside the actual responsive remove-button box.");
includes(controls, ".iconButton[hidden] {\n  display: none;\n}", "Hidden icon controls must not retain a rendered box.");
includes(controls, ".filtersDialog .addFilterRow {\n  width: 100%;\n  padding-bottom: 0;\n  border-bottom: 0;\n}", "Add filter must not show a divider when no rules exist.");
includes(controls, ".filtersDialog .filterBuilder:has(> .filterRules > .filterRule) > .addFilterRow {\n  padding-bottom: 8px;\n  border-bottom: 1px solid var(--border);\n}", "Add filter must show the canonical divider only when filter rules exist.");
excludes(controls, "transform: translateY(1px);", "The Filters count must not use a manual vertical nudge on desktop.");
includes(responsive, "/* Canonical responsive layout owner.", "Responsive behavior must remain centralized in responsive.css.");
includes(responsive, "@media (max-width: 900px)", "Tablet and mobile layout must share the canonical 900px breakpoint.");
includes(responsive, "--mobile-nav-height: 58px;", "Mobile navigation must reserve its compact bottom-rail height.");
includes(responsive, "inset: auto auto 8px 50%;", "Mobile navigation must be anchored to the bottom of the application shell.");
includes(responsive, "padding: 4px;\n    overflow: visible;\n    border: 1px solid color-mix", "Mobile navigation must allow long labels to spill beyond the rail instead of clipping them.");
includes(responsive, "border-radius: 999px;", "Mobile navigation must keep the rounded floating-rail geometry.");
includes(responsive, ".menuRail .navButton {\n    display: flex;\n    flex: 1 1 0;\n    flex-direction: column;", "Mobile navigation items must use the existing links as equal icon-over-label cells.");
includes(responsive, "padding: 4px 2px;\n    overflow: visible;\n    border-color: transparent;", "Mobile navigation cells must not clip labels that exceed an equal-width cell.");
includes(responsive, ".menuRail .navButton .navEmoji {\n    flex: 0 0 18px;\n    width: 18px;\n    height: 18px;\n    color: inherit;\n    font-size: 18px;\n    line-height: 18px;", "Mobile navigation icons must keep the same 18px geometry as desktop.");
includes(responsive, ".menuRail .navButton .navText {\n    display: block;\n    width: max-content;\n    min-height: 9px;\n    max-width: none;\n    margin-left: 0;\n    overflow: visible;", "Mobile navigation labels must render fully without ellipsis or clipping.");
includes(responsive, "text-overflow: clip;\n    white-space: nowrap;", "Mobile navigation labels must spill as one complete line.");
includes(responsive, ".menuRail .navButton.active,\n  .menuRail .navButton.active:hover {\n    border-color: transparent;\n    background: transparent;\n    color: #4aa3df;\n    box-shadow: none;\n  }", "The selected mobile section must be indicated only by #4aa3df icon/text color, without an active box.");
includes(responsive, '[data-initial-page="settings"] #sidebar .navButton[data-page="settings"] {\n    border-color: transparent;\n    background: transparent;\n    color: #4aa3df;\n    box-shadow: none;\n  }', "Mobile first paint must use the same color-only selected navigation state.");
includes(responsive, "#accountButton > span {", "The mobile account label must remain accessible while visually hidden.");
includes(responsive, "#accountButton .accountButtonIcon {\n    width: 20px;\n    height: 20px;\n  }", "The mobile account button must center the existing account SVG as its only visible content.");
includes(responsive, "#accountDropdown {\n    left: auto;\n    right: 0;\n    width: min(190px, calc(100vw - 24px));\n    transform-origin: top right;\n  }", "The mobile account dropdown must align its right border to the account button throughout its open/close animation.");
includes(responsive, "body > #appShell > main {\n    padding: 4px 12px calc(var(--mobile-nav-height) + 18px);", "Mobile page content must use compact top padding.");
includes(responsive, ".tablePageTitle,\n  .evaluationTitleRow {\n    margin-top: 2px;\n  }", "Mobile page titles must not recreate the removed top padding as margin.");
includes(responsive, ".topbar .searchButton {\n    grid-area: search;\n    width: 100%;\n    min-width: 0;\n    height: 40px;", "The tablet/mobile global search bar must be slightly shorter than the previous touch-sized version.");
includes(responsive, "height: 44px;", "Primary mobile touch controls must retain a 44px touch target where they are not intentionally compact table chrome.");
includes(responsive, "overflow-x: auto;", "Wide tables and genuinely overflowing horizontal controls must remain pan-scrollable.");
includes(responsive, "env(safe-area-inset-bottom)", "Mobile layout must account for device safe areas.");
includes(responsive, "input:where(:not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"range\"]):not([type=\"button\"]):not([type=\"submit\"])),\n  select,\n  textarea {\n    font-size: 16px;\n  }", "Mobile form controls must retain the 16px zoom-prevention fallback at element-level specificity so component-owned Filters typography can override it.");
excludes(responsive, "input:not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"range\"]):not([type=\"button\"]):not([type=\"submit\"]),\n  select,\n  textarea", "The mobile zoom-prevention rule must not use attribute-chain specificity that overrides Filters input typography.");
excludes(responsive, "--mfl-popup-close-glyph-size:", "Responsive breakpoints must scale only the close box; the glyph must inherit the canonical one-third ratio instead of growing independently on mobile.");
includes(responsive, "#progressionPage .playerTableScroller table {\n    width: 100%;\n    min-width: 760px;\n    max-width: none;\n  }", "Dense player tables must keep a readable tablet floor while preserving their canonical column proportions.");
includes(responsive, "#progressionPage .playerTableScroller :is(th, td) {\n    padding-inline: 1px;\n  }", "Player-table cell padding must use the tighter tablet compact contract.");
includes(responsive, "#progressionPage .playerTableScroller th {\n    font-size: 10px;\n  }", "Player-table headers must compact responsively on tablets.");
includes(responsive, "#progressionPage .playerTableScroller td {\n    font-size: 12px;\n  }", "Player-table body text must compact responsively on tablets.");
includes(responsive, ".evaluationSummaryTable th,\n  .evaluationTableShell .evaluationTable th {\n    font-size: 10px;\n  }", "Evaluation table headers must follow the same 10px tablet typography step as the other player tables.");
includes(responsive, ".evaluationSummaryTable td,\n  .evaluationTableShell .evaluationTable td {\n    font-size: 12px;\n  }", "Evaluation table body text must follow the same 12px tablet typography step as the other player tables while row height is owned by the responsive row-height contract.");
includes(responsive, ".advancedPlayerTable {\n    min-width: 620px;\n    font-size: 11px;\n  }", "Advanced player data must use the compact tablet width floor while remaining horizontally pannable.");
includes(responsive, ".evaluationSummaryShell .tableScroller,\n  .evaluationTableShell .tableScroller {\n    overflow-x: auto;\n  }", "Dense Evaluation tables must own explicit mobile horizontal scrolling.");
includes(responsive, "#evaluationPage .evaluationTitleRow,\n  #evaluationPage .evaluationTopBar,\n  #evaluationPage .evaluationSearchGroup,\n  #evaluationPage .evaluationActions {\n    display: contents;\n  }", "Small-phone Evaluation chrome must share one responsive grid so Advanced Settings and both metrics can occupy one row without duplicate markup.");
includes(responsive, "grid-template-columns: repeat(3, minmax(0, 1fr));", "Small-phone Evaluation must use exactly three equal top-row tracks so Advanced Settings, MFL/USD, and Discount Rate stay on one line.");
includes(responsive, "#evaluationPage .advancedSettingsButton {\n    grid-column: 1;\n    grid-row: 2;\n    width: 100%;\n    min-width: 0;\n    height: 42px;\n    min-height: 42px;", "Advanced Settings must occupy the first control column and use the same 42px mobile height as the Evaluation metrics.");
includes(responsive, "#evaluationPage .evaluationMetrics {\n    grid-column: 2 / -1;\n    grid-row: 2;", "MFL/USD and Discount Rate must occupy the second and third control columns on the same row as Advanced Settings.");
includes(responsive, "#evaluationPage .evaluationButtons {\n    display: grid;\n    grid-column: 1 / -1;\n    grid-row: 4;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    align-items: stretch;\n    gap: 6px;\n    width: 100%;\n    justify-self: stretch;", "Reset and Player Page must share the full row immediately below the Evaluation search.");
includes(responsive, "#evaluationPage .evaluationButtons .evaluationPlayerPageButton {\n    width: 100%;\n  }", "Reset and Player Page must fill the same equal-width mobile tracks as Share and Save.");
includes(responsive, "#evaluationPage .evaluationSearchGroup:has(#evaluationLoadButton:not([hidden])) .evaluationSearch {\n    grid-column: 1 / -1;\n    grid-row: 3;\n    width: calc(100% - 82px);\n  }", "The empty Evaluation state must keep the search field beside the compact Load control in the shared three-column mobile grid.");
includes(responsive, "#evaluationPage .evaluationButtons:has(#evaluationLoadButton:not([hidden])) {\n    grid-column: 1 / -1;\n    grid-row: 3;\n    grid-template-columns: 1fr;\n    width: 76px;", "Load must remain beside the search input after the header controls join one line.");
includes(responsive, "#evaluationPage #evaluationLoadButton {\n    height: 40px;\n    min-height: 40px;\n  }", "Load must match the compact mobile search-input height.");
includes(responsive, "#evaluationPage .evaluationMetrics {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 6px;\n  }", "Small-phone Evaluation metrics must preserve two equal compact boxes on the shared header row.");
includes(responsive, "#evaluationPage .evaluationMetric {\n    grid-template-rows: 15px 1fr;\n    gap: 1px;\n    width: 100%;\n    min-width: 0;\n    height: 42px;\n    min-height: 42px;", "MFL/USD and Discount Rate must match the 42px Advanced Settings height.");
includes(responsive, "#evaluationPage .evaluationMetric span {\n    font-size: 9px;", "Evaluation metric labels must use the reduced small-screen text size.");
includes(responsive, "#evaluationPage .evaluationMetric strong {\n    font-size: 15px;", "Evaluation metric values must use the reduced small-screen text size.");
includes(responsive, "#evaluationPage .evaluationMflUsdInput {\n    height: 20px;\n    min-height: 20px;\n    padding: 0 2px;\n    font-size: 12px;", "The inline MFL/USD editor must stay compact inside the shared-height metric box.");
includes(responsive, "#evaluationPage .evaluationSummaryShell .tableScroller {\n    overflow-x: hidden;\n    touch-action: pan-y;\n  }", "The Evaluation summary must remain fitted and non-scrollable on small phones.");
includes(responsive, "#evaluationPage .evaluationTableShell .tableScroller {\n    display: block;\n    width: 100%;\n    max-width: 100%;\n    overflow-x: auto;\n    overflow-y: hidden;", "The season-by-season Evaluation table must be horizontally scrollable on small phones.");
includes(responsive, "#evaluationPage .evaluationTableShell .evaluationTable {\n    width: 100%;\n    min-width: 500px;\n    max-width: none;\n    table-layout: fixed;", "The season-by-season Evaluation table must use the compact readable scrollable width floor on small phones.");
includes(responsive, "html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-page=\"evaluation\"][data-initial-evaluation-selection=\"true\"] #evaluationPage .evaluationTableShell::after {\n    opacity: 0.94;\n    visibility: visible;\n    transition: none;", "Selected Evaluation first paint must expose the right body fade immediately on small phones.");
includes(sharedTableUi, 'document.querySelector("#evaluationPage .evaluationTableShell .tableScroller")', "Evaluation season scrolling must reuse shared table fade-state ownership.");
includes(sharedTableUi, 'scroller.closest("#progressionPage .tableShell, #evaluationPage .evaluationTableShell")', "Evaluation and player tables must share the same directional fade shell logic.");
includes(bootstrap, "function primeFirstPaintEvaluationTableFade()", "Bootstrap must prime the selected Evaluation right fade before hydration.");
includes(appCore, "window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();", "Evaluation rendering must synchronize the shared scroll fade before the populated table is painted.");
includes(responsive, "#evaluationPage .evaluationSummaryTable th,\n  #evaluationPage .evaluationTableShell .evaluationTable th {\n    height: var(--mfl-evaluation-header-row-height);\n    font-size: 9px;\n    line-height: 1.05;\n  }", "Evaluation table headers must follow the same 9px small-phone typography step while using the responsive header-height contract.");
includes(responsive, "#evaluationPage .evaluationSummaryTable td {\n    height: var(--mfl-evaluation-summary-row-height);\n    font-size: 11px;\n  }", "Evaluation Summary body text must keep the 11px small-phone typography while preserving desktop-relative row height.");
includes(responsive, "#evaluationPage .evaluationTableShell .evaluationTable td {\n    height: var(--mfl-evaluation-season-row-height);\n    font-size: 11px;\n  }", "Evaluation Season body text must keep the 11px small-phone typography while preserving desktop-relative row height.");
includes(responsive, "#evaluationPage .evaluationSummaryTable th,\n  #evaluationPage .evaluationTableShell .evaluationTable th {\n    height: var(--mfl-evaluation-header-row-height);\n    font-size: 8px;\n  }", "Evaluation table headers must follow the same 8px very-small-phone typography step while using the responsive header-height contract.");
includes(responsive, "#evaluationPage .evaluationSummaryTable td {\n    height: var(--mfl-evaluation-summary-row-height);\n    font-size: 10px;\n  }", "Evaluation Summary body text must keep the 10px very-small-phone typography while preserving desktop-relative row height.");
includes(responsive, "#evaluationPage .evaluationTableShell .evaluationTable td {\n    height: var(--mfl-evaluation-season-row-height);\n    font-size: 10px;\n  }", "Evaluation Season body text must keep the 10px very-small-phone typography while preserving desktop-relative row height.");
excludes(responsive, "font-size: clamp(6.5px, 2vw, 9px);", "Evaluation summary typography must not retain an independent fluid scale.");
excludes(responsive, "font-size: clamp(6.25px, 1.9vw, 9px);", "Evaluation season-table typography must not retain an independent fluid scale.");
excludes(responsive, "font-size: clamp(6.25px, 2.1vw, 8.5px);", "Very-small Evaluation summary typography must use the shared discrete table breakpoint instead of a separate clamp.");
excludes(responsive, "font-size: clamp(6px, 2vw, 8.5px);", "Very-small Evaluation season typography must use the shared discrete table breakpoint instead of a separate clamp.");
includes(
  responsive,
  "#evaluationPage .evaluationOverallControl {\n    grid-template-columns: 16px 18px 16px;\n    gap: 0;\n    width: 100%;\n    height: 16px;\n    justify-content: start;\n  }",
  "The editable Overall control must keep compact square +/- buttons tightly grouped around its value on small phones.",
);
includes(responsive, "#evaluationPage .evaluationOverallControl strong {\n    min-width: 18px;\n  }", "The mobile Overall value track must stay compact between the +/- buttons.");
includes(responsive, "#evaluationPage .evaluationSummaryPositionSelect {\n    --mfl-evaluation-position-trigger-width: 38px;\n    --mfl-evaluation-position-chevron-left: min(29px, calc(100% - 8px));\n    width: min(var(--mfl-evaluation-position-trigger-width), 100%);\n    max-width: 100%;\n    min-height: 28px;\n    padding: 0 10px 0 0;", "The Evaluation position selector must anchor its small-phone chevron to one x-coordinate independent of whether the position has two or three letters, while still fitting the summary column.");
excludes(responsive, "#evaluationPage .evaluationSummaryTable td:nth-child(2):has(.evaluationSummaryPositionSelect)::after", "Responsive Evaluation must not recreate a custom Position chevron.");
includes(responsive, "#evaluationPage .evaluationOptionFilters {\n    align-items: center;\n    flex-direction: row;\n    flex-wrap: nowrap;", "Ignore discount rate and Ignore first season must remain on one small-phone row.");
includes(responsive, "#evaluationPage .evaluationOverallControl button,\n  #evaluationPage .evaluationOverallControlSpacer {\n    width: 16px;\n    min-width: 16px;\n    height: 16px;\n    min-height: 16px;\n  }", "Evaluation +/- controls must remain reduced square buttons on small phones.");
includes(responsive, "#evaluationPage .evaluationFooterActions {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));", "Evaluation Share and Save must share one equal-width mobile row.");
includes(responsive, "#evaluationPage .evaluationFooterSavedActions {\n    display: contents;\n  }", "Evaluation saved actions must participate directly in the shared mobile footer grid.");
includes(responsive, "#evaluationPage #evaluationShareButton {\n    grid-column: 1;\n    grid-row: 1;\n    width: 100%;\n  }", "Share must occupy the first equal-width mobile footer column.");
includes(responsive, "#evaluationPage #evaluationSaveButton {\n    grid-column: 2;\n    grid-row: 1;\n    width: 100%;\n  }", "Save must occupy the second equal-width mobile footer column.");
excludes(responsive, ".evaluationSummaryTable {\n    min-width: 460px;", "Small phones must not restore the former 460px Evaluation summary width floor.");
includes(responsive, "#evaluationPage .evaluationTableShell .evaluationTable {\n    min-width: 460px;\n  }", "Very small phones must use the compact scrollable 460px season-table width floor.");
excludes(responsive, ".evaluationSummaryTable {\n    min-width: 430px;", "Very small phones must not restore the former 430px Evaluation summary width floor.");
excludes(responsive, ".evaluationTableShell .evaluationTable {\n    min-width: 480px;", "Very small phones must not restore the former 480px season table width floor.");

includes(bootstrap, 'const FIRST_PAINT_HORIZONTAL_MEDIA = window.matchMedia("(max-width: 900px)");', "First-paint horizontal cues must use the canonical mobile breakpoint.");
includes(bootstrap, 'const FIRST_PAINT_OVERFLOW_CLASS = "mflViewsOverflowing";', "First paint and runtime must share one overflow-state class.");
includes(bootstrap, "function firstPaintHorizontalItems(scroller) {", "First paint must enumerate only controls that can actually need horizontal scrolling.");
includes(bootstrap, '":scope > #openFiltersButton, :scope > .viewControlsSeparator, :scope > .viewButton"', "The first-paint view-strip measurement must include Filters, its separator, and rendered view buttons.");
includes(bootstrap, '":scope > label";', "The first-paint quick-filter measurement must include only rendered quick-filter labels.");
includes(bootstrap, "function firstPaintHorizontalContentWidth(scroller) {", "First paint must measure the visible controls themselves instead of inferring need from route names.");
includes(bootstrap, "item.getBoundingClientRect().width + marginLeft + marginRight", "First-paint control measurement must include each rendered control's visual width and margins.");
includes(bootstrap, "const controlsOverflowing = firstPaintHorizontalContentWidth(scroller) - scroller.clientWidth > FIRST_PAINT_OVERFLOW_EPSILON;", "First-paint cues must require visible controls to exceed the strip width.");
includes(bootstrap, "&& nativeOverflowing\n        && controlsOverflowing;", "First-paint arrows and fading must appear only when the user cannot see every rendered control.");
includes(bootstrap, "function primeFirstPaintHorizontalOverflow() {", "Bootstrap must own synchronous first-paint overflow measurement.");
includes(bootstrap, 'document.querySelector("#progressionPage .views"),\n      document.querySelector("#progressionPage .quickFilters"),', "First-paint measurement must cover both horizontal table-control strips.");
includes(bootstrap, "scroller.scrollWidth - scroller.clientWidth > FIRST_PAINT_OVERFLOW_EPSILON", "First-paint cues must also respect the browser's real scroll extent.");
includes(bootstrap, "scroller.classList.toggle(FIRST_PAINT_OVERFLOW_CLASS, overflowing);", "Bootstrap must expose measured first-paint overflow to the canonical responsive owner.");
const visibilityPrimeIndex = bootstrap.indexOf('document.querySelectorAll("main > .pageView").forEach');
const overflowPrimeIndex = bootstrap.indexOf('if (target.id === "progressionPage") primeFirstPaintHorizontalOverflow();');
invariant(visibilityPrimeIndex >= 0 && overflowPrimeIndex > visibilityPrimeIndex, "First-paint overflow must be measured only after the target route is made visible, while still inside synchronous bootstrap.");

includes(responsive, ".viewsScrollerShell {\n    position: relative;\n    width: 100%;\n    max-width: 100%;\n    clip-path: inset(0);\n  }", "Stationary horizontal-control cues must be clipped to the non-scrolling shell so their fade paint cannot reach Watchlist selector spacing.");
includes(responsive, ".views {\n    --mfl-views-gap: 6px;\n    position: relative;\n    display: flex;\n    flex-wrap: nowrap;\n    gap: var(--mfl-views-gap);\n    width: 100%;\n    max-width: 100%;\n    overflow-x: hidden;\n    overflow-y: hidden;", "Section views must keep one measured gap and must not be horizontally scrollable unless their contents actually overflow.");
includes(responsive, ".views.mflViewsOverflowing {\n    overflow-x: auto;\n    overscroll-behavior-x: none;\n    -webkit-overflow-scrolling: touch;\n    touch-action: pan-x pan-y;\n  }", "Overflowing section views must hard-stop horizontal overscroll at their native content boundaries.");
includes(responsive, ".quickFilters {\n    position: relative;\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    flex-wrap: nowrap;\n    gap: 8px;\n    width: 100%;\n    max-width: 100%;\n    margin-bottom: 0;\n    padding: 0;\n    overflow-x: hidden;\n    overflow-y: hidden;", "Mobile Quick Filters must have zero padding and no desktop bottom margin so the count can sit exactly below the actual row.");
includes(responsive, ".quickFilters.mflViewsOverflowing {\n    overflow-x: auto;\n    overscroll-behavior-x: none;\n    -webkit-overflow-scrolling: touch;\n    touch-action: pan-x pan-y;\n  }", "Quick filters must reuse the same native horizontal scrolling contract as the view row.");
includes(responsive, "#progressionPage > .quickFilters {\n    height: 46px;\n    min-height: 46px;\n    margin-bottom: 0;\n    padding: 0;\n    align-items: flex-start;\n  }", "First paint must reserve the final compact 46px tablet Quick Filters and player-count footprint without using padding to position the row.");
includes(responsive, ".quickFiltersScrollerShell {\n    position: relative;\n    height: 46px;\n    min-height: 46px;\n    margin-bottom: 0;\n  }", "The hydrated tablet Quick Filters shell must preserve the exact same compact 46px footprint.");
includes(responsive, ".quickFiltersScrollerShell > .quickFilters {\n    height: 28px;\n    min-height: 28px;\n    margin-bottom: 0;\n    padding: 0;\n  }", "The tablet Quick Filters row must use its compact 28px zero-padding geometry inside the reserved footprint.");
includes(responsive, ".quickFilters label {\n    flex: 0 0 auto;\n    min-height: 28px;\n    gap: 5px;\n    padding: 0;", "Tablet Quick Filter labels must follow the compact row without reintroducing padding.");
includes(responsive, "#progressionPage .watchlistPlayerCount:not([hidden]) {\n    display: flex;\n    align-items: center;\n    width: 100%;\n    height: 14px;\n    min-height: 14px;\n    margin: 0;", "The tablet player count must use a compact fixed flow-owned box within the reserved Quick Filters footprint.");
includes(responsive, "#progressionPage .quickFiltersScrollerShell + .watchlistPlayerCount:not([hidden]) {\n    position: static;\n    margin-top: -16px;\n    margin-bottom: 2px;\n  }", "The hydrated tablet player count must consume the shell's compact reserved lower space without CSS Anchor Positioning.");
includes(responsive, "#progressionPage > .quickFilters > .watchlistPlayerCount:not([hidden]) {\n    position: absolute;\n    top: 30px;\n    left: 0;\n  }", "First paint must place a visible tablet player count in the same compact reserved lower space before the runtime shell exists.");
excludes(responsive, "position-anchor:", "Mobile player-count layout must not depend on CSS Anchor Positioning support.");
excludes(responsive, "anchor-name:", "Quick Filters must not expose an unused CSS anchor after switching the count to ordinary flow.");
excludes(responsive, "anchor-size(", "Mobile player-count width must come from normal layout rather than anchor-size().");
includes(responsive, ".quickFiltersScrollerShell:has(> .quickFilters.mflViewsOverflowing) > .viewsScrollButton {\n    top: 14px;\n  }", "Tablet Quick Filters arrows must stay centered on the actual 28px row rather than the full reserved footprint.");
includes(responsive, ".quickFilters input[type=\"checkbox\"] {\n    flex: 0 0 16px;\n    width: 16px;\n    min-width: 16px;\n    height: 16px;\n    border-radius: 4px;", "Quick-filter checkboxes must keep the same square 16px geometry as the canonical checkboxes.");
excludes(responsive, "::-webkit-scrollbar", "Responsive layout must leave scrollbar visuals to scrollbars.css.");
excludes(responsive, "scrollbar-width:", "Responsive layout must leave standards scrollbar visuals to scrollbars.css.");
includes(scrollbars, "/* Mobile control strips and the compact Filters body keep native scrolling without visible scrollbar chrome. */", "The canonical scrollbar owner must document hidden scrollbar chrome for mobile Filters.");
includes(scrollbars, ".views,\n    .quickFilters,\n    .filtersDialog .filterBuilder {\n      scrollbar-width: none;", "Mobile views, Quick Filters, and Filters body must hide standards scrollbar chrome.");
includes(scrollbars, ".views,\n  .quickFilters,\n  .filtersDialog .filterBuilder {\n    -ms-overflow-style: none;", "Mobile views, Quick Filters, and Filters body must hide legacy scrollbar chrome.");
includes(scrollbars, ".views::-webkit-scrollbar,\n  .quickFilters::-webkit-scrollbar,\n  .filtersDialog .filterBuilder::-webkit-scrollbar {\n    display: none;", "The Filters popup must not show a WebKit scrollbar on mobile.");
excludes(responsive, 'content: "\\2192";', "First paint must not use a text arrow that differs from the final SVG cue.");
includes(responsive, "#progressionPage .views::before,\n  #progressionPage .views::after,\n  #progressionPage .quickFilters::before,\n  #progressionPage .quickFilters::after {\n    content: \"\";\n    position: absolute;\n    top: 50%;\n    opacity: 0;\n    visibility: hidden;\n    pointer-events: none;", "Both first-paint strips must use dedicated non-interactive fade and SVG-shape layers.");
includes(responsive, "#progressionPage .views::before {\n    right: -2px;\n    z-index: 3;\n    width: 86px;\n    height: 48px;\n    background: linear-gradient(", "The view first-paint fade must already use the final right-edge gradient geometry.");
includes(responsive, "#progressionPage .views::after {\n    right: 6px;\n    z-index: 4;\n    width: 18px;\n    height: 18px;\n    background: var(--text-soft);", "The view first-paint arrow must already use the final 18px cue geometry and color.");
includes(responsive, "#progressionPage .quickFilters::before {\n    right: -2px;\n    z-index: 3;\n    width: 60px;\n    height: 28px;", "Quick-filter first-paint fading must match the compact tablet row height.");
includes(responsive, "#progressionPage .quickFilters::after {\n    right: 5px;\n    z-index: 4;\n    width: 14px;\n    height: 14px;", "Quick-filter first-paint arrows must be centered at the smaller tablet row scale.");
includes(responsive, "#progressionPage > .views.mflViewsOverflowing::before,", "View first-paint chrome must depend on measured overflow.");
includes(responsive, "#progressionPage > .quickFilters.mflViewsOverflowing::before,", "Quick-filter first-paint chrome must depend on measured overflow.");
includes(responsive, "opacity: 0.92;\n    visibility: visible;", "Measured first-paint overflow must use the same final 0.92 cue strength before hydration.");
includes(responsive, "#progressionPage .views.mflViewsOverflowing {\n    box-shadow: inset -96px 0 96px -69px var(--page-bg);\n  }", "First-paint Views fading must include the exact 96px runtime inset shadow before hydration.");
includes(responsive, "#progressionPage .quickFilters.mflViewsOverflowing {\n    box-shadow: inset -72px 0 72px -52px var(--page-bg);\n  }", "First-paint Quick Filters fading must include the exact 72px runtime inset shadow before hydration.");
includes(responsive, "M5%2012h14", "The first-paint arrow mask must use the same horizontal shaft as the final SVG cue.");
includes(responsive, "m12%205%207%207-7%207", "The first-paint arrow mask must use the same chevron path as the final SVG cue.");
includes(responsive, "html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) .viewsScrollerShell .viewsScrollButton {\n    transition: none;\n  }", "Hydration must not replay the arrow/fade appearance transition while first-paint chrome is being handed off.");
includes(responsive, ".viewsScrollerShell:has(> .mflViewsOverflowing) > .viewsScrollButtonRight {\n    opacity: 0.92;\n    visibility: visible;\n    pointer-events: auto;", "The runtime right cue must inherit the final 0.92 first-paint visibility immediately when the overlay shell is created.");
includes(responsive, ".viewsScrollButton {\n    position: absolute;\n    top: 50%;\n    z-index: 4;", "Both lateral-scroll cues must stay outside scrolling content in the overlay shell.");
includes(responsive, "opacity: 0;\n    visibility: hidden;\n    pointer-events: none;", "Hidden lateral-scroll cues must remain transitionable without intercepting input.");
includes(responsive, "transform: translateY(-50%) scale(0.94);\n    transition:\n      opacity 180ms ease,\n      transform 180ms ease,\n      visibility 0s linear 180ms;", "Arrow appearance and disappearance must animate instead of popping after initial hydration.");
includes(responsive, ".viewsScrollButton.mflViewsScrollButtonVisible {\n    opacity: 0.92;\n    visibility: visible;\n    pointer-events: auto;\n    transform: translateY(-50%) scale(1);", "Visible arrows and their gradient layer must retain the same 0.92 strength after hydration.");
includes(responsive, ".viewsScrollButtonRight {\n    right: 0;\n  }", "The right cue must be flush to the true right edge.");
includes(responsive, ".viewsScrollButtonLeft {\n    left: 0;\n  }", "The left cue must be flush to the true left edge.");
includes(responsive, "top: -9px;\n    bottom: -9px;\n    width: 86px;", "View-row edge cues may retain their wider gradient internally because the shell clips all paint to the actual view-strip box.");
includes(responsive, ".viewsScrollButtonRight::before {\n    right: -2px;\n    background: linear-gradient(\n      90deg,", "The right edge must fade strongly toward the page background.");
includes(responsive, ".viewsScrollButtonLeft::before {\n    left: -2px;\n    background: linear-gradient(\n      270deg,", "The left edge must mirror the stronger fade.");
includes(responsive, "color-mix(in srgb, var(--page-bg) 88%, transparent) 70%,\n      var(--page-bg) 100%", "Edge fades must become substantially opaque before the cue.");
includes(responsive, ".quickFiltersScrollerShell .viewsScrollButton {\n    width: 24px;\n    min-width: 24px;\n    height: 24px;\n    min-height: 24px;\n    padding: 5px;", "Tablet quick-filter runtime arrows must scale down to the shorter row.");
includes(responsive, ".quickFiltersScrollerShell .viewsScrollButton::before {\n    top: -2px;\n    bottom: -2px;\n    width: 60px;", "Tablet quick-filter runtime fading must match the compact 28px row height.");
includes(responsive, ".quickFiltersScrollerShell .viewsScrollButton svg {\n    width: 14px;\n    height: 14px;", "Tablet quick-filter runtime arrows must use the same 14px geometry as first paint.");
includes(responsive, ".viewsScrollButton:hover,\n  .viewsScrollButton:focus-visible,\n  .viewsScrollButton:active {\n    background: transparent;\n    opacity: 1;\n  }", "Horizontal-scroll cues must remain background-free in every interactive state.");
includes(responsive, ".viewsScrollButton svg {\n    position: relative;\n    z-index: 1;\n    width: 18px;\n    height: 18px;", "The canonical view-row arrows must retain the requested 18px geometry above the fade layer.");
includes(responsive, ".viewsScrollButtonLeft svg {\n    transform: scaleX(-1);\n  }", "The left cue must mirror the same arrow asset instead of introducing a second icon owner.");
includes(responsive, ".viewButton {\n    flex: 0 0 100px;\n    width: 100px;\n    min-width: 100px;\n    max-width: 100px;", "All tablet/mobile section view buttons must share one fixed width.");
includes(responsive, "#openFiltersButton {\n    flex: 0 0 100px;\n    width: 100px;\n    min-width: 100px;\n    max-width: 100px;", "Filters must use the same fixed tablet/mobile footprint as the section view buttons.");

includes(sharedTableUi, 'const VIEW_SCROLL_BUTTON_CLASS = "viewsScrollButton";', "Shared table UI must own the conditional horizontal-scroll cue behavior.");
includes(sharedTableUi, 'const QUICK_FILTERS_SHELL_CLASS = "quickFiltersScrollerShell";', "Quick filters must reuse the shared shell lifecycle instead of introducing a second arrow implementation.");
includes(sharedTableUi, "function tableHorizontalScrollers() {", "The shared runtime must enumerate both mobile horizontal control strips.");
includes(sharedTableUi, "return [tableViews(), tableQuickFilters()].filter", "View buttons and quick filters must share the same scroller implementation.");
includes(sharedTableUi, 'if (views.matches("#progressionPage .quickFilters")) shell.classList.add(QUICK_FILTERS_SHELL_CLASS);', "The shared shell must expose a quick-filter role without creating a second arrow implementation.");
includes(sharedTableUi, 'if (count?.parentElement === views) shell.insertAdjacentElement("afterend", count);', "The player count must be moved outside the mobile quick-filter strip.");
includes(sharedTableUi, 'if (count instanceof HTMLElement && count.parentElement !== views) views.appendChild(count);', "Leaving mobile must restore the player count to its canonical quick-filter container.");
includes(sharedTableUi, 'return views.matches("#progressionPage .quickFilters") ? "quick filters" : "views";', "Shared arrows must expose contextual accessible labels for quick filters and views.");
includes(sharedTableUi, "function setViewScrollButtonVisible(button, visible) {", "Cue visibility must be changed without display:none or the hidden attribute.");
includes(sharedTableUi, "button.classList.toggle(VIEW_SCROLL_VISIBLE_CLASS, visible);", "Cue transition state must be controlled through the canonical visible class.");
excludes(sharedTableUi, "button.hidden =", "Cue visibility must not bypass transitions with the hidden attribute.");
includes(sharedTableUi, "function viewScrollButton(views) {", "Shared table UI must own the right cue.");
includes(sharedTableUi, "function viewScrollLeftButton(views) {", "Shared table UI must own the matching left cue.");
includes(sharedTableUi, 'button.setAttribute("aria-label", `Scroll ${scrollerLabel(views)} right`);', "The right arrow must use the shared contextual accessible label.");
includes(sharedTableUi, 'button.setAttribute("aria-label", `Scroll ${scrollerLabel(views)} left`);', "The left arrow must use the shared contextual accessible label.");
includes(sharedTableUi, "const target = Math.max(0, views.scrollLeft - distance);\n      views.scrollTo({ left: target, behavior: \"smooth\" });", "Left-arrow clicks must stop exactly at the native left boundary.");
includes(sharedTableUi, "shell.appendChild(button);", "Both arrows must remain outside each horizontal scroller so they cannot extend scrollWidth.");
excludes(sharedTableUi, "views.appendChild(button);", "Neither arrow may be appended to horizontal scrolling content itself.");
excludes(sharedTableUi, 'button.style.left =', "Pinned arrows must never be repositioned horizontally during scrolling.");
includes(sharedTableUi, "function renderedViewItems(views) {", "Horizontal overflow must be measured from rendered direct controls.");
includes(sharedTableUi, "function viewMaxScroll(views) {\n    return Math.max(0, views.scrollWidth - views.clientWidth);\n  }", "The browser's native scroll extent must define the canonical right boundary once overlay chrome is outside the scroller.");
includes(sharedTableUi, "const overflowing = viewContentWidth(views) - views.clientWidth > VIEW_SCROLL_EPSILON;", "Horizontal scrolling must remain enabled only when visible contents exceed the strip width.");
includes(sharedTableUi, "const scrollLeft = clampViewScroll(views, maxScroll);", "Horizontal scrolling must retain a defensive clamp at the native scroll boundary.");
includes(sharedTableUi, "const target = Math.min(maxScroll, views.scrollLeft + distance);\n      views.scrollTo({ left: target, behavior: \"smooth\" });", "Right-arrow clicks must stop at the browser's exact right boundary rather than scrolling into empty space.");
includes(sharedTableUi, "const canScrollLeft = scrollLeft > VIEW_SCROLL_EPSILON;\n    const canScrollRight = maxScroll - scrollLeft > VIEW_SCROLL_EPSILON;", "Each edge cue must appear only when additional content exists in its direction.");
includes(sharedTableUi, "setViewScrollButtonVisible(leftButton, canScrollLeft);\n    setViewScrollButtonVisible(button, canScrollRight);", "Left and right cue transitions must track the actual scroll position independently.");
includes(sharedTableUi, 'target.matches("#progressionPage .views, #progressionPage .quickFilters")', "Resize observation must cover both shared horizontal strips.");
includes(sharedTableUi, "viewResizeObserver = new ResizeObserver", "Horizontal overflow must stay correct when responsive widths or visible controls change.");
excludes(sharedTableUi, "MutationObserver", "Horizontal scrolling and mobile page-size ownership must remain event/resize-driven rather than DOM-repair driven.");
includes(sharedTableUi, "(shell || views).insertAdjacentElement(\"afterend\", switcher);", "Mobile Watchlist must keep its selector outside both the clipped strip and its overlay shell.");
includes(sharedTableUi, "if (switcher.parentElement !== views) views.appendChild(switcher);", "Leaving mobile Watchlist must restore the selector to its canonical desktop container.");
includes(staticUi, "switcher instanceof HTMLElement && switcher.parentElement === container", "Static route view ordering must tolerate the Watchlist selector being temporarily outside the mobile strip.");

includes(responsive, ".searchDialog {\n    width: min(680px, calc(100vw - 24px));", "The mobile search popup must use a smaller bounded width instead of filling every tablet screen.");
includes(responsive, "height: min(435px, calc(100dvh - 24px));", "The tablet/mobile search popup must fit its compact five-result stack without excess vertical space.");
includes(responsive, ".globalSearchControl #playerSearchInput {\n    height: 38px;\n    min-height: 38px;", "The search-popup input must be shorter on tablet/mobile widths.");
includes(responsive, "padding-left: 10px;\n    padding-right: 38px;\n    font-size: 16px;", "The compact search input must retain 16px text to prevent mobile zoom-on-focus.");
includes(responsive, ".searchResults {\n    gap: 6px;\n    min-height: 0;\n    height: auto;\n    max-height: none;\n    grid-auto-rows: 56px;", "Search popup results must use compact bounded boxes on tablet/mobile widths.");
includes(responsive, ".searchResult {\n    align-content: center;\n    gap: 2px;\n    min-height: 56px;\n    padding: 7px 10px;\n    border-radius: 6px;", "Search result cards must vertically center their compact content on tablet/mobile widths.");
includes(responsive, "height: min(392px, calc(100dvh - 16px));", "Phone search popups must tighten around five 50px result boxes.");
includes(responsive, "height: min(382px, calc(100dvh - 12px));", "Very narrow phone search popups must tighten around five 48px result boxes.");
includes(responsive, ".filtersDialog {\n    width: min(640px, calc(100vw - 16px));\n    max-width: calc(100vw - 16px);\n    height: auto;", "The tablet Filters popup must narrow further so its rule boxes fit the viewport without lateral scrolling.");
includes(responsive, ".filtersDialog {\n    --mfl-filter-box-font-size: 13px;\n    --mfl-filter-box-line-height: 16px;\n    --mfl-popup-close-size: 30px;\n    width: min(640px, 100%);\n    max-width: 100%;\n    height: auto;\n    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));", "The Filters popup must remain bounded by the safe-area-adjusted usable viewport while scaling the complete close control proportionally from desktop.");
includes(responsive, ".filterBuilder {\n    flex: 0 1 auto;\n    gap: 6px;\n    min-width: 0;\n    min-height: 0;\n    padding: 8px 10px;\n    overflow-x: hidden;\n  }", "The Filters body must clamp horizontal overflow while retaining compact content-driven spacing.");
includes(responsive, ".addFilterRow,\n  .filterRules {\n    min-width: 0;\n    max-width: 100%;\n    gap: 6px;\n  }", "The add-filter row and rules container must never exceed the popup content width.");
includes(responsive, ".filtersDialog .addFilterRow > *,\n  .filtersDialog .filterRule,\n  .filtersDialog .filterRule > *,\n  .filtersDialog .filterRule :is(\n    input,\n    select,\n    button,\n    [data-filter-value],\n    [data-filter-value-group],\n    .mflNumericStepperControl,\n    .betweenValue,\n    .dateValue,\n    .dateRangeValue\n  ),", "Every direct and nested Filters control, including numeric/date/range wrappers, must be allowed to shrink within the popup.");
includes(responsive, "min-inline-size: 0;\n    max-inline-size: 100%;", "Nested Filters controls must explicitly override intrinsic inline minimums that can otherwise force lateral overflow.");
includes(responsive, ".filtersDialog .filterRule :is(\n    input,\n    select,\n    [data-filter-value],\n    [data-filter-value-group],\n    .mflNumericStepperControl,\n    .betweenValue,\n    .dateValue,\n    .dateRangeValue\n  ),", "All input-producing Filters control wrappers must consume only their assigned grid track.");
includes(responsive, ".filtersDialog .mflNumericStepperControl {\n    grid-template-columns: minmax(0, 1fr) 16px;\n    gap: 2px;\n  }", "Numeric filter inputs must reserve a compact fixed stepper while allowing the input itself to shrink.");
includes(responsive, ".filtersDialog .mflNumericStepperControl > input[type=\"number\"] {\n    width: 100%;\n    min-width: 0;\n    max-width: 100%;\n  }", "Numeric filter inputs must not retain an intrinsic width wider than the phone value track.");
excludes(responsive, ".filterRule > button,\n  .filterRule [data-filter-value] {\n    height: 36px;", "Responsive layout must not redefine generic filter-box height or accidentally resize the remove control; controls.css owns actual box height.");
includes(responsive, ".filterRule {\n    --mfl-filter-edge-gap: 8px;\n    --mfl-filter-builder-inline-padding: 10px;\n    --mfl-filter-remove-size: 18px;\n    --mfl-filter-remove-strip: calc((2 * var(--mfl-filter-edge-gap)) + var(--mfl-filter-remove-size) - var(--mfl-filter-builder-inline-padding));\n    position: relative;\n    box-sizing: border-box;\n    width: calc(100% - var(--mfl-filter-remove-strip));\n    max-width: calc(100% - var(--mfl-filter-remove-strip));\n    margin-left: 0;\n    margin-right: var(--mfl-filter-remove-strip);\n    overflow: visible;\n    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);\n    grid-template-rows: 36px 36px;\n    gap: 4px;\n    min-height: 76px;", "Tablet/mobile filter rules must derive the external remove strip from one symmetric 8px edge gap plus the remove-control size.");
includes(responsive, ".filterRule > :nth-child(4) {\n    grid-column: 2;\n    grid-row: 2;", "Visible-operator filter values must fill exactly the flexible value column.");
includes(responsive, ".filtersDialog .filterRule > :is(:nth-child(2), :nth-child(4)) {\n    width: 100%;\n    inline-size: 100%;\n    min-width: 0;\n    min-inline-size: 0;\n    max-width: 100%;\n    max-inline-size: 100%;\n  }", "Mobile filter-name and value/input boxes must fully consume their proportional popup-sized track without retaining intrinsic width.");
includes(responsive, ".filterRule > :nth-child(5) {\n    position: absolute;\n    top: 18px;\n    right: calc(var(--mfl-filter-edge-gap) - var(--mfl-filter-builder-inline-padding) - var(--mfl-filter-remove-strip));\n    width: var(--mfl-filter-remove-size);\n    min-width: var(--mfl-filter-remove-size);\n    max-width: var(--mfl-filter-remove-size);\n    height: var(--mfl-filter-remove-size);\n    min-height: var(--mfl-filter-remove-size);\n    transform: translateY(-50%);\n  }", "Tablet remove controls must keep the same 8px gap to the boxes and to the popup's right content edge.");
includes(responsive, ".filterRule > :nth-child(5) {\n    position: absolute;\n    top: 18px;\n    right: calc(var(--mfl-filter-edge-gap) - var(--mfl-filter-builder-inline-padding) - var(--mfl-filter-remove-strip));\n    width: var(--mfl-filter-remove-size);\n    min-width: var(--mfl-filter-remove-size);\n    max-width: var(--mfl-filter-remove-size);\n    height: var(--mfl-filter-remove-size);\n    min-height: var(--mfl-filter-remove-size);\n    transform: translateY(-50%);\n  }", "Phone remove controls must keep the same 8px gap to the boxes and to the popup's right content edge while remaining outside grid flow.");
includes(responsive, ".filterRule > :nth-child(3)[hidden] + :nth-child(4) {\n    grid-column: 1 / 3;\n  }", "Filter values must reclaim both content columns while the external remove control remains outside grid flow.");
includes(responsive, ".filterRule select[hidden] {\n    display: none;\n  }", "Hidden filter operators must leave their grid track reclaimable.");
includes(responsive, ".filtersDialog {\n    --mfl-filter-box-font-size: 12px;\n    --mfl-filter-box-line-height: 15px;\n    --mfl-popup-close-size: 28px;\n    width: min(100%, 420px);\n    height: auto;\n    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));\n  }", "Phone Filters must use a viewport-safe narrow dialog with centered box text and a proportionally scaled close control.");
includes(responsive, ".addFilterRow select {\n    flex: 0 1 200px;\n    width: min(200px, 100%);\n    min-width: 0;\n    max-width: 100%;\n  }", "Phone Add Filter must not reserve horizontal space for the removed plus control.");
includes(responsive, ".filterRule {\n    --mfl-filter-builder-inline-padding: 6px;\n    --mfl-filter-remove-size: 14px;\n    width: calc(100% - var(--mfl-filter-remove-strip));\n    max-width: calc(100% - var(--mfl-filter-remove-strip));\n    margin-left: 0;\n    margin-right: var(--mfl-filter-remove-strip);\n    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);\n    grid-template-rows: 36px 36px;\n    gap: 3px;\n    min-height: 75px;", "Phone filter rules must continuously resize their two content columns from the popup width while preserving the external remove strip.");
includes(responsive, ".filterRule:first-child > :nth-child(1) {\n    display: none;\n  }", "The first phone filter rule must not reserve width for its intentionally hidden connector.");
includes(responsive, ".filterRule:first-child > :nth-child(2) {\n    grid-column: 1 / 3;\n  }", "The first phone filter column selector must reclaim the hidden connector's width.");
includes(responsive, ".filtersFooter {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));", "Phone filter actions must stay side by side to conserve vertical space.");
includes(responsive, ".filtersFooter button {\n    height: 36px;\n    min-height: 36px;\n  }", "Phone Filters footer buttons must keep the same 36px height as desktop.");
includes(responsive, "#progressionPage > .quickFilters {\n    height: 42px;\n    min-height: 42px;\n    padding: 0;\n  }", "Phone first paint must reserve the compact final 42px Quick Filters and player-count footprint with zero padding.");
includes(responsive, "#progressionPage .quickFiltersScrollerShell {\n    height: 42px;\n    min-height: 42px;\n  }", "The hydrated phone Quick Filters shell must keep the same compact 42px footprint as first paint.");
includes(responsive, "#progressionPage .quickFiltersScrollerShell > .quickFilters {\n    height: 26px;\n    min-height: 26px;\n  }", "The phone Quick Filters row must use a 26px row inside the compact footprint.");
includes(responsive, "#progressionPage .quickFiltersScrollerShell:has(> .quickFilters.mflViewsOverflowing) > .viewsScrollButton {\n    top: 13px;\n  }", "Phone Quick Filters arrows must stay centered on the actual 26px row.");
includes(responsive, "#progressionPage .watchlistPlayerCount:not([hidden]) {\n    height: 14px;\n    min-height: 14px;\n    font-size: 10px;\n  }", "The phone player count must keep its compact 14px box inside the final footprint.");
includes(responsive, "#progressionPage .quickFiltersScrollerShell + .watchlistPlayerCount:not([hidden]) {\n    margin-top: -16px;\n  }", "The hydrated phone player count must occupy the compact shell's reserved lower space.");
includes(responsive, "#progressionPage > .quickFilters > .watchlistPlayerCount:not([hidden]) {\n    top: 28px;\n  }", "Phone first paint must place a visible player count at the same compact vertical start before hydration.");
includes(responsive, "#progressionPage > .controlsBar {\n    display: none;\n  }", "Mobile table pages must remove the Rows selector chrome entirely at the 900px breakpoint.");
excludes(responsive, ".field.compact.rowsField", "Responsive mobile CSS must not maintain a second visible Rows-selector geometry.");
excludes(responsive, "#pageSizeSelect", "Responsive mobile CSS must not size a selector that is unavailable on mobile.");
includes(appCore, "pageSize: 100,", "The canonical table state must keep 100 rows as its default page size.");
includes(sharedTableUi, 'const MOBILE_TABLE_MEDIA = window.matchMedia("(max-width: 900px)");', "The shared table UI must use the same 900px mobile breakpoint as responsive layout.");
includes(sharedTableUi, 'const MOBILE_PAGE_SIZE = "100";', "Mobile table pages must enforce 100 rows while the selector is unavailable.");
includes(sharedTableUi, 'if (typeof restoreSavedTableState !== "function") return false;', "Mobile page-size ownership must hook the canonical saved-table-state restore path.");
includes(sharedTableUi, 'state.pageSize = 100;\n            state.page = 1;', "A restored desktop page size must be normalized to 100 and page one while mobile.");
includes(sharedTableUi, 'Object.defineProperty(restoreWithMobilePageSize, "__mflMobilePageSize", { value: true });', "The mobile page-size restore bridge must be installed only once.");
includes(sharedTableUi, 'window.__mflMarkApplicationCoreLoaded = bridgedMarker;', "The pre-core table runtime must install its restore bridge synchronously when the application core becomes available.");
includes(sharedTableUi, 'select.value = MOBILE_PAGE_SIZE;\n    select.dispatchEvent(new Event("change", { bubbles: true }));', "Entering mobile after startup must reuse the canonical page-size change path.");
includes(sharedTableUi, 'MOBILE_TABLE_MEDIA.addEventListener("change", onMobileTableMediaChange);', "Entering the mobile breakpoint must immediately restore the fixed 100-row policy.");

includes(responsive, "@media (max-width: 520px)", "Phone layouts must have a dedicated compact breakpoint.");
excludes(responsive, "#progressionPage:not([hidden])", "Phone table chrome must not depend on hidden removal before receiving its first-paint layout.");
includes(responsive, "#progressionPage .views {\n    --mfl-views-gap: 4px;\n    margin-bottom: 5px;\n  }", "Phone views must keep their compact measured gap inside the non-scrolling shell.");
includes(responsive, ".viewButton {\n    flex-basis: 74px;\n    width: 74px;\n    min-width: 74px;\n    max-width: 74px;\n    height: 32px;\n    min-height: 32px;", "All phone view buttons must keep the same 74px footprint.");
includes(responsive, "padding-inline: 4px;\n    border-radius: 5px;\n    font-size: 10px;", "Phone view labels must reduce text size instead of growing individual buttons.");
includes(responsive, "#progressionPage .views > #openFiltersButton {\n    flex-basis: 74px;\n    width: 74px;\n    min-width: 74px;\n    max-width: 74px;", "The Filters button must match the fixed phone view-button width.");
includes(responsive, ".quickFiltersScrollerShell .viewsScrollButton {\n    width: 20px;\n    min-width: 20px;\n    height: 20px;\n    min-height: 20px;\n    padding: 4px;", "Phone quick-filter arrows must fit inside the compact 26px quick-filter row.");
includes(responsive, ".quickFiltersScrollerShell .viewsScrollButton::before {\n    top: -3px;\n    bottom: -3px;\n    width: 50px;", "Phone quick-filter fading must match the compact row height.");
includes(responsive, ".quickFiltersScrollerShell .viewsScrollButton svg {\n    width: 12px;\n    height: 12px;", "Phone quick-filter runtime arrows must match first-paint 12px geometry.");
includes(responsive, "#progressionPage .quickFilters::before {\n    width: 50px;\n    height: 26px;", "Phone quick-filter first-paint fading must match the compact runtime cue footprint.");
includes(responsive, "#progressionPage .quickFilters::after {\n    right: 4px;\n    width: 12px;\n    height: 12px;", "Phone quick-filter first-paint arrow must match the runtime cue footprint.");
includes(responsive, ".quickFilters label {\n    min-height: 26px;\n    gap: 4px;\n    padding: 0;\n    font-size: 11px;", "Phone Quick Filter labels must keep compact single-row geometry without padding.");
includes(responsive, ".quickFilters input[type=\"checkbox\"] {\n    flex-basis: 16px;\n    width: 16px;\n    min-width: 16px;\n    height: 16px;", "Phone Quick Filters must preserve the canonical square checkbox size instead of shrinking into rounded pills.");
includes(responsive, "#progressionPage #filterSummary {\n    display: inline-grid;\n    flex: 0 0 13px;\n    place-items: center;\n    align-self: stretch;", "The mobile Filters count must fill the compact Filters button vertically and center its digit in that exact box.");
includes(responsive, "min-height: 0;\n    height: auto;\n    font-size: 9px;", "The mobile Filters count must not retain a fixed competing height.");
includes(responsive, '[data-initial-table-page="club"] #progressionPage .viewButton[data-view="attributes"]::after {\n    font-size: 10px;\n  }', "Club first paint must use the same compact phone view-label scale before route resolution.");
includes(responsive, "#progressionPage .playerTableScroller table {\n    min-width: 600px;\n  }", "Phone player tables must use the tighter compact width floor.");
includes(responsive, ".mflStatsHistogram {\n    width: 100%;\n    min-width: 520px;", "Phone Stats histograms must keep a readable local horizontal floor inside their own scroller.");
includes(responsive, ".mflStatsAgeDistribution {\n    width: 100%;\n    min-width: 0;\n    max-width: 100%;", "Phone Stats histogram viewports must remain constrained to the page width while their chart pans internally.");
includes(responsive, "@media (max-width: 380px)", "Very narrow phones must have an additional layout safeguard.");
includes(responsive, ".viewButton {\n    flex-basis: 68px;\n    width: 68px;\n    min-width: 68px;\n    max-width: 68px;", "Very narrow phones must keep every view button at the same 68px width.");
includes(responsive, ".filtersDialog {\n    --mfl-filter-box-font-size: 11px;\n    --mfl-filter-box-line-height: 14px;\n    --mfl-popup-close-size: 26px;\n  }", "Very narrow phone Filters must keep 11px text centered on a 14px line box while the close glyph follows the canonical one-third box ratio.");
includes(responsive, ".addFilterRow select {\n    flex-basis: 180px;\n    width: min(180px, 100%);\n    max-width: 100%;\n  }", "Very narrow Add Filter must use the whole available row without reserving a plus-button slot.");
includes(responsive, ".filterRule {\n    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);\n    grid-template-rows: 36px 36px;\n    gap: 3px;\n    min-height: 75px;", "Very narrow phones must retain the same fluid two-column grid rather than switching back to fixed-width tracks.");
excludes(responsive, "grid-template-columns: 64px minmax(0, 1fr) 10px", "Very narrow Filters must never restore a third grid column for the remove control.");
includes(responsive, ".filterRule:has(> :nth-child(4) > :is(.betweenValue, .dateRangeValue)),", "Very narrow range/date filters must be allowed to grow vertically instead of forcing their input boxes laterally outside the screen.");
includes(responsive, "grid-template-rows: 36px auto;\n    min-height: auto;", "Very narrow range/date filter cards must keep a 36px first row while allowing the value row to grow.");
includes(responsive, "#progressionPage .playerTableScroller table {\n    min-width: 540px;\n  }", "Very narrow phones must use the tightest readable compact player-table floor.");
includes(responsive, ".playerAttributeViewButton,\n  .pager button {\n    min-height: 44px;", "Touch navigation outside compact table chrome and pager controls must remain finger-sized.");
excludes(responsive, ".searchButton,\n  .navButton,\n  .playerAttributeViewButton", "The deliberately compact mobile search bar must not be forced back to a 44px minimum by the coarse-pointer contract.");
excludes(responsive, ".navButton,\n  .viewButton,\n  .playerAttributeViewButton", "Compact phone view buttons must not be forced back to a 44px minimum by the coarse-pointer contract.");
excludes(responsive, "#accountButton::before", "Mobile account rendering must use the canonical SVG instead of a replacement pseudo-element.");
excludes(responsive, "--mfl-table-col-name", "Responsive CSS must not redefine Uniform Width column proportions.");
excludes(responsive, "--mfl-table-col-stat", "Responsive CSS must not redefine Uniform Width stat-column proportions.");
for (const variableName of [
  "--mfl-evaluation-summary-col-name",
  "--mfl-evaluation-summary-col-position",
  "--mfl-evaluation-summary-col-age",
  "--mfl-evaluation-summary-col-overall",
  "--mfl-evaluation-summary-col-seasons",
  "--mfl-evaluation-summary-col-return",
  "--mfl-evaluation-summary-col-value",
  "--mfl-evaluation-season-col-name",
  "--mfl-evaluation-season-col-season",
  "--mfl-evaluation-season-col-age",
  "--mfl-evaluation-season-col-overall",
  "--mfl-evaluation-season-col-mfl",
  "--mfl-evaluation-season-col-usd",
  "--mfl-evaluation-season-col-discount",
  "--mfl-evaluation-season-col-value",
]) {
  excludes(responsive, `${variableName}:`, `Small-screen Evaluation must preserve the desktop Uniform Width proportion for ${variableName}.`);
}
includes(appCore, 'const playerName = formatCellValue(row, "name");', "Evaluation tables must retain the canonical full player name for non-small screens.");
includes(appCore, 'const compactPlayerName = playerName.replace(/^(\\S)[^\\s]*\\s+(?:.*\\s)?(\\S+)$/, "$1. $2");', "Evaluation tables must derive first-initial plus surname from the canonical player name.");
includes(responsive, "#evaluationPage .evaluationPlayerNameFull {\n    display: none;\n  }\n\n  #evaluationPage .evaluationPlayerNameCompact {\n    display: inline;\n  }", "Small-screen Evaluation tables must show first initial plus surname while hiding the full name.");
includes(responsive, "#advancedSettingsModal .advancedSettingsDialog,\n  #evaluationLoadModal .evaluationLoadDialog {\n    width: min(100%, 420px);\n    max-width: 420px;\n    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));", "Load Evaluation and Advanced Settings must share the compact safe-area-aware small-phone surface.");
includes(responsive, "#advancedSettingsModal .advancedSettingsFooter {\n    display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 6px;\n    padding: 6px 8px;", "Advanced Settings must keep Reset, Discard, and Apply on one compact phone footer row.");
includes(responsive, "#evaluationLoadModal .evaluationLoadResult {\n    grid-template-columns: minmax(0, 1fr) 72px auto;\n    gap: 6px;\n    min-height: 52px;", "Load Evaluation rows must remain compact instead of stacking on small phones.");
includes(responsive, "#evaluationPage .evaluationSummaryTable :is(th, td):first-child,\n  #evaluationPage .evaluationTableShell .evaluationTable :is(th, td):first-child {\n    padding-left: 6px;\n  }", "Small-phone Evaluation tables must retain left inset on their first column.");
includes(stylesBase, ".evaluationTable td {\n  height: 32px;\n}", "Desktop Evaluation body rows must use the compact 32px height.");
includes(stylesBase, ".evaluationOverallControl {\n  display: grid;\n  grid-template-columns: 24px 20px 24px;", "Desktop Evaluation Overall +/- buttons must sit closer to the value.");
includes(stylesBase, ".evaluationOverallControl strong {\n  min-width: 20px;", "Desktop Evaluation Overall value must keep the tightened center track.");
includes(stylesBase, ".evaluationButtons[hidden] #evaluationResetButton[hidden],\n.evaluationButtons[hidden] #evaluationPlayerPageButton[hidden] {\n  display: inline-flex;", "Evaluation loading must reserve exactly the final Reset/Player Page two-button footprint.");
includes(stylesBase, ".evaluationButtons[hidden] #evaluationLoadButton[hidden] {\n  display: none;\n}", "The hidden Load button must not create a third loading-state action track.");
includes(stylesBase, ".evaluationOverallControl {\n  display: grid;\n  grid-template-columns: 24px 20px 24px;\n  align-items: center;\n  justify-content: start;", "Desktop Evaluation Overall controls must align to the left edge of the Overall column.");
includes(responsive, "top: var(--mfl-evaluation-table-body-top, var(--mfl-evaluation-table-header-height));", "Evaluation directional fades must start at the measured table-body boundary rather than painting over headers.");
includes(sharedTableUi, "function syncEvaluationTableFadeBodyTop(scroller) {", "Hydrated Evaluation must continuously measure the real header bottom for body-only fading.");
includes(bootstrap, "--mfl-evaluation-table-body-top", "Selected Evaluation first paint must measure the table header before exposing the body fade.");
includes(responsive, "--mfl-evaluation-header-row-height: 32px;\n    --mfl-evaluation-summary-row-height: 32px;\n    --mfl-evaluation-season-row-height: 27px;", "Tablet Evaluation must use the compact 32/32/27 row-height contract.");
includes(responsive, "--mfl-evaluation-header-row-height: 27px;\n    --mfl-evaluation-summary-row-height: 27px;\n    --mfl-evaluation-season-row-height: 23px;", "Small-phone Evaluation must use the compact 27/27/23 row-height contract.");
includes(responsive, "--mfl-evaluation-header-row-height: 25px;\n    --mfl-evaluation-summary-row-height: 25px;\n    --mfl-evaluation-season-row-height: 21px;", "Very-small-phone Evaluation must use the compact 25/25/21 row-height contract.");
includes(indexHtml, '<th aria-label="Position"><span class="evaluationHeaderFull">Position</span><span class="evaluationHeaderCompact" aria-hidden="true">POS</span></th>', "Evaluation Position must expose the compact POS label without replacing its canonical accessible heading.");
includes(indexHtml, '<th aria-label="Expected Seasons"><span class="evaluationHeaderFull">Expected Seasons</span><span class="evaluationHeaderCompact" aria-hidden="true">SZN</span></th>', "Evaluation Expected Seasons must expose SZN on small screens.");
includes(indexHtml, '<th aria-label="$MFL Return"><span class="evaluationHeaderFull">$MFL Return</span><span class="evaluationHeaderCompact" aria-hidden="true">$MFL</span></th>', "Evaluation MFL Return must expose the compact $MFL label on small screens.");
includes(indexHtml, '<th aria-label="Season"><span class="evaluationHeaderFull">Season</span><span class="evaluationHeaderCompact" aria-hidden="true">SZN</span></th>', "Evaluation Season must expose SZN on small screens.");
includes(indexHtml, '<th aria-label="Discount Factor"><span class="evaluationHeaderFull">Discount Factor</span><span class="evaluationHeaderCompact" aria-hidden="true">DISC</span></th>', "Evaluation Discount Factor must expose DISC on small screens.");
includes(indexHtml, '<th aria-label="Overall"><span class="evaluationHeaderFull">Overall</span><span class="evaluationHeaderCompact" aria-hidden="true">OVR</span></th>', "Evaluation Overall must expose OVR on small screens.");
includes(stylesBase, '#evaluationPage .evaluationHeaderCompact {\n  display: none;\n}', "Compact Evaluation headings must remain hidden on desktop.");
includes(responsive, '#evaluationPage .evaluationHeaderFull {\n    display: none;\n  }\n\n  #evaluationPage .evaluationHeaderCompact {\n    display: inline;\n  }', "Small phones must swap Evaluation headings to their compact labels without runtime text mutation.");
includes(responsive, '#evaluationPage {\n    --mfl-evaluation-header-row-height: 32px;\n    --mfl-evaluation-summary-row-height: 32px;\n    --mfl-evaluation-season-row-height: 27px;\n  }', "Tablet Evaluation must use the compact vertical contract.");
includes(responsive, '#evaluationPage {\n    --mfl-evaluation-header-row-height: 27px;\n    --mfl-evaluation-summary-row-height: 27px;\n    --mfl-evaluation-season-row-height: 23px;\n  }', "Small-phone Evaluation must use the compact vertical contract.");
includes(responsive, '#evaluationPage {\n    --mfl-evaluation-header-row-height: 25px;\n    --mfl-evaluation-summary-row-height: 25px;\n    --mfl-evaluation-season-row-height: 21px;\n  }', "Very-small-phone Evaluation must use the compact vertical contract.");
includes(responsive, '.evaluationSummaryTable thead tr,\n  .evaluationTableShell .evaluationTable thead tr,\n  .evaluationSummaryTable th,\n  .evaluationTableShell .evaluationTable th {\n    height: var(--mfl-evaluation-header-row-height);\n  }', "Every Evaluation header row and header cell must consume the responsive header-height contract.");
includes(responsive, '.evaluationSummaryTable tbody tr,\n  .evaluationSummaryTable td {\n    height: var(--mfl-evaluation-summary-row-height);\n  }', "Every Evaluation Summary body row and cell must consume the desktop-proportional Summary height contract.");
includes(responsive, '.evaluationTableShell .evaluationTable tbody tr,\n  .evaluationTableShell .evaluationTable td {\n    height: var(--mfl-evaluation-season-row-height);\n  }', "Every Evaluation Season body row and cell must consume the desktop-proportional Season height contract.");
excludes(responsive, "!important", "Responsive layout must not rely on !important overrides.");
excludes(controls, "!important", "Navigation icon geometry must not rely on !important overrides.");

console.log("Responsive layout validation passed: Quick Filters keep canonical square checkboxes with zero mobile padding; first-paint and hydrated Quick Filters share compact 46px tablet and 42px phone player-count footprints so the table never changes vertical position; Showing x/y players uses normal flow inside that reserved footprint without CSS Anchor Positioning; Filters use one 36px box/grid-row height across desktop and mobile, value controls fill their assigned flexible column and reclaim only content columns when controls are hidden, while mobile filter rules use fully proportional 1fr/2fr content tracks, filter-name/value boxes fill those tracks, and the remove control stays outside the grid with popup-border-aware equal box-to-x and x-to-border spacing; canonical first-paint markup exposes Add filter... immediately and the divider separates it from filter rules; hidden icon buttons cannot render a plus box; filter-rule removal uses #ff2020 danger red; first-paint arrows/fades require actual visible control overflow, start at the exact hydrated 0.92 gradient opacity plus 96px/72px inset-shadow strength, runtime fades are clipped to the actual strip so they cannot paint into Watchlist selector spacing, and cues stay centered on the true row; mobile Filters clamp direct inputs plus numeric/date/range wrappers to their grid tracks without lateral overflow or visible internal scrollbar chrome; bootstrap and runtime share measured overflow; first-paint SVG arrows hand off continuously to the shared runtime; global search cards are vertically centered and the popup fits five compact results; fixed 100-row mobile pagination, compact table chrome, unclipped mobile nav labels, original Settings gear, 18px desktop/mobile navigation icons, outline-only currentColor My Players shirt, color-only selected navigation, safe areas, Uniform Width, and horizontal scrolling stay single-owned.");
