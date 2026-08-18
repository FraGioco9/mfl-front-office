(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  window.__mflGlobalSearchRuntime?.destroy?.();

  let controller = null;
  let sequence = 0;
  let evaluationController = null;
  let evaluationSequence = 0;
  let destroyed = false;
  let modalObserver = null;
  let focusFrame = 0;
  let focusSettleTimer = 0;
  let pendingPayload = null;
  let pendingQuery = "";
  let pendingEvaluationPayload = null;
  let pendingEvaluationQuery = "";

  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  function coreContracts() {
    const contracts = Reflect.get(window, "__mflCoreContracts");
    return contracts && typeof contracts === "object" ? contracts : null;
  }

  function installCoreSearchMatching() {
    const install = coreContracts()?.installSearchMatching;
    return typeof install === "function" ? Boolean(install()) : false;
  }

  function searchInput() {
    const input = document.getElementById("playerSearchInput");
    return input instanceof HTMLInputElement ? input : null;
  }

  function searchResults() {
    const results = document.getElementById("playerSearchResults");
    return results instanceof HTMLElement ? results : null;
  }

  function searchModal() {
    const modal = document.getElementById("searchModal");
    return modal instanceof HTMLElement ? modal : null;
  }

  function evaluationInput() {
    const input = document.getElementById("evaluationSearchInput");
    return input instanceof HTMLInputElement ? input : null;
  }

  function evaluationResults() {
    const results = document.getElementById("evaluationSearchResults");
    return results instanceof HTMLElement ? results : null;
  }

  function syncClearButton() {
    const input = searchInput();
    const button = document.getElementById("playerSearchClearButton");
    if (input && button instanceof HTMLElement) button.hidden = !input.value.trim();
  }

  function syncEvaluationClearButton() {
    const input = evaluationInput();
    const button = document.getElementById("evaluationSearchClearButton");
    if (input && button instanceof HTMLElement) button.hidden = !input.value.trim();
  }

  function renderSearchMessage(message) {
    const results = searchResults();
    if (!results) return;
    const hint = document.createElement("div");
    hint.className = "searchHint";
    hint.textContent = message;
    results.replaceChildren(hint);
    results.classList.remove("filledSearchResults");
  }

  function renderEvaluationMessage(message) {
    const results = evaluationResults();
    if (!results) return;
    const hint = document.createElement("div");
    hint.className = "searchHint";
    hint.textContent = message;
    results.replaceChildren(hint);
    results.hidden = false;
  }

  function markSearching(normalizedQuery) {
    if (!normalizedQuery) return;
    document.documentElement.dataset.globalSearchQueryPending = normalizedQuery;
    syncClearButton();
    renderSearchMessage("Searching…");
  }

  function finishSearching(normalizedQuery) {
    if (document.documentElement.dataset.globalSearchQueryPending === normalizedQuery) {
      delete document.documentElement.dataset.globalSearchQueryPending;
    }
  }

  function markEvaluationSearching(normalizedQuery) {
    if (!normalizedQuery) return;
    document.documentElement.dataset.evaluationSearchQueryPending = normalizedQuery;
    syncEvaluationClearButton();
    renderEvaluationMessage("Searching…");
  }

  function finishEvaluationSearching(normalizedQuery) {
    if (document.documentElement.dataset.evaluationSearchQueryPending === normalizedQuery) {
      delete document.documentElement.dataset.evaluationSearchQueryPending;
    }
  }

  function renderCurrentResults() {
    try {
      coreContracts()?.renderGlobalSearchResults?.();
    } catch (error) {
      console.warn("Could not render Global Search results.", error);
    }
  }

  function renderCurrentEvaluationResults() {
    try {
      coreContracts()?.renderCurrentEvaluationSearchResults?.();
    } catch (error) {
      console.warn("Could not render Evaluation search results.", error);
    }
  }

  function resetEvaluationSelection() {
    try {
      coreContracts()?.resetCurrentEvaluationSelection?.();
    } catch (error) {
      console.warn("Could not reset Evaluation selection.", error);
    }
  }

  function payloadApplierReady() {
    return typeof coreContracts()?.applySearchPayload === "function";
  }

  function applyPayload(payload, normalizedQuery = "") {
    installCoreSearchMatching();
    const applySearchPayload = coreContracts()?.applySearchPayload;
    if (typeof applySearchPayload !== "function") {
      pendingPayload = payload;
      pendingQuery = normalizedQuery;
      return false;
    }

    applySearchPayload(payload, "all");
    pendingPayload = null;
    pendingQuery = "";
    renderCurrentResults();
    finishSearching(normalizedQuery);
    return true;
  }

  function applyEvaluationPayload(payload, normalizedQuery = "") {
    installCoreSearchMatching();
    const applySearchPayload = coreContracts()?.applySearchPayload;
    if (typeof applySearchPayload !== "function") {
      pendingEvaluationPayload = payload;
      pendingEvaluationQuery = normalizedQuery;
      return false;
    }

    applySearchPayload(payload, "players");
    pendingEvaluationPayload = null;
    pendingEvaluationQuery = "";
    renderCurrentEvaluationResults();
    finishEvaluationSearching(normalizedQuery);
    return true;
  }

  function flushPendingPayload() {
    if (!pendingPayload) return false;
    const input = searchInput();
    if (!input || !pendingQuery || normalize(input.value) !== pendingQuery) {
      pendingPayload = null;
      pendingQuery = "";
      return false;
    }
    return applyPayload(pendingPayload, pendingQuery);
  }

  function flushPendingEvaluationPayload() {
    if (!pendingEvaluationPayload) return false;
    const input = evaluationInput();
    if (!input || !pendingEvaluationQuery || normalize(input.value) !== pendingEvaluationQuery) {
      pendingEvaluationPayload = null;
      pendingEvaluationQuery = "";
      return false;
    }
    return applyEvaluationPayload(pendingEvaluationPayload, pendingEvaluationQuery);
  }

  function invalidateLegacyAllSearch() {
    coreContracts()?.invalidateDatabaseSearch?.("all");
  }

  function invalidateLegacyEvaluationSearch() {
    coreContracts()?.invalidateDatabaseSearch?.("players");
  }

  async function searchDatabase(rawQuery) {
    installCoreSearchMatching();
    const query = String(rawQuery || "").trim();
    const normalizedQuery = normalize(query);
    const input = searchInput();
    if (!input || !normalizedQuery) return false;

    const requestSequence = ++sequence;
    controller?.abort();
    invalidateLegacyAllSearch();
    controller = new AbortController();
    const activeController = controller;
    const parameters = new URLSearchParams({ mode: "search", type: "all", limit: "20", q: query, v: VERSION });

    markSearching(normalizedQuery);
    try {
      const response = await fetch(`/api/data?${parameters}`, {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
        signal: activeController.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not search the database.");
      if (destroyed || requestSequence !== sequence || normalize(input.value) !== normalizedQuery) return false;
      return applyPayload(payload, normalizedQuery);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error?.message || "Could not search the database.");
        if (!destroyed && requestSequence === sequence && normalize(input.value) === normalizedQuery) {
          renderSearchMessage("Could not search.");
          finishSearching(normalizedQuery);
        }
      }
      return false;
    } finally {
      if (controller === activeController) controller = null;
    }
  }

  async function searchEvaluationDatabase(rawQuery) {
    installCoreSearchMatching();
    const query = String(rawQuery || "").trim();
    const normalizedQuery = normalize(query);
    const input = evaluationInput();
    if (!input || !normalizedQuery) return false;

    const requestSequence = ++evaluationSequence;
    evaluationController?.abort();
    invalidateLegacyEvaluationSearch();
    evaluationController = new AbortController();
    const activeController = evaluationController;
    const parameters = new URLSearchParams({ mode: "search", type: "players", limit: "20", q: query, v: VERSION });

    markEvaluationSearching(normalizedQuery);
    try {
      const response = await fetch(`/api/data?${parameters}`, {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
        signal: activeController.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not search players.");
      if (destroyed || requestSequence !== evaluationSequence || normalize(input.value) !== normalizedQuery) return false;
      return applyEvaluationPayload(payload, normalizedQuery);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error?.message || "Could not search players.");
        if (!destroyed && requestSequence === evaluationSequence && normalize(input.value) === normalizedQuery) {
          renderEvaluationMessage("Could not search.");
          finishEvaluationSearching(normalizedQuery);
        }
      }
      return false;
    } finally {
      if (evaluationController === activeController) evaluationController = null;
    }
  }

  function clearGlobalRequest() {
    sequence += 1;
    controller?.abort();
    controller = null;
    pendingPayload = null;
    pendingQuery = "";
    delete document.documentElement.dataset.globalSearchQueryPending;
  }

  function clearEvaluationRequest() {
    evaluationSequence += 1;
    evaluationController?.abort();
    evaluationController = null;
    pendingEvaluationPayload = null;
    pendingEvaluationQuery = "";
    delete document.documentElement.dataset.evaluationSearchQueryPending;
  }

  function onInput(event) {
    const input = searchInput();
    if (!input || event.target !== input) return;
    event.stopImmediatePropagation();
    const query = String(input.value || "").trim();
    if (!query) {
      clearGlobalRequest();
      syncClearButton();
      renderCurrentResults();
      return;
    }
    void searchDatabase(query);
  }

  function onEvaluationInput(event) {
    const input = evaluationInput();
    if (!input || event.target !== input) return;
    event.stopImmediatePropagation();
    const query = String(input.value || "").trim();
    if (!query) {
      clearEvaluationRequest();
      syncEvaluationClearButton();
      resetEvaluationSelection();
      void window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults?.(false);
      return;
    }
    void searchEvaluationDatabase(query);
  }

  function onEvaluationFocus(event) {
    const input = evaluationInput();
    if (!input || event.target !== input) return;
    const normalizedQuery = normalize(input.value);
    if (normalizedQuery && document.documentElement.dataset.evaluationSearchQueryPending === normalizedQuery) {
      event.stopImmediatePropagation();
      renderEvaluationMessage("Searching…");
    }
  }

  function focusSearchInput(selectText = false) {
    const modal = searchModal();
    const input = searchInput();
    if (destroyed || !modal || modal.hidden || !input) return false;
    input.focus({ preventScroll: true });
    if (selectText) input.select();
    return document.activeElement === input;
  }

  function restoreSearchFocusIfNeeded() {
    const modal = searchModal();
    const input = searchInput();
    if (!destroyed && modal && !modal.hidden && input && document.activeElement !== input) focusSearchInput(false);
  }

  function focusAndSelectSearch() {
    if (destroyed) return;
    if (focusFrame) cancelAnimationFrame(focusFrame);
    if (focusSettleTimer) clearTimeout(focusSettleTimer);
    focusSearchInput(true);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = 0;
      restoreSearchFocusIfNeeded();
    });
    focusSettleTimer = window.setTimeout(() => {
      focusSettleTimer = 0;
      restoreSearchFocusIfNeeded();
    }, 80);
  }

  function observeSearchModal() {
    const modal = searchModal();
    if (!modal) return;
    modalObserver?.disconnect();
    modalObserver = new MutationObserver(() => {
      if (!modal.hidden) focusAndSelectSearch();
    });
    modalObserver.observe(modal, { attributes: true, attributeFilter: ["hidden"] });
  }

  function onReady() {
    installCoreSearchMatching();
    flushPendingPayload();
    flushPendingEvaluationPayload();
  }

  document.addEventListener("input", onInput, true);
  document.addEventListener("input", onEvaluationInput, true);
  document.addEventListener("focus", onEvaluationFocus, true);
  window.addEventListener("mfl:ready", onReady);
  observeSearchModal();
  if (document.documentElement.dataset.mflReady === "true") onReady();
  document.documentElement.dataset.globalSearchAuthoritative = "true";
  document.documentElement.dataset.evaluationSearchAuthoritative = "true";
  window.__mflGlobalSearchReadyPromise = Promise.resolve(true);

  function destroy() {
    destroyed = true;
    clearGlobalRequest();
    clearEvaluationRequest();
    modalObserver?.disconnect();
    modalObserver = null;
    if (focusFrame) cancelAnimationFrame(focusFrame);
    if (focusSettleTimer) clearTimeout(focusSettleTimer);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("input", onEvaluationInput, true);
    document.removeEventListener("focus", onEvaluationFocus, true);
    window.removeEventListener("mfl:ready", onReady);
  }

  window.__mflGlobalSearchRuntime = Object.freeze({
    version: VERSION,
    search: searchDatabase,
    searchEvaluation: searchEvaluationDatabase,
    cap() {},
    flush: flushPendingPayload,
    flushEvaluation: flushPendingEvaluationPayload,
    focus: focusAndSelectSearch,
    destroy,
  });
})();
