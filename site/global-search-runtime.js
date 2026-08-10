(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.26");
  const MAX_RESULT_BOXES = 5;
  const previous = window.__mflGlobalSearchRuntime;
  previous?.destroy?.();

  let controller = null;
  let sequence = 0;
  let destroyed = false;
  let resultsObserver = null;
  let observedResults = null;

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

  function applyPayload(payload) {
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
    renderCurrentResults();
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
      applyPayload(payload);
      return true;
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error?.message || "Could not search the database.");
      }
      return false;
    } finally {
      if (controller === activeController) controller = null;
    }
  }

  function onInput(event) {
    const input = searchInput();
    if (!input || event.target !== input) return;

    // Typed global search is the authoritative owner of non-empty queries. Do
    // not let the recent-results handler reuse its five cached items as the
    // search universe while the full database request is in flight.
    event.stopImmediatePropagation();
    const query = String(input.value || "").trim();

    if (!query) {
      sequence += 1;
      controller?.abort();
      controller = null;
      renderCurrentResults();
      return;
    }

    // Preserve the existing real-time feel by filtering whatever index is
    // already available immediately; the authoritative full-database payload
    // replaces it as soon as the network request resolves.
    renderCurrentResults();
    void searchDatabase(query);
  }

  document.addEventListener("input", onInput, true);
  observeResultBoxes();

  function destroy() {
    destroyed = true;
    sequence += 1;
    controller?.abort();
    controller = null;
    resultsObserver?.disconnect();
    resultsObserver = null;
    observedResults = null;
    document.removeEventListener("input", onInput, true);
  }

  window.__mflGlobalSearchRuntime = Object.freeze({
    version: VERSION,
    search: searchDatabase,
    cap: capResultBoxes,
    destroy,
  });
})();
