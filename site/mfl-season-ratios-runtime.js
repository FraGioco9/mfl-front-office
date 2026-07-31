(() => {
  const RELEASE_VERSION = "1.118.16";
  const RELEASE = [
    `v${RELEASE_VERSION}`,
    "Keep the Evaluation discount-rate display synchronized with the active rate",
  ];
  const CORE_RUNTIME_URL = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@446d875082f0c06605646ed77adec816840b2ce8/site/mfl-season-ratios-runtime.js";
  const payload = window.__mflSeasonRatioPayload || (window.__mflSeasonRatioPayload = {});
  let syncTimer = 0;
  let renderHookInstalled = false;

  payload.version = RELEASE_VERSION;
  payload.releases = Array.isArray(payload.releases) ? payload.releases : [];
  if (!payload.releases.some((entry) => String(entry?.[0] || "") === RELEASE[0])) {
    payload.releases.unshift(RELEASE);
  }

  function syncImmediateVersionStyle() {
    let style = document.getElementById("mflImmediateVersionStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflImmediateVersionStyle";
      document.head.appendChild(style);
    }
    style.textContent = `.siteFooter a[data-page="changelog"]::before{content:"MFL Front Office v${RELEASE_VERSION}"!important}`;
  }

  function currentDiscountRate() {
    try {
      if (typeof evaluationDiscountRateValue !== "function") return NaN;
      return Number(evaluationDiscountRateValue());
    } catch (error) {
      console.error("Could not read the current Evaluation discount rate.", error);
      return NaN;
    }
  }

  function formatDiscountRate(rate) {
    if (!Number.isFinite(rate)) return "-";
    try {
      if (typeof formatEvaluationRate === "function") return formatEvaluationRate(rate);
    } catch {
      // The equivalent formatting below remains available.
    }
    return `${(rate * 100).toFixed(2)}%`;
  }

  function syncDiscountRateDisplay() {
    const rate = currentDiscountRate();
    if (!Number.isFinite(rate)) return false;
    const label = formatDiscountRate(rate);

    document.querySelectorAll(".evaluationDiscountRate").forEach((element) => {
      if (element.textContent !== label) element.textContent = label;
    });

    const advancedValue = document.getElementById("advancedDiscountRateValue");
    if (advancedValue && advancedValue.textContent !== label) {
      advancedValue.textContent = label;
    }
    return true;
  }

  function installEvaluationRenderSync() {
    if (renderHookInstalled || typeof renderEvaluationPage !== "function") return;
    const originalRenderEvaluationPage = renderEvaluationPage;
    const wrappedRenderEvaluationPage = function renderEvaluationPageWithCurrentDiscountRate() {
      const result = originalRenderEvaluationPage.apply(this, arguments);
      const syncAfterRender = () => {
        queueMicrotask(syncDiscountRateDisplay);
        requestAnimationFrame(syncDiscountRateDisplay);
      };
      Promise.resolve(result).then(syncAfterRender, syncAfterRender);
      return result;
    };
    wrappedRenderEvaluationPage.__discountDisplaySynchronized = true;
    renderEvaluationPage = wrappedRenderEvaluationPage;
    renderHookInstalled = true;
  }

  function maintainDiscountDisplay() {
    syncImmediateVersionStyle();
    installEvaluationRenderSync();
    syncDiscountRateDisplay();
  }

  function startDiscountDisplaySync() {
    maintainDiscountDisplay();
    clearInterval(syncTimer);
    syncTimer = window.setInterval(maintainDiscountDisplay, 100);
  }

  syncImmediateVersionStyle();

  const previousCore = document.getElementById("mflSeasonRatioRuntimeCore");
  if (previousCore) previousCore.remove();
  const core = document.createElement("script");
  core.id = "mflSeasonRatioRuntimeCore";
  core.src = CORE_RUNTIME_URL;
  core.async = false;
  core.addEventListener("load", startDiscountDisplaySync, { once: true });
  core.addEventListener("error", () => {
    console.error("Could not load the MFL season-ratio runtime.");
    startDiscountDisplaySync();
  }, { once: true });
  document.head.appendChild(core);
})();
