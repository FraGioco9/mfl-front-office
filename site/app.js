(() => {
  const VERSION = "1.119.19";
  const SOURCE_COMMIT = "dc3265ceb18ee501e6107f3a31869c6500738e92";
  const SOURCE_URL = `https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@${SOURCE_COMMIT}/site/app.js`;
  const START_MARKER = "async function startApp() {";
  const END_MARKER = "\n(() => {\n  const currentVersion";

  const replacement = `async function startApp() {
  loadTheme();
  setupChangelogSections();
  const initialTarget = pageTargetFromPath(\`${window.location.pathname}${window.location.search}\`);
  const initialPage = initialTarget.pageName;
  const initialSearchParams = new URLSearchParams(window.location.search);
  const initialSavedEvaluationId = initialPage === "evaluation"
    ? String(initialSearchParams.get("saved") || "").trim()
    : "";
  const initialSavedEvaluationPlayerId = initialPage === "evaluation"
    ? String(initialSearchParams.get("player") || "").trim()
    : "";

  loadSavedTableState();
  applyStoredWalletPermission();
  loadEvaluationMflPerUsd();
  loadEvaluationLateSeasonRewardRates();
  renderEvaluationMflPerUsdControl(false);
  evaluationDiscountRate.textContent = formatEvaluationRate(evaluationDiscountRateValue());
  updateMenuVisibility();

  const revealInitialAppShell = () => {
    loadingScreen.hidden = true;
    document.documentElement.classList.remove("loading", "table-layout-pending", "bootPending");
    document.body.classList.remove("booting", "loading", "tableLayoutPending");
    revealAppShell();
    showAppShell();
  };

  if (initialPage === "changelog") {
    updateAccountState();
    await showHomeShell("changelog", false, initialTarget.options);
    revealInitialAppShell();
    return;
  }

  revealInitialAppShell();
  beginInteractionBusy();
  try {
    if (initialSavedEvaluationId) {
      await Promise.resolve(ensureFlowWallet()).catch(() => false);
    } else {
      void ensureFlowWallet();
    }
    applyStoredWalletPermission();
    await loadSummary();
    await loadWalletPreferences();
    applyStoredWalletPermission();
    updateAccountState();
    await showHomeShell(initialPage, false, initialTarget.options);

    if (
      initialSavedEvaluationId
      && state.evaluationSavedId !== initialSavedEvaluationId
    ) {
      await loadSavedEvaluation(initialSavedEvaluationId, initialSavedEvaluationPlayerId);
      if (state.evaluationSavedId === initialSavedEvaluationId) {
        const savedUrl = new URL("/evaluation", window.location.origin);
        if (initialSavedEvaluationPlayerId) {
          savedUrl.searchParams.set("player", initialSavedEvaluationPlayerId);
        }
        savedUrl.searchParams.set("saved", initialSavedEvaluationId);
        window.history.replaceState({}, "", savedUrl.pathname + savedUrl.search);
      }
    }
  } finally {
    endInteractionBusy({ reset: true });
  }
}`;

  function fail(message) {
    console.error(message);
    document.documentElement.classList.remove("bootPending", "loading", "appBusy", "table-layout-pending");
    document.body?.classList.remove("booting", "loading", "appBusy", "tableLayoutPending");
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) loadingScreen.hidden = true;
    const main = document.querySelector("main");
    if (main) main.innerHTML = '<p class="emptyState">Could not load MFL Front Office.</p>';
  }

  try {
    const request = new XMLHttpRequest();
    request.open("GET", SOURCE_URL, false);
    request.send(null);
    if (!(request.status >= 200 && request.status < 300) || !request.responseText) {
      fail(`Could not load the pinned application source (${request.status}).`);
      return;
    }

    const source = request.responseText;
    const startIndex = source.indexOf(START_MARKER);
    const endIndex = source.indexOf(END_MARKER, startIndex);
    if (startIndex < 0 || endIndex < 0) {
      fail("Could not locate the application startup function.");
      return;
    }

    let patchedSource = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
    patchedSource = patchedSource.replace(
      /const currentVersion = "\d+\.\d+\.\d+";/g,
      `const currentVersion = "${VERSION}";`,
    );
    patchedSource += `\n//# sourceURL=mfl-front-office-app-v${VERSION}.js`;

    const script = document.createElement("script");
    script.textContent = patchedSource;
    document.head.appendChild(script);
  } catch (error) {
    fail(error?.message || "Could not initialize the application.");
  }
})();
