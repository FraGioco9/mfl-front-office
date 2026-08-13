(() => {
  "use strict";

  const CLASS = "mflEvaluationResultLoading";
  const STYLE_ID = "mflEvaluationSearchStateRuntimeStyles";
  window.__mflEvaluationSearchStateRuntime?.destroy?.();

  let destroyed = false;
  let syncing = false;
  let resultsObserver = null;
  let busyObserver = null;
  let releaseFrame = 0;
  let settleFrame = 0;
  let probeTimer = 0;
  let safetyTimer = 0;
  let sawBusy = false;
  let recentSearchNodes = [];

  const originalRecentRule = typeof window.shouldShowEvaluationRecentResults === "function"
    ? window.shouldShowEvaluationRecentResults
    : null;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html.${CLASS} body *,
    html.${CLASS} body *::before,
    html.${CLASS} body *::after {
      transition: none !important;
      animation: none !important;
    }

    html.${CLASS} #evaluationSearchResults {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    html.${CLASS} body::after {
      content: "" !important;
      display: block !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: transparent !important;
      pointer-events: auto !important;
    }
  `;
  document.head.appendChild(style);

  const input = () => document.getElementById("evaluationSearchInput");
  const results = () => document.getElementById("evaluationSearchResults");
  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const active = () => document.body?.dataset.page === "evaluation" || /^\/evaluation\/?$/i.test(location.pathname);
  const loadingLocked = () => document.documentElement.classList.contains(CLASS);

  function playerSelected() {
    const panel = document.getElementById("evaluationPanel");
    if (panel instanceof HTMLElement && !panel.hidden) return true;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("player") || params.get("saved") || params.get("share"));
  }

  const recentRule = () => {
    const field = input();
    if (!(field instanceof HTMLInputElement)) return originalRecentRule?.() || false;
    if (field.value.trim()) return originalRecentRule?.() || false;
    return document.activeElement === field || !playerSelected();
  };

  function installRecentRule() {
    if (window.shouldShowEvaluationRecentResults !== recentRule) {
      window.shouldShowEvaluationRecentResults = recentRule;
    }
  }

  function resultId(button) {
    if (!(button instanceof HTMLButtonElement)) return "";
    const match = String(button.textContent || "").match(/#(\d+)/);
    return match?.[1] || "";
  }

  function rememberClickedSearch(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const id = resultId(button);
    recentSearchNodes = [button, ...recentSearchNodes.filter((candidate) => {
      if (!(candidate instanceof HTMLButtonElement)) return false;
      return !id || resultId(candidate) !== id;
    })].slice(0, 5);
  }

  function captureRenderedRecents(container) {
    if (!(container instanceof HTMLElement)) return;
    const buttons = Array.from(container.querySelectorAll(":scope > .evaluationSearchResult"))
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, 5);
    if (buttons.length) recentSearchNodes = buttons;
  }

  function restoreRecentSearches(container) {
    if (!(container instanceof HTMLElement)) return false;
    const nodes = recentSearchNodes
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, 5);
    if (!nodes.length) return false;
    container.replaceChildren(...nodes);
    container.hidden = false;
    return true;
  }

  function showSearching(container) {
    const existing = container.querySelector(":scope > .searchHint");
    if (existing instanceof HTMLElement && existing.textContent === "Searchingº" && container.children.length === 1) {
      container.hidden = false;
      return;
    }
    const hint = document.createElement("div");
    hint.className = "searchHint";
    hint.textContent = "Searchingº";
    container.replaceChildren(hint);
    container.hidden = false;
  }

  function hideSuggestions(container) {
    if (!(container instanceof HTMLElement) || container.hidden) return;
    syncing = true;
    container.hidden = true;
    requestAnimationFrame(() => { syncing = false; });
  }

  function sync() {
    if (destroyed || syncing || !active() || loadingLocked()) return;
    const field = input();
    const container = results();
    if (!(field instanceof HTMLInputElement) || !(container instanceof HTMLElement)) return;

    syncing = true;
    installRecentRule();

    if (playerSelected() && document.activeElement !== field) {
      container.hidden = true;
      requestAnimationFrame(() => { syncing = false; });
      return;
    }

    const query = normalize(field.value);
    if (!query && restoreRecentSearches(container)) {
      requestAnimationFrame(() => { syncing = false; });
      return;
    }

    if (query && document.documentElement.dataset.evaluationSearchQueryPending === query) {
      showSearching(container);
    } else {
      window.renderEvaluationSearchResults?.();
      if (!query) captureRenderedRecents(container);
    }

    requestAnimationFrame(() => { syncing = false; });
  }

  function onBlur(event) {
    if (event.target !== input()) return;
    event.stopImmediatePropagation();
    if (loadingLocked()) return;

    const container = results();
    if (!(container instanceof HTMLElement)) return;
    if (event.relatedTarget instanceof Node && container.contains (event.relatedTarget)) return;

    if (playerSelected()) {
      hideSuggestions(container);
      return;
    }

    queueMicrotask(sync);
  }

  function onKeyUp(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement) || event.target !== field || field.value.trim()) return;
    queueMicrotask(sync);
  }

  function onPointerUp(event) {
    const target = event.target instanceof Element ? event.target.closest("#evaluationSearchClearButton") : null;
    if (!(target instanceof HTMLButtonElement)) return;
    window.setTimeout(sync, 0);
  }

  function installObserver() {
    const container = results();
    if (!(container instanceof HTMLElement)) return;
    resultsObserver = new MutationObserver(() => {
      if (syncing || loadingLocked()) return;
      const field = input();
      if (!(field instanceof HTMLInputElement)) return;

      if (playerSelected() && document.activeElement !== field) {
        hideSuggestions(container);
        return;
      }

      if (document.activeElement === field && !field.value.trim()) {
        captureRenderedRecents(container);
        return;
      }

      if (document.activeElement !== field) sync();
    });
    resultsObserver.observe(container, { childList: true, attributes: true, attributeFilter: ["hidden"] });
  }

  function loadingBusy() {
    const root = document.documentElement;
    const body = document.body;
    return root.classList.contains("mflInteractionBusy") || root.dataset.interactionBusy === "true"
      || root.classList.contains("mflDataLoading") || body?.classList.contains("evaluationRouteLoading")
      || body?.classList.contains("loading") || body?.getAttribute("aria-busy") === "true";
  }

  function stopLock() {
    if (releaseFrame) cancelAnimationFrame(releaseFrame);
    if (settleFrame) cancelAnimationFrame(settleFrame);
    releaseFrame = settleFrame = 0;
    clearTimeout(probeTimer);
    clearTimeout(safetyTimer);
    probeTimer = safetyTimer = 0;
    sawBusy = false;
    busyObserver?.disconnect();
    busyObserver = null;
    document.documentElement.classList.remove(CLASS);
    queueMicrotask(sync);
  }

  function checkLock() {
    if (!loadingLocked()) return;
    if (loadingBusy()) {
      sawBusy = true;
      if (releaseFrame) cancelAnimationFrame(releaseFrame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      releaseFrame = settleFrame = 0;
      return;
    }
    if (!sawBusy || releaseFrame) return;
    releaseFrame = requestAnimationFrame(() => {
      releaseFrame = 0;
      if (loadingBusy()) return checkLock();
      settleFrame = requestAnimationFrame(() => {
        settleFrame = 0;
        if (loadingBusy()) return checkLock();
        stopLock();
      });
    });
  }

  function startLock() {
    const container = results();
    if (!loadingLocked()) {
      document.documentElement.classList.add(CLASS);
      if (container instanceof HTMLElement) container.hidden = true;
      busyObserver = new MutationObserver(checkLock);
      busyObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-interaction-busy"] });
      if (document.body) busyObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "aria-busy"] });
      probeTimer = setTimeout(() => { if (!sawBusy && !loadingBusy()) stopLock(); }, 750);
      safetyTimer = setTimeout(stopLock, 65000);
    }
    if (loadingBusy()) sawBusy = true;
    checkLock();
  }

  function onClick(event) {
    const target = event.target instanceof Element
      ? event.target.closest("#evaluationSearchResults .evaluationSearchResult")
      : null;
    if (!(target instanceof HTMLButtonElement) || target.disabled) return;
    rememberClickedSearch(target);
    startLock();
  }

  installRecentRule();
  captureRenderedRecents(results());
  input()?.addEventListener("blur", onBlur, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keyup", onKeyUp, true);
  document.addEventListener("pointerup", onPointerUp, true);
  installObserver();
  sync();

  function destroy() {
    destroyed = true;
    resultsObserver?.disconnect();
    resultsObserver = null;
    input()?.removeEventListener("blur", onBlur, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keyup", onKeyUp, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    stopLock();
    recentSearchNodes = [];
    style.remove();
    if (originalRecentRule && window.shouldShowEvaluationRecentResults === recentRule) {
      window.shouldShowEvaluationRecentResults = originalRecentRule;
    }
  }

  window.__mflEvaluationSearchStateRuntime = Object.freeze({ sync, destroy });
})();
