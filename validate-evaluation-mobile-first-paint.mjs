import { readCanonicalCoreSource } from "./validate-core-sources.mjs";
import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [indexHtml, responsive, stylesBase, bootstrap, sharedTableUi, appCore] = await Promise.all([
  read("./index.html"),
  read("./responsive.css"),
  read("./styles-base.css"),
  read("./bootstrap.js"),
  read("./shared-table-ui-runtime.js"),
  Promise.all([
    readCanonicalCoreSource("shared"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
]);

const evaluationHandoffMarker = '<!-- Evaluation first paint: expose the route only after top controls are fully parsed. -->';
const evaluationHandoffIndex = indexHtml.indexOf(evaluationHandoffMarker);
const evaluationOptionsIndex = indexHtml.indexOf('id="evaluationOptionFilters"');
const evaluationPanelIndex = indexHtml.indexOf('id="evaluationPanel"');
invariant(
  !indexHtml.includes('html[data-initial-page="evaluation"]:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #evaluationPage {\n        display: block;\n      }')
    && indexHtml.includes('@media (min-width: 521px) {\n        html[data-initial-page="evaluation"][data-stored-wallet-opt-in="true"][data-initial-evaluation-selection="false"]:not(.mflInitialRouteResolved) #evaluationButtons {\n          display: flex;')
    && indexHtml.includes('@media (max-width: 520px) {\n        html[data-initial-page="evaluation"][data-stored-wallet-opt-in="true"][data-initial-evaluation-selection="false"]:not(.mflInitialRouteResolved) #evaluationButtons {\n          display: grid;')
    && !indexHtml.includes('html[data-initial-page="evaluation"]:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #evaluationPage,')
    && evaluationOptionsIndex >= 0
    && evaluationHandoffIndex > evaluationOptionsIndex
    && evaluationPanelIndex > evaluationHandoffIndex
    && indexHtml.includes('buttons.hidden = false;\n              resetButton.hidden = !selected;\n              loadButton.hidden = selected || !optedIn;\n              playerPageButton.hidden = !selected;\n\n              document.body.dataset.page = "evaluation";\n              page.hidden = false;')
    && !indexHtml.includes('html[data-initial-page="evaluation"] #evaluationPage .evaluationTitleRow {\n        align-items: flex-start;')
    && !indexHtml.includes('html[data-initial-page="evaluation"] #evaluationPage .evaluationTitleRow > .tablePageTitle {'),
  "Evaluation must remain hidden until its complete top-control DOM is parsed, then atomically enter canonical route/layout state before first visible paint.",
);
invariant(
  responsive.includes("@media (max-width: 520px)"),
  "Evaluation small-phone layout must remain owned by the canonical 520px responsive breakpoint.",
);
invariant(
  responsive.includes("#evaluationPage {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    align-content: start;\n    column-gap: 6px;\n    row-gap: 6px;\n  }"),
  "Small-phone Evaluation must retain its three-column responsive page grid and start-align implicit rows so the shared page floor cannot stretch first-paint controls.",
);
invariant(
  !responsive.includes("#evaluationPage {\n    display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));"),
  "The unscoped small-phone Evaluation layout must not force the page visible on non-Evaluation routes.",
);
invariant(
  responsive.includes('html body[data-page="evaluation"] #evaluationPage {\n    display: grid;\n  }'),
  "Hydrated Evaluation must retain the same small-phone grid formatting context instead of reverting to the route-ready desktop block flow.",
);
invariant(
  responsive.includes("#evaluationPage .advancedSettingsButton {\n    grid-column: 1;\n    grid-row: 2;")
    && responsive.includes("#evaluationPage .evaluationMetrics {\n    grid-column: 2 / -1;\n    grid-row: 2;"),
  "Evaluation must keep Advanced Settings and both metrics on the shared compact row.",
);
invariant(
  responsive.includes("#evaluationPage .evaluationSearch {\n    grid-column: 1 / -1;\n    grid-row: 3;")
    && responsive.includes("#evaluationPage .evaluationButtons {\n    display: grid;\n    grid-column: 1 / -1;\n    grid-row: 4;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    align-items: stretch;\n    gap: 6px;\n    width: 100%;\n    justify-self: stretch;")
    && responsive.includes("#evaluationPage .evaluationButtons .evaluationPlayerPageButton {\n    width: 100%;\n  }")
    && !responsive.includes("#evaluationPage:has(#evaluationResetButton:not([hidden]))"),
  "Selected Evaluation must keep Reset and Player Page as equal full-track buttons immediately below the search bar without a selected-state row override.",
);
invariant(
  responsive.includes("#evaluationPage .evaluationFooterActions {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));")
    && responsive.includes("#evaluationPage #evaluationShareButton {\n    grid-column: 1;\n    grid-row: 1;\n    width: 100%;\n  }")
    && responsive.includes("#evaluationPage #evaluationSaveButton {\n    grid-column: 2;\n    grid-row: 1;\n    width: 100%;\n  }"),
  "Reset and Player Page must use the same two-track mobile sizing pattern as Share and Save.",
);
invariant(
  responsive.includes('#evaluationPage .evaluationSearchGroup:has(#evaluationLoadButton:not([hidden])) .evaluationSearch,\n  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"] #evaluationPage .evaluationSearch {\n    grid-column: 1 / -1;\n    grid-row: 3;\n    width: calc(100% - 82px);\n  }')
    && responsive.includes('#evaluationPage .evaluationButtons:has(#evaluationLoadButton:not([hidden])),\n  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"] #evaluationPage .evaluationButtons {\n    grid-column: 1 / -1;\n    grid-row: 3;\n    grid-template-columns: 1fr;\n    width: 76px;'),
  "Empty Evaluation Search/Load tracks must match before and after hydration removes hidden.",
);
invariant(
  appCore.includes('clearEvaluationSearchFocus();\n      evaluationButtons.hidden = false;\n      evaluationResetButton.hidden = false;\n      if (evaluationLoadButton) evaluationLoadButton.hidden = true;\n      evaluationPlayerPageButton.hidden = false;\n      void setPage("evaluation", true, { playerId });')
    && appCore.includes('clearEvaluationSearchFocus();\n    evaluationButtons.hidden = false;\n    evaluationResetButton.hidden = false;\n    if (evaluationLoadButton) evaluationLoadButton.hidden = true;\n    evaluationPlayerPageButton.hidden = false;\n    setPage("evaluation", true, { playerId: id });'),
  "Player and table Evaluation actions must stage selected controls before in-site mobile destination visibility.",
);
invariant(
  responsive.includes("#evaluationPage .evaluationMetrics {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 6px;\n  }"),
  "The small-phone metric row must keep two equal compact tracks after hydration.",
);
invariant(
  responsive.includes("#evaluationPage .evaluationMetricLabel {\n    width: 100%;\n    justify-content: flex-end;\n    text-align: right;\n  }")
    && responsive.includes("justify-items: end;")
    && responsive.includes("#evaluationPage .evaluationMetric strong {\n    font-size: 15px;\n    line-height: 1;\n    text-align: right;")
    && responsive.includes("#evaluationPage .evaluationMflUsdInput {\n    height: 20px;\n    min-height: 20px;\n    padding: 0 2px;\n    font-size: 12px;\n    line-height: 18px;\n    text-align: right;"),
  "MFL/USD and Discount Rate box contents must stay right-aligned on small phones, including the MFL/USD editor.",
);
invariant(
  responsive.includes("#advancedSettingsModal,\n  #evaluationLoadModal {\n    padding:\n      max(8px, env(safe-area-inset-top))")
    && responsive.includes("#advancedSettingsModal .advancedSettingsDialog,\n  #evaluationLoadModal .evaluationLoadDialog {\n    width: min(100%, 420px);\n    max-width: 420px;\n    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));")
    && responsive.includes("#evaluationLoadModal .evaluationLoadDialog {\n    height: auto;\n  }")
    && responsive.includes("#evaluationLoadModal .evaluationLoadList {\n    gap: 4px;\n    height: 269px;\n    max-height: 269px;\n    grid-auto-rows: 48px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResult {\n    gap: 4px;\n    min-height: 48px;\n    padding: 5px 8px;"),
  "Load Evaluation and Advanced Settings must share one safe-area-aware small-phone modal frame while Load Evaluation keeps compact result rows.",
);
invariant(
  responsive.includes("#advancedSettingsModal .advancedSettingHeader,\n  #advancedSettingsModal .advancedLateSeasonRewardSetting {\n    align-items: center;\n    flex-direction: row;\n    gap: 8px;")
    && responsive.includes("#advancedSettingsModal .advancedSettingHeaderControl,\n  #advancedSettingsModal .advancedRewardRateControlGroup {\n    justify-content: flex-end;\n    width: auto;\n    margin-left: auto;\n    gap: 6px;")
    && responsive.includes("#advancedSettingsModal .advancedSettingsFooter {\n    display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 6px;\n    padding: 6px 8px;")
    && responsive.includes("#advancedSettingsModal .advancedSettingsFooter button {\n    width: 100%;\n    min-width: 0;\n    height: 36px;\n    min-height: 36px;"),
  "Advanced Settings must stay vertically compact on phones without stacking section controls or its three footer actions.",
);
invariant(
  responsive.includes("#advancedSettingsModal,\n  #evaluationLoadModal {\n    padding:\n      max(6px, env(safe-area-inset-top))")
    && responsive.includes("#advancedSettingsModal .advancedSettingsDialog,\n  #evaluationLoadModal .evaluationLoadDialog {\n    max-height: calc(100dvh - 12px - env(safe-area-inset-top) - env(safe-area-inset-bottom));")
    && responsive.includes("#evaluationLoadModal .evaluationLoadDialog {\n    height: auto;\n  }")
    && responsive.includes("#evaluationLoadModal .evaluationLoadList {\n    gap: 3px;\n    height: 242px;\n    max-height: 242px;\n    grid-auto-rows: 44px;"),
  "Phone modal framing must retain its safe-area-aware compact height independently from the tiny-card scaling contract.",
);
invariant(
  !responsive.includes("#evaluationLoadModal .evaluationLoadDialog {\n    height: min(390px, calc(100dvh - 12px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));\n  }")
    && responsive.split("#evaluationLoadModal .evaluationLoadDialog {\n    height: auto;\n  }").length - 1 >= 2,
  "Load Evaluation must shrink-wrap the five-card stack at both phone breakpoints instead of restoring a fixed tiny-phone dialog height.",
);
invariant(
  responsive.includes("#evaluationPage .evaluationSummaryTable :is(th, td):first-child,\n  #evaluationPage .evaluationTableShell .evaluationTable :is(th, td):first-child {\n    padding-left: 6px;\n  }"),
  "Small-phone Evaluation tables must preserve a scaled left inset on their first column.",
);
invariant(
  responsive.includes("#evaluationPage .evaluationTableShell .tableScroller {\n    display: block;\n    width: 100%;\n    max-width: 100%;\n    overflow-x: auto;\n    overflow-y: hidden;")
    && responsive.includes("#evaluationPage .evaluationTableShell .evaluationTable {\n    width: 100%;\n    min-width: 500px;\n    max-width: none;")
    && responsive.includes("#evaluationPage .evaluationTableShell .evaluationTable {\n    min-width: 460px;\n  }"),
  "Season-by-season Evaluation must remain horizontally scrollable with readable width floors on small and tiny phones.",
);
invariant(
  bootstrap.includes("function primeFirstPaintEvaluationTableFade()")
    && bootstrap.includes("--mfl-evaluation-table-body-top")
    && bootstrap.includes('if (target.id === "evaluationPage") primeFirstPaintEvaluationTableFade();')
    && sharedTableUi.includes("function syncEvaluationTableFadeBodyTop(scroller) {")
    && sharedTableUi.includes('document.querySelector("#evaluationPage .evaluationTableShell .tableScroller")')
    && appCore.includes("window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();"),
  "Evaluation season-table fading must be primed before first paint and handed to the shared directional scroll-cue runtime on render.",
);

invariant(
  indexHtml.includes('class="evaluationHeaderCompact" aria-hidden="true">POS</span>')
    && indexHtml.includes('class="evaluationHeaderCompact" aria-hidden="true">SZN</span>')
    && indexHtml.includes('class="evaluationHeaderCompact" aria-hidden="true">OVR</span>')
    && indexHtml.includes('class="evaluationHeaderCompact" aria-hidden="true">$MFL</span>')
    && indexHtml.includes('class="evaluationHeaderCompact" aria-hidden="true">DISC</span>')
    && indexHtml.includes('class="evaluationHeaderCompact" aria-hidden="true">SZN</span>'),
  "Evaluation compact phone headings must exist in first-paint markup before application hydration.",
);
invariant(
  responsive.includes("--mfl-evaluation-header-row-height: 32px;\n    --mfl-evaluation-summary-row-height: 32px;\n    --mfl-evaluation-season-row-height: 27px;")
    && responsive.includes("--mfl-evaluation-header-row-height: 27px;\n    --mfl-evaluation-summary-row-height: 27px;\n    --mfl-evaluation-season-row-height: 23px;")
    && responsive.includes("--mfl-evaluation-header-row-height: 25px;\n    --mfl-evaluation-summary-row-height: 25px;\n    --mfl-evaluation-season-row-height: 21px;"),
  "Evaluation rows must progressively compact at tablet, phone, and tiny-phone breakpoints.",
);
invariant(
  responsive.includes("#evaluationPage .evaluationHeaderFull { display: none; }")
    && responsive.includes("#evaluationPage .evaluationHeaderCompact { display: inline; }"),
  "Evaluation must use compact header labels throughout the <=900px contract.",
);

invariant(
  responsive.includes("#evaluationPage .evaluationSearchResult {\n    min-height: 54px;\n    padding: 7px 10px;\n    border-radius: 7px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadList {\n    gap: 5px;\n    height: 342px;\n    max-height: 342px;\n    grid-auto-rows: 60px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResult {\n    gap: 8px;\n    min-height: 60px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadIconButton {\n    width: 28px;\n    min-width: 28px;\n    height: 28px;\n    min-height: 28px;"),
  "Tablet Evaluation recent and saved cards must scale together from the desktop geometry at <=900px.",
);
invariant(
  responsive.includes("#evaluationPage .evaluationSearchResult {\n    min-height: 48px;\n    padding: 6px 8px;\n    border-radius: 6px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResult {\n    gap: 4px;\n    min-height: 48px;\n    padding: 5px 8px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResultMain strong {\n    font-size: 12px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadIconButton {\n    width: 26px;\n    min-width: 26px;\n    height: 26px;\n    min-height: 26px;"),
  "Phone Evaluation recent cards, saved cards, typography, and actions must compact together at <=520px.",
);
invariant(
  responsive.includes("#evaluationPage .evaluationSearchResult {\n    min-height: 44px;\n    padding: 4px 6px;\n    border-radius: 5px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResult {\n    gap: 3px;\n    min-height: 44px;\n    padding: 4px 6px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadPresentValue {\n    min-width: 56px;\n    font-size: 9px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadIconButton {\n    width: 24px;\n    min-width: 24px;\n    height: 24px;\n    min-height: 24px;")
    && responsive.includes("#evaluationLoadModal .evaluationLoadIconButton svg {\n    width: 11px;\n    height: 11px;"),
  "Tiny-phone Evaluation recent and saved cards must scale a third time, including text, value, button, and icon geometry.",
);
invariant(
  (responsive.match(/#evaluationLoadModal \.evaluationLoadList \{[\s\S]{0,120}grid-auto-rows: 48px;/g) || []).length === 1,
  "The <=520 Saved Evaluation row contract must have one canonical owner rather than duplicate 48px geometry blocks.",
);
invariant(
  !responsive.includes("!important"),
  "Responsive Evaluation card scaling must not introduce !important overrides.",
);

const loadDialogRuleStart = stylesBase.indexOf(".evaluationLoadDialog {");
const loadDialogRuleEnd = stylesBase.indexOf("\n}", loadDialogRuleStart);
const loadDialogRule = loadDialogRuleStart >= 0 && loadDialogRuleEnd >= 0
  ? stylesBase.slice(loadDialogRuleStart, loadDialogRuleEnd + 2)
  : "";
const sharedDialogRuleStart = stylesBase.indexOf(".mflDialog {");
const sharedDialogRuleEnd = stylesBase.indexOf("\n}", sharedDialogRuleStart);
const sharedDialogRule = sharedDialogRuleStart >= 0 && sharedDialogRuleEnd >= 0
  ? stylesBase.slice(sharedDialogRuleStart, sharedDialogRuleEnd + 2)
  : "";
invariant(
  sharedDialogRule.includes("border-radius: var(--mfl-radius-dialog);")
    && sharedDialogRule.includes("background: var(--mfl-dialog-background);")
    && loadDialogRule.includes("background-clip: padding-box;")
    && loadDialogRule.includes("overflow: hidden;")
    && !stylesBase.includes(".evaluationLoadDialog,\n.evaluationLoadList,\n.evaluationLoadResult,\n.evaluationLoadActions {\n  overflow: visible;"),
  "Evaluation Load dialog must inherit the shared rounded surface while preserving its specialist clipping and body-portaled tooltip behavior.",
);
const desktopLoadResultRuleStart = stylesBase.indexOf(".evaluationLoadResult {");
const desktopLoadResultRuleEnd = stylesBase.indexOf("\n}", desktopLoadResultRuleStart);
const desktopLoadResultRule = desktopLoadResultRuleStart >= 0 && desktopLoadResultRuleEnd >= 0
  ? stylesBase.slice(desktopLoadResultRuleStart, desktopLoadResultRuleEnd + 2)
  : "";
const desktopLoadMainRuleStart = stylesBase.indexOf(".evaluationLoadResultMain {");
const desktopLoadMainRuleEnd = stylesBase.indexOf("\n}", desktopLoadMainRuleStart);
const desktopLoadMainRule = desktopLoadMainRuleStart >= 0 && desktopLoadMainRuleEnd >= 0
  ? stylesBase.slice(desktopLoadMainRuleStart, desktopLoadMainRuleEnd + 2)
  : "";
const desktopLoadValueRuleStart = stylesBase.indexOf(".evaluationLoadPresentValue {");
const desktopLoadValueRuleEnd = stylesBase.indexOf("\n}", desktopLoadValueRuleStart);
const desktopLoadValueRule = desktopLoadValueRuleStart >= 0 && desktopLoadValueRuleEnd >= 0
  ? stylesBase.slice(desktopLoadValueRuleStart, desktopLoadValueRuleEnd + 2)
  : "";
const desktopLoadActionsRuleStart = stylesBase.indexOf(".evaluationLoadActions {");
const desktopLoadActionsRuleEnd = stylesBase.indexOf("\n}", desktopLoadActionsRuleStart);
const desktopLoadActionsRule = desktopLoadActionsRuleStart >= 0 && desktopLoadActionsRuleEnd >= 0
  ? stylesBase.slice(desktopLoadActionsRuleStart, desktopLoadActionsRuleEnd + 2)
  : "";
const desktopRecentResultRuleStart = stylesBase.indexOf(".evaluationSearchResult {");
const desktopRecentResultRuleEnd = stylesBase.indexOf("\n}", desktopRecentResultRuleStart);
const desktopRecentResultRule = desktopRecentResultRuleStart >= 0 && desktopRecentResultRuleEnd >= 0
  ? stylesBase.slice(desktopRecentResultRuleStart, desktopRecentResultRuleEnd + 2)
  : "";
invariant(
  desktopLoadResultRule.includes("grid-template-columns: minmax(0, 1fr) auto auto;")
    && desktopLoadResultRule.includes("align-items: center;")
    && desktopLoadResultRule.includes("text-align: center;")
    && desktopLoadMainRule.includes("justify-items: start;")
    && desktopLoadMainRule.includes("text-align: left;")
    && stylesBase.includes(".searchResult,\n.evaluationSearchResult,\n.evaluationLoadResultMain {\n  align-content: center;\n  gap: 4px;\n}")
    && desktopLoadValueRule.includes("text-align: center;")
    && desktopLoadActionsRule.includes("align-items: center;")
    && desktopLoadActionsRule.includes("justify-content: center;")
    && desktopRecentResultRule.includes("padding: 10px 12px;")
    && desktopRecentResultRule.includes("text-align: left;")
    && (responsive.match(/#evaluationLoadModal \.evaluationLoadResult \{[\s\S]{0,140}grid-template-columns:/g) || []).length === 0
    && !responsive.includes("#evaluationLoadModal .evaluationLoadActions {\n    gap: 4px;\n    justify-content: center;")
    && !responsive.includes("#evaluationPage .evaluationSearchResult {\n    align-content: center;"),
  "Evaluation card centering must remain desktop-owned; responsive rules may scale dimensions but must not redefine the card alignment model.",
);

console.log("Evaluation mobile first-paint and hydration validation passed.");
