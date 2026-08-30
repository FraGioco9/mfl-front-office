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
  let recentLoadingActive = false;
  let resultPointerDown = false;
  let directPointerFocus = false;
  let directPointerFocusResetTimer = 0;

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
    if (!field.value.trim() || !playerSelected()) return true;
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

  function waitForSupabaseRecentState(force = false) {
    if (force) {
      const ensure = coreContracts()?.ensureEvaluationRecentStateHydrated;
      if (typeof ensure === "function") {
        return Promise.resolve(ensure({ force: true })).catch((error) => {
          console.warn("Could not refresh Supabase Evaluation recent-search state.", error);
        });
      }
    }

    const pending = window.__mflWalletPreferencesStartupPromise;
    if (!pending || typeof pending.then !== "function") return Promise.resolve();
    return Promise.resolve(pending).catch((error) => {
      console.warn("Could not load Supabase Evaluation recent-search state.", error);
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
    const current = Array.isArray(window[RECENT_ENTRIES_KEY]) ? window[RECENT_ENTRIES_KEY] : [];
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
    window[RECENT_ENTRIES_KEY] = buildRecentEntries(payload);
    installCoreRecentRowsBridge();
  }

  function renderEmptySearchFromCore() {
    if (!active()) {
      recentLoadingActive = false;
      return false;
    }
    const field = input();
    if (!(field instanceof HTMLInputElement) || field.value.trim()) {
      recentLoadingActive = false;
      return false;
    }
    recentLoadingActive = false;
    try {
      coreContracts()?.renderCurrentEvaluationSearchResults?.();
    } catch (error) {
      console.warn("Could not render recent Evaluation searches.", error);
      return false;
    }
    syncClearButton(field);
    return true;
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
        const response = await fetch(url.toString(), { cache: "no-store", headers: { Accept: "application/json" } });
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
    return { columns, rows: ids.map((id) => rowsById.get(id)).filter(Boolean) };
  }

  function primeRecentSearchData({ force = false, showLoading = false, refreshSupabase = false } = {}) {
    const field = input();
    if (recentPrimePromise) {
      if (showLoading) renderRecentLoadingMessage(field);
      if (!refreshSupabase) return recentPrimePromise;
      if (!recentSupabaseRefreshPromise) {
        recentSupabaseRefreshPromise = recentPrimePromise
          .then(() => {
            if (destroyed) return false;
            return primeRecentSearchData({ force, showLoading, refreshSupabase: true });
          })
          .finally(() => {
            recentSupabaseRefreshPromise = null;
          });
      }
      return recentSupabaseRefreshPromise;
    }

    const currentIds = recentEvaluationPlayerIds();
    const currentSignature = currentIds.join(",");
    if (!force && !refreshSupabase && recentPayload && recentPayloadSignature === currentSignature) {
      publishRecentPayload(recentPayload);
      return Promise.resolve(renderEmptySearchFromCore());
    }

    if (showLoading) renderRecentLoadingMessage(field);
    recentPrimePromise = waitForSupabaseRecentState(refreshSupabase)
      .then(() => {
        const ids = recentEvaluationPlayerIds();
        const signature = ids.join(",");
        if (!force && recentPayload && recentPayloadSignature === signature) {
          publishRecentPayload(recentPayload);
          return renderEmptySearchFromCore();
        }

        recentPayloadSignature = signature;
        return fetchRecentEvaluationPayload(ids).then((payload) => {
          if (destroyed || recentPayloadSignature !== signature) return false;
          recentPayload = payload;
          publishRecentPayload(payload);
          return renderEmptySearchFromCore();
        });
      })
      .catch((error) => {
        console.warn("Could not prime recent Evaluation searches.", error);
        return renderEmptySearchFromCore();
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

  function restoreEmptyRecentResults(force = false, showLoading = false, refreshSupabase = false) {
    const field = input();
    if (!active() || !(field instanceof HTMLInputElement) || field.value.trim()) return Promise.resolve(false);
    installCoreBridges();
    const currentSignature = recentEvaluationPlayerIds().join(",");
    const hasReadyRecentPayload = !force && recentPayload && recentPayloadSignature === currentSignature;
    return primeRecentSearchData({
      force,
      showLoading: showLoading || !hasReadyRecentPayload,
      refreshSupabase,
    });
  }

  function sync() {
    if (destroyed || !active()) return;
    installCoreBridges();
    const field = input();
    if (!(field instanceof HTMLInputElement)) return;
    syncSelectedPlayerLabel(field);
    syncClearButton(field);
    syncTypedResultVisibility(field);
    if (!field.value.trim()) void restoreEmptyRecentResults(false, true);
  }

  function clearDirectPointerFocus() {
    directPointerFocus = false;
    if (directPointerFocusResetTimer) window.clearTimeout(directPointerFocusResetTimer);
    directPointerFocusResetTimer = 0;
  }

  function selectEmptySearch() {
    const field = input();
    if (!(field instanceof HTMLInputElement)
      || !active()
      || playerSelected()
      || field.value.trim()
      || window.__mflInteractionBusy?.isBusy?.()) return false;

    directPointerFocus = true;
    try {
      field.focus({ preventScroll: true });
      field.select();
      return document.activeElement === field;
    } finally {
      clearDirectPointerFocus();
    }
  }

  function onPointerDown(event) {
    const field = input();
    clearDirectPointerFocus();
    resultPointerDown = event.target instanceof Element
      && Boolean(event.target.closest("#evaluationSearchResults .evaluationSearchResult"));
    if (resultPointerDown) return;
    if (event.target instanceof Element) {
      const title = event.target.closest(".evaluationSearch .field > span");
      if (title instanceof HTMLElement) {
        event.preventDefault();
        return;
      }
    }
    if (!(field instanceof HTMLInputElement) || event.target !== field) return;
    directPointerFocus = true;
    directPointerFocusResetTimer = window.setTimeout(clearDirectPointerFocus, 0);
  }

  function onPointerUp() {
    resultPointerDown = false;
  }

  function onRecentLoadingFocusCapture(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement)
      || event.target !== field
      || !recentLoadingActive
      || field.value.trim()) return;
    event.stopImmediatePropagation();
    clearDirectPointerFocus();
    syncClearButton(field);
  }

  function onRecentLoadingBlurCapture(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement)
      || event.target !== field
      || !recentLoadingActive
      || field.value.trim()) return;
    event.stopImmediatePropagation();
    syncClearButton(field);
  }

  function onFocus(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement) || event.target !== field) return;
    if (!directPointerFocus) {
      event.stopImmediatePropagation();
      field.blur();
      return;
    }
    clearDirectPointerFocus();
    syncClearButton(field);
    if (!field.value.trim()) {
      if (recentLoadingActive) return;
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
      recentLoadingActive = false;
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
    void restoreEmptyRecentResults(false);
  }

  function onRouteActive() {
    if (destroyed || !active()) return;
    installCoreBridges();
    const field = input();
    if (!(field instanceof HTMLInputElement)) return;
    syncSelectedPlayerLabel(field);
    syncClearButton(field);
    syncTypedResultVisibility(field);
    if (!field.value.trim()) void restoreEmptyRecentResults(false, true);
  }

  purgeLegacyLocalRecentState();
  installCoreBridges();
  syncClearButton();
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("focus", onRecentLoadingFocusCapture, true);
  document.addEventListener("blur", onRecentLoadingBlurCapture, true);
  input()?.addEventListener("focus", onFocus, true);
  input()?.addEventListener("blur", onBlur, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("storage", onLegacyRecentStorage, true);
  window.addEventListener("mfl:evaluation-ready", onReady);
  window.addEventListener("mfl:evaluation-route-active", onRouteActive);
  window.addEventListener("mfl:ready", onReady);
  window.addEventListener("pageshow", onReady);

  function destroy() {
    destroyed = true;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("focus", onRecentLoadingFocusCapture, true);
    document.removeEventListener("blur", onRecentLoadingBlurCapture, true);
    input()?.removeEventListener("focus", onFocus, true);
    input()?.removeEventListener("blur", onBlur, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("storage", onLegacyRecentStorage, true);
    window.removeEventListener("mfl:evaluation-ready", onReady);
    window.removeEventListener("mfl:evaluation-route-active", onRouteActive);
    window.removeEventListener("mfl:ready", onReady);
    window.removeEventListener("pageshow", onReady);
    clearDirectPointerFocus();
    recentPrimePromise = null;
    recentPayload = null;
    recentPayloadSignature = "";
    recentLoadingActive = false;
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
    ownsEmptyRecentResults,
    shouldShowTypedResults,
    destroy,
  });
})();
