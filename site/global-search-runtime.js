(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  const MAX_GLOBAL_SEARCH_RESULTS = 10;
  const MAX_RECENT_GLOBAL_SEARCH_RESULTS = 5;
  const TABLE_STATE_STORAGE_KEY = "mfl-table-filters-v1";
  const GLOBAL_RECENT_STORAGE_KEYS = new Set([
    "mfl-recent-player-searches-v1",
    "mfl-recent-agent-searches-v1",
    "mfl-recent-searches-v1",
  ]);
  window.__mflGlobalSearchRuntime?.destroy?.();

  let controller = null;
  let sequence = 0;
  let recentController = null;
  let recentSequence = 0;
  let recentLoadPromise = null;
  let recentLoadedForOpen = false;
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
  let originalLoadRecentIdsFromStorage = null;
  let originalSaveRecentIdsToStorage = null;
  let originalSaveTableStateLocally = null;
  let localRecentStateCleared = false;

  const normalize = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  function windowFunction(name) {
    const fn = Reflect.get(window, name);
    return typeof fn === "function" ? fn : null;
  }

  function coreContracts() {
    const contracts = Reflect.get(window, "__mflCoreContracts");
    return contracts && typeof contracts === "object" ? contracts : null;
  }

  function installCoreSearchMatching() {
    const install = coreContracts()?.installSearchMatching;
    return typeof install === "function" ? Boolean(install()) : false;
  }

  function stripGlobalRecentFields(savedState) {
    if (!savedState || typeof savedState !== "object" || Array.isArray(savedState)) return savedState;
    const sanitized = { ...savedState };
    delete sanitized.recentSearchItems;
    delete sanitized.recentSearchPlayerIds;
    delete sanitized.recentSearchAgentWallets;
    return sanitized;
  }

  function purgeLocalGlobalSearchHistory() {
    try {
      GLOBAL_RECENT_STORAGE_KEYS.forEach((storageKey) => localStorage.removeItem(storageKey));
      const rawState = localStorage.getItem(TABLE_STATE_STORAGE_KEY);
      if (!rawState) return;
      const savedState = JSON.parse(rawState);
      const sanitizedState = stripGlobalRecentFields(savedState);
      if (JSON.stringify(savedState) !== JSON.stringify(sanitizedState)) {
        localStorage.setItem(TABLE_STATE_STORAGE_KEY, JSON.stringify(sanitizedState));
      }
    } catch {
      // Global Search still remains Supabase-only in memory when browser storage is unavailable.
    }
  }

  function installSupabaseOnlyRecentStorage() {
    const loadRecentIdsFromStorage = windowFunction("loadRecentIdsFromStorage");
    if (!originalLoadRecentIdsFromStorage && loadRecentIdsFromStorage) {
      originalLoadRecentIdsFromStorage = loadRecentIdsFromStorage;
      Reflect.set(window, "loadRecentIdsFromStorage", function loadNonGlobalRecentIds(storageKey) {
        if (GLOBAL_RECENT_STORAGE_KEYS.has(String(storageKey || ""))) return [];
        return originalLoadRecentIdsFromStorage.apply(this, arguments);
      });
    }

    const saveRecentIdsToStorage = windowFunction("saveRecentIdsToStorage");
    if (!originalSaveRecentIdsToStorage && saveRecentIdsToStorage) {
      originalSaveRecentIdsToStorage = saveRecentIdsToStorage;
      Reflect.set(window, "saveRecentIdsToStorage", function saveNonGlobalRecentIds(storageKey) {
        if (GLOBAL_RECENT_STORAGE_KEYS.has(String(storageKey || ""))) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            // Global Search history intentionally has no browser-storage fallback.
          }
          return;
        }
        return originalSaveRecentIdsToStorage.apply(this, arguments);
      });
    }

    const saveTableStateLocally = windowFunction("saveTableStateLocally");
    if (!originalSaveTableStateLocally && saveTableStateLocally) {
      originalSaveTableStateLocally = saveTableStateLocally;
      Reflect.set(window, "saveTableStateLocally", function saveTableStateWithoutGlobalRecents(savedState) {
        return originalSaveTableStateLocally.call(this, stripGlobalRecentFields(savedState));
      });
    }

    purgeLocalGlobalSearchHistory();
  }

  function restoreLocalRecentStorageOwners() {
    if (originalLoadRecentIdsFromStorage) {
      Reflect.set(window, "loadRecentIdsFromStorage", originalLoadRecentIdsFromStorage);
      originalLoadRecentIdsFromStorage = null;
    }
    if (originalSaveRecentIdsToStorage) {
      Reflect.set(window, "saveRecentIdsToStorage", originalSaveRecentIdsToStorage);
      originalSaveRecentIdsToStorage = null;
    }
    if (originalSaveTableStateLocally) {
      Reflect.set(window, "saveTableStateLocally", originalSaveTableStateLocally);
      originalSaveTableStateLocally = null;
    }
  }

  function clearLocalRecentStateOnce() {
    if (localRecentStateCleared) return;
    const restoreRecentSearchState = windowFunction("restoreRecentSearchState");
    if (!restoreRecentSearchState) return;
    restoreRecentSearchState({
      recentSearchItems: [],
      recentSearchPlayerIds: [],
      recentSearchAgentWallets: [],
    });
    localRecentStateCleared = true;
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
    if (!input || !(button instanceof HTMLElement)) return;
    const hidden = !input.value.trim();
    button.hidden = hidden;
    button.toggleAttribute("hidden", hidden);
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

  function normalizeSearchResults() {
    const input = searchInput();
    const results = searchResults();
    if (!input || !results) return;

    const hasQuery = Boolean(input.value.trim());
    const maxResults = hasQuery ? MAX_GLOBAL_SEARCH_RESULTS : MAX_RECENT_GLOBAL_SEARCH_RESULTS;
    const directResults = Array.from(results.querySelectorAll(":scope > .searchResult"));
    directResults.slice(maxResults).forEach((result) => result.remove());
    results.classList.toggle("filledSearchResults", !hasQuery && directResults.length > 0);
  }

  function normalizedSupabaseRecentItems(tableState) {
    const recentItems = Array.isArray(tableState?.recentSearchItems) ? tableState.recentSearchItems : [];
    const normalizedItems = [];

    recentItems.forEach((item) => {
      const key = String(item || "").trim();
      const valid = (key.startsWith("player:") && key.length > 7)
        || (key.startsWith("agent:") && key.length > 6)
        || (key.startsWith("club:") && key.length > 5);
      if (valid && !normalizedItems.includes(key)) normalizedItems.push(key);
    });

    if (normalizedItems.length) return normalizedItems.slice(0, MAX_RECENT_GLOBAL_SEARCH_RESULTS);

    const playerIds = Array.isArray(tableState?.recentSearchPlayerIds) ? tableState.recentSearchPlayerIds : [];
    const agentWallets = Array.isArray(tableState?.recentSearchAgentWallets) ? tableState.recentSearchAgentWallets : [];
    const legacyItems = [
      ...playerIds.map((playerId) => `player:${String(playerId || "").trim()}`),
      ...agentWallets.map((walletAddress) => `agent:${String(walletAddress || "").trim().toLowerCase()}`),
    ].filter((key) => key !== "player:" && key !== "agent:");

    return Array.from(new Set(legacyItems)).slice(0, MAX_RECENT_GLOBAL_SEARCH_RESULTS);
  }

  function applySupabaseRecentState(tableState) {
    const recentItems = normalizedSupabaseRecentItems(tableState);
    const recentPlayerIds = recentItems
      .filter((item) => item.startsWith("player:"))
      .map((item) => item.slice(7));
    const recentAgentWallets = recentItems
      .filter((item) => item.startsWith("agent:"))
      .map((item) => item.slice(6));

    windowFunction("restoreRecentSearchState")?.({
      recentSearchItems: recentItems,
      recentSearchPlayerIds,
      recentSearchAgentWallets,
    });
    return recentItems;
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
      normalizeSearchResults();
      syncClearButton();
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

  function clearRecentRequest(options = {}) {
    recentSequence += 1;
    recentController?.abort();
    recentController = null;
    recentLoadPromise = null;
    if (options.resetLoaded) recentLoadedForOpen = false;
  }

  async function restoreSupabaseRecentResults(options = {}) {
    const input = searchInput();
    if (!input || input.value.trim()) return false;

    const hasWalletProof = windowFunction("hasWalletProof");
    const walletProofHeaders = windowFunction("walletProofHeaders");
    if (!hasWalletProof || !walletProofHeaders || !hasWalletProof()) return false;

    if (options.force) recentLoadedForOpen = false;
    if (recentLoadedForOpen) {
      renderCurrentResults();
      return true;
    }
    if (recentLoadPromise) return recentLoadPromise;

    const requestSequence = ++recentSequence;
    recentController = new AbortController();
    const activeController = recentController;
    syncClearButton();
    renderSearchMessage("Loading recent searches…");

    const loadPromise = (async () => {
      try {
        const response = await fetch("/api/wallet-preferences", {
          cache: "no-store",
          headers: walletProofHeaders(true),
          signal: activeController.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Could not load recent searches.");
        if (destroyed || requestSequence !== recentSequence || searchInput()?.value.trim()) return false;

        applySupabaseRecentState(data?.tableState);
        if (destroyed || requestSequence !== recentSequence || searchInput()?.value.trim()) return false;

        recentLoadedForOpen = true;
        renderCurrentResults();
        return true;
      } catch (error) {
        if (error?.name !== "AbortError" && !destroyed && requestSequence === recentSequence) {
          console.warn("Could not load recent Global Search entries from Supabase.", error);
          renderSearchMessage("Could not load recent searches.");
        }
        return false;
      } finally {
        if (recentController === activeController) recentController = null;
        if (requestSequence === recentSequence) recentLoadPromise = null;
      }
    })();

    recentLoadPromise = loadPromise;
    return loadPromise;
  }

  async function renderEmptySearchResults(options = {}) {
    const input = searchInput();
    if (!input || input.value.trim()) return false;

    syncClearButton();
    const hasWalletProof = windowFunction("hasWalletProof");
    if (!hasWalletProof?.()) {
      windowFunction("restoreRecentSearchState")?.({
        recentSearchItems: [],
        recentSearchPlayerIds: [],
        recentSearchAgentWallets: [],
      });
      renderSearchMessage("Opt in to load recent searches.");
      return true;
    }

    return restoreSupabaseRecentResults(options);
  }

  async function searchDatabase(rawQuery) {
    installCoreSearchMatching();
    const query = String(rawQuery || "").trim();
    const normalizedQuery = normalize(query);
    const input = searchInput();
    if (!input || !normalizedQuery) return false;

    clearRecentRequest();
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
    syncClearButton();
    const query = String(input.value || "").trim();
    if (!query) {
      clearGlobalRequest();
      clearRecentRequest({ resetLoaded: true });
      void renderEmptySearchResults({ force: true });
      return;
    }
    void searchDatabase(query);
  }

  function onClearClick(event) {
    const target = event.target instanceof Element ? event.target.closest("#playerSearchClearButton") : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = searchInput();
    if (!input) return;

    input.value = "";
    clearGlobalRequest();
    clearRecentRequest({ resetLoaded: true });
    syncClearButton();
    void renderEmptySearchResults({ force: true });
    input.focus({ preventScroll: true });
  }

  function onSearchResultClick(event) {
    const target = event.target instanceof Element
      ? event.target.closest("#playerSearchResults > .searchResult")
      : null;
    if (!target) return;

    queueMicrotask(() => {
      if (destroyed) return;
      const hasWalletProof = windowFunction("hasWalletProof");
      const saveWalletPreferencesNow = windowFunction("saveWalletPreferencesNow");
      if (hasWalletProof?.() && saveWalletPreferencesNow) void saveWalletPreferencesNow();
    });
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
      if (modal.hidden) {
        clearRecentRequest({ resetLoaded: true });
        return;
      }

      const input = searchInput();
      syncClearButton();
      if (input && !input.value.trim()) void renderEmptySearchResults();
      focusAndSelectSearch();
    });
    modalObserver.observe(modal, { attributes: true, attributeFilter: ["hidden"] });
  }

  function onReady() {
    installSupabaseOnlyRecentStorage();
    clearLocalRecentStateOnce();
    installCoreSearchMatching();
    flushPendingPayload();
    flushPendingEvaluationPayload();
    const modal = searchModal();
    const input = searchInput();
    syncClearButton();
    if (modal && !modal.hidden && input && !input.value.trim()) void renderEmptySearchResults();
  }

  installSupabaseOnlyRecentStorage();
  clearLocalRecentStateOnce();
  document.addEventListener("input", onInput, true);
  document.addEventListener("click", onClearClick, true);
  document.addEventListener("click", onSearchResultClick);
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
    clearRecentRequest({ resetLoaded: true });
    clearEvaluationRequest();
    modalObserver?.disconnect();
    modalObserver = null;
    if (focusFrame) cancelAnimationFrame(focusFrame);
    if (focusSettleTimer) clearTimeout(focusSettleTimer);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("click", onClearClick, true);
    document.removeEventListener("click", onSearchResultClick);
    document.removeEventListener("input", onEvaluationInput, true);
    document.removeEventListener("focus", onEvaluationFocus, true);
    window.removeEventListener("mfl:ready", onReady);
    restoreLocalRecentStorageOwners();
  }

  window.__mflGlobalSearchRuntime = Object.freeze({
    version: VERSION,
    search: searchDatabase,
    searchEvaluation: searchEvaluationDatabase,
    recent: restoreSupabaseRecentResults,
    cap: normalizeSearchResults,
    flush: flushPendingPayload,
    flushEvaluation: flushPendingEvaluationPayload,
    focus: focusAndSelectSearch,
    destroy,
  });
})();