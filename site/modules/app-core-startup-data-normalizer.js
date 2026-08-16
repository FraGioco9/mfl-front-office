// @ts-check

const ORIGINAL_START_APP = `async function startApp() {
  loadTheme();
  setupChangelogSections();
  const initialTarget = pageTargetFromPath(\`${location.pathname}${location.search}\`);
  loadSavedTableState();
  const earlyGlobalSearch = primeGlobalSearchIndexes();
  applyStoredWalletPermission();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
  updateMenuVisibility();
  showAppShell();
  void ensureFlowWallet();
  await Promise.allSettled([earlyGlobalSearch, loadSummary(), loadWalletPreferences()]);
  applyStoredWalletPermission();
  updateAccountState();
  await showHomeShell(initialTarget.pageName, false, initialTarget.options);
}`;

const ROUTE_AWARE_START_APP = `async function startApp() {
  loadTheme();
  setupChangelogSections();
  const initialTarget = pageTargetFromPath(\`${location.pathname}${location.search}\`);
  loadSavedTableState();
  const earlyGlobalSearch = primeGlobalSearchIndexes();
  const startupSummaryPromise = loadSummary();
  const startupWalletPreferencesPromise = loadWalletPreferences();
  applyStoredWalletPermission();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
  updateMenuVisibility();
  showAppShell();
  void ensureFlowWallet();

  const startupDependencies = [earlyGlobalSearch];
  if (initialTarget.pageName === "home") startupDependencies.push(startupSummaryPromise);
  if (["watchlist", "myplayers", "settings", "player"].includes(initialTarget.pageName)) {
    startupDependencies.push(startupWalletPreferencesPromise);
  }
  await Promise.allSettled(startupDependencies);
  applyStoredWalletPermission();
  updateAccountState();
  await showHomeShell(initialTarget.pageName, false, initialTarget.options);

  void Promise.allSettled([startupSummaryPromise, startupWalletPreferencesPromise]).then(() => {
    applyStoredWalletPermission();
    updateAccountState();
  });
}`;

export function normalizeStartupDataDependencies(source) {
  const text = String(source || "");
  if (text.includes("const startupSummaryPromise = loadSummary();")) return text;
  if (!text.includes(ORIGINAL_START_APP)) {
    throw new Error("Could not locate the application startup data barrier.");
  }
  return text.replace(ORIGINAL_START_APP, ROUTE_AWARE_START_APP);
}
