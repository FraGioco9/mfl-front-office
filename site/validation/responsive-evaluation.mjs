import { includes, excludes } from "./assertions.mjs";

export function validateResponsiveEvaluation(context) {
  const { indexHtml, responsive, stylesBase, sharedTableUi, appCore, bootstrap } = context;
  includes(responsive, ".tablePageTitle,\n  .evaluationTitleRow {\n    margin-top: 2px;\n  }", "Mobile page titles must not recreate the removed top padding as margin.");
  includes(responsive, ".evaluationSummaryTable th,\n  .evaluationTableShell .evaluationTable th {\n    font-size: 10px;\n  }", "Evaluation table headers must follow the same 10px tablet typography step as the other player tables.");
  includes(responsive, ".evaluationSummaryTable td,\n  .evaluationTableShell .evaluationTable td {\n    font-size: 12px;\n  }", "Evaluation table body text must follow the same 12px tablet typography step as the other player tables while row height is owned by the responsive row-height contract.");
  includes(responsive, ".evaluationSummaryShell .tableScroller,\n  .evaluationTableShell .tableScroller {\n    overflow-x: auto;\n  }", "Dense Evaluation tables must own explicit mobile horizontal scrolling.");
  includes(responsive, "#evaluationPage .evaluationTitleRow,\n  #evaluationPage .evaluationTopBar,\n  #evaluationPage .evaluationSearchGroup,\n  #evaluationPage .evaluationActions {\n    display: contents;\n  }", "Small-phone Evaluation chrome must share one responsive grid so Advanced Settings and both metrics can occupy one row without duplicate markup.");
  includes(responsive, "grid-template-columns: repeat(3, minmax(0, 1fr));", "Small-phone Evaluation must use exactly three equal top-row tracks so Advanced Settings, MFL/USD, and Discount Rate stay on one line.");
  includes(responsive, "#evaluationPage .advancedSettingsButton {\n    grid-column: 1;\n    grid-row: 2;\n    width: 100%;\n    min-width: 0;\n    height: 42px;\n    min-height: 42px;", "Advanced Settings must occupy the first control column and use the same 42px mobile height as the Evaluation metrics.");
  includes(responsive, "#evaluationPage .evaluationMetrics {\n    grid-column: 2 / -1;\n    grid-row: 2;", "MFL/USD and Discount Rate must occupy the second and third control columns on the same row as Advanced Settings.");
  includes(responsive, "#evaluationPage .evaluationButtons {\n    display: grid;\n    grid-column: 1 / -1;\n    grid-row: 4;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    align-items: stretch;\n    gap: 6px;\n    width: 100%;\n    justify-self: stretch;", "Reset and Player Page must share the full row immediately below the Evaluation search.");
  includes(responsive, "#evaluationPage .evaluationButtons .evaluationPlayerPageButton {\n    width: 100%;\n  }", "Reset and Player Page must fill the same equal-width mobile tracks as Share and Save.");
  includes(responsive, "#evaluationPage .evaluationSearchGroup:has(#evaluationLoadButton:not([hidden])) .evaluationSearch,\n  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-page=\"evaluation\"][data-initial-evaluation-selection=\"false\"] #evaluationPage .evaluationSearch {\n    grid-column: 1 / -1;\n    grid-row: 3;\n    width: calc(100% - 82px);\n  }", "The empty Evaluation state must keep the search field beside the compact Load control before and after mobile hydration.");
  includes(responsive, "#evaluationPage .evaluationButtons:has(#evaluationLoadButton:not([hidden])),\n  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-page=\"evaluation\"][data-initial-evaluation-selection=\"false\"] #evaluationPage .evaluationButtons {\n    grid-column: 1 / -1;\n    grid-row: 3;\n    grid-template-columns: 1fr;\n    width: 76px;", "Load must remain beside the search input at parser-time and after hydration.");
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
  includes(responsive, "#evaluationPage .evaluationSummaryPositionSelect {\n    width: max-content;\n    max-width: 100%;\n    min-height: 28px;\n    padding: 0;", "The Evaluation position selector must preserve intrinsic canonical text-plus-chevron spacing on small phones while fitting the summary column.");
  excludes(responsive, "--mfl-evaluation-position-chevron-left:", "Responsive Evaluation must not hard-code a Position-only chevron coordinate.");
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
  includes(stylesBase, ".searchResult,\n.evaluationSearchResult,\n.evaluationLoadResultMain {\n  align-content: center;\n  gap: 4px;\n}", "Global Search, Evaluation Last 5, and Load Evaluation must share one desktop-owned centered name/info stack with a readable 4px gap.");
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
  includes(responsive, "#evaluationLoadModal .evaluationLoadResult {\n    gap: 4px;\n    min-height: 48px;\n    padding: 5px 8px;", "Load Evaluation rows must keep the same phone text inset as Evaluation Last 5 and Global Search while preserving their value/action columns.");
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
}
