(() => {
  "use strict";

  const PLAYER_LABEL_STORAGE_PREFIX = "mfl-evaluation-player-label-v1:";
  const LEGACY_RECENT_STORAGE_KEY = "mfl-recent-evaluation-searches-v1";
  const TABLE_STATE_STORAGE_KEY = "mfl-table-filters-v1";
  const RECENT_ENTRIES_KEY = "__mflEvaluationSupabaseRecentEntries";
  window.__mflEvaluationSearchStateRuntime?.destroy?.();

  let destroyed = false;
  let syncing = false;
  let resultsObserver = null;
  let recentPrimePromise = null;
  let recentPayload = null;
  let recentPayloadSignature = "";

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
    return active();
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

  function purgeLegacyLocalRecentState() {
    try {
      localStorage.removeItem(LEGACY_RECENT_STORAGE_KEY);
      const savedState = JSON.parse(localStorage.getItem(TABLE_STATE_STORAGE_KEY) || "null");
      if (!savedState || typeof savedState !== "object" || Array.isArray(savedState)
        || !("recentEvaluationPlayerIds" in savedState)) return;
      delete savedState.recentEvaluationPlayerIds;
      localStorage.setItem(TABLE_STATE_STORAGE_KEY, JSON.stringify(savedState));
    } catch {
      // Supabase remains authoritative even when browser storage cannot be cleaned.
    }
  }

  function onLegacyRecentStorage(event) {
    if (event.key !== LEGACY_RECENT_STORAGE_KEY) return;
    try {
      localStorage.removeItem(LEGACY_RECENT_STORAGE_KEY);
    } catch {
      // The core bridge already ignores this key when storage is unavailable.
    }
  }

  function recentEvaluationPlayerIds() {
    try {
      const ids = window.eval(
        "typeof state === 'object' && Array.isArray(state.recentEvaluationPlayerIds) ? [...state.recentEvaluationPlayerIds] : []",
      );
      return Array.isArray(ids)
        ? ids.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 5)
        : [];
    } catch {
      return [];
    }
  }

  function buildRecentEntries(payload) {
    window.__mflEvaluationSupabaseRecentPayload = payload;
    try {
      const entries = window.eval(`(() => {
        const payload = window.__mflEvaluationSupabaseRecentPayload || {};
        const columns = Array.isArray(payload.columns) ? payload.columns : [];
        const rows = Array.isArray(payload.rows) ? payload.rows : [];
        if (typeof buildPlayerSearchEntryFromCompactRow !== "function") return [];
        return rows
          .map((row) => buildPlayerSearchEntryFromCompactRow(row, columns))
          .filter((entry) => entry && !entry.retired);
      })()`);
      return Array.isArray(entries) ? entries : [];
    } catch (error) {
      console.warn("Could not build Supabase Evaluation recent entries.", error);
      return [];
    } finally {
      delete window.__mflEvaluationSupabaseRecentPayload;
    }
  }

  function installCoreRecentRowsBridge() {
    try {
      window.eval(`(() => {
        if (typeof recentEvaluationRows !== "function") return false;
        if (recentEvaluationRows.__mflSupabaseOnly) return true;
        const supabaseRecentRows = function() {
          const entries = window.${RECENT_ENTRIES_KEY};
          return Array.isArray(entries) ? entries.slice(0, 5) : [];
        };
        Object.defineProperty(supabaseRecentRows, "__mflSupabaseOnly", { value: true });
        recentEvaluationRows = supabaseRecentRows;
        return true;
      })()`);
    } catch (error) {
      console.warn("Could not isolate Supabase Evaluation recent rows.", error);
    }
  }

  function installEmptyPlayerSearchBridge() {
    try {
      window.eval(`(() => {
        if (typeof requestDatabaseSearch !== "function") return false;
        if (requestDatabaseSearch.__mflEvaluationSupabaseOnly) return true;
        const originalRequestDatabaseSearch = requestDatabaseSearch;
        const supabaseOnlyRequestDatabaseSearch = function(rawQuery = "", type = "all", options = {}) {
          if (type === "players" && !String(rawQuery || "").trim()) {
            const restore = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
            return typeof restore === "function"
              ? restore(Boolean(options?.force))
              : Promise.resolve(false);
          }
          return originalRequestDatabaseSearch.apply(this, arguments);
        };
        Object.defineProperty(supabaseOnlyRequestDatabaseSearch, "__mflEvaluationSupabaseOnly", { value: true });
        requestDatabaseSearch = supabaseOnlyRequestDatabaseSearch;
        return true;
      })()`);
    } catch (error) {
      console.warn("Could not isolate empty Evaluation searches from generic recents.", error);
    }
  }

  function publishRecentPayload(payload) {
    const entries = buildRecentEntries(payload);
    window[RECENT_ENTRIES_KEY] = entries;
    installCoreRecentRowsBridge();
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

  async function fetchRecentEvaluationPayload(ids) {
    if (!ids.length) return { columns: [], rows: [] };

    const payloads = await Promise.all(ids.map(async (id) => {
      const url = new URL("/api/data", window.location.origin);
      url.searchParams.set("mode", "search");
      url.searchParams.set("type", "players");
      url.searchParams.set("q", id);
      url.searchParams.set("limit", "5");
      try {
        const response = await fetch(url.toString(), {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        return response.ok ? response.json() : null;
      } catch {
        return null;
      }
    }));

    let columns = [];
    const rowsById = new Map();
    payloads.forEach((payload, index) => {
      const payloadColumns = Array.isArray(payload?.columns) ? payload.columns : [];
      const payloadRows = Array.isArray(payload?.rows) ? payload.rows : [];
      const idIndex = payloadColumns.indexOf("player_id");
      if (idIndex < 0) return;
      if (!columns.length) columns = payloadColumns;
      const expectedId = ids[index];
      const exact = payloadRows.find((row) => Array.isArray(row) && String(row[idIndex]) === expectedId);
      if (exact) rowsById.set(expectedId, exact);
    });

    return {
      columns,
      rows: ids.map((id) => rowsById.get(id)).filter(Boolean),
    };
  }

  function primeRecentSearchData({ force = false } = {}) {
    const ids = recentEvaluationPlayerIds();
    const signature = ids.join(",");

    if (!force && recentPayload && recentPayloadSignature === signature) {
      publishRecentPayload(recentPayload);
      renderEmptySearchFromCore();
      return Promise.resolve(true);
    }
    if (recentPrimePromise && recentPayloadSignature === signature) return recentPrimePromise;

    recentPayloadSignature = signature;
    recentPrimePromise = fetchRecentEvaluationPayload(ids)
      .then((payload) => {
        if (destroyed || recentPayloadSignature !== signature) return false;
        recentPayload = payload;
        publishRecentPayload(payload);
        renderEmptySearchFromCore();
        return true;
      })
      .catch((error) => {
        console.warn("Could not prime recent Evaluation searches.", error);
        return false;
      })
      .finally(() => {
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
    installCoreRecentRowsBridge();
    installEmptyPlayerSearchBridge();
    syncSelectedPlayerLabel(field);
    syncClearButton(field);

    const query = normalize(field.value);
    if (query && document.documentElement.dataset.evaluationSearchQueryPending === query) {
      showSearching(container);
    } else if (!query) {
      const ids = recentEvaluationPlayerIds();
      const signature = ids.join(",");
      if (recentPayload && recentPayloadSignature === signature) {
        publishRecentPayload(recentPayload);
        renderEmptySearchFromCore();
      } else {
        void primeRecentSearchData();
      }
    }

    requestAnimationFrame(() => { syncing = false; });
  }

  function restoreEmptyRecentResults(force = false) {
    const field = input();
    if (!active() || !(field instanceof HTMLInputElement) || field.value.trim()) return Promise.resolve(false);
    return primeRecentSearchData({ force }).finally(() => queueMicrotask(sync));
  }

  function onReady() {
    void restoreEmptyRecentResults(true);
  }

  function onBlur(event) {
    if (event.target !== input()) return;
    const field = input();
    syncClearButton(field);

    const container = results();
    if (!(container instanceof HTMLElement)) return;
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;

    if (!field.value.trim()) {
      void restoreEmptyRecentResults();
    }
  }

  function onKeyUp(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement) || event.target !== field) return;
    syncClearButton(field);
    if (field.value.trim()) return;
    void restoreEmptyRecentResults();
  }

  function onClick(event) {
    if (!(event.target instanceof Element)) return;

    const clear = event.target.closest("#evaluationSearchClearButton");
    if (clear instanceof HTMLButtonElement) {
      void restoreEmptyRecentResults(true);
      return;
    }

    const result = event.target.closest("#evaluationSearchResults .evaluationSearchResult");
    if (!(result instanceof HTMLButtonElement) || result.disabled) return;
    rememberClickedSearch(result);
    queueMicrotask(() => { void primeRecentSearchData({ force: true }); });
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

      if (!field.value.trim()) {
        queueMicrotask(sync);
        return;
      }

      syncSelectedPlayerLabel(field);
    });
    resultsObserver.observe(container, { childList: true, attributes: true, attributeFilter: ["hidden"] });
    if (button instanceof HTMLButtonElement) {
      resultsObserver.observe(button, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  purgeLegacyLocalRecentState();
  installRecentRule();
  installCoreRecentRowsBridge();
  installEmptyPlayerSearchBridge();
  syncClearButton();
  input()?.addEventListener("blur", onBlur, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("storage", onLegacyRecentStorage, true);
  window.addEventListener("mfl:evaluation-ready", onReady);
  window.addEventListener("mfl:ready", onReady);
  window.addEventListener("pageshow", onReady);
  installObserver();
  void restoreEmptyRecentResults(true);
  sync();

  function destroy() {
    destroyed = true;
    resultsObserver?.disconnect();
    resultsObserver = null;
    input()?.removeEventListener("blur", onBlur, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("storage", onLegacyRecentStorage, true);
    window.removeEventListener("mfl:evaluation-ready", onReady);
    window.removeEventListener("mfl:ready", onReady);
    window.removeEventListener("pageshow", onReady);
    recentPrimePromise = null;
    recentPayload = null;
    recentPayloadSignature = "";
    delete window[RECENT_ENTRIES_KEY];
    if (originalRecentRule && window.shouldShowEvaluationRecentResults === recentRule) {
      window.shouldShowEvaluationRecentResults = originalRecentRule;
    }
  }

  window.__mflEvaluationSearchStateRuntime = Object.freeze({ sync, restoreEmptyRecentResults, destroy });
})();
