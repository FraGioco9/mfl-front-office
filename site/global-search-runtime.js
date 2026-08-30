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
    "mfl-recent-search-clubs",
  ]);
  window.__mflGlobalSearchRuntime?.destroy?.();

  let controller = null;
  let sequence = 0;
  let recentController = null;
  let recentSequence = 0;
  let recentLoadPromise = null;
  let recentLoadedForSession = false;
  let recentLoadFailed = false;
  let canonicalRecentItems = [];
  let canonicalRecentResults = new Map();
  let canonicalRecentPayload = null;
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

  function renderSettledTypedSearchEmptyState(normalizedQuery) {
    const input = searchInput();
    const results = searchResults();
    if (!input || !results || !normalizedQuery || normalize(input.value) !== normalizedQuery) return false;
    if (results.querySelector(":scope > .searchResult")) return false;
    renderSearchMessage("No players, clubs, or agents found.");
    return true;
  }

  function normalizeSearchResults() {
    const input = searchInput();
    const results = searchResults();
    if (!input || !results) return;

    const hasQuery = Boolean(input.value.trim());
    const maxResults = hasQuery ? MAX_GLOBAL_SEARCH_RESULTS : MAX_RECENT_GLOBAL_SEARCH_RESULTS;
    const directResults = Array.from(results.querySelectorAll(":scope > .searchResult"));
    directResults.slice(maxResults).forEach((result) => result.remove());
    results.classList.remove("filledSearchResults");
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

  function recentStateFromItems(items) {
    const recentItems = Array.isArray(items)
      ? items.map((item) => String(item || "").trim()).filter(Boolean).slice(0, MAX_RECENT_GLOBAL_SEARCH_RESULTS)
      : [];
    return {
      recentSearchItems: recentItems,
      recentSearchPlayerIds: recentItems
        .filter((item) => item.startsWith("player:"))
        .map((item) => item.slice(7)),
      recentSearchAgentWallets: recentItems
        .filter((item) => item.startsWith("agent:"))
        .map((item) => item.slice(6)),
    };
  }

  function recentIdentifiers(items = canonicalRecentItems) {
    const identifiers = { playerIds: [], walletAddresses: [], clubIds: [] };
    items.forEach((item) => {
      const key = String(item || "").trim();
      if (key.startsWith("player:")) identifiers.playerIds.push(key.slice(7));
      else if (key.startsWith("agent:")) identifiers.walletAddresses.push(key.slice(6));
      else if (key.startsWith("club:")) identifiers.clubIds.push(key.slice(5));
    });
    return identifiers;
  }

  function applyRecentItemsToCore(items = canonicalRecentItems) {
    windowFunction("restoreRecentSearchState")?.(recentStateFromItems(items));
  }

  function captureCanonicalRecentResults() {
    const results = searchResults();
    if (!results || !canonicalRecentItems.length) return false;
    const allowed = new Set(canonicalRecentItems);
    Array.from(results.querySelectorAll(":scope > .searchResult")).forEach((result) => {
      const key = String(result.dataset.searchKey || "").trim();
      if (key && allowed.has(key)) canonicalRecentResults.set(key, result);
    });
    return canonicalRecentItems.every((key) => canonicalRecentResults.has(key));
  }

  function renderCanonicalRecentResults() {
    const input = searchInput();
    const results = searchResults();
    if (!recentLoadedForSession || !input || input.value.trim() || !results) return false;
    const ordered = canonicalRecentItems
      .map((key) => canonicalRecentResults.get(key))
      .filter((result) => result instanceof HTMLElement);
    if (ordered.length !== canonicalRecentItems.length) return false;
    results.replaceChildren(...ordered);
    results.classList.remove("filledSearchResults");
    syncClearButton();
    return true;
  }

  function publishCanonicalRecentPayload() {
    const input = searchInput();
    const applySearchPayload = coreContracts()?.applySearchPayload;
    if (!canonicalRecentPayload || !input || input.value.trim() || typeof applySearchPayload !== "function") return false;

    installCoreSearchMatching();
    applySearchPayload(canonicalRecentPayload, "all");
    applyRecentItemsToCore();
    renderCurrentResults();
    captureCanonicalRecentResults();
    return renderCanonicalRecentResults();
  }

  function promoteCanonicalRecentResult(result) {
    if (!(result instanceof HTMLElement)) return false;
    const key = String(result.dataset.searchKey || "").trim();
    if (!key) return false;
    canonicalRecentItems = [
      key,
      ...canonicalRecentItems.filter((item) => item !== key),
    ].slice(0, MAX_RECENT_GLOBAL_SEARCH_RESULTS);
    canonicalRecentResults.set(key, result);
    Array.from(canonicalRecentResults.keys()).forEach((cachedKey) => {
      if (!canonicalRecentItems.includes(cachedKey)) canonicalRecentResults.delete(cachedKey);
    });
    applyRecentItemsToCore();
    purgeLocalGlobalSearchHistory();
    return true;
  }

  function applySupabaseRecentState(tableState) {
    canonicalRecentItems = normalizedSupabaseRecentItems(tableState);
    canonicalRecentResults = new Map();
    canonicalRecentPayload = null;
    applyRecentItemsToCore();
    return canonicalRecentItems;
  }

  async function fetchCanonicalRecentPayload(signal) {
    const identifiers = recentIdentifiers();
    const parameters = new URLSearchParams({ mode: "search", type: "recent", v: VERSION });
    if (identifiers.playerIds.length) parameters.set("playerIds", identifiers.playerIds.join(","));
    if (identifiers.walletAddresses.length) parameters.set("walletAddresses", identifiers.walletAddresses.join(","));
    if (identifiers.clubIds.length) parameters.set("clubIds", identifiers.clubIds.join(","));

    const response = await fetch(`/api/data?${parameters}`, {
      cache: "no-store",
      headers: { Accept: "application/json", "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
      signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Could not resolve recent searches.");
    return payload;
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
    renderSettledTypedSearchEmptyState(normalizedQuery);
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

  function clearRecentRequest() {
    recentSequence += 1;
    recentController?.abort();
    recentController = null;
    recentLoadPromise = null;
  }

  async function hydrateSupabaseRecentResults() {
    const hasWalletProof = windowFunction("hasWalletProof");
    const walletProofHeaders = windowFunction("walletProofHeaders");
    if (!hasWalletProof || !walletProofHeaders || !hasWalletProof()) return false;
    if (recentLoadedForSession) return true;
    if (recentLoadPromise) return recentLoadPromise;

    const requestSequence = ++recentSequence;
    recentController = new AbortController();
    const activeController = recentController;
    recentLoadFailed = false;

    const loadPromise = (async () => {
      try {
        const response = await fetch("/api/wallet-preferences", {
          cache: "no-store",
          headers: walletProofHeaders(true),
          signal: activeController.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Could not load recent searches.");
        if (destroyed || requestSequence !== recentSequence) return false;

        applySupabaseRecentState(data?.tableState);
        canonicalRecentPayload = await fetchCanonicalRecentPayload(activeController.signal);
        if (destroyed || requestSequence !== recentSequence) return false;

        recentLoadedForSession = true;
        recentLoadFailed = false;
        publishCanonicalRecentPayload();
        return true;
      } catch (error) {
        if (error?.name !== "AbortError" && !destroyed && requestSequence === recentSequence) {
          recentLoadFailed = true;
          console.warn("Could not preload recent Global Search entries from Supabase.", error);
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

  function preloadRecentResults() {
    installSupabaseOnlyRecentStorage();
    clearLocalRecentStateOnce();
    installCoreSearchMatching();
    return hydrateSupabaseRecentResults();
  }

  async function restoreSupabaseRecentResults() {
    const input = searchInput();
    if (!input || input.value.trim()) return false;

    const hasWalletProof = windowFunction("hasWalletProof");
    if (!hasWalletProof?.()) return false;

    const pendingRecentLoad = recentLoadPromise;
    if (!recentLoadedForSession && pendingRecentLoad) await pendingRecentLoad;
    if (!recentLoadedForSession || input.value.trim()) {
      if (!input.value.trim()) {
        renderSearchMessage(recentLoadFailed ? "Could not load recent searches." : "Loading recent searches…");
      }
      return false;
    }

    applyRecentItemsToCore();
    if (renderCanonicalRecentResults()) return true;
    if (publishCanonicalRecentPayload()) return true;
    renderCurrentResults();
    captureCanonicalRecentResults();
    return true;
  }

  async function renderEmptySearchResults() {
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

    return restoreSupabaseRecentResults();
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
    syncClearButton();
    const query = String(input.value || "").trim();
    if (!query) {
      clearGlobalRequest();
      void renderEmptySearchResults();
      return;
    }
    captureCanonicalRecentResults();
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
    syncClearButton();
    void renderEmptySearchResults();
    input.focus({ preventScroll: true });
  }

  function searchResultTarget(event) {
    const target = event.target instanceof Element
      ? event.target.closest("#playerSearchResults > .searchResult")
      : null;
    return target instanceof HTMLElement ? target : null;
  }

  function flushCanonicalRecentState() {
    const hasWalletProof = windowFunction("hasWalletProof");
    const saveWalletPreferencesNow = windowFunction("saveWalletPreferencesNow");
    purgeLocalGlobalSearchHistory();
    if (hasWalletProof?.() && saveWalletPreferencesNow) void saveWalletPreferencesNow();
  }

  function onAgentSearchResultClickCapture(event) {
    const target = searchResultTarget(event);
    if (!target) return;

    const searchKey = String(target.dataset.searchKey || "").trim();
    if (!searchKey.startsWith("agent:")) return;

    const walletAddress = searchKey.slice(6).trim().toLowerCase();
    const setPage = windowFunction("setPage");
    const closeSearch = windowFunction("closeSearch");
    if (!walletAddress || !setPage || !closeSearch) return;

    event.preventDefault();
    event.stopPropagation();
    closeSearch();

    const mflWalletAddress = String(window.__mflAppConfig?.routes?.mflWalletAddress || "").trim().toLowerCase();
    const pageName = walletAddress === mflWalletAddress ? "mfl" : "agents";
    const options = pageName === "mfl"
      ? { view: "attributes" }
      : { walletAddress, view: "attributes" };
    void Promise.resolve(setPage(pageName, true, options)).catch((error) => {
      console.error(error?.message || "Could not open Agent page.");
    });
    flushCanonicalRecentState();
  }

  function onSearchResultClickCapture(event) {
    const target = searchResultTarget(event);
    if (!target || !recentLoadedForSession) return;
    promoteCanonicalRecentResult(target);
  }

  function onSearchResultClick(event) {
    const target = searchResultTarget(event);
    if (!target) return;

    if (recentLoadedForSession) {
      flushCanonicalRecentState();
      return;
    }

    const pendingRecentLoad = recentLoadPromise;
    if (!pendingRecentLoad) return;
    void pendingRecentLoad.then((loaded) => {
      if (destroyed || !loaded) return;
      promoteCanonicalRecentResult(target);
      flushCanonicalRecentState();
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
      if (modal.hidden) return;

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
    const input = searchInput();
    syncClearButton();
    void preloadRecentResults().then(() => {
      const modal = searchModal();
      if (modal && !modal.hidden && input && !input.value.trim()) void renderEmptySearchResults();
    });
  }

  installSupabaseOnlyRecentStorage();
  clearLocalRecentStateOnce();
  document.addEventListener("input", onInput, true);
  document.addEventListener("click", onClearClick, true);
  document.addEventListener("click", onSearchResultClickCapture, true);
  document.addEventListener("click", onAgentSearchResultClickCapture, true);
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
    clearRecentRequest();
    clearEvaluationRequest();
    modalObserver?.disconnect();
    modalObserver = null;
    canonicalRecentItems = [];
    canonicalRecentResults.clear();
    canonicalRecentPayload = null;
    if (focusFrame) cancelAnimationFrame(focusFrame);
    if (focusSettleTimer) clearTimeout(focusSettleTimer);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("click", onClearClick, true);
    document.removeEventListener("click", onSearchResultClickCapture, true);
    document.removeEventListener("click", onAgentSearchResultClickCapture, true);
    document.removeEventListener("click", onSearchResultClick);
    document.removeEventListener("input", onEvaluationInput, true);
    document.removeEventListener("focus", onEvaluationFocus, true);
    window.removeEventListener("mfl:ready", onReady);
    restoreLocalRecentStorageOwners();
  }

  window.__mflGlobalSearchRuntime = Object.freeze({
    version: VERSION,
    preload: preloadRecentResults,
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