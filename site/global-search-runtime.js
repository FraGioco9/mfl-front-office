(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.24");
  const previous = window.__mflGlobalSearchRuntime;
  previous?.destroy?.();

  let controller = null;
  let sequence = 0;
  let destroyed = false;

  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  function searchInput() {
    const input = document.getElementById("playerSearchInput");
    return input instanceof HTMLInputElement ? input : null;
  }

  function renderCurrentResults() {
    try {
      if (typeof window.renderSearchResultsNow === "function") {
        window.renderSearchResultsNow();
        return;
      }
      window.eval("if (typeof renderSearchResultsNow === 'function') renderSearchResultsNow();");
    } catch (error) {
      console.warn("Could not render global search results.", error);
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

  async function searchThroughLegacyPipeline(query, normalizedQuery, requestSequence) {
    const input = searchInput();
    if (!input) return null;

    window.__mflGlobalSearchQuery = query;
    let result;
    try {
      result = window.eval(`
        typeof requestDatabaseSearch === "function"
          ? requestDatabaseSearch(window.__mflGlobalSearchQuery, "all", { force: true })
          : null
      `);
    } catch {
      return null;
    } finally {
      delete window.__mflGlobalSearchQuery;
    }

    if (!result || typeof result.then !== "function") return null;

    try {
      const loaded = await result;
      if (destroyed || requestSequence !== sequence || normalize(input.value) !== normalizedQuery) return false;
      if (loaded) renderCurrentResults();
      return Boolean(loaded);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error?.message || "Could not search the database.");
      }
      return false;
    }
  }

  async function searchDatabase(rawQuery) {
    const query = String(rawQuery || "").trim();
    const normalizedQuery = normalize(query);
    const input = searchInput();
    if (!input || !normalizedQuery) return false;

    const requestSequence = ++sequence;

    // Use the legacy database-search pipeline when available. It owns the same
    // abort controller/sequence as the startup recent-results request, so a
    // typed query cancels that older request instead of letting it overwrite
    // the complete players / clubs / agents results after they arrive.
    const legacyResult = await searchThroughLegacyPipeline(query, normalizedQuery, requestSequence);
    if (legacyResult !== null) return legacyResult;

    controller?.abort();
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

    // Own typed global-search requests so the recent-result bootstrap cannot
    // answer a typed query or race a complete players / clubs / agents search.
    event.stopImmediatePropagation();
    const query = String(input.value || "").trim();
    renderCurrentResults();

    if (!query) {
      sequence += 1;
      controller?.abort();
      controller = null;
      return;
    }
    void searchDatabase(query);
  }

  document.addEventListener("input", onInput, true);

  function destroy() {
    destroyed = true;
    sequence += 1;
    controller?.abort();
    controller = null;
    document.removeEventListener("input", onInput, true);
  }

  window.__mflGlobalSearchRuntime = Object.freeze({
    version: VERSION,
    search: searchDatabase,
    destroy,
  });
})();
