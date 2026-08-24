// @ts-check

import {
  extractRequiredFunction,
  extractRequiredFunctions,
  extractRequiredSection,
  insertBeforeRequiredMarker,
  normalizeSplitterInput,
  replaceAllRequired,
  replaceRequired,
} from "./app-core-splitter-utils.js";

const ROUTE_CORE_NAMES = Object.freeze(["mflstats", "table", "club"]);
const ROUTE_CORE_PLACEHOLDER = (name) => `/*__MFL_ROUTE_CORE_${String(name || "").toUpperCase()}__*/`;

export function splitApplicationCoreRuntime(source) {
  const input = normalizeSplitterInput({ core: source }, "mflstats", "route application core");
  if (input.alreadySplit) {
    return Object.freeze({ core: String(source || ""), routeChunks: Object.freeze({ ...input.routeChunks }) });
  }

  let core = input.core;
  const routeChunks = {};

  const mflStatsFunctions = extractRequiredFunctions(
    core,
    [
      "mflStatsHistogramAnimationDuration",
      "mflStatsAnimationEntryKey",
      "captureMflStatsAnimationEntry",
      "consumeMflStatsAnimationEntry",
      "mflStatsHistogramAnimationState",
      "applyMflStatsHistogramAnimationState",
      "mflStatsHistogramAnimationStart",
      "mflStatsHistogramAnimationProgress",
      "mflStatsHistogramDisplayValue",
      "mflStatsHistogramDisplayRows",
      "mflStatsHistogramDisplayLabel",
      "renderMflStatsHistogram",
      "mflStatsOverallRange",
      "mflStatsAgeRange",
      "mflStatsFilteredRows",
      "renderMflStatsPage",
    ],
    "MFL Stats helper",
  );
  core = mflStatsFunctions.core;

  let extracted = extractRequiredSection(
    core,
    'mflStatsDistributionModeButtons?.addEventListener("click", (event) => {',
    "let pendingViewButtonPointer = null;",
    "MFL Stats distribution binding",
  );
  core = extracted.core;
  routeChunks.mflstats = [
    ...mflStatsFunctions.chunks,
    extracted.chunk,
  ].filter(Boolean).join("\n\n");

  const tableParts = [];
  const tableFunctions = extractRequiredFunctions(
    core,
    [
      "pagerWindow",
      "pagerPages",
      "syncPager",
      "currentTableState",
      "saveTableStateLocally",
      "tableStateWithoutPageFilters",
      "tableRestoreSavedTableStateOwner",
      "syncRestoredTableControls",
      "filterRulesForLoading",
      "renderTableLoadingShell",
      "updateFilterSummary",
      "activeFilterCount",
      "activeQuickFilterCount",
      "tableApplyFiltersOwner",
      "renderTable",
      "buildHeader",
      "updateViewButtons",
      "syncQuickFilterLabels",
      "currentTablePageState",
      "saveTableState",
      "tablePageKey",
      "preferredViewForPage",
      "normalizeViewForPage",
      "pageNameForViewButton",
      "activateViewButton",
      "resetFilters",
      "resetTableFiltersForPageSwitch",
      "readFilterRules",
      "normalizedFilterRule",
      "filteredRowsForRules",
      "compareRows",
      "appliedTableFilterSignature",
      "syncActiveWatchlistFromSet",
      "createPagerInput",
      "beginPagerEdit",
      "commitPagerEdit",
      "cancelPagerEdit",
      "handlePagerKeydown",
      "positionTableControlCellContent",
      "alignTableControlCellContent",
      "updateTableControlCellAlignment",
    ],
    "Table helper",
  );
  core = tableFunctions.core;
  tableParts.push(...tableFunctions.chunks);

  extracted = extractRequiredSection(
    core,
    "openFiltersButton.addEventListener(\"click\", () => {",
    "const selectionActionBar = document.getElementById(\"selectionActionBar\");",
    "Table filter interactions",
  );
  core = extracted.core;
  tableParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "previousPageButton.addEventListener(\"click\", () => {",
    "function rowIdValue(row) {",
    "Table pager interactions",
  );
  core = extracted.core;
  tableParts.push(extracted.chunk);

  routeChunks.table = tableParts.filter(Boolean).join("\n\n");

  const clubParts = [];
  const clubFunctions = extractRequiredFunctions(
    core,
    [
      "clubRouteTargetFromPath",
      "canonicalClubRoute",
      "clubRows",
      "clubTitleIdentityFromRows",
      "saveClubTitleIdentity",
      "renderClubTitle",
      "hideClubPageControls",
      "restoreStandardControls",
      "applyClubPresentation",
      "captureClubView",
      "restoreClubView",
      "openClubPage",
    ],
    "Club helper",
  );
  core = clubFunctions.core;
  clubParts.push(...clubFunctions.chunks);

  let clubSearch = extractRequiredSection(
    core,
    '  if (typeof renderSearchResultsNow === "function") {',
    '  document.addEventListener("click", (event) => {',
    "Club route-local search wrapper",
  );
  core = clubSearch.core;
  clubParts.push(clubSearch.chunk);

  extracted = extractRequiredSection(
    core,
    '  document.addEventListener("click", (event) => {',
    "  window.__mflOpenClubPageRoute = openClubPage;",
    "Club route-local view handler",
  );
  core = extracted.core;
  clubParts.push(extracted.chunk);

  extracted = extractRequiredSection(
    core,
    "  window.__mflOpenClubPageRoute = openClubPage;",
    "function openPlayerPage(",
    "Club route exports",
  );
  core = extracted.core;
  clubParts.push(extracted.chunk);

  routeChunks.club = clubParts.filter(Boolean).join("\n\n");

  core = replaceAllRequired(
    core,
    "if (typeof renderMflStatsPage === \"function\") renderMflStatsPage();",
    "window.__mflRouteRuntime?.render?.(\"mflstats\");",
    "MFL Stats shared render bridge",
  );
  core = replaceAllRequired(
    core,
    "if (typeof syncQuickFilterLabels === \"function\") syncQuickFilterLabels();",
    "window.__mflRouteRuntime?.render?.(\"table\");",
    "Table shared render bridge",
  );

  core = replaceRequired(
    core,
    `    state.currentPage = pageName;
    state.view = viewName;
    state.page = 1;
    state.pageSize = Number(payload.pageSize || state.pageSize);
    state.rows = rows;
    state.totalRows = Number(payload.totalRows || rows.length);
    state.tableSourceRowsCount = state.rows.length;
    restoreSavedTableState(pageName, { view: viewName });`,
    `    state.currentPage = pageName;
    state.view = viewName;
    state.page = 1;
    state.pageSize = Number(payload.pageSize || state.pageSize);
    state.rows = rows;
    state.totalRows = Number(payload.totalRows || rows.length);
    state.tableSourceRowsCount = state.rows.length;
    window.__mflRouteRuntime?.render?.("table", "restoreSavedTableState", pageName, { view: viewName });`,
    "Table shared restore bridge",
  );
  core = replaceRequired(
    core,
    `      syncRestoredTableControls(pageName);
      state.incrementalApplying = true;`,
    `      window.__mflRouteRuntime?.render?.("table", "syncRestoredTableControls", pageName);
      state.incrementalApplying = true;`,
    "Table shared restored-control bridge",
  );
  core = replaceAllRequired(
    core,
    "buildHeader();",
    "window.__mflRouteRuntime?.render?.(\"table\", \"buildHeader\");",
    "Table shared header bridge",
  );
  core = replaceAllRequired(
    core,
    "updateViewButtons();",
    "window.__mflRouteRuntime?.render?.(\"table\", \"updateViewButtons\");",
    "Table shared view-button bridge",
  );
  core = replaceAllRequired(
    core,
    "applyFilters({ save: false });",
    "window.__mflRouteRuntime?.render?.(\"table\", \"applyFilters\", { save: false });",
    "Table shared filter bridge",
  );
  core = replaceAllRequired(
    core,
    "applyFilters();",
    "window.__mflRouteRuntime?.render?.(\"table\", \"applyFilters\");",
    "Table shared filter bridge",
  );
  core = replaceAllRequired(
    core,
    "saveTableStateLocally(currentTableState());",
    "window.__mflRouteRuntime?.render?.(\"table\", \"saveCurrentTableState\");",
    "Table shared state save bridge",
  );
  core = replaceRequired(
    core,
    "const preferredView = preferredViewForPage(pageName);",
    'const preferredView = window.__mflRouteRuntime?.render?.("table", "preferredViewForPage", pageName) || "attributes";',
    "Table preferred view bridge",
  );
  core = replaceRequired(
    core,
    "const pageName = pageNameForViewButton(button);",
    'const pageName = window.__mflRouteRuntime?.render?.("table", "pageNameForViewButton", button);',
    "Table view-button page bridge",
  );
  core = replaceRequired(
    core,
    "const viewName = normalizeViewForPage(button.dataset.view, pageName);",
    'const viewName = window.__mflRouteRuntime?.render?.("table", "normalizeViewForPage", button.dataset.view, pageName);',
    "Table view normalization bridge",
  );
  core = replaceRequired(
    core,
    `      const savedPageState = state.tablePageStates?.[pageName] || defaultTablePageState(pageName);
      const routeView = normalizeViewForPage(options.view || savedPageState.view, pageName);`,
    `      const savedPageState = state.tablePageStates?.[pageName] || defaultTablePageState(pageName);
      const routeView = window.__mflRouteRuntime?.render?.("table", "normalizeViewForPage", options.view || savedPageState.view, pageName);`,
    "Table setPage view normalization bridge",
  );
  core = replaceRequired(
    core,
    `    const route = prepareIncrementalRoute(pageName, {
      ...options,
      view: normalizeViewForPage(options.view || state.view, pageName),`,
    `    const route = prepareIncrementalRoute(pageName, {
      ...options,
      view: window.__mflRouteRuntime?.render?.("table", "normalizeViewForPage", options.view || state.view, pageName),`,
    "Table incremental view normalization bridge",
  );
  core = replaceAllRequired(
    core,
    "syncQuickFilterLabels();",
    'window.__mflRouteRuntime?.render?.("table", "syncQuickFilterLabels");',
    "Table quick-filter bridge",
  );
  core = replaceAllRequired(
    core,
    "resetFilters();",
    'window.__mflRouteRuntime?.render?.("table", "resetFilters");',
    "Table reset bridge",
  );
  core = replaceAllRequired(
    core,
    "resetTableFiltersForPageSwitch(pageName);",
    'window.__mflRouteRuntime?.render?.("table", "resetTableFiltersForPageSwitch", pageName);',
    "Table page-switch reset bridge",
  );

  core = replaceRequired(
    core,
    `      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
    };`,
    `      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
      ...(clubTarget?.clubId ? { clubId: clubTarget.clubId } : {}),
    };`,
    "Club shared incremental route identity",
  );
  core = replaceRequired(
    core,
    `    const transition = await runViewTransition(pageName, viewName, {
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
    });`,
    `    const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;
    if (pageName === "club" && !clubTarget?.clubId) return;
    const clubPath = clubTarget?.clubId
      ? window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName) || ""
      : "";
    const transition = await runViewTransition(pageName, viewName, {
      walletAddress: state.currentAgentWalletAddress,
      watchlistId: state.currentWatchlistId,
      ...(clubTarget?.clubId ? {
        clubId: clubTarget.clubId,
        path: clubPath,
      } : {}),
    });`,
    "Club shared view transition identity",
  );

  const evaluationParts = [];
  const mflStatsParts = [];

  const evaluationRouteOnly = extractRequiredFunctions(
    core,
    ["recoverInvalidEvaluationLink"],
    "Evaluation dependency-closed helper",
  );
  core = evaluationRouteOnly.core;
  evaluationParts.push(...evaluationRouteOnly.chunks);

  let extractedEvaluation = extractRequiredSection(
    core,
    "const advancedPlayerTableTsv = `",
    'const agentColumn = "wallet_name";',
    "Evaluation advanced player lookup data",
  );
  core = extractedEvaluation.core;
  evaluationParts.push(extractedEvaluation.chunk);

  extractedEvaluation = extractRequiredSection(
    core,
    "const evaluationContractsTable = (() => {",
    "function evaluationMflMultiplierForSeason(",
    "Evaluation contract lookup table",
  );
  core = extractedEvaluation.core;
  evaluationParts.push(extractedEvaluation.chunk);

  const evaluationFunctions = extractRequiredFunctions(
    core,
    [
      "evaluationMflMultiplierForSeason",
      "evaluationSummaryOverallForSeason",
      "evaluationAdjustedOverall",
      "evaluationAdjustedOverallRaw",
      "evaluationBaseOverall",
      "evaluationMetricRows",
      "evaluationMetricForOverall",
      "evaluationSalaryForOverall",
      "evaluationNetSalaryForSeason",
      "evaluationPositionAverages",
      "evaluationFutureOverall",
      "evaluationSeasonsRemaining",
      "evaluationExpectedCashFlowForSeason",
      "evaluationDiscountFactor",
      "evaluationPresentValue",
      "evaluationDcfValue",
      "evaluationCurrentValue",
      "evaluationRateOfReturn",
      "evaluationCurrentSeasonNumber",
      "evaluationDiscountRateValue",
      "evaluationMflPerUsdValue",
      "formatEvaluationRate",
      "formatEvaluationCurrency",
      "formatEvaluationMflCurrency",
      "renderEvaluationMflPerUsdControl",
      "evaluationRatingBonus",
      "evaluationOpponentStrengthMalus",
      "evaluationMatchXp",
      "evaluationXpProgression",
      "evaluationValuationRows",
      "evaluationHeaderRows",
      "evaluationExportRows",
      "evaluationAdvancedPlayerRows",
      "advancedPlayerTableSourceRows",
      "formatAdvancedPlayerTableValue",
      "renderAdvancedPlayerTable",
      "updateAdvancedPlayerTableClip",
      "openAdvancedSettings",
      "closeAdvancedSettings",
      "queueEvaluationSettingsSave",
      "syncEvaluationSettingsFromControls",
      "syncEvaluationSettingsToControls",
      "applyEvaluationSettings",
      "resetAdvancedSettings",
      "evaluationPlayerIdFromUrl",
      "evaluationSavedIdFromUrl",
      "evaluationShareIdFromUrl",
      "basicEvaluationPathForPlayer",
      "syncEvaluationPlayerUrl",
      "isPlainEvaluationUrl",
      "clearEvaluationSearchFocus",
      "renderEvaluationSearchResults",
      "clearEvaluationSearch",
      "handleEvaluationSearchInput",
      "resetEvaluationSelection",
      "renderEmptyEvaluationSelection",
      "renderEvaluationTable",
      "renderEvaluationPage",
      "applySharedEvaluationPayload",
      "loadSharedEvaluation",
      "loadSavedEvaluation",
      "loadEvaluationFromUrl",
    ],
    "Evaluation helper",
  );
  core = evaluationFunctions.core;
  evaluationParts.push(...evaluationFunctions.chunks);

  extractedEvaluation = extractRequiredSection(
    core,
    "evaluationSearchInput.addEventListener(\"input\", handleEvaluationSearchInput);",
    "settingsLinkButton.addEventListener(\"click\", async () => {",
    "Evaluation route bindings",
  );
  core = extractedEvaluation.core;
  evaluationParts.push(extractedEvaluation.chunk);

  routeChunks.evaluation = evaluationParts.filter(Boolean).join("\n\n");

  const mflStatsCore = routeChunks.mflstats;
  if (mflStatsCore) {
    mflStatsParts.push(mflStatsCore);
  }
  routeChunks.mflstats = mflStatsParts.filter(Boolean).join("\n\n");

  const routeRuntimeFacade = `
window.__mflRouteRuntime = window.__mflRouteRuntime || Object.freeze({
  render(routeName, method, ...args) {
    const runtime = window.__mflRouteCores?.[String(routeName || "")];
    if (!runtime) return undefined;
    if (!method) return runtime.render?.(...args);
    return runtime[method]?.(...args);
  },
});`;
  core = insertBeforeRequiredMarker(
    core,
    "window.__mflCoreContracts = Object.freeze({",
    routeRuntimeFacade,
    "route runtime facade",
  );

  const routeCoreAssignments = ROUTE_CORE_NAMES.map((name) => [name, ROUTE_CORE_PLACEHOLDER(name)]);
  for (const [name, placeholder] of routeCoreAssignments) {
    const chunk = String(Reflect.get(routeChunks, name) || "").trim();
    if (!chunk) continue;
    Reflect.set(routeChunks, name, `${chunk}\n\nwindow.__mflRouteCores = window.__mflRouteCores || {};\nwindow.__mflRouteCores[${JSON.stringify(name)}] = Object.freeze({});`);
    core = `${core.trim()}\n\n${placeholder}\n`;
  }

  return Object.freeze({
    core,
    routeChunks: Object.freeze(routeChunks),
  });
}
