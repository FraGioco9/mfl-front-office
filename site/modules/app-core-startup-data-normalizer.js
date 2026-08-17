// @ts-check

const ORIGINAL_START_APP = `async function startApp() {
  loadTheme();
  setupChangelogSections();
  loadSavedTableState();
  const initialTarget = pageTargetFromPath(\`\${location.pathname}\${location.search}\`);
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

const LEGACY_ROUTE_AWARE_START_APP = `async function startApp() {
  loadTheme();
  setupChangelogSections();
  loadSavedTableState();
  const initialTarget = pageTargetFromPath(\`\${location.pathname}\${location.search}\`);
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

const ROUTE_AWARE_START_APP = `async function startApp() {
  loadTheme();
  setupChangelogSections();
  loadSavedTableState();
  const initialTarget = pageTargetFromPath(\`\${location.pathname}\${location.search}\`);
  const earlyGlobalSearch = primeGlobalSearchIndexes();
  const startupSummaryPromise = loadSummary();
  const startupWalletPreferencesPromise = loadWalletPreferences();
  const startupProgressionPermissionPromise = (
    pageRequiresProgressionPermission(initialTarget.pageName)
    && hasWalletOptIn()
  )
    ? loadWalletPermissions({ force: true })
    : null;
  applyStoredWalletPermission();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
  updateMenuVisibility();
  showAppShell();

  const startupDependencies = [earlyGlobalSearch];
  if (startupProgressionPermissionPromise) startupDependencies.push(startupProgressionPermissionPromise);
  if (initialTarget.pageName === "home") startupDependencies.push(startupSummaryPromise);
  if (["watchlist", "myplayers", "settings", "player"].includes(initialTarget.pageName)) {
    startupDependencies.push(startupWalletPreferencesPromise);
  }
  await Promise.allSettled(startupDependencies);
  applyStoredWalletPermission();
  updateAccountState();
  updateMenuVisibility();
  await showHomeShell(initialTarget.pageName, false, initialTarget.options);

  void Promise.allSettled([startupSummaryPromise, startupWalletPreferencesPromise]).then(() => {
    applyStoredWalletPermission();
    updateAccountState();
  });
}`;

export function normalizeStartupDataDependencies(source) {
  const text = String(source || "");
  if (text.includes("const startupProgressionPermissionPromise = (")) return text;
  if (text.includes(LEGACY_ROUTE_AWARE_START_APP)) {
    return text.replace(LEGACY_ROUTE_AWARE_START_APP, ROUTE_AWARE_START_APP);
  }
  if (!text.includes(ORIGINAL_START_APP)) {
    throw new Error("Could not locate the canonical application startup data barrier.");
  }
  return text.replace(ORIGINAL_START_APP, ROUTE_AWARE_START_APP);
}
