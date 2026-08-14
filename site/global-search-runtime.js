(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  const MAX_RESULT_BOXES = 5;
  const previous = window.__mflGlobalSearchRuntime;
  previous?.destroy?.();

  let controller = null;
  let sequence = 0;
  let evaluationController = null;
  let evaluationSequence = 0;
  let destroyed = false;
  let resultsObserver = null;
  let observedResults = null;
  let modalObserver = null;
  let focusFrame = 0;
  let focusSettleTimer = 0;
  let pendingPayload = null;
  let pendingQuery = "";
  let pendingFlushTimer = 0;
  let pendingFlushAttempts = 0;
  let pendingEvaluationPayload = null;
  let pendingEvaluationQuery = "";
  let pendingEvaluationFlushTimer = 0;
  let pendingEvaluationFlushAttempts = 0;
  let canonicalSearchCaptured = false;
  let canonicalSearchArmed = document.documentElement.dataset.mflReady === "true";
  let canonicalSearchResults = [];

  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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

  function currentSearchButtons() {
    const results = searchResults();
    if (!results) return [];
    return Array.from(results.querySelectorAll(":scope > .searchResult"))
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, MAX_RESULT_BOXES);
  }

  function searchResultKey(button) {
    if (!(button instanceof HTMLButtonElement)) return "";
    const key = String(button.dataset.searchKey || "").trim().toLowerCase();
    return key || normalize(button.textContent);
  }

  function prependCanonicalSearchResult(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const key = searchResultKey(button);
    if (!key) return;
    canonicalSearchResults = [
      button,
      ...canonicalSearchResults.filter((candidate) => searchResultKey(candidate) !== key),
    ].slice(0, MAX_RESULT_BOXES);
  }

  function syncCanonicalSearchResults() {
    const input = searchInput();
    const results = searchResults();
    if (!input || !results) return;

    if (!canonicalSearchCaptured && canonicalSearchArmed && !input.value.trim()) {
      const rendered = currentSearchButtons();
      if (rendered.length) {
        canonicalSearchResults = rendered;
        canonicalSearchCaptured = true;
      }
      return;
    }

    if (!canonicalSearchCaptured || input.value.trim()) return;

    queueMicrotask(() => {
      if (destroyed || input.value.trim() || !canonicalSearchResults.length) return;
      const current = Array.from(results.children);
      const alreadyCanonical = current.length === canonicalSearchResults.length
        && current.every((node, index) => node === canonicalSearchResults[index]);
      if (alreadyCanonical) return;
      results.replaceChildren(...canonicalSearchResults);
      results.classList.toggle("filledSearchResults", canonicalSearchResults.length > 0);
    });
  }

  function onSearchResultClick(event) {
    if (!canonicalSearchCaptured || !(event.target instanceof Element)) return;
    const button = event.target.closest("#playerSearchResults .searchResult");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    prependCanonicalSearchResult(button);
  }

  function armCanonicalSearchResults() {
    canonicalSearchArmed = true;
    syncCanonicalSearchResults();
  }

  function capResultBoxes() {
    const results = searchResults();
    if (!results) return;
    Array.from(results.querySelectorAll(":scope > .searchResult"))
      .slice(MAX_RESULT_BOXES)
      .forEach((result) => result.remove());
  }

  function syncResultBoxes() {
    capResultBoxes();
    syncCanonicalSearchResults();
  }

  function observeResultBoxes() {
    const results = searchResults();
    if (!results || results === observedResults) return;
    resultsObserver?.disconnect();
    observedResults = results;
    resultsObserver = new MutationObserver(syncResultBoxes);
    resultsObserver.observe(results, { childList: true });
    syncResultBoxes();
  }

  function renderCurrentResults() {
    try {
      if (typeof window.renderSearchResultsNow === "function") {
        window.renderSearchResultsNow();
      } else {
        window.eval("if (typeof renderSearchResultsNow === 'function') renderSearchResultsNow();");
      }
    } catch (error) {
      console.warn("Could not render global search results.", error);
    } finally {
      observeResultBoxes();
      syncResultBoxes();
    }
  }

  function renderCurrentEvaluationResults() {
    try {
      if (typeof window.renderEvaluationSearchResults === "function") {
        window.renderEvaluationSearchResults();
      } else {
        window.eval("if (typeof renderEvaluationSearchResults === 'function') renderEvaluationSearchResults();");
      }
    } catch (error) {
      console.warn("Could not render Evaluation search results.", error);
    }
  }

  function resetEvaluationSelection() {
    try {
      if (typeof window.resetEvaluationSelection === "function") {
        window.resetEvaluationSelection();
      } else {
        window.eval("if (typeof resetEvaluationSelection === 'function') resetEvaluationSelection();");
      }
    } catch (error) {
      console.warn("Could not reset Evaluation selection.", error);
    }
  }

  function legacyPayloadApplierReady() {
    if (typeof window.applyDatabaseSearchPayload === "function") return true;
    try {
      return Boolean(window.eval("typeof applyDatabaseSearchPayload === 'function'"));
    } catch {
      return false;
    }
  }

  function schedulePendingFlush() {
    if (destroyed || !pendingPayload || pendingFlushTimer || pendingFlushAttempts >= 20) return;
    pendingFlushAttempts += 1;
    pendingFlushTimer = window.setTimeout(() => {
      pendingFlushTimer = 0;
      if (!flushPendingPayload() && pendingPayload) schedulePendingFlush();
    }, 50);
  }

  function schedulePendingEvaluationFlush() {
    if (destroyed || !pendingEvaluationPayload || pendingEvaluationFlushTimer
      || pendingEvaluationFlushAttempts >= 20) return;
    pendingEvaluationFlushAttempts += 1;
    pendingEvaluationFlushTimer = window.setTimeout(() => {
      pendingEvaluationFlushTimer = 0;
      if (!flushPendingEvaluationPayload() && pendingEvaluationPayload) schedulePendingEvaluationFlush();
    }, 50);
  }

  function applyPayload(payload, normalizedQuery = "") {
    if (!legacyPayloadApplierReady()) {
      pendingPayload = payload;
      pendingQuery = normalizedQuery;
      pendingFlushAttempts = 0;
      schedulePendingFlush();
      return false;
    }

    window.__mflAuthoritativeGlobalSearchPayload = payload;
    try {
      if (typeof window.applyDatabaseSearchPayload === "function") {
        window.applyDatabaseSearchPayload(payload, "all");
      } else {
        window.eval("if (typeof applyDatabaseSearchPayload === 'function') applyDatabaseSearchPayload(window.__mflAuthoritativeGlobalSearchPayload, 'all');");
      }
    } finally {
      delete window.__mflAuthoritativeGlobalSearchPayload;
    }
    pendingPayload = null;
    pendingQuery = "";
    pendingFlushAttempts = 0;
    if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
    pendingFlushTimer = 0;
    renderCurrentResults();
    finishSearching(normalizedQuery);
    return true;
  }

  function applyEvaluationPayload(payload, normalizedQuery = "") {
    if (!legacyPayloadApplierReady()) {
      pendingEvaluationPayload = payload;
      pendingEvaluationQuery = normalizedQuery;
      pendingEvaluationFlushAttempts = 0;
      schedulePendingEvaluationFlush();
      return false;
    }

    window.__mflAuthoritativeEvaluationSearchPayload = payload;
    try {
      if (typeof window.applyDatabaseSearchPayload === "function") {
        window.applyDatabaseSearchPayload(payload, "players");
      } else {
        window.eval("if (typeof applyDatabaseSearchPayload === 'function') applyDatabaseSearchPayload(window.__mflAuthoritativeEvaluationSearchPayload, 'players');");
      }
    } finally {
      delete window.__mflAuthoritativeEvaluationSearchPayload;
    }
    pendingEvaluationPayload = null;
    pendingEvaluationQuery = "";
    pendingEvaluationFlushAttempts = 0;
    if (pendingEvaluationFlushTimer) window.clearTimeout(pendingEvaluationFlushTimer);
    pendingEvaluationFlushTimer = 0;
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
      pendingFlushAttempts = 0;
      if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
      pendingFlushTimer = 0;
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
      pendingEvaluationFlushAttempts = 0;
      if (pendingEvaluationFlushTimer) window.clearTimeout(pendingEvaluationFlushTimer);
      pendingEvaluationFlushTimer = 0;
      return false;
    }
    return applyEvaluationPayload(pendingEvaluationPayload, pendingEvaluationQuery);
  }

  function invalidateLegacyAllSearch() {
    try {
      window.eval(`(() => {
        if (typeof databaseSearchAbortControllers !== "undefined") {
          databaseSearchAbortControllers.get("all")?.abort?.();
        }
        if (typeof databaseSearchSequences !== "undefined") {
          databaseSearchSequences.set("all", (databaseSearchSequences.get("all") || 0) + 1);
        }
      })();`);
    } catch {
      // Typed search remains authoritative through its own request sequence even
      // if a future core stops exposing the legacy search coordination bindings.
    }
  }

  function invalidateLegacyEvaluationSearch() {
    try {
      window.eval(`(() => {
        if (typeof databaseSearchAbortControllers !== "undefined") {
          databaseSearchAbortControllers.get("players")?.abort?.();
        }
        if (typeof databaseSearchSequences !== "undefined") {
          databaseSearchSequences.set("players", (databaseSearchSequences.get("players") || 0) + 1);
        }
      })();`);
    } catch {
      // Evaluation typed search remains authoritative through its own sequence.
    }
  }

  async function searchDatabase(rawQuery) {
    const query = String(rawQuery || "").trim();
    const normalizedQuery = normalize(query);
    const input = searchInput();
    if (!input || !normalizedQuery) return false;

    const requestSequence = ++sequence;
    controller?.abort();
    invalidateLegacyAllSearch();
    controller = new AbortController();
    const activeController = controller;
    const parameters = new URLSearchParams({
      mode: "search",
      type: "all",
      limit: "20",
      q: query,
      v: VERSION,
    });

    // Never expose partial results from a previous query or from the currently
    // loaded local indexes. A typed query has one authoritative database result.
    markSearching(normalizedQuery);
    try {
      const response = await fetch(`/api/data?${parameters}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
        signal: activeController.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not search the database.");
      if (destroyed || requestSequence !== sequence || normalize(input.value) !== normalizedQuery) return false;
      applyPayload(payload, normalizedQuery);
      return true;
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
    const query = String(rawQuery || "").trim();
    const normalizedQuery = normalize(query);
    const input = evaluationInput();
    if (!input || !normalizedQuery) return false;

    const requestSequence = ++evaluationSequence;
    evaluationController?.abort();
    invalidateLegacyEvaluationSearch();
    evaluationController = new AbortController();
    const activeController = evaluationController;
    const parameters = new URLSearchParams({
      mode: "search",
      type: "players",
      limit: "20",
      q: query,
      v: VERSION,
    });

    // Evaluation follows the same all-at-once lifecycle as global search: no
    // previously loaded player matches are visible while SQLite is searching.
    markEvaluationSearching(normalizedQuery);
    try {
      const response = await fetch(`/api/data?${parameters}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
        signal: activeController.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not search players.");
      if (destroyed || requestSequence !== evaluationSequence
        || normalize(input.value) !== normalizedQuery) return false;
      applyEvaluationPayload(payload, normalizedQuery);
      return true;
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error?.message || "Could not search players.");
        if (!destroyed && requestSequence === evaluationSequence
          && normalize(input.value) === normalizedQuery) {
          renderEvaluationMessage("Could not search.");
          finishEvaluationSearching(normalizedQuery);
        }
      }
      return false;
    } finally {
      if (evaluationController === activeController) evaluationController = null;
    }
  }

  function onInput(event) {
    const input = searchInput();
    if (!input || event.target !== input) return;

    // Typed global search owns the request and rendering lifecycle so every
    // non-empty query is shown only after the complete database result arrives.
    event.stopImmediatePropagation();
    const query = String(input.value || "").trim();

    if (!query) {
      sequence += 1;
      controller?.abort();
      controller = null;
      pendingPayload = null;
      pendingQuery = "";
      pendingFlushAttempts = 0;
      if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
      pendingFlushTimer = 0;
      delete document.documentElement.dataset.globalSearchQueryPending;
      syncClearButton();
      renderCurrentResults();
      return;
    }

    void searchDatabase(query);
  }

  function onEvaluationInput(event) {
    const input = evaluationInput();
    if (!input || event.target !== input) return;

    // Suppress the legacy immediate local-index render and its duplicate
    // request. Evaluation exposes only the completed authoritative response.
    event.stopImmediatePropagation();
    const query = String(input.value || "").trim();

    if (!query) {
      evaluationSequence += 1;
      evaluationController?.abort();
      evaluationController = null;
      pendingEvaluationPayload = null;
      pendingEvaluationQuery = "";
      pendingEvaluationFlushAttempts = 0;
      if (pendingEvaluationFlushTimer) window.clearTimeout(pendingEvaluationFlushTimer);
      pendingEvaluationFlushTimer = 0;
      delete document.documentElement.dataset.evaluationSearchQueryPending;
      syncEvaluationClearButton();
      resetEvaluationSelection();
      renderCurrentEvaluationResults();
      return;
    }

    void searchEvaluationDatabase(query);
  }

  function onEvaluationFocus(event) {
    const input = evaluationInput();
    if (!input || event.target !== input) return;
    const normalizedQuery = normalize(input.value);
    if (!normalizedQuery
      || document.documentElement.dataset.evaluationSearchQueryPending !== normalizedQuery) return;
    event.stopImmediatePropagation();
    renderEvaluationMessage("Searching…");
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
    if (!destroyed && modal && !modal.hidden && input && document.activeElement !== input) {
      focusSearchInput(false);
    }
  }

  function focusAndSelectSearch() {
    if (destroyed) return;
    if (focusFrame) cancelAnimationFrame(focusFrame);
    if (focusSettleTimer) window.clearTimeout(focusSettleTimer);

    // Select exactly once when the modal becomes visible. Follow-up passes may
    // restore stolen focus, but never reselect after the user begins typing.
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
    // Opening/closing is owned by the hidden attribute. Do not observe the
    // animation class, because it changes after opening and would reselect text.
    modalObserver.observe(modal, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }

  document.addEventListener("click", onSearchResultClick, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("input", onEvaluationInput, true);
  document.addEventListener("focus", onEvaluationFocus, true);
  window.addEventListener("mfl:ready", armCanonicalSearchResults);
  window.addEventListener("mfl:ready", flushPendingPayload);
  window.addEventListener("mfl:ready", flushPendingEvaluationPayload);
  observeResultBoxes();
  observeSearchModal();
  if (canonicalSearchArmed) syncCanonicalSearchResults();
  document.documentElement.dataset.globalSearchAuthoritative = "true";
  document.documentElement.dataset.evaluationSearchAuthoritative = "true";
  window.__mflGlobalSearchReadyPromise = Promise.resolve(true);

  function destroy() {
    destroyed = true;
    sequence += 1;
    evaluationSequence += 1;
    controller?.abort();
    controller = null;
    evaluationController?.abort();
    evaluationController = null;
    pendingPayload = null;
    pendingQuery = "";
    pendingFlushAttempts = 0;
    pendingEvaluationPayload = null;
    pendingEvaluationQuery = "";
    pendingEvaluationFlushAttempts = 0;
    canonicalSearchCaptured = false;
    canonicalSearchResults = [];
    if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
    pendingFlushTimer = 0;
    if (pendingEvaluationFlushTimer) window.clearTimeout(pendingEvaluationFlushTimer);
    pendingEvaluationFlushTimer = 0;
    resultsObserver?.disconnect();
    resultsObserver = null;
    observedResults = null;
    modalObserver?.disconnect();
    modalObserver = null;
    if (focusFrame) cancelAnimationFrame(focusFrame);
    focusFrame = 0;
    if (focusSettleTimer) window.clearTimeout(focusSettleTimer);
    focusSettleTimer = 0;
    delete document.documentElement.dataset.globalSearchQueryPending;
    delete document.documentElement.dataset.evaluationSearchQueryPending;
    document.removeEventListener("click", onSearchResultClick, true);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("input", onEvaluationInput, true);
    document.removeEventListener("focus", onEvaluationFocus, true);
    window.removeEventListener("mfl:ready", armCanonicalSearchResults);
    window.removeEventListener("mfl:ready", flushPendingPayload);
    window.removeEventListener("mfl:ready", flushPendingEvaluationPayload);
  }

  window.__mflGlobalSearchRuntime = Object.freeze({
    version: VERSION,
    search: searchDatabase,
    searchEvaluation: searchEvaluationDatabase,
    cap: capResultBoxes,
    flush: flushPendingPayload,
    flushEvaluation: flushPendingEvaluationPayload,
    focus: focusAndSelectSearch,
    destroy,
  });
})();