(() => {
  "use strict";

  const PLAYER_LABEL_STORAGE_PREFIX = "mfl-evaluation-player-label-v1:";
  const LEGACY_RECENT_STORAGE_KEY = "mfl-recent-evaluation-searches-v1";
  const TABLE_STATE_STORAGE_KEY = "mfl-table-filters-v1";
  const RECENT_ENTRIES_KEY = "__mflEvaluationSupabaseRecentEntries";

  window.__mflEvaluationSearchStateRuntime?.destroy?.();

  let destroyed = false;
  let recentPrimePromise = null;
  let recentSupabaseRefreshPromise = null;
  let recentPayload = null;
  let recentPayloadSignature = "";
  let recentWriteSequence = 0;
  let recentLoadingActive = document.getElementById("evaluationSearchResults")?.dataset.mflEvaluationRecentLoading === "true";
  let resultPointerDown = false;
  let committingRecentResults = false;

  const originalRecentRule = typeof window.shouldShowEvaluationRecentResults === "function"
    ? window.shouldShowEvaluationRecentResults
    : null;

  const input = () => document.getElementById("evaluationSearchInput");
  const clearButton = () => document.getElementById("evaluationSearchClearButton");
  const active = () => document.body?.dataset.page === "evaluation" || /^\/evaluation\/?$/i.test(location.pathname);
  const coreContracts = () => {
    const contracts = window.__mflCoreContracts;
    return contracts && typeof contracts === "object" ? contracts : null;
  };

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

  function shouldShowTypedResults(field = input()) {
    if (!(field instanceof HTMLInputElement) || !active()) return true;
    if (!field.value.trim()) return true;
    return document.activeElement === field || resultPointerDown;
  }

  function syncTypedResultVisibility(field = input()) {
    if (shouldShowTypedResults(field)) return;
    const results = document.getElementById("evaluationSearchResults");
    if (results instanceof HTMLElement) results.hidden = true;
  }

  function syncClearButton(field = input()) {
    const button = clearButton();
    if (!(field instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) return;
    button.hidden = !(playerSelected() || field.value.trim());
  }

  function recentRule() {
    const field = input();
    if (!(field instanceof HTMLInputElement)) return originalRecentRule?.() || false;
    return active();
  }

  function installRecentRule() {
    if (window.shouldShowEvaluationRecentResults !== recentRule) {
      window.shouldShowEvaluationRecentResults = recentRule;
    }
  }

  function recentLoadingMessageVisible() {
    const results = document.getElementById("evaluationSearchResults");
    if (!(results instanceof HTMLElement) || results.hidden || results.children.length !== 1) return false;
    const hint = results.firstElementChild;
    return hint instanceof HTMLElement
      && hint.classList.contains("searchHint")
      && hint.textContent === "Loading…";
  }

  function renderRecentLoadingMessage(field = input()) {
    if (!active() || !(field instanceof HTMLInputElement) || field.value.trim()) return false;
    if (recentLoadingActive && recentLoadingMessageVisible()) return true;
    const results = document.getElementById("evaluationSearchResults");
    if (!(results instanceof HTMLElement)) return false;
    const hint = document.createElement("div");
    hint.className = "searchHint";
    hint.textContent = "Loading…";
    results.dataset.mflEvaluationRecentLoading = "true";
    results.replaceChildren(hint);
    results.hidden = false;
    recentLoadingActive = true;
    return true;
  }

  function ownsEmptyRecentResults() {
    const field = input();
    return recentLoadingActive
      && active()
      && field instanceof HTMLInputElement
      && !field.value.trim();
  }

  function clearRecentLoadingOwnership() {
    recentLoadingActive = false;
    const results = document.getElementById("evaluationSearchResults");
    if (results instanceof HTMLElement) delete results.dataset.mflEvaluationRecentLoading;
  }

  function waitForSupabaseRecentState(force = false) {
    const ensure = coreContracts()?.ensureEvaluationRecentStateHydrated;
    if (typeof ensure === "function") {
      return Promise.resolve(ensure({ force })).catch((error) => {
        console.warn("Could not load Supabase Evaluation recent-search state.", error);
        return false;
      });
    }

    const pending = window.__mflWalletPreferencesStartupPromise;
    if (pending && typeof pending.then === "function") {
      return Promise.resolve(pending).catch((error) => {
        console.warn("Could not load Supabase Evaluation recent-search state.", error);
        return false;
      });
    }

    if (document.documentElement.dataset.mflReady === "true") return Promise.resolve(false);

    return new Promise((resolve) => {
      window.addEventListener("mfl:ready", () => {
        const lateEnsure = coreContracts()?.ensureEvaluationRecentStateHydrated;
        if (typeof lateEnsure !== "function") {
          resolve(false);
          return;
        }
        Promise.resolve(lateEnsure({ force }))
          .then(resolve)
          .catch((error) => {
            console.warn("Could not load Supabase Evaluation recent-search state.", error);
            resolve(false);
          });
      }, { once: true });
    });
  }

  function resultId(button) {
    if (!(button instanceof HTMLButtonElement)) return "";
    const match = String(button.textContent || "").match(/#(\d+)/);
    return match?.[1] || "";
  }

  function resultName(button) {
    return button instanceof HTMLButtonElement
      ? String(button.querySelector("strong")?.textContent || "").trim()
      : "";
  }

  function storePlayerLabel(playerId, playerName) {
    const id = String(playerId || "").trim();
    const name = String(playerName || "").trim();
    if (!id || !name || name === `Player #${id}`) return;
    try {
      localStorage.setItem(`${PLAYER_LABEL_STORAGE_PREFIX}${id}`, name);
    } catch {}
  }

  function syncSelectedPlayerLabel(field = input()) {
    if (!(field instanceof HTMLInputElement)) return;
    const playerId = selectedPlayerIdFromUrl();
    if (playerId) storePlayerLabel(playerId, field.value);
  }

  function purgeLegacyLocalRecentState() {
    try {
      localStorage.removeItem(LEGACY_RECENT_STORAGE_KEY);
      const savedState = JSON.parse(localStorage.getItem(TABLE_STATE_STORAGE_KEY) || "null");
      if (!savedState || typeof savedState !== "object" || Array.isArray(savedState)
        || !("recentEvaluationPlayerIds" in savedState)) return;
      delete savedState.recentEvaluationPlayerIds;
      localStorage.setItem(TABLE_STATE_STORAGE_KEY, JSON.stringify(savedState));
    } catch {}
  }

  function onLegacyRecentStorage(event) {
    if (event.key !== LEGACY_RECENT_STORAGE_KEY) return;
    try { localStorage.removeItem(LEGACY_RECENT_STORAGE_KEY); } catch {}
  }

  function recentEvaluationPlayerIds() {
    const ids = coreContracts()?.evaluationRecentPlayerIds?.();
    return Array.isArray(ids)
      ? ids.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 5)
      : [];
  }

  function recentStateSettled() {
    return Boolean(coreContracts()?.evaluationRecentStateHydrated?.())
      || document.documentElement.dataset.storedWalletOptIn !== "true";
  }

  function currentRecentEntries() {
    return Array.isArray(window[RECENT_ENTRIES_KEY]) ? window[RECENT_ENTRIES_KEY] : [];
  }

  function recentEntriesMatch(ids, entries = currentRecentEntries()) {
    const expectedIds = Array.isArray(ids)
      ? ids.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 5)
      : [];
    const entryIds = Array.isArray(entries)
      ? entries.map((entry) => String(entry?.playerId || "").trim()).filter(Boolean)
      : [];
    return expectedIds.length === entryIds.length
      && expectedIds.every((id, index) => id === entryIds[index]);
  }

  function recentPayloadMatches(ids, payload = recentPayload) {
    if (!payload) return false;
    return recentEntriesMatch(ids, buildRecentEntries(payload));
  }

  function setRecentEvaluationPlayerIds(ids) {
    const normalizedIds = Array.isArray(ids)
      ? ids.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 5)
      : [];
    const storedIds = coreContracts()?.setEvaluationRecentPlayerIds?.(normalizedIds);
    return Array.isArray(storedIds) ? storedIds : normalizedIds;
  }

  function promoteRecentEntry(playerId) {
    const key = String(playerId || "").trim();
    if (!key) return;
    const entry = coreContracts()?.evaluationSearchEntry?.(key);
    if (!entry || entry.retired) return;
    const current = currentRecentEntries();
    window[RECENT_ENTRIES_KEY] = [
      entry,
      ...current.filter((item) => String(item?.playerId || "") !== key),
    ].slice(0, 5);
  }

  function persistRecentEvaluationToSupabase(ids, sequence) {
    const savePromise = coreContracts()?.persistEvaluationRecentPlayerIds?.(ids) || Promise.resolve(false);
    return Promise.resolve(savePromise).finally(() => {
      if (destroyed || sequence !== recentWriteSequence) return;
      setRecentEvaluationPlayerIds(ids);
      recentPayload = null;
      recentPayloadSignature = "";
      void primeRecentSearchData({ force: true });
    });
  }

  function commitRecentPlayer(playerId) {
    const key = String(playerId || "").trim();
    if (!key) return;
    const currentIds = recentEvaluationPlayerIds();
    const nextIds = setRecentEvaluationPlayerIds([
      key,
      ...currentIds.filter((id) => id !== key),
    ].slice(0, 5));
    promoteRecentEntry(key);
    recentPayload = null;
    recentPayloadSignature = "";
    const sequence = ++recentWriteSequence;
    queueMicrotask(() => {
      if (destroyed || sequence !== recentWriteSequence) return;
      void primeRecentSearchData({ force: true });
      void persistRecentEvaluationToSupabase(nextIds, sequence);
    });
  }

  function buildRecentEntries(payload) {
    const entries = coreContracts()?.buildEvaluationRecentEntries?.(payload);
    return Array.isArray(entries) ? entries : [];
  }

  function installCoreRecentRowsBridge() {
    const install = coreContracts()?.installEvaluationRecentRowsOwner;
    return typeof install === "function"
      ? Boolean(install(() => window[RECENT_ENTRIES_KEY]))
      : false;
  }

  function installEmptyPlayerSearchBridge() {
    const install = coreContracts()?.installEvaluationEmptySearchOwner;
    if (typeof install !== "function") return false;
    return Boolean(install((force) => {
      if (committingRecentResults) return Promise.resolve(true);
      const restore = window.__mflEvaluationSearchStateRuntime?.restoreEmptyRecentResults;
      return typeof restore === "function" ? restore(Boolean(force)) : Promise.resolve(false);
    }));
  }

  function installRecentWriteBridge() {
    const install = coreContracts()?.installEvaluationRecentWriteOwner;
    if (typeof install !== "function") return false;
    return Boolean(install((playerId) => {
      window.__mflEvaluationSearchStateRuntime?.commitRecentPlayer?.(playerId);
    }));
  }

  function installCoreBridges() {
    installRecentRule();
    installCoreRecentRowsBridge();
    installEmptyPlayerSearchBridge();
    installRecentWriteBridge();
  }

  function publishRecentPayload(payload) {
    const entries = buildRecentEntries(payload);
    window[RECENT_ENTRIES_KEY] = entries;
    installCoreRecentRowsBridge();
    return entries;
  }

  function renderEmptySearchFromCore(expectedIds = recentEvaluationPlayerIds()) {
    if (!active()) {
      clearRecentLoadingOwnership();
      return false;
    }
    const field = input();
    if (!(field instanceof HTMLInputElement) || field.value.trim()) {
      clearRecentLoadingOwnership();
      return false;
    }
    if (!recentStateSettled() || !recentEntriesMatch(expectedIds)) {
      renderRecentLoadingMessage(field);
      return false;
    }
    committingRecentResults = true;
    try {
      const committed = coreContracts()?.renderCurrentEvaluationSearchResults?.({ releaseRecentLoading: true });
      if (!committed) return false;
      clearRecentLoadingOwnership();
    } catch (error) {
      console.warn("Could not render recent Evaluation searches.", error);
      return false;
    } finally {
      committingRecentResults = false;
    }
    syncClearButton(field);
    return true;
  }

  async function fetchRecentEvaluationPayload(ids) {
    if (!ids.length) return { columns: [], rows: [] };
    const url = new URL("/api/data", window.location.origin);
    url.searchParams.set("mode", "search");
    url.searchParams.set("type", "recent");
    url.searchParams.set("playerIds", ids.join(","));
    try {
      const response = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return { columns: [], rows: [] };
      const payload = await response.json().catch(() => ({}));
      const players = payload?.players;
      const columns = Array.isArray(players?.columns) ? players.columns : [];
      const rows = Array.isArray(players?.rows) ? players.rows : [];
      const idIndex = columns.indexOf("player_id");
      if (idIndex < 0) return { columns, rows: [] };
      const rowsById = new Map(rows
        .filter(Array.isArray)
        .map((row) => [String(row[idIndex]), row]));
      return { columns, rows: ids.map((id) => rowsById.get(id)).filter(Boolean) };
    } catch {
      return { columns: [], rows: [] };
    }
  }

  function primeRecentSearchData({ force = false, showLoading = false, refreshSupabase = false } = {}) {
    if (recentPrimePromise) {
      if (showLoading) renderRecentLoadingMessage(input());
      if (!refreshSupabase) return recentPrimePromise;
      if (!recentSupabaseRefreshPromise) {
        recentSupabaseRefreshPromise = recentPrimePromise
          .then(() => {
            if (destroyed) return false;
            return primeRecentSearchData({ force, showLoading: false, refreshSupabase: true });
          })
          .finally(() => {
            recentSupabaseRefreshPromise = null;
          });
      }
      return recentSupabaseRefreshPromise;
    }

    const currentIds = recentEvaluationPlayerIds();
    const currentSignature = currentIds.join(",");
    if (!force
      && !refreshSupabase
      && recentStateSettled()
      && recentPayload
      && recentPayloadSignature === currentSignature
      && recentPayloadMatches(currentIds)) {
      publishRecentPayload(recentPayload);
      return Promise.resolve(renderEmptySearchFromCore(currentIds));
    }

    if (showLoading || recentLoadingActive) renderRecentLoadingMessage(input());
    recentPrimePromise = waitForSupabaseRecentState(refreshSupabase)
      .then(() => {
        const ids = recentEvaluationPlayerIds();
        const signature = ids.join(",");
        if (!recentStateSettled()) {
          renderRecentLoadingMessage(input());
          return false;
        }
        if (!force
          && recentPayload
          && recentPayloadSignature === signature
          && recentPayloadMatches(ids)) {
          publishRecentPayload(recentPayload);
          return renderEmptySearchFromCore(ids);
        }

        recentPayloadSignature = signature;
        return fetchRecentEvaluationPayload(ids).then((payload) => {
          if (destroyed || recentPayloadSignature !== signature) return false;
          recentPayload = payload;
          publishRecentPayload(payload);
          const rendered = renderEmptySearchFromCore(ids);
          if (!rendered && ids.length) renderRecentLoadingMessage(input());
          return rendered;
        });
      })
      .catch((error) => {
        console.warn("Could not prime recent Evaluation searches.", error);
        renderRecentLoadingMessage(input());
        return false;
      })
      .finally(() => {
        recentPrimePromise = null;
        const fieldNow = input();
        if (!active() || !(fieldNow instanceof HTMLInputElement) || fieldNow.value.trim()) {
          recentLoadingActive = false;
        }
      });
    return recentPrimePromise;
  }

  function restoreEmptyRecentResults(force = false, showLoading = true, refreshSupabase = false) {
    const field = input();
    if (!active() || !(field instanceof HTMLInputElement) || field.value.trim()) return Promise.resolve(false);
    installCoreBridges();
    const recentStateReady = recentStateSettled();
    const currentIds = recentEvaluationPlayerIds();
    const currentSignature = currentIds.join(",");
    let cachedReady = Boolean(
      recentStateReady
      && !force
      && recentPayload
      && recentPayloadSignature === currentSignature
      && recentPayloadMatches(currentIds)
    );
    let matchingEntriesReady = false;
    if (cachedReady) {
      publishRecentPayload(recentPayload);
      cachedReady = renderEmptySearchFromCore(currentIds);
    } else if (!force && recentStateReady && currentIds.length) {
      matchingEntriesReady = recentEntriesMatch(currentIds);
      if (matchingEntriesReady) matchingEntriesReady = renderEmptySearchFromCore(currentIds);
    }
    const primePromise = primeRecentSearchData({
      force,
      showLoading: Boolean(showLoading && !cachedReady && !matchingEntriesReady),
      refreshSupabase,
    });
    if (cachedReady || matchingEntriesReady) return Promise.resolve(true);
    return Promise.resolve(primePromise).then((rendered) => Boolean(rendered));
  }

  function sync() {
    if (destroyed || !active()) return;
    installCoreBridges();
    const field = input();
    if (!(field instanceof HTMLInputElement)) return;
    syncSelectedPlayerLabel(field);
    syncClearButton(field);
    syncTypedResultVisibility(field);
  }

  function selectEmptySearch() {
    const field = input();
    if (!(field instanceof HTMLInputElement)
      || !active()
      || playerSelected()
      || field.value.trim()
      || window.__mflInteractionBusy?.isBusy?.()) return false;

    field.focus({ preventScroll: true });
    field.select();
    return document.activeElement === field;
  }

  function onPointerDown(event) {
    resultPointerDown = event.target instanceof Element
      && Boolean(event.target.closest("#evaluationSearchResults .evaluationSearchResult"));
    if (resultPointerDown || !(event.target instanceof Element)) return;
    const title = event.target.closest(".evaluationSearch .field > span");
    if (title instanceof HTMLElement) event.preventDefault();
  }

  function onPointerUp() {
    resultPointerDown = false;
  }

  function onFocus(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement) || event.target !== field) return;
    syncClearButton(field);
    if (!field.value.trim()) {
      void restoreEmptyRecentResults(false);
      return;
    }
    coreContracts()?.renderCurrentEvaluationSearchResults?.();
  }

  function onBlur(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement) || event.target !== field) return;
    syncSelectedPlayerLabel(field);
    syncClearButton(field);
    syncTypedResultVisibility(field);
  }

  function onKeyUp(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement) || event.target !== field) return;
    syncClearButton(field);
    if (field.value.trim()) {
      return;
    }
    void restoreEmptyRecentResults(false);
  }

  function onClick(event) {
    if (!(event.target instanceof Element)) return;
    const title = event.target.closest(".evaluationSearch .field > span");
    if (title instanceof HTMLElement) {
      event.preventDefault();
      return;
    }

    const clear = event.target.closest("#evaluationSearchClearButton");
    if (clear instanceof HTMLButtonElement) {
      queueMicrotask(() => {
        selectEmptySearch();
      });
      return;
    }

    const result = event.target.closest("#evaluationSearchResults .evaluationSearchResult");
    if (!(result instanceof HTMLButtonElement) || result.disabled) return;
    storePlayerLabel(resultId(result), resultName(result));
  }

  function onReady() {
    installCoreBridges();
    const field = input();
    if (field instanceof HTMLInputElement) {
      syncClearButton(field);
      syncTypedResultVisibility(field);
    }
  }

  purgeLegacyLocalRecentState();
  installCoreBridges();
  syncClearButton();
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerup", onPointerUp, true);
  input()?.addEventListener("focus", onFocus, true);
  input()?.addEventListener("blur", onBlur, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("storage", onLegacyRecentStorage, true);
  window.addEventListener("mfl:evaluation-ready", onReady);
  window.addEventListener("mfl:ready", onReady);
  window.addEventListener("pageshow", onReady);

  function destroy() {
    destroyed = true;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    input()?.removeEventListener("focus", onFocus, true);
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
    clearRecentLoadingOwnership();
    resultPointerDown = false;
    recentWriteSequence += 1;
    delete window[RECENT_ENTRIES_KEY];
    if (originalRecentRule && window.shouldShowEvaluationRecentResults === recentRule) {
      window.shouldShowEvaluationRecentResults = originalRecentRule;
    }
  }

  window.__mflEvaluationSearchStateRuntime = Object.freeze({
    sync,
    restoreEmptyRecentResults,
    commitRecentPlayer,
    selectEmptySearch,
    shouldShowTypedResults,
    ownsEmptyRecentResults,
    destroy,
  });
})();