(() => {
  const VERSION = "1.119.49";
  const HISTORY_LENGTH = 4;
  const INPUT_SELECTOR = "#evaluationMflUsdInput, #advancedMflUsdInput, #evaluationMflUsdIncreaseButton, #evaluationMflUsdDecreaseButton, #evaluationMflUsdResetButton, #advancedMflUsdIncreaseButton, #advancedMflUsdDecreaseButton, #advancedMflUsdResetButton, #resetAdvancedSettingsButton, #applyAdvancedSettingsButton";
  const previousRuntime = window.__mflEvaluationDiscountRuntime;

  previousRuntime?.destroy?.();

  let frame = 0;
  let observer = null;
  let nativeRenderEvaluationPage = null;
  let renderEvaluationPageWrapper = null;
  let lastRenderedKey = "";

  function historicalRows() {
    const candidates = [
      window.mflSeasonRatios,
      window.__mflSeasonRatioResult?.rows,
      window.__mflSeasonRatioPayload?.rows,
    ];
    const source = candidates.find((value) => Array.isArray(value) && value.length) || [];
    const bySeason = new Map();

    source.forEach((row) => {
      const season = Number(row?.season);
      const ratio = Number(row?.ratio);
      if (!Number.isInteger(season) || season <= 0 || !Number.isFinite(ratio) || ratio <= 0) return;
      bySeason.set(season, { season, ratio });
    });

    return Array.from(bySeason.values())
      .sort((a, b) => a.season - b.season)
      .slice(-HISTORY_LENGTH);
  }

  function currentMflPerUsd() {
    try {
      const value = Number(state?.evaluationMflPerUsd);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  function calculateDiscountRate() {
    const history = historicalRows();
    const currentRatio = currentMflPerUsd();
    if (history.length !== HISTORY_LENGTH || !currentRatio) return null;

    const currentSeason = history[history.length - 1].season + 1;
    const sequence = [...history, { season: currentSeason, ratio: currentRatio, current: true }];
    const growthFactors = [];

    for (let index = 1; index < sequence.length; index += 1) {
      const previous = sequence[index - 1].ratio;
      const current = sequence[index].ratio;
      if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current) || current <= 0) return null;
      growthFactors.push(current / previous);
    }

    const product = growthFactors.reduce((result, factor) => result * factor, 1);
    const rate = Math.pow(product, 1 / growthFactors.length) - 1;
    if (!Number.isFinite(rate)) return null;

    return {
      rate,
      history,
      currentSeason,
      currentRatio,
      growthFactors,
    };
  }

  function dynamicEvaluationDiscountRateValue() {
    return calculateDiscountRate()?.rate ?? 0;
  }

  function installRateFunction() {
    try {
      if (typeof evaluationDiscountRateValue !== "function") return false;
      if (evaluationDiscountRateValue !== dynamicEvaluationDiscountRateValue) {
        evaluationDiscountRateValue = dynamicEvaluationDiscountRateValue;
      }
      return true;
    } catch {
      return false;
    }
  }

  function syncDiscountRate() {
    frame = 0;
    const calculated = calculateDiscountRate();
    if (!calculated) return false;

    installRateFunction();
    const label = `${(calculated.rate * 100).toFixed(2)}%`;
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (value && value.textContent !== label) value.textContent = label;
    if (advanced && advanced.textContent !== label) advanced.textContent = label;

    document.documentElement.classList.add("mflEvaluationRateResolved");
    window.__mflDynamicDiscountResult = Object.freeze({
      version: VERSION,
      rate: calculated.rate,
      label,
      currentSeason: calculated.currentSeason,
      currentRatio: calculated.currentRatio,
      history: Object.freeze(calculated.history.map((row) => Object.freeze({ ...row }))),
      growthFactors: Object.freeze([...calculated.growthFactors]),
    });
    lastRenderedKey = `${calculated.history.map((row) => `${row.season}:${row.ratio}`).join("|")}|${calculated.currentSeason}:${calculated.currentRatio}|${label}`;
    return true;
  }

  function scheduleSync() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(syncDiscountRate);
  }

  function wrapEvaluationRenderer() {
    if (typeof renderEvaluationPage !== "function") return false;
    if (renderEvaluationPage === renderEvaluationPageWrapper) return true;

    nativeRenderEvaluationPage = renderEvaluationPage;
    renderEvaluationPageWrapper = function renderEvaluationPageWithDynamicDiscountRate() {
      installRateFunction();
      const result = nativeRenderEvaluationPage.apply(this, arguments);
      scheduleSync();
      return result;
    };
    renderEvaluationPage = renderEvaluationPageWrapper;
    return true;
  }

  function maintain() {
    wrapEvaluationRenderer();
    installRateFunction();
    syncDiscountRate();
  }

  function onRatioReady() {
    window.queueMicrotask(maintain);
    scheduleSync();
  }

  function onEvaluationSettingChange(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(INPUT_SELECTOR)) return;
    window.queueMicrotask(() => {
      installRateFunction();
      scheduleSync();
    });
  }

  window.addEventListener("mfl:season-ratios-ready", onRatioReady);
  document.addEventListener("input", onEvaluationSettingChange, true);
  document.addEventListener("change", onEvaluationSettingChange, true);
  document.addEventListener("click", onEvaluationSettingChange, true);

  observer = new MutationObserver(() => {
    const calculated = calculateDiscountRate();
    if (!calculated) return;
    const label = `${(calculated.rate * 100).toFixed(2)}%`;
    const currentKey = `${calculated.history.map((row) => `${row.season}:${row.ratio}`).join("|")}|${calculated.currentSeason}:${calculated.currentRatio}|${label}`;
    const value = document.getElementById("evaluationDiscountRate");
    const advanced = document.getElementById("advancedDiscountRateValue");
    if (currentKey !== lastRenderedKey
        || (value && value.textContent !== label)
        || (advanced && advanced.textContent !== label)) {
      scheduleSync();
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
    attributeFilter: ["class", "data-page"],
  });

  function destroy() {
    if (frame) window.cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("mfl:season-ratios-ready", onRatioReady);
    document.removeEventListener("input", onEvaluationSettingChange, true);
    document.removeEventListener("change", onEvaluationSettingChange, true);
    document.removeEventListener("click", onEvaluationSettingChange, true);

    if (nativeRenderEvaluationPage
        && renderEvaluationPageWrapper
        && typeof renderEvaluationPage === "function"
        && renderEvaluationPage === renderEvaluationPageWrapper) {
      renderEvaluationPage = nativeRenderEvaluationPage;
    }
  }

  window.__mflEvaluationDiscountRuntime = {
    version: VERSION,
    destroy,
    sync: maintain,
    calculate: calculateDiscountRate,
  };

  maintain();
  [0, 50, 150, 400, 1000, 2000, 5000].forEach((delay) => {
    window.setTimeout(maintain, delay);
  });
})();
