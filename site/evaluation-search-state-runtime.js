(() => {
  "use strict";

  const PLAYER_LABEL_STORAGE_PREFIX = "mfl-evaluation-player-label-v1:";
  window.__mflEvaluationSearchStateRuntime?.destroy?.();

  let destroyed = false;
  let syncing = false;
  let resultsObserver = null;
  let recentPrimePromise = null;

  const originalRecentRule = typeof window.shouldShowEvaluationRecentResults === "function"
    ? window.shouldShowEvaluationRecentResults
    : null;

  const input = () => document.getElementById("evaluationSearchInput");
  const results = () => document.getElementById("evaluationSearchResults");
  const clearButton = () => document.getElementById("evaluationSearchClearButton");
  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const active = () => document.body?.dataset.page === "evaluation" || /^\/evaluation\/?$/i.test(location.pathname);

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

  function syncClearButton(field = input()) {
    const button = clearButton();
    if (!(field instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) return;
    button.hidden = !(playerSelected() || field.value.trim());
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
      // Evaluation continues normally when browser storage is unavailable.
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
    storePlayerLabel(resultId(button), resultName(button));
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
    if (destroyed || syncing || !active()) return;
    const field = input();
    const container = results();
    if (!(field instanceof HTMLInputElement) || !(container instanceof HTMLElement)) return;

    syncing = true;
    installRecentRule();
    syncSelectedPlayerLabel(field);
    syncClearButton(field);

    if (playerSelected() && document.activeElement !== field) {
      container.hidden = true;
      requestAnimationFrame(() => { syncing = false; });
      return;
    }

    const query = normalize(field.value);
    if (query && document.documentElement.dataset.evaluationSearchQueryPending === query) {
      showSearching(container);
    } else if (!query) {
      // Core owns the recent IDs loaded from wallet preferences/Supabase. Never
      // restore a DOM snapshot from the current section here.
      renderEmptySearchFromCore();
    }

    requestAnimationFrame(() => { syncing = false; });
  }

  function onBlur(event) {
    if (event.target !== input()) return;
    const field = input();
    syncClearButton(field);

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
    if (!(field instanceof HTMLInputElement) || event.target !== field) return;
    syncClearButton(field);
    if (field.value.trim()) return;
    void primeRecentSearchData().finally(() => queueMicrotask(sync));
  }

  function onClick(event) {
    if (!(event.target instanceof Element)) return;

    const clear = event.target.closest("#evaluationSearchClearButton");
    if (clear instanceof HTMLButtonElement) {
      void primeRecentSearchData().finally(() => queueMicrotask(() => {
        syncClearButton();
        sync();
      }));
      return;
    }

    const result = event.target.closest("#evaluationSearchResults .evaluationSearchResult");
    if (!(result instanceof HTMLButtonElement) || result.disabled) return;
    rememberClickedSearch(result);
  }

  function installObserver() {
    const container = results();
    const button = clearButton();
    if (!(container instanceof HTMLElement)) return;

    resultsObserver = new MutationObserver(() => {
      if (destroyed || syncing) return;
      const field = input();
      if (!(field instanceof HTMLInputElement)) return;

      syncClearButton(field);

      if (playerSelected() && document.activeElement !== field) {
        hideSuggestions(container);
        return;
      }

      if (!field.value.trim()) {
        queueMicrotask(sync);
        return;
      }

      syncSelectedPlayerLabel(field);
      if (document.activeElement !== field) sync();
    });
    resultsObserver.observe(container, { childList: true, attributes: true, attributeFilter: ["hidden"] });
    if (button instanceof HTMLButtonElement) {
      resultsObserver.observe(button, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  installRecentRule();
  syncClearButton();
  input()?.addEventListener("blur", onBlur, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keyup", onKeyUp, true);
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
    recentPrimePromise = null;
    if (originalRecentRule && window.shouldShowEvaluationRecentResults === recentRule) {
      window.shouldShowEvaluationRecentResults = originalRecentRule;
    }
  }

  window.__mflEvaluationSearchStateRuntime = Object.freeze({ sync, destroy });
})();
