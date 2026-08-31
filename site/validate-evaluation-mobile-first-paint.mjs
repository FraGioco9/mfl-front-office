import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [indexHtml, responsive, bootstrap, sharedTableUi, appCore] = await Promise.all([
  read("./index.html"),
  read("./responsive.css"),
  read("./bootstrap.js"),
  read("./shared-table-ui-runtime.js"),
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
]);

invariant(
  indexHtml.includes('html[data-initial-page="evaluation"]:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #evaluationPage {\n        display: grid;\n      }'),
  "Direct Evaluation first paint must expose the page as a grid so small-phone grid placement is effective before route hydration.",
);
invariant(
  responsive.includes("@media (max-width: 520px)"),
  "Evaluation small-phone layout must remain owned by the canonical 520px responsive breakpoint.",
);
invariant(
  responsive.includes("#evaluationPage {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    column-gap: 6px;\n    row-gap: 6px;\n  }"),
  "Small-phone Evaluation must retain its three-column responsive page grid independently from table column proportions.",
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
  responsive.includes("#evaluationPage .evaluationSearchGroup:has(#evaluationLoadButton:not([hidden])) .evaluationSearch {\n    grid-column: 1 / -1;\n    grid-row: 3;\n    width: calc(100% - 82px);\n  }")
    && responsive.includes("#evaluationPage .evaluationButtons:has(#evaluationLoadButton:not([hidden])) {\n    grid-column: 1 / -1;\n    grid-row: 3;\n    grid-template-columns: 1fr;\n    width: 76px;"),
  "Empty Evaluation search must use the full row except for the fixed Load control and shared gap.",
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
    && responsive.includes("#evaluationLoadModal .evaluationLoadDialog {\n    height: min(420px, calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));\n  }")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResult {\n    grid-template-columns: minmax(0, 1fr) 72px auto;\n    gap: 6px;\n    min-height: 52px;"),
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
    && responsive.includes("#evaluationLoadModal .evaluationLoadDialog {\n    height: min(390px, calc(100dvh - 12px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));\n  }")
    && responsive.includes("#evaluationLoadModal .evaluationLoadList {\n    grid-auto-rows: 48px;\n    padding: 5px 6px 8px;\n  }")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResult {\n    grid-template-columns: minmax(0, 1fr) 64px auto;\n    gap: 4px;\n    min-height: 48px;\n    padding-inline: 6px;\n  }"),
  "Both Evaluation popups must scale again at the tiny-phone breakpoint while Load Evaluation results remain one-line and touchable.",
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

console.log("Evaluation mobile first-paint and hydration validation passed.");
