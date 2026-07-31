(() => {
  const RELEASE_VERSION = "1.118.17";
  const RELEASE = [
    `v${RELEASE_VERSION}`,
    "Restore Evaluation metric format, hide Load on player routes, and enable MFL Stats filters",
  ];
  const CORE_RUNTIME_URL = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@446d875082f0c06605646ed77adec816840b2ce8/site/mfl-season-ratios-runtime.js";
  const payload = window.__mflSeasonRatioPayload || (window.__mflSeasonRatioPayload = {});
  let syncTimer = 0;
  let renderHookInstalled = false;
  let statsFilterGuardInstalled = false;

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

    const value = document.getElementById("evaluationDiscountRate");
    if (value && value.textContent !== label) value.textContent = label;

    const advancedValue = document.getElementById("advancedDiscountRateValue");
    if (advancedValue && advancedValue.textContent !== label) {
      advancedValue.textContent = label;
    }
    return true;
  }

  function syncEvaluationPlayerRouteActions() {
    const playerRoute = location.pathname === "/evaluation"
      && Boolean(new URLSearchParams(location.search).get("player"));
    document.body.classList.toggle("evaluationPlayerRoute", playerRoute);

    const loadButton = document.getElementById("evaluationLoadButton");
    if (!loadButton) return;
    if (playerRoute) {
      loadButton.hidden = true;
      loadButton.setAttribute("aria-hidden", "true");
    } else {
      loadButton.removeAttribute("aria-hidden");
    }
  }

  function installEvaluationRenderSync() {
    if (renderHookInstalled || typeof renderEvaluationPage !== "function") return;
    const originalRenderEvaluationPage = renderEvaluationPage;
    const wrappedRenderEvaluationPage = function renderEvaluationPageWithCurrentDiscountRate() {
      const result = originalRenderEvaluationPage.apply(this, arguments);
      const syncAfterRender = () => {
        queueMicrotask(() => {
          syncDiscountRateDisplay();
          syncEvaluationPlayerRouteActions();
        });
        requestAnimationFrame(() => {
          syncDiscountRateDisplay();
          syncEvaluationPlayerRouteActions();
        });
      };
      Promise.resolve(result).then(syncAfterRender, syncAfterRender);
      return result;
    };
    wrappedRenderEvaluationPage.__discountDisplaySynchronized = true;
    renderEvaluationPage = wrappedRenderEvaluationPage;
    renderHookInstalled = true;
  }

  function statsFilterButtonFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || (document.body.dataset.page !== "mflstats" && location.pathname !== "/mfl/stats")) {
      return null;
    }
    return target.closest("#mflStatsOverallFilters .mflStatsFilterButton");
  }

  function preserveStatsFilterPointer(event) {
    if (!statsFilterButtonFromEvent(event)) return;
    event.stopImmediatePropagation();
  }

  function activateStatsFilter(event) {
    const button = statsFilterButtonFromEvent(event);
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      if (typeof mflStatsOverallFilterOptions === "undefined"
          || typeof state !== "object" || !state
          || typeof renderMflStatsPage !== "function") {
        return;
      }
      const label = String(button.textContent || "").trim();
      const filter = mflStatsOverallFilterOptions.find((entry) => String(entry?.label || "").trim() === label);
      if (!filter) return;
      state.mflStatsOverallFilter = filter.id;
      renderMflStatsPage();
    } catch (error) {
      console.error("Could not apply the MFL Stats overall filter.", error);
    }
  }

  function installStatsFilterGuard() {
    if (statsFilterGuardInstalled) return;
    statsFilterGuardInstalled = true;
    window.addEventListener("pointerdown", preserveStatsFilterPointer, true);
    window.addEventListener("mousedown", preserveStatsFilterPointer, true);
    window.addEventListener("click", activateStatsFilter, true);
  }

  function maintainDisplayAndControls() {
    syncImmediateVersionStyle();
    installEvaluationRenderSync();
    installStatsFilterGuard();
    syncDiscountRateDisplay();
    syncEvaluationPlayerRouteActions();
  }

  function startDisplayAndControlSync() {
    maintainDisplayAndControls();
    clearInterval(syncTimer);
    syncTimer = window.setInterval(maintainDisplayAndControls, 100);
  }

  syncImmediateVersionStyle();

  const previousCore = document.getElementById("mflSeasonRatioRuntimeCore");
  if (previousCore) previousCore.remove();
  const core = document.createElement("script");
  core.id = "mflSeasonRatioRuntimeCore";
  core.src = CORE_RUNTIME_URL;
  core.async = false;
  core.addEventListener("load", startDisplayAndControlSync, { once: true });
  core.addEventListener("error", () => {
    console.error("Could not load the MFL season-ratio runtime.");
    startDisplayAndControlSync();
  }, { once: true });
  document.head.appendChild(core);
})();
