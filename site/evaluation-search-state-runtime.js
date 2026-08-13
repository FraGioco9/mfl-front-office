(() => {
  "use strict";

  const STYLE_ID = "mflEvaluationSearchStateRuntimeStyles";
  const RESULT_LOADING_CLASS = "mflEvaluationResultLoading";
  const previous = window.__mflEvaluationSearchStateRuntime;
  previous?.destroy?.();

  let destroyed = false;
  let resultsObserver = null;
  let busyObserver = null;
  let syncFrame = 0;
  let syncing = false;
  let resultLoading = false;
  let sawBusy = false;
  let releaseFrame = 0;
  let settleFrame = 0;
  let probeTimer = 0;
  let safetyTimer = 0;

  const originalShouldShowRecent = typeof window.shouldShowEvaluationRecentResults === "function"
    ? window.shouldShowEvaluationRecentResults
    : null;
  const alwaysShowRecent = () => true;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html.${RESULT_LOADING_CLASS} body *,
    html.${RESULT_LOADING_CLASS} body *::before,
    html.${RESULT_LOADING_CLASS} body *::after {
      transition: none !important;
      transition-property: none !important;
      transition-duration: 0s !important;
      animation: none !important;
      animation-duration: 0s !important;
    }
  `;
  document.head.appendChild(style);

  function evaluationInput() {
    const input = document.getElementById("evaluationSearchInput");
    return input instanceof HTMLInputElement ? input : null;
  }

  function evaluationResults() {
    const results = document.getElementById("evaluationSearchResults");
    return results instanceof HTMLElement ? results : null;
  }

  function evaluationActive() {
    return document.body?.dataset.page === "evaluation" || /^\/evaluation\/?$/i.test(window.location.pathname);
  }

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function installRecentVisibilityRule() {
    if (typeof window.shouldShowEvaluationRecentResults === "function"
      && window.shouldShowEvaluationRecentResults !== alwaysShowRecent) {
      window.shouldShowEvaluationRecentResults = alwaysShowRecent;
    }
  }

  function renderSearching(results) {
    const hint = results.querySelector(":scope > .searchHint");
    if (hint instanceof HTMLElement && hint.textContent === "Searching…" && results.children.length === 1) {
      results.hidden = false;
      return;
    }
    const nextHint = document.createElement("div");
    nextHint.className = "searchHint";
    nextHint.textContent = "Searching…";
    results.replaceChildren(nextHint);
    results.hidden = false;
  }

  function syncPresentation() {
    syncFrame = 0;
    if (destroyed || syncing || !evaluationActive()) return;
    const input = evaluationInput();
    const results = evaluationResults();
    if (!input || !results) return;

    syncing = true;
    installRecentVisibilityRule();
    const query = normalize(input.value);
    const pending = Boolean(query) && document.documentElement.dataset.evaluationSearchQueryPending === query;

    if (!query) {
      window.renderEvaluationSearchResults?.();
      results.hidden = false;
    } else if (pending) {
      renderSearching(results);
    } else {
      results.hidden = false;
      const hasResult = Boolean(results.querySelector(":scope > .evaluationSearchResult"));
      const hasMessage = Boolean(results.querySelector(":scope > .searchHint"));
      if (!hasResult && !hasMessage) window.renderEvaluationSearchResults?.();
    }

    requestAnimationFrame(() => {
      syncing = false;
    });
  }

  function scheduleSync() {
    if (destroyed || syncing || syncFrame) return;
    syncFrame = requestAnimationFrame(syncPresentation);
  }

  function onEvaluationBlur(event) {
    if (event.target !== evaluationInput()) return;
    event.stopImmediatePropagation();
    queueMicrotask(scheduleSync);
  }

  function installResultsObserver() {
    const results = evaluationResults();
    if (!results) return;
    resultsObserver = new MutationObserver(() => {
      if (!syncing) scheduleSync();
    });
    resultsObserver.observe(results, {
      childList: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }

  function resultFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const result = target.closest("#evaluationSearchResults .evaluationSearchResult");
    return result instanceof HTMLButtonElement && !result.disabled ? result : null;
  }

  function loadingBusy() {
    const root = document.documentElement;
    const body = document.body;
    return root.classList.contains("mflInteractionBusy")
      || root.dataset.interactionBusy === "true"
      || root.classList.contains("mflDataLoading")
      || body?.classList.contains("evaluationRouteLoading")
      || body?.classList.contains("loading")
      || body?.getAttribute("aria-busy") === "true";
  }

  function cancelReleaseFrames() {
    if (releaseFrame) cancelAnimationFrame(releaseFrame);
    if (settleFrame) cancelAnimationFrame(settleFrame);
    releaseFrame = 0;
    settleFrame = 0;
  }

  function releaseLoadingLock() {
    resultLoading = false;
    sawBusy = false;
    cancelReleaseFrames();
    if (probeTimer) window.clearTimeout(probeTimer);
    if (safetyTimer) window.clearTimeout(safetyTimer);
    probeTimer = 0;
    safetyTimer = 0;
    busyObserver?.disconnect();
    busyObserver = null;
    document.documentElement.classList.remove(RESULT_LOADING_CLASS);
  }

  function maybeReleaseLoadingLock() {
    if (!resultLoading) return;
    if (loadingBusy()) {
      sawBusy = true;
      cancelReleaseFrames();
      return;
    }
    if (!sawBusy || releaseFrame) return;
    releaseFrame = requestAnimationFrame(() => {
      releaseFrame = 0;
      if (!resultLoading || loadingBusy()) return maybeReleaseLoadingLock();
      settleFrame = requestAnimationFrame(() => {
        settleFrame = 0;
        if (!resultLoading || loadingBusy()) return maybeReleaseLoadingLock();
        releaseLoadingLock();
      });
    });
  }

  function beginLoadingLock() {
    if (!resultLoading) {
      resultLoading = true;
      document.documentElement.classList.add(RESULT_LOADING_CLASS);
      busyObserver = new MutationObserver(maybeReleaseLoadingLock);
      busyObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-interaction-busy"],
      });
      if (document.body) {
        busyObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ["class", "aria-busy"],
        });
      }
      probeTimer = window.setTimeout(() => {
        probeTimer = 0;
        if (resultLoading && !sawBusy && !loadingBusy()) releaseLoadingLock();
      }, 750);
      safetyTimer = window.setTimeout(releaseLoadingLock, 65_000);
    }
    if (loadingBusy()) sawBusy = true;
    maybeReleaseLoadingLock();
  }

  function onResultClick(event) {
    if (resultFromTarget(event.target)) beginLoadingLock();
  }

  installRecentVisibilityRule();
  evaluationInput()?.addEventListener("blur", onEvaluationBlur, true);
  document.addEventListener("click", onResultClick, true);
  installResultsObserver();
  syncPresentation();

  function destroy() {
    destroyed = true;
    if (syncFrame) cancelAnimationFrame(syncFrame);
    syncFrame = 0;
    resultsObserver?.disconnect();
    resultsObserver = null;
    evaluationInput()?.removeEventListener("blur", onEvaluationBlur, true);
    document.removeEventListener("click", onResultClick, true);
    releaseLoadingLock();
    style.remove();
    if (originalShouldShowRecent && window.shouldShowEvaluationRecentResults === alwaysShowRecent) {
      window.shouldShowEvaluationRecentResults = originalShouldShowRecent;
    }
  }

  window.__mflEvaluationSearchStateRuntime = Object.freeze({ sync: syncPresentation, destroy });
})();
