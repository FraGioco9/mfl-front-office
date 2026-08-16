(() => {
  "use strict";

  const PLAYER_LABEL_STORAGE_PREFIX = "mfl-evaluation-player-label-v1:";
  const LEGACY_RECENT_STORAGE_KEY = "mfl-recent-evaluation-searches-v1";
  const TABLE_STATE_STORAGE_KEY = "mfl-table-filters-v1";
  const RECENT_ENTRIES_KEY = "__mflEvaluationSupabaseRecentEntries";

  window.__mflEvaluationSearchStateRuntime?.destroy?.();

  let destroyed = false;
  let recentPrimePromise = null;
  let recentPayload = null;
  let recentPayloadSignature = "";
  let recentWriteSequence = 0;

  const originalRecentRule = typeof window.shouldShowEvaluationRecentResults === "function"
    ? window.shouldShowEvaluationRecentResults
    : null;

  const input = () => document.getElementById("evaluationSearchInput");
  const clearButton = () => document.getElementById("evaluationSearchClearButton");
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

  function recentRule() {
    const field = input();
    if (!(field instanceof HTMLInputElement)) return originalRecentRule?.() || false;
    if (field.value.trim()) return originalRecentRule?.() || false;
    return active();
  }

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

  function setRecentEvaluationPlayerIds(ids) {
    const normalizedIds = Array.isArray(ids)
      ? ids.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 5)
      : [];
    window.__mflEvaluationNextRecentIds = normalizedIds;
    try {
      window.eval("if (typeof state === 'object' && state) state.recentEvaluationPlayerIds = [...window.__mflEvaluationNextRecentIds];");
    } catch {} finally {
      delete window.__mflEvaluationNextRecentIds;
    }
    return normalizedIds;
  }

  function promoteRecentEntry(playerId) {
    const key = String(playerId || "").trim();
    if (!key) return;
    window.__mflEvaluationClickedRecentId = key;
    try {
      const entry = window.eval(`(() => {
        if (typeof state !== "object" || !Array.isArray(state.evaluationSearchIndex)) return null;
        return state.evaluationSearchIndex.find((item) => String(item?.playerId || "") === window.__mflEvaluationClickedRecentId) || null;
      })()`);
      if (!entry || entry.retired) return;
      const current = Array.isArray(window[RECENT_ENTRIES_KEY]) ? window[RECENT_ENTRIES_KEY] : [];
      window[RECENT_ENTRIES_KEY] = [
        entry,
        ...current.filter((item) => String(item?.playerId || "") !== key),
      ].slice(0, 5);
    } catch {} finally {
      delete window.__mflEvaluationClickedRecentId;
    }
  }

  function persistRecentEvaluationToSupabase(ids, sequence) {
    window.__mflEvaluationPendingRecentIds = ids;
    let savePromise = Promise.resolve(false);
    try {
      savePromise = window.eval(`(() => {
        if (typeof state !== "object" || !state) return Promise.resolve(false);
        state.recentEvaluationPlayerIds = [...window.__mflEvaluationPendingRecentIds];
        if (state.walletPreferencesSaveTimer) {
          window.clearTimeout(state.walletPreferencesSaveTimer);
          state.walletPreferencesSaveTimer = null;
        }
        if (!state.linkedWalletAddress
          || typeof hasWalletProof !== "function"
          || !hasWalletProof()
          || typeof saveWalletPreferencesNow !== "function") {
          return Promise.resolve(false);
        }
        return Promise.resolve(saveWalletPreferencesNow()).then(() => true, () => false);
      })()`);
    } catch {
      savePromise = Promise.resolve(false);
    } finally {
      delete window.__mflEvaluationPendingRecentIds;
    }

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
      return Boolean(window.eval(`(() => {
        if (typeof recentEvaluationRows !== "function") return false;
        if (recentEvaluationRows.__mflSupabaseOnly) return true;
        const supabaseRecentRows = function() {
          const entries = window.${RECENT_ENTRIES_KEY};
          return Array.isArray(entries) ? entries.slice(0, 5) : [];
        };
        Object.defineProperty(supabaseRecentRows, "__mflSupabaseOnly", { value: true });
        recentEvaluationRows = supabaseRecentRows;
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not install Evaluation recent-row ownership.", error);
      return false;
    }
  }

  function installEmptyPlayerSearchBridge() {
    try {
      return Boolean(window.eval(`(() => {
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
      })()`));
    } catch (error) {
      console.warn("Could not isolate empty Evaluation searches.", error);
      return false;
    }
  }

  function installRecentWriteBridge() {
    try {
      return Boolean(window.eval(`(() => {
        if (typeof rememberEvaluationResult !== "function") return false;
        if (rememberEvaluationResult.__mflSupabaseImmediate) return true;
        const originalRememberEvaluationResult = rememberEvaluationResult;
        const supabaseImmediateRememberEvaluationResult = function(playerId) {
          const result = originalRememberEvaluationResult.apply(this, arguments);
          window.__mflEvaluationSearchStateRuntime?.commitRecentPlayer?.(playerId);
          return result;
        };
        Object.defineProperty(supabaseImmediateRememberEvaluationResult, "__mflSupabaseImmediate", { value: true });
        rememberEvaluationResult = supabaseImmediateRememberEvaluationResult;
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not install Evaluation recent-write ownership.", error);
      return false;
    }
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
    if (!active()) return;
    const field = input();
    if (!(field instanceof HTMLInputElement) || field.value.trim()) return;
    try {
      if (typeof window.renderEvaluationSearchResults === "function") {
        window.renderEvaluationSearchResults();
      } else {
        window.eval("if (typeof renderEvaluationSearchResults === 'function') renderEvaluationSearchResults();");
      }
    } catch (error) {
      console.warn("Could not render recent Evaluation searches.", error);
    }
    syncClearButton(field);
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

  function restoreEmptyRecentResults(force = false) {
    const field = input();
    if (!active() || !(field instanceof HTMLInputElement) || field.value.trim()) return Promise.resolve(false);
    installCoreBridges();
    return primeRecentSearchData({ force });
  }

  function sync() {
    if (destroyed || !active()) return;
    installCoreBridges();
    const field = input();
    if (!(field instanceof HTMLInputElement)) return;
    syncSelectedPlayerLabel(field);
    syncClearButton(field);
    if (!field.value.trim()) void restoreEmptyRecentResults(false);
  }

  function onBlur(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement) || event.target !== field) return;
    syncSelectedPlayerLabel(field);
    syncClearButton(field);
    if (!field.value.trim()) void restoreEmptyRecentResults(false);
  }

  function onKeyUp(event) {
    const field = input();
    if (!(field instanceof HTMLInputElement) || event.target !== field) return;
    syncClearButton(field);
    if (!field.value.trim()) void restoreEmptyRecentResults(false);
  }

  function onClick(event) {
    if (!(event.target instanceof Element)) return;
    const clear = event.target.closest("#evaluationSearchClearButton");
    if (clear instanceof HTMLButtonElement) {
      queueMicrotask(() => void restoreEmptyRecentResults(true));
      return;
    }

    const result = event.target.closest("#evaluationSearchResults .evaluationSearchResult");
    if (!(result instanceof HTMLButtonElement) || result.disabled) return;
    storePlayerLabel(resultId(result), resultName(result));
  }

  function onReady() {
    installCoreBridges();
    void restoreEmptyRecentResults(true);
  }

  purgeLegacyLocalRecentState();
  installCoreBridges();
  syncClearButton();
  input()?.addEventListener("blur", onBlur, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("storage", onLegacyRecentStorage, true);
  window.addEventListener("mfl:evaluation-ready", onReady);
  window.addEventListener("mfl:ready", onReady);
  window.addEventListener("pageshow", onReady);
  void restoreEmptyRecentResults(true);

  function destroy() {
    destroyed = true;
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
    destroy,
  });
})();
