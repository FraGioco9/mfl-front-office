(() => {
  const RELEASE_VERSION = "1.118.18";
  const RELEASE = [
    `v${RELEASE_VERSION}`,
    "Remove loading header rounding, prevent Evaluation flashes, and restore MFL Stats filters",
  ];
  const CORE_RUNTIME_URL = "https://cdn.jsdelivr.net/gh/FraGioco9/mfl-front-office@446d875082f0c06605646ed77adec816840b2ce8/site/mfl-season-ratios-runtime.js";
  const payload = window.__mflSeasonRatioPayload || (window.__mflSeasonRatioPayload = {});
  const busyEvents = ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "contextmenu"];
  let syncTimer = 0;
  let renderHookInstalled = false;
  let statsFilterGuardInstalled = false;
  let statsBusyHandlerInstalled = false;

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
    if (!value) return false;

    if (value.textContent !== label) value.textContent = label;
    const advancedValue = document.getElementById("advancedDiscountRateValue");
    if (advancedValue && advancedValue.textContent !== label) advancedValue.textContent = label;
    document.body.classList.add("evaluationDiscountRateReady");
    return true;
  }

  function syncEvaluationPlayerRouteActions() {
    const playerRoute = location.pathname === "/evaluation"
      && Boolean(new URLSearchParams(location.search).get("player"));
    document.body.classList.toggle("evaluationPlayerRoute", playerRoute);

    const loadButton = document.getElementById("evaluationLoadButton");
    if (loadButton) {
      if (playerRoute) {
        loadButton.hidden = true;
        loadButton.setAttribute("aria-hidden", "true");
      } else {
        loadButton.removeAttribute("aria-hidden");
      }
    }
    document.body.classList.add("evaluationRouteActionsReady");
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

  function statsPage() {
    const page = document.getElementById("mflStatsPage");
    if (!page || page.hidden) return null;
    if (document.body.dataset.page !== "mflstats" && location.pathname !== "/mfl/stats") return null;
    return page;
  }

  function statsFinishedLoading() {
    const page = statsPage();
    if (!page) return false;
    const buttons = page.querySelectorAll("#mflStatsOverallFilters .mflStatsFilterButton");
    if (!buttons.length) return false;
    return !Array.from(page.querySelectorAll(".mflStatsEmpty"))
      .some((element) => /loading/i.test(String(element.textContent || "")));
  }

  function unlockStatsFilters() {
    if (!statsFinishedLoading()) return false;

    try {
      if (typeof state === "object" && state) state.interactionBusyDepth = 0;
      if (typeof syncInteractionBusyState === "function") syncInteractionBusyState();
    } catch (error) {
      console.error("Could not reset the MFL Stats interaction state.", error);
    }

    document.documentElement.classList.remove("appBusy", "loading", "bootPending", "table-layout-pending");
    document.body.classList.remove(
      "appBusy", "loading", "booting", "tableRowsLoading", "tableLayoutPending",
      "clubViewLoading", "clubViewSwitching"
    );
    document.body.classList.add("mflStatsInteractive");
    document.body.setAttribute("aria-busy", "false");
    document.querySelectorAll("[inert]").forEach((element) => {
      if (element instanceof HTMLElement) element.inert = false;
    });
    document.querySelectorAll("#mflStatsOverallFilters .mflStatsFilterButton").forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
    });
    return true;
  }

  function statsFilterButtonFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !statsPage()) return null;
    return target.closest("#mflStatsOverallFilters .mflStatsFilterButton");
  }

  function activateStatsFilter(event) {
    const button = statsFilterButtonFromEvent(event);
    if (!button || !unlockStatsFilters()) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      if (typeof mflStatsOverallFilterOptions === "undefined"
          || typeof state !== "object" || !state
          || typeof renderMflStatsPage !== "function") return;
      const label = String(button.textContent || "").trim();
      const filter = mflStatsOverallFilterOptions.find(
        (entry) => String(entry?.label || "").trim() === label,
      );
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
    window.addEventListener("click", activateStatsFilter, true);
  }

  function installStatsBusyHandler() {
    if (statsBusyHandlerInstalled || typeof blockInteractionWhileBusy !== "function") return;
    statsBusyHandlerInstalled = true;
    const original = blockInteractionWhileBusy;
    busyEvents.forEach((name) => document.removeEventListener(name, original, true));
    const replacement = (event) => {
      if (statsFilterButtonFromEvent(event) && unlockStatsFilters()) return;
      original(event);
    };
    busyEvents.forEach((name) => document.addEventListener(name, replacement, true));
  }

  function maintainDisplayAndControls() {
    syncImmediateVersionStyle();
    installEvaluationRenderSync();
    installStatsFilterGuard();
    installStatsBusyHandler();
    syncDiscountRateDisplay();
    syncEvaluationPlayerRouteActions();
    unlockStatsFilters();
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
