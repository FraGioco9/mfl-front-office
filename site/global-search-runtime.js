(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  const MAX_RESULT_BOXES = 5;
  const previous = window.__mflGlobalSearchRuntime;
  previous?.destroy?.();
  window.__mflSearchResultClickRuntime?.destroy?.();

  let controller = null;
  let sequence = 0;
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

  function syncClearButton() {
    const input = searchInput();
    const button = document.getElementById("playerSearchClearButton");
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

  function capResultBoxes() {
    const results = searchResults();
    if (!results) return;
    Array.from(results.querySelectorAll(":scope > .searchResult"))
      .slice(MAX_RESULT_BOXES)
      .forEach((result) => result.remove());
  }

  function observeResultBoxes() {
    const results = searchResults();
    if (!results || results === observedResults) return;
    resultsObserver?.disconnect();
    observedResults = results;
    resultsObserver = new MutationObserver(capResultBoxes);
    resultsObserver.observe(results, { childList: true });
    capResultBoxes();
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
      capResultBoxes();
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

  document.addEventListener("input", onInput, true);
  window.addEventListener("mfl:ready", flushPendingPayload);
  observeResultBoxes();
  observeSearchModal();
  document.documentElement.dataset.globalSearchAuthoritative = "true";
  window.__mflGlobalSearchReadyPromise = Promise.resolve(true);

  function destroy() {
    destroyed = true;
    sequence += 1;
    controller?.abort();
    controller = null;
    pendingPayload = null;
    pendingQuery = "";
    pendingFlushAttempts = 0;
    if (pendingFlushTimer) window.clearTimeout(pendingFlushTimer);
    pendingFlushTimer = 0;
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
    document.removeEventListener("input", onInput, true);
    window.removeEventListener("mfl:ready", flushPendingPayload);
  }

  window.__mflGlobalSearchRuntime = Object.freeze({
    version: VERSION,
    search: searchDatabase,
    cap: capResultBoxes,
    flush: flushPendingPayload,
    focus: focusAndSelectSearch,
    destroy,
  });
})();
