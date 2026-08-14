(() => {
  "use strict";

  const CLASS = "mflEvaluationResultLoading";
  const STYLE_ID = "mflEvaluationSearchStateRuntimeStyles";
  const PLAYER_LABEL_STORAGE_PREFIX = "mfl-evaluation-player-label-v1:";
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
  let recentSearchCaptured = false;
  let recentPrimePromise = null;

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

  function selectedPlayerIdFromUrl() {
    if (!/^\/evaluation\/?$/i.test(location.pathname)) return "";
    return String(new URLSearchParams(location.search).get("player") || "").trim();
  }

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

  function resultName(button) {
    if (!(button instanceof HTMLButtonElement)) return "";
    return String(button.querySelector("strong")?.textContent || "").trim();
  }

  function storePlayerLabel(playerId, playerName) {
    const id = String(playerId || "").trim();
    const name = String(playerName || "").trim();
    if (!id || !name || name === `Player #${id}`) return;
    try {
      localStorage.setItem(`${PLAYER_LABEL_STORAGE_PREFIX}${id}`, name);
    } catch {
      // The runtime still works when browser storage is unavailable.
    }
  }

  function syncSelectedPlayerLabel(field = input()) {
    if (!(field instanceof HTMLInputElement)) return;
    const playerId = selectedPlayerIdFromUrl();
    if (!playerId) return;
    storePlayerLabel(playerId, field.value);
  }

  function rememberClickedSearch(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const id = resultId(button);
    storePlayerLabel(id, resultName(button));
    if (!recentSearchCaptured) return;
    recentSearchNodes = [button, ...recentSearchNodes.filter((candidate) => {
      if (!(candidate instanceof HTMLButtonElement)) return false;
      return !id || resultId(candidate) !== id;
    })].slice(0, 5);
  }

  function captureRenderedRecents(container) {
    if (recentSearchCaptured || !(container instanceof HTMLElement) || !active()) return false;
    const field = input();
    if (!(field instanceof HTMLInputElement) || field.value.trim()) return false;

    const buttons = Array.from(container.querySelectorAll(":scope > .evaluationSearchResult"))
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, 5);
    if (!buttons.length) return false;

    recentSearchNodes = buttons;
    recentSearchCaptured = true;
    return true;
  }

  function restoreRecentSearches(container) {
    if (!recentSearchCaptured || !(container instanceof HTMLElement)) return false;
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
    if (existing instanceof HTMLElement && existing.textContent === "Searching..." && container.children.length === 1) {
      container.hidden = false;
      return;
    }
    const hint = document.createElement("div");
    hint.className = "searchHint";
    hint.textContent = "Searching...";
    container.replaceChildren(hint);
    container.hidden = false;
  }

  function hideSuggestions(container) {
    if (!(container instanceof HTMLElement) || container.hidden) return;
    syncing = true;
    container.hidden = true;
    requestAnimationFrame(() => { syncing = false; });
  }

  function renderEmptySearchFromCore() {
    try {
      if (typeof window.renderEvaluationSearchResults === "function") {
        window.renderEvaluationSearchResults();
        return;
      }
      window.eval("if (typeof renderEvaluationSearchResults === 'function') renderEvaluationSearchResults();");
    } catch (error) {
      console.warn("Could not render recent Evaluation searches.", error);
    }
  }

  function primeRecentSearchData() {
    if (recentPrimePromise) return recentPrimePromise;
    recentPrimePromise = Promise.resolve().then(() => {
      if (typeof window.primeEmptyEvaluationSearch === "function") {
        return window.primeEmptyEvaluationSearch();
      }
      return window.eval("typeof primeEmptyEvaluationSearch === 'function' ? primeEmptyEvaluationSearch() : false");
    }).catch((error) => {
      console.warn("Could not prime recent Evaluation searches.", error);
      return false;
    }).finally(() => {
      recentPrimePromise = null;
    });
    return recentPrimePromise;
  }

  function sync() {
    if (destroyed || syncing || !active() || loadingLocked()) return;
    const field = input();
    const container = results();
    if (!(field instanceof HTMLInputElement) || !(container instanceof HTMLElement)) return;

    syncing = true;
    installRecentRule();
    syncSelectedPlayerLabel(field);

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
    } else if (!query) {
      renderEmptySearchFromCore();
      captureRenderedRecents(container);
      restoreRecentSearches(container);
    }

    requestAnimationFrame(() => { syncing = false; });
  }

  function onBlur(event) {
    if (event.target !== input()) return;
    event.stopImmediatePropagation();
    if (loadingLocked()) return;

    const container = results();
    if (!(container instanceof HTMLElement)) return;
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;

    if (playerSelected()) {
      hideSuggestions(container);
      return;
    }

    void primeRecentSearchData().finally(() => queueMicrotask(sync));
  }

  function onKeyUp(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement) || event.target !== field || field.value.trim()) return;
    void primeRecentSearchData().finally(() => queueMicrotask(sync));
  }

  function onPointerUp(event) {
    const target = event.target instanceof Element ? event.target.closest("#evaluationSearchClearButton") : null;
    if (!(target instanceof HTMLButtonElement)) return;
    void primeRecentSearchData().finally(() => window.setTimeout(sync, 0));
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

      if (!field.value.trim()) {
        if (!recentSearchCaptured) {
          captureRenderedRecents(container);
        } else {
          queueMicrotask(sync);
        }
        return;
      }

      syncSelectedPlayerLabel(field);
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
  void primeRecentSearchData().finally(sync);
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
    recentSearchCaptured = false;
    recentPrimePromise = null;
    style.remove();
    if (originalRecentRule && window.shouldShowEvaluationRecentResults === recentRule) {
      window.shouldShowEvaluationRecentResults = originalRecentRule;
    }
  }

  window.__mflEvaluationSearchStateRuntime = Object.freeze({ sync, destroy });
})();
